"""
DynamoDB access for the Employee table.

Uses boto3 with the fyp-backend IAM user's credentials (picked up auto from env)
Per the Architecture Conclusion: DynamoDB stores profile + department data ONLY - no passwords.
Cognito owns authentication entirely.
"""

import boto3
import uuid
import config
from datetime import datetime, timezone

_dynamodb = boto3.resource("dynamodb", region_name=config.AWS_REGION)
_employees_table = _dynamodb.Table(config.DYNAMODB_EMPLOYEES_TABLE)
_folders_table = _dynamodb.Table(config.DYNAMODB_FOLDERS_TABLE)
_documents_table = _dynamodb.Table(config.DYNAMODB_DOCUMENTS_TABLE)
_audit_log_table = _dynamodb.Table(config.DYNAMODB_AUDIT_LOG_TABLE)
_file_passwords_table = _dynamodb.Table(config.DYNAMODB_FILE_PASSWORDS_TABLE)
_scan_logs_table = _dynamodb.Table(config.DYNAMODB_SCAN_LOGS_TABLE)

# EMPLOYEES


def get_employee_by_email(email: str) -> dict | None:
    """
    Look up employee profile by email(Email = table partition key).

    Returns the item dict (name, dept, role, ...) or None if no matching record exists
    """
    response = _employees_table.get_item(Key={"email": email})
    return response.get("Item")


# FOLDERS


def create_folder(
    department: str,
    folder_id: str,
    name: str,
    created_by: str,
    parent_folder_id: str | None = None,
) -> dict:
    """
    Create a new folder record for a department.
    """

    item = {
        "department": department,
        "folder_id": folder_id,
        "name": name,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    item["last_modified_by"] = created_by
    item["last_modified_at"] = item["created_at"]
    if parent_folder_id:
        item["parent_folder_id"] = parent_folder_id
    _folders_table.put_item(Item=item)
    return item


def get_folders_by_department(
    department: str, parent_folder_id: str | None = None, flat: bool = False
) -> list[dict]:
    """
    Return all folder belongs to dept
    """
    response = _folders_table.query(
        KeyConditionExpression="department = :dept",
        ExpressionAttributeValues={":dept": department},
    )
    items = response.get("Items", [])

    if flat:
        return sorted(items, key=lambda x: x.get("name", "").lower())

    if parent_folder_id is None:
        # Root level - folders with no parent_folder_id attribute
        items = [item for item in items if "parent_folder_id" not in item]
    else:
        items = [
            item for item in items if item.get("parent_folder_id") == parent_folder_id
        ]
    return sorted(items, key=lambda x: x.get("name", "").lower())


def rename_folder(
    department: str, folder_id: str, new_name: str, modified_by: str
) -> None:
    """
    Update folder display name. Not UUID
    """
    _folders_table.update_item(
        Key={"department": department, "folder_id": folder_id},
        UpdateExpression="SET #n = :name, last_modified_by = :mb, last_modified_at = :ma",
        ExpressionAttributeNames={"#n": "name"},
        ExpressionAttributeValues={
            ":name": new_name,
            ":mb": modified_by,
            ":ma": datetime.now(timezone.utc).isoformat(),
        },
    )


def delete_folder(department: str, folder_id: str) -> None:
    """
    Delete a folder record. Does not automatically delete files inside it.
    Caller is responsible for handling orphaned documents if needed.
    """
    _folders_table.delete_item(Key={"department": department, "folder_id": folder_id})


def get_all_subfolder_ids(department: str, folder_id: str) -> list[str]:
    """
    Recursively collect all sub-folder IDS under a given folder.
    Used by delete_fodler to cascade delete nested folders
    """
    all_ids: list[str] = []
    queue = [folder_id]
    while queue:
        current = queue.pop()
        sub_folders = get_folders_by_department(department, parent_folder_id=current)
        for sf in sub_folders:
            all_ids.append(sf["folder_id"])
            queue.append(sf["folder_id"])
    return all_ids


# DOCUMENTS


def create_document(
    department: str,
    file_id: str,
    display_name: str,
    s3_key: str,
    uploaded_by: str,
    file_size: int,
    content_type: str,
    folder_id: str | None = None,
    lock_kdf: dict | None = None,
) -> dict:
    """
    Create a document metadata record after successful S3 Upload.
    s3_key is a stable UUID-based path - display name is what user sees.
    folder_id None for root-level files.

    lock_kdf is given for a locked file: the PUBLIC key-derivation parameters
    ({version, kdf, iterations, salt}) the browser needs to compute the verifier.
    content_type always stays the file's real type; for locked files the S3
    object itself is stored as application/octet-stream.
    """
    item = {
        "department": department,
        "file_id": file_id,
        "display_name": display_name,
        "s3_key": s3_key,
        "uploaded_by": uploaded_by,
        "file_size": file_size,
        "content_type": content_type,
        "is_locked": lock_kdf is not None,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    if lock_kdf is not None:
        item["lock_kdf"] = lock_kdf
    item["last_modified_by"] = uploaded_by
    item["last_modified_at"] = item["uploaded_at"]
    if folder_id:
        item["folder_id"] = folder_id
    _documents_table.put_item(Item=item)
    return item


def get_documents_by_department(
    department: str, folder_id: str | None = None, flat: bool = False
) -> list[dict]:
    """
    Return all documents for a department.
    If folder_id is provided, returns only files inside that folder.
    If folder_id None, returns root files
    """
    response = _documents_table.query(
        KeyConditionExpression="department = :dept",
        ExpressionAttributeValues={":dept": department},
    )
    items = response.get("Items", [])

    if flat:
        return sorted(items, key=lambda x: x.get("display_name", "").lower())

    if folder_id is None:
        items = [item for item in items if "folder_id" not in item]
    else:
        items = [item for item in items if item.get("folder_id") == folder_id]

    return sorted(items, key=lambda x: x.get("display_name", "").lower())


def get_document(department: str, file_id: str) -> dict | None:
    """
    Fetch a single document record by department + file_id.
    Returns None if not found
    """
    response = _documents_table.get_item(
        Key={"department": department, "file_id": file_id}
    )
    return response.get("Item")


def rename_document(
    department: str, file_id: str, new_name: str, modified_by: str
) -> None:
    """
    Update a document name display name only
    """
    _documents_table.update_item(
        Key={
            "department": department,
            "file_id": file_id,
        },
        UpdateExpression="SET display_name = :name, last_modified_by = :mb, last_modified_at = :ma",
        ExpressionAttributeValues={
            ":name": new_name,
            ":mb": modified_by,
            ":ma": datetime.now(timezone.utc).isoformat(),
        },
    )


def move_document(department: str, file_id: str, folder_id: str | None) -> None:
    """
    Move a document to new folder or root.
    """
    if folder_id:
        _documents_table.update_item(
            Key={"department": department, "file_id": file_id},
            UpdateExpression="SET folder_id = :fid",
            ExpressionAttributeValues={":fid": folder_id},
        )
    else:
        _documents_table.update_item(
            Key={"department": department, "file_id": file_id},
            UpdateExpression="REMOVE folder_id",
        )


def move_folder(department: str, folder_id: str, parent_folder_id: str | None) -> None:
    """
    Move a folder to a new folder or root.
    """
    if parent_folder_id:
        _folders_table.update_item(
            Key={"department": department, "folder_id": folder_id},
            UpdateExpression="SET parent_folder_id = :pid",
            ExpressionAttributeValues={":pid": parent_folder_id},
        )
    else:
        _folders_table.update_item(
            Key={"department": department, "folder_id": folder_id},
            UpdateExpression="REMOVE parent_folder_id",
        )


def delete_document(department: str, file_id: str) -> None:
    """
    Delete a document metadata record from DynamoDB
    Caller separately delete the S3 object using file's s3 key
    """
    _documents_table.delete_item(Key={"department": department, "file_id": file_id})


def get_all_employees() -> list[dict]:
    response = _employees_table.scan()
    return response.get("Items", [])


def get_employee_names(emails: set[str]) -> dict[str, str]:
    """
    Resolve set of employee emails to display names via a single batched lookup.
    Missing entry will be null for the display and fallback to the raw email if any
    """
    if not emails:
        return {}
    response = _dynamodb.batch_get_item(
        RequestItems={
            config.DYNAMODB_EMPLOYEES_TABLE: {
                "Keys": [{"email": email} for email in emails],
                "ProjectionExpression": "email, #n",
                "ExpressionAttributeNames": {"#n": "name"},
            }
        }
    )
    items = response.get("Responses", {}).get(config.DYNAMODB_EMPLOYEES_TABLE, [])
    return {item["email"]: item["name"] for item in items}


def create_employee(
    email: str, name: str, department: str, role: str, personal_email: str
) -> None:
    _employees_table.put_item(
        Item={
            "email": email,
            "name": name,
            "department": department,
            "role": role,
            "personal_email": personal_email,
            "status": "active",
        }
    )


def delete_employee(email: str) -> None:
    _employees_table.delete_item(Key={"email": email})


def update_employee_department(email: str, department: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET department = :dept",
        ExpressionAttributeValues={":dept": department.lower().strip()},
    )


def set_employee_status(email: str, status: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET #s = :status",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":status": status},
    )


def update_employee_onboarding(email: str, nric_last4_hash: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET nric_last4_hash = :nh, onboarding_complete = :oc",
        ExpressionAttributeValues={
            ":nh": nric_last4_hash,
            ":oc": True,
        },
    )


def update_employee_reset_token(email: str, token: str, expiry: int) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET reset_token = :t, reset_token_expiry = :e",
        ExpressionAttributeValues={":t": token, ":e": expiry},
    )


def clear_employee_reset_token(email: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="REMOVE reset_token, reset_token_expiry",
    )


def record_failed_reset_attempt(email: str, locked_until: int | None) -> None:
    """
    Increments failed attempt counter.
    Locks the account from further reset attempts until timestamp
    and reset the counter back to 0
    """
    if locked_until is not None:
        _employees_table.update_item(
            Key={"email": email},
            UpdateExpression="SET reset_attempt_count = :zero, reset_locked_until = :locked",
            ExpressionAttributeValues={":zero": 0, ":locked": locked_until},
        )
    else:
        _employees_table.update_item(
            Key={"email": email},
            UpdateExpression="SET reset_attempt_count = if_not_exists(reset_attempt_count, :zero) + :inc",
            ExpressionAttributeValues={":zero": 0, ":inc": 1},
        )


def clear_reset_attempts(email: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="REMOVE reset_attempt_count, reset_locked_until",
    )


def update_employee_profile(email: str, address: str, phone: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET address = :a, phone = :p",
        ExpressionAttributeValues={":a": address, ":p": phone},
    )


def create_audit_log_entry(
    department: str,
    action: str,
    actor_email: str,
    target_type: str | None = None,
    target_id: str | None = None,
    target_name: str | None = None,
    details: str | None = None,
) -> dict:
    """
    Append an audit log entry.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {
        "department": department,
        "log_id": f"{timestamp}#{uuid.uuid4()}",
        "action": action,
        "actor_email": actor_email,
        "timestamp": timestamp,
    }
    if target_type:
        item["target_type"] = target_type
    if target_id:
        item["target_id"] = target_id
    if target_name:
        item["target_name"] = target_name
    if details:
        item["details"] = details
    _audit_log_table.put_item(Item=item)
    return item


def get_audit_logs(
    department: str | None = None, action: str | None = None, limit: int = 200
) -> list[dict]:
    """
    Return audit log entries, newest first.
    """
    if department:
        response = _audit_log_table.query(
            KeyConditionExpression="department = :dept",
            ExpressionAttributeValues={":dept": department},
            ScanIndexForward=False,
        )
        items = response.get("Items", [])
    else:
        response = _audit_log_table.scan()
        items = response.get("Items", [])
        items.sort(key=lambda x: x["log_id"], reverse=True)

    if action:
        items = [item for item in items if item.get("action") == action]

    return items[:limit]


# FILE PASSWORDS (gate for locked files)
#
# One item per locked file, keyed like Documents (department + file_id) so the
# department-scoping rule still holds. Holds only gate material - never the
# file password or the AES key, which stay in the browser:
#   verifier_hash  bcrypt(verifier)
#   iv             AES-GCM IV, released only after the verifier matches
#   failed_attempts / locked_until   unlock rate limiting


def create_file_password(
    department: str, file_id: str, verifier_hash: str, iv: str, created_by: str
) -> dict:
    item = {
        "department": department,
        "file_id": file_id,
        "verifier_hash": verifier_hash,
        "iv": iv,
        "failed_attempts": 0,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _file_passwords_table.put_item(Item=item)
    return item


def get_file_password(department: str, file_id: str) -> dict | None:
    response = _file_passwords_table.get_item(
        Key={"department": department, "file_id": file_id}
    )
    return response.get("Item")


def delete_file_password(department: str, file_id: str) -> None:
    """
    Safe to call for an unlocked file: deleting a missing item is a no-op.
    """
    _file_passwords_table.delete_item(Key={"department": department, "file_id": file_id})


def register_failed_unlock(
    department: str, file_id: str, max_attempts: int, lockout_seconds: int
) -> dict:
    """
    Count one wrong verifier atomically. When the counter reaches max_attempts,
    start a lockout (epoch seconds) and reset the counter.
    Returns {"failed_attempts": int, "locked_until": int | None}.
    """
    key = {"department": department, "file_id": file_id}
    response = _file_passwords_table.update_item(
        Key=key,
        UpdateExpression="ADD failed_attempts :one",
        ExpressionAttributeValues={":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    attempts = int(response["Attributes"]["failed_attempts"])
    if attempts < max_attempts:
        return {"failed_attempts": attempts, "locked_until": None}

    locked_until = int(datetime.now(timezone.utc).timestamp()) + lockout_seconds
    _file_passwords_table.update_item(
        Key=key,
        UpdateExpression="SET failed_attempts = :zero, locked_until = :lu",
        ExpressionAttributeValues={":zero": 0, ":lu": locked_until},
    )
    return {"failed_attempts": 0, "locked_until": locked_until}


def clear_failed_unlocks(department: str, file_id: str) -> None:
    _file_passwords_table.update_item(
        Key={"department": department, "file_id": file_id},
        UpdateExpression="SET failed_attempts = :zero REMOVE locked_until",
        ExpressionAttributeValues={":zero": 0},
    )


def unlock_locked_until(file_password: dict) -> int | None:
    """
    Epoch seconds the file stays locked out until, or None if not locked out now.
    """
    locked_until = file_password.get("locked_until")
    if locked_until is None:
        return None
    locked_until = int(locked_until)
    if locked_until > int(datetime.now(timezone.utc).timestamp()):
        return locked_until
    return None


# SCAN LOGS
#
# One item per ClamAV scan. scan_type is "upload", "download" or "lock";
# result is "clean", "infected", "not_fully_scanned" or "error".


def create_scan_log(
    department: str,
    file_id: str,
    file_name: str,
    user_email: str,
    scan_type: str,
    result: str,
    details: str | None = None,
) -> dict:
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {
        "department": department,
        "scan_id": f"{timestamp}#{uuid.uuid4()}",
        "file_id": file_id,
        "file_name": file_name,
        "user_email": user_email,
        "scan_type": scan_type,
        "result": result,
        "timestamp": timestamp,
    }
    if details:
        item["details"] = details
    _scan_logs_table.put_item(Item=item)
    return item


def get_scan_logs(
    department: str | None = None, result: str | None = None, limit: int = 200
) -> list[dict]:
    """
    Return scan log entries, newest first. department None = all departments
    (admin view); result optionally filters (e.g. "infected").
    """
    if department:
        response = _scan_logs_table.query(
            KeyConditionExpression="department = :dept",
            ExpressionAttributeValues={":dept": department},
            ScanIndexForward=False,
        )
        items = response.get("Items", [])
    else:
        response = _scan_logs_table.scan()
        items = response.get("Items", [])
        items.sort(key=lambda x: x["scan_id"], reverse=True)

    if result:
        items = [item for item in items if item.get("result") == result]

    return items[:limit]
