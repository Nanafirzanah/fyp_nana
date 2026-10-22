"""
Documents management routes - upload, list, download

Upload flow:
    file received
        1,. generate UUID as file_id
        2. S3 upload at '{department}/{file_uuid}'
        3, DynamoDB record created: {file_id, display_name, s3_key, .....}
"""

import os
import uuid
import io
import logging
import dynamodb_client
import s3_client

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from dependencies import get_current_employee
from botocore.exceptions import ClientError
from config import MAX_UPLOAD_SIZE_BYTES

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)


CONTENT_TYPE_EXTENSIONS: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/csv": ".csv",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "text/plain": ".txt",
}


class RenameDocumentRequest(BaseModel):
    name: str


class MoveItemsRequest(BaseModel):
    file_ids: list[str] = []
    folder_ids: list[str] = []
    destination_folder_id: str | None = None


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    folder_id: str | None = Query(default=None),
    employee: dict = Depends(get_current_employee),
):
    """
    Upload a document to the authenticated employee's department folder in S3 & Create metadata in DynamoDB

    folder_id query param is optional:
        None = file stores in root
        <uuid> = files stored in that folder
    """

    department = employee["department"]
    if not department:
        raise HTTPException(
            status_code=403, detail="No department assigned to this account."
        )

    # Cleaning display name
    display_name = os.path.basename(file.filename or "")
    if not display_name:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_id = str(uuid.uuid4())
    s3_key = f"{department}/{file_id}"
    content_type = file.content_type or "application/octet-stream"

    # Upload bytes to S3
    file_bytes = bytearray()
    chunk_size = 1024 * 1024
    while chunk := await file.read(chunk_size):
        file_bytes.extend(chunk)
        if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=413, detail="File exceeds 50MB upload limit."
            )
    file_bytes = bytes(file_bytes)
    try:
        s3_client.upload_file_by_key(io.BytesIO(file_bytes), s3_key, content_type)
    except ClientError as e:
        logger.error("S3 upload failed for %s: %s", s3_key, e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to upload file to storage")

    try:
        # Write metadata to DynamoDB
        document = dynamodb_client.create_document(
            department=department,
            file_id=file_id,
            display_name=display_name,
            s3_key=s3_key,
            uploaded_by=employee["email"],
            file_size=file.size or 0,
            content_type=content_type,
            folder_id=folder_id,
        )
    except ClientError as e:
        logger.error(
            "DynamoDB create document failed for %s: %s", file_id, e, exc_info=True
        )
        try:
            s3_client.delete_file_by_key(s3_key)
        except ClientError:
            logger.error("S3 rollback failed - orphaned key %s", s3_key)
        raise HTTPException(status_code=503, detail="Failed to save file record")

    try:
        dynamodb_client.create_audit_log_entry(
            department=department,
            action="upload",
            actor_email=employee["email"],
            target_type="document",
            target_id=file_id,
            target_name=display_name,
        )
    except ClientError as e:
        logger.error("Audit log failed for upload %s: %s", file_id, e, exc_info=True)

    return document


@router.get("/list")
def list_documents(
    folder_id: str | None = Query(default=None),
    flat: bool = Query(default=False),
    employee: dict = Depends(get_current_employee),
):
    """
    List all documents in the authenticated employee's dept folder
    folder_id omitted at root level
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned to this acc.")

    try:
        files = dynamodb_client.get_documents_by_department(
            department, folder_id=folder_id, flat=flat
        )
    except ClientError as e:
        logger.error("DynamoDB get documents failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to retrieve documents")

    try:
        uploader_emails = {f["uploaded_by"] for f in files if f.get("uploaded_by")}
        names = dynamodb_client.get_employee_names(uploader_emails)
        for f in files:
            f["uploaded_by_name"] = names.get(
                f.get("uploaded_by"), f.get("uploaded_by")
            )
    except ClientError as e:
        logger.error("DynamoDB resolve uploader names failed: %s", e, exc_info=True)
        for f in files:
            f["uploaded_by_name"] = f.get("uploaded_by")

    return {"department": department, "folder_id": folder_id, "files": files}


@router.get("/download/{file_id}")
def download_document(
    file_id: str,
    employee: dict = Depends(get_current_employee),
):
    """
    Generate a URL to download the file
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned")
    document = dynamodb_client.get_document(department, file_id)
    if document is None:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        url = s3_client.generate_download_url(
            s3_key=document["s3_key"],
            filename=document["display_name"],
        )
    except ClientError as e:
        logger.error(
            "S3 presign failed for %s: %s", document["s3_key"], e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to generate download link")

    try:
        dynamodb_client.create_audit_log_entry(
            department=department,
            action="download",
            actor_email=employee["email"],
            target_type="document",
            target_id=file_id,
            target_name=document["display_name"],
        )
    except ClientError as e:
        logger.error("Audit log failed for download %s: %s", file_id, e, exc_info=True)

    return {
        "file_id": file_id,
        "filename": document["display_name"],
        "url": url,
    }


@router.patch("/{file_id}/rename")
def rename_document(
    file_id: str,
    body: RenameDocumentRequest,
    employee: dict = Depends(get_current_employee),
):
    """
    Rename a doc's display name. The extension is derived from the file's
    stored content_type and always re-applied - whatever extension the
    caller submits (or omits) is discarded, so a rename can never desync
    the display name from the file's real type.
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="Noe dept assigned to this acc.")

    raw_name = body.name.strip()
    if not raw_name:
        raise HTTPException(status_code=400, detail="File name cannot empty")

    document = dynamodb_client.get_document(department, file_id)
    if document is None:
        raise HTTPException(status_code=404, detail="File not found")

    base_name = raw_name.rsplit(".", 1)[0] if "." in raw_name else raw_name
    base_name = base_name.strip()
    if not base_name:
        raise HTTPException(status_code=400, detail="File name cannot be empty")

    extension = CONTENT_TYPE_EXTENSIONS.get(document["content_type"])
    if extension is None:
        current_name = document["display_name"]
        extension = f".{current_name.rsplit('.', 1)[-1]}" if "." in current_name else ""

    name = f"{base_name}{extension}"

    try:
        dynamodb_client.rename_document(department, file_id, name)
    except ClientError as e:
        logger.error(
            "DynamoDB rename_document failed for %s: %s", file_id, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to rename file")

    return {"file_id": file_id, "display_name": name}


@router.post("/move")
def move_items(
    body: MoveItemsRequest,
    employee: dict = Depends(get_current_employee),
):
    """
    Move a batch of files / folders to a new destination folder.
    Folder logic same, it will cycle checked first.
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned to this acc.")

    if not body.file_ids and not body.folder_ids:
        raise HTTPException(status_code=400, detail="Nothing selected to move")

    destination = body.destination_folder_id

    for folder_id in body.folder_ids:
        if folder_id == destination:
            raise HTTPException(
                status_code=400, detail="Cannot move a folder into itself"
            )
        try:
            descendant_ids = dynamodb_client.get_all_subfolder_ids(
                department, folder_id
            )
        except ClientError as e:
            logger.error(
                "get_all_subfolder_ids failed for %s: %s", folder_id, e, exc_info=True
            )
            raise HTTPException(status_code=503, detail="Failed to validate move")
        if destination is not None and destination in descendant_ids:
            raise HTTPException(
                status_code=400,
                detail="Cannot move a folder into one of its own subfolders",
            )

    try:
        for file_id in body.file_ids:
            dynamodb_client.move_document(department, file_id, destination)
        for folder_id in body.folder_ids:
            dynamodb_client.move_folder(department, folder_id, destination)

    except ClientError as e:
        logger.error("Move failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to move item(s)")

    try:
        dynamodb_client.create_audit_log_entry(
            department=department,
            action="move",
            actor_email=employee["email"],
            target_type="mixed",
            details=(
                f"moved {len(body.file_ids)} file(s), {len(body.folder_ids)} "
                f"folder(s) to {destination or 'root'}"
            ),
        )
    except ClientError as e:
        logger.error("Audit log failed for move: %s", e, exc_info=True)

    return {
        "moved_files": len(body.file_ids),
        "moved_folders": len(body.folder_ids),
        "destination_folder_id": destination,
    }


@router.delete("/{file_id}")
def delete_document(
    file_id: str,
    employee: dict = Depends(get_current_employee),
):
    """
    Delete a doc - S3 object first, then dynamodb record.
    If S3 delete fails, dynamodb record stays
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned to this acc.")
    document = dynamodb_client.get_document(department, file_id)
    if document is None:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        s3_client.delete_file_by_key(document["s3_key"])
    except ClientError as e:
        logger.error(
            "S3 delete failed for %s: %s", document["s3_key"], e, exc_info=True
        )
        raise HTTPException(
            status_code=503, detail="Failed to delete file from storage"
        )

    try:
        dynamodb_client.delete_document(department, file_id)
    except ClientError as e:
        logger.error(
            "DyanmoDB delete_document failed for %s: %s", file_id, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to delete file record")

    try:
        dynamodb_client.create_audit_log_entry(
            department=department,
            action="delete",
            actor_email=employee["email"],
            target_type="document",
            target_id=file_id,
            target_name=document["display_name"],
        )
    except ClientError as e:
        logger.error("Audit log failed for delete %s: %s", file_id, e, exc_info=True)

    return {"file_id": file_id, "deleted": True}
