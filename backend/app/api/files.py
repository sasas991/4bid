"""
File storage endpoints backed by LocalStack S3.

Every completed upload is recorded in the `files` DB table so any entity
(auction, user profile, …) can reference it by integer ID instead of a raw
S3 key.

Endpoints
─────────
POST   /files/upload                 Simple upload (multipart/form-data) → FileUploadResponse
GET    /files/download               Presigned download URL redirect  (?key=…)
GET    /files/{file_id}              File metadata + fresh presigned URL

POST   /files/multipart/init         Start a multipart upload  → {upload_id, key}
POST   /files/multipart/part         Upload one part           → {part_number, etag}
POST   /files/multipart/complete     Finalize upload + persist DB record → FileUploadResponse
GET    /files/multipart/recover      List already-uploaded parts for a stalled upload
DELETE /files/multipart/abort        Abort and clean up an incomplete multipart upload
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from botocore.exceptions import ClientError

from ..core.database import get_db
from ..core import security
from ..models.models import FileRecord, User
from ..services import s3_service
from .dtos import (
    FileUploadResponse,
    MultipartInitRequest,
    MultipartInitResponse,
    PartUploadResponse,
    CompletePart,
    MultipartCompleteRequest,
)

router = APIRouter(prefix="/files", tags=["files"])


def _persist_file_record(
    db: Session,
    s3_key: str,
    original_filename: str,
    content_type: str,
    size_bytes: int | None,
    uploaded_by_id: int | None,
) -> FileRecord:
    record = FileRecord(
        s3_key=s3_key,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        uploaded_by_id=uploaded_by_id,
    )
    db.add(record)
    db.flush()
    db.refresh(record)
    return record


def _to_response(record: FileRecord) -> FileUploadResponse:
    return FileUploadResponse(
        id=record.id,
        s3_key=record.s3_key,
        original_filename=record.original_filename,
        content_type=record.content_type,
        size_bytes=record.size_bytes,
        url=s3_service.get_presigned_download_url(record.s3_key),
    )


# ── Simple upload ────────────────────────────────────────────────────────────

@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload any file. Returns a DB record ID + presigned URL.
    Use the returned `id` when creating an auction (image_file_id) or
    updating a profile (avatar_file_id).
    """
    data = await file.read()
    filename = file.filename or "file"
    content_type = file.content_type or "application/octet-stream"
    key = s3_service.make_key(filename)

    try:
        s3_service.upload_file(data, key, content_type)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))

    record = _persist_file_record(db, key, filename, content_type, len(data), current_user.id)
    return _to_response(record)


# ── Download / metadata ──────────────────────────────────────────────────────

@router.get("/download")
def download_file(key: str = Query(..., description="S3 key returned by any upload endpoint")):
    """Redirect to a presigned S3 download URL (valid 1 hour)."""
    try:
        url = s3_service.get_presigned_download_url(key)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail=str(e))
    return RedirectResponse(url)


@router.get("/{file_id}", response_model=FileUploadResponse)
def get_file(file_id: int, db: Session = Depends(get_db)):
    """Return file metadata and a fresh presigned download URL."""
    record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return _to_response(record)


# ── Multipart upload ─────────────────────────────────────────────────────────

@router.post("/multipart/init", response_model=MultipartInitResponse)
def multipart_init(
    body: MultipartInitRequest,
    _: User = Depends(security.get_current_user),
):
    """
    Start a multipart upload session.
    Returns upload_id and key — keep both to upload parts and finalize.
    The DB record is created only after /multipart/complete succeeds.
    """
    key = s3_service.make_key(body.filename)
    try:
        upload_id = s3_service.init_multipart_upload(key, body.content_type)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"upload_id": upload_id, "key": key}


@router.post("/multipart/part", response_model=PartUploadResponse)
async def multipart_upload_part(
    key: str = Query(...),
    upload_id: str = Query(...),
    part_number: int = Query(..., ge=1, le=10000),
    file: UploadFile = File(...),
    _: User = Depends(security.get_current_user),
):
    """
    Upload a single part. Parts must be >= 5 MB except for the last one.
    Save the returned ETag alongside the part_number to call /multipart/complete.
    """
    data = await file.read()
    try:
        etag = s3_service.upload_part(key, upload_id, part_number, data)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"part_number": part_number, "etag": etag}


@router.post("/multipart/complete", response_model=FileUploadResponse)
def multipart_complete(
    body: MultipartCompleteRequest,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Finalize a multipart upload and persist the DB record.
    Returns the same FileUploadResponse as /upload — use `id` to reference the file.
    """
    try:
        s3_service.complete_multipart_upload(
            body.key,
            body.upload_id,
            [p.model_dump() for p in body.parts],
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Derive filename from the key (strip uuid prefix)
    original_filename = body.key.rsplit("/", 1)[-1]
    record = _persist_file_record(
        db,
        body.key,
        original_filename,
        "application/octet-stream",
        None,
        current_user.id,
    )
    return _to_response(record)


# ── Recovery ─────────────────────────────────────────────────────────────────

@router.get("/multipart/recover")
def multipart_recover(
    key: str = Query(...),
    upload_id: str = Query(...),
    _: User = Depends(security.get_current_user),
):
    """
    List parts already uploaded for a stalled multipart upload.
    Compare returned part numbers against what you intended to send,
    then re-upload only the missing ones before calling /multipart/complete.
    """
    try:
        parts = s3_service.list_uploaded_parts(key, upload_id)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "NoSuchUpload":
            raise HTTPException(
                status_code=404,
                detail="Upload session not found. It may have been completed or aborted.",
            )
        raise HTTPException(status_code=500, detail=str(e))
    return {"key": key, "upload_id": upload_id, "parts": parts}


@router.delete("/multipart/abort")
def multipart_abort(
    key: str = Query(...),
    upload_id: str = Query(...),
    _: User = Depends(security.get_current_user),
):
    """Abort an incomplete multipart upload and free its storage."""
    try:
        s3_service.abort_multipart_upload(key, upload_id)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "NoSuchUpload":
            raise HTTPException(status_code=404, detail="Upload session not found.")
        raise HTTPException(status_code=500, detail=str(e))
    return {"detail": "Upload aborted."}
