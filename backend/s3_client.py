"""
S3 client helper functions for document storage.

Documents are stored under department-scoped prefixes:
    s3://<bucket>/<department>/<file_uuid>

    The UUID s3_key is permanent and never changes.
    Display name live in DynamoDB and are what user see.
    Department-level access control is enforced in the route handles - not here
"""

import boto3

from config import AWS_REGION, S3_BUCKET_NAME

_s3 = boto3.client("s3", region_name=AWS_REGION)


def upload_file_by_key(
    file_obj,
    s3_key: str,
    content_type: str = "application/octet-stream",
) -> None:
    """
    Upload a file-like object to S333 at given UUID based key
    s3_key format: '{department}/{file_uuid}'
    """
    _s3.upload_fileobj(
        file_obj,
        S3_BUCKET_NAME,
        s3_key,
        ExtraArgs={"ContentType": content_type},
    )


def delete_file_by_key(s3_key: str) -> None:
    """
    Delete a file from S3 by its full key.
    Used for single deletion and cascade deletion
    """
    _s3.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)


def generate_download_url(s3_key: str, filename: str, expires_in: int = 300) -> str:
    """
    Generate a presigned GET URL for downloading a file.
    filename is passed as Content-Disposition so browser saves file with correct display name
    """
    return _s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": S3_BUCKET_NAME,
            "Key": s3_key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=expires_in,
    )


def download_file_by_key(s3_key: str) -> bytes:
    """
    Download a file's raw bytes from S3 by its key.
    Used server-side when the full file content is needed (e.g. malware scanning).
    """
    response = _s3.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
    return response["Body"].read()
