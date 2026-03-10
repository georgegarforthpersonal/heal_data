"""
Cloudflare R2 Storage Service

Provides S3-compatible storage operations for audio files.
Configuration via environment variables:
- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME (default: cannwood-media)
"""

import os
from pathlib import Path
from typing import Optional, BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

# Configuration
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "cannwood-media")

AUDIO_PREFIX = "audio"
IMAGE_PREFIX = "images"


def get_r2_client():
    """Create and return an R2 client using boto3."""
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        raise ValueError(
            "R2 credentials not configured. "
            "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
        )

    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


def upload_audio_file(
    file_data: BinaryIO,
    filename: str,
    org_slug: str,
    content_type: str = "audio/wav",
) -> str:
    """
    Upload an audio file to R2.

    Args:
        file_data: File-like object with audio data
        filename: Original filename
        org_slug: Organisation slug for path prefix
        content_type: MIME type (default: audio/wav)

    Returns:
        R2 key for the uploaded file
    """
    client = get_r2_client()
    r2_key = f"{AUDIO_PREFIX}/{org_slug}/{filename}"

    client.upload_fileobj(
        file_data,
        R2_BUCKET_NAME,
        r2_key,
        ExtraArgs={"ContentType": content_type},
    )

    return r2_key


def download_audio_file(r2_key: str, local_path: Path) -> Path:
    """
    Download an audio file from R2 to a local path.

    Args:
        r2_key: R2 object key
        local_path: Local path to save file

    Returns:
        Path to downloaded file
    """
    client = get_r2_client()
    client.download_file(R2_BUCKET_NAME, r2_key, str(local_path))
    return local_path


def generate_presigned_url(r2_key: str, expires_in: int = 3600) -> str:
    """
    Generate a presigned URL for downloading a file.

    Args:
        r2_key: R2 object key
        expires_in: URL expiry time in seconds (default: 1 hour)

    Returns:
        Presigned URL string
    """
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": R2_BUCKET_NAME, "Key": r2_key},
        ExpiresIn=expires_in,
    )


def delete_audio_file(r2_key: str) -> bool:
    """
    Delete an audio file from R2.

    Args:
        r2_key: R2 object key

    Returns:
        True if deleted successfully
    """
    client = get_r2_client()
    try:
        client.delete_object(Bucket=R2_BUCKET_NAME, Key=r2_key)
        return True
    except ClientError:
        return False


def get_file_metadata(r2_key: str) -> Optional[dict]:
    """
    Get metadata for a file in R2.

    Returns:
        Dict with size, content_type, last_modified, or None if not found
    """
    client = get_r2_client()
    try:
        response = client.head_object(Bucket=R2_BUCKET_NAME, Key=r2_key)
        return {
            "size": response.get("ContentLength"),
            "content_type": response.get("ContentType"),
            "last_modified": response.get("LastModified"),
        }
    except ClientError:
        return None


# ============================================================================
# Image Storage Functions
# ============================================================================

def upload_image_file(
    file_data: BinaryIO,
    filename: str,
    org_slug: str,
    content_type: str = "image/jpeg",
) -> str:
    """
    Upload an image file to R2.

    Args:
        file_data: File-like object with image data
        filename: Original filename
        org_slug: Organisation slug for path prefix
        content_type: MIME type (default: image/jpeg)

    Returns:
        R2 key for the uploaded file
    """
    client = get_r2_client()
    r2_key = f"{IMAGE_PREFIX}/{org_slug}/{filename}"

    client.upload_fileobj(
        file_data,
        R2_BUCKET_NAME,
        r2_key,
        ExtraArgs={"ContentType": content_type},
    )

    return r2_key


def download_image_file(r2_key: str, local_path: Path) -> Path:
    """
    Download an image file from R2 to a local path.

    Args:
        r2_key: R2 object key
        local_path: Local path to save file

    Returns:
        Path to downloaded file
    """
    client = get_r2_client()
    client.download_file(R2_BUCKET_NAME, r2_key, str(local_path))
    return local_path


def delete_image_file(r2_key: str) -> bool:
    """
    Delete an image file from R2.

    Args:
        r2_key: R2 object key

    Returns:
        True if deleted successfully
    """
    client = get_r2_client()
    try:
        client.delete_object(Bucket=R2_BUCKET_NAME, Key=r2_key)
        return True
    except ClientError:
        return False


def generate_image_presigned_url(r2_key: str, expires_in: int = 3600) -> str:
    """
    Generate a presigned URL for downloading/previewing an image.

    Args:
        r2_key: R2 object key
        expires_in: URL expiry time in seconds (default: 1 hour)

    Returns:
        Presigned URL string
    """
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": R2_BUCKET_NAME, "Key": r2_key},
        ExpiresIn=expires_in,
    )
