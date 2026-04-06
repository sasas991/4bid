import uuid
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from ..core.config import settings


def get_s3_client():
    """S3 client for internal (container-to-container) operations."""
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        config=Config(signature_version="s3v4"),
    )


def _get_public_s3_client():
    """S3 client using the public URL — used only for generating presigned URLs
    that browsers can follow."""
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_PUBLIC_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket_exists() -> None:
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=settings.S3_BUCKET)
    except ClientError:
        s3.create_bucket(Bucket=settings.S3_BUCKET)


def make_key(filename: str) -> str:
    """Generate a unique S3 key for the given original filename."""
    ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
    suffix = f".{ext}" if ext else ""
    return f"uploads/{uuid.uuid4().hex}{suffix}"


def upload_file(data: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to S3 and return the key."""
    s3 = get_s3_client()
    s3.put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    """Return a presigned GET URL for the given key (browser-accessible)."""
    s3 = _get_public_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


# ── Multipart upload helpers (used for large files + recovery) ──────────────

def init_multipart_upload(key: str, content_type: str = "application/octet-stream") -> str:
    """Start a multipart upload. Returns the upload_id."""
    s3 = get_s3_client()
    resp = s3.create_multipart_upload(
        Bucket=settings.S3_BUCKET,
        Key=key,
        ContentType=content_type,
    )
    return resp["UploadId"]


def upload_part(key: str, upload_id: str, part_number: int, data: bytes) -> str:
    """Upload a single part. Returns the ETag."""
    s3 = get_s3_client()
    resp = s3.upload_part(
        Bucket=settings.S3_BUCKET,
        Key=key,
        UploadId=upload_id,
        PartNumber=part_number,
        Body=data,
    )
    return resp["ETag"]


def complete_multipart_upload(key: str, upload_id: str, parts: list[dict]) -> str:
    """
    Complete a multipart upload.
    parts: [{"PartNumber": int, "ETag": str}, ...]
    Returns the final S3 key.
    """
    s3 = get_s3_client()
    s3.complete_multipart_upload(
        Bucket=settings.S3_BUCKET,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={"Parts": parts},
    )
    return key


def list_uploaded_parts(key: str, upload_id: str) -> list[dict]:
    """
    Return the list of already-uploaded parts for a multipart upload.
    Used for recovery: the client can skip re-uploading parts that already exist.
    Returns: [{"PartNumber": int, "ETag": str, "Size": int}, ...]
    """
    s3 = get_s3_client()
    parts = []
    kwargs: dict = {
        "Bucket": settings.S3_BUCKET,
        "Key": key,
        "UploadId": upload_id,
    }
    while True:
        resp = s3.list_parts(**kwargs)
        for p in resp.get("Parts", []):
            parts.append({
                "PartNumber": p["PartNumber"],
                "ETag": p["ETag"],
                "Size": p["Size"],
            })
        if resp.get("IsTruncated"):
            kwargs["PartNumberMarker"] = resp["NextPartNumberMarker"]
        else:
            break
    return parts


def abort_multipart_upload(key: str, upload_id: str) -> None:
    s3 = get_s3_client()
    s3.abort_multipart_upload(
        Bucket=settings.S3_BUCKET,
        Key=key,
        UploadId=upload_id,
    )
