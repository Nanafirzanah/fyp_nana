"""
Configuration loader for my fyp backend.

All values are read from environment variables
Use python-dotenv locally
in Elastic Beanstalk, set these as environment properties in the EB console instead of a.env file.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# AWS region
# All other service must live within the same region
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")
DYNAMODB_EMPLOYEES_TABLE = os.getenv("DYNAMODB_EMPLOYEES_TABLE", "Employees")
DYNAMODB_FOLDERS_TABLE = os.getenv("DYNAMODB_FOLDERS_TABLE", "Folders")
DYNAMODB_DOCUMENTS_TABLE = os.getenv("DYNAMODB_DOCUMENTS_TABLE", "Documents")
DYNAMODB_AUDIT_LOG_TABLE = os.getenv("DYNAMODB_AUDIT_LOG_TABLE", "AuditLog")
DYNAMODB_FILE_PASSWORDS_TABLE = os.getenv(
    "DYNAMODB_FILE_PASSWORDS_TABLE", "FilePasswords"
)
DYNAMODB_SCAN_LOGS_TABLE = os.getenv("DYNAMODB_SCAN_LOGS_TABLE", "ScanLogs")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")

# RESEND API
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "")

MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024

# Locked files are encrypted whole in the browser, so they get a smaller cap.
# Ciphertext is plaintext + 16 bytes (AES-GCM tag).
MAX_LOCKED_FILE_BYTES = 25 * 1024 * 1024
GCM_TAG_BYTES = 16

# Wrong-verifier attempts allowed before a file is temporarily locked out.
UNLOCK_MAX_FAILED_ATTEMPTS = 5
UNLOCK_LOCKOUT_SECONDS = 5 * 60

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

if (
    not COGNITO_USER_POOL_ID
    or not COGNITO_APP_CLIENT_ID
    or not S3_BUCKET_NAME
    or not RESEND_API_KEY
    or not RESEND_FROM_EMAIL
):
    raise RuntimeError(
        "Cognito user pool id, cognito app client id, S3 bucket name, Resend API, Resend from email key must be set"
    )
