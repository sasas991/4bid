from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FileUploadResponse(BaseModel):
    id: int
    s3_key: str
    original_filename: str
    content_type: str
    size_bytes: Optional[int] = None
    url: str  # fresh presigned URL


class MultipartInitRequest(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"


class MultipartInitResponse(BaseModel):
    upload_id: str
    key: str


class PartUploadResponse(BaseModel):
    part_number: int
    etag: str


class CompletePart(BaseModel):
    PartNumber: int
    ETag: str


class MultipartCompleteRequest(BaseModel):
    key: str
    upload_id: str
    parts: list[CompletePart]
