"""
Test setup for the backend.

config.py refuses to import without these variables, so set dummy values before
anything imports the app. The tests never touch AWS: every S3/DynamoDB call is
replaced with a fake in the test itself.
"""

import os
import sys

os.environ.setdefault("COGNITO_USER_POOL_ID", "test-pool")
os.environ.setdefault("COGNITO_APP_CLIENT_ID", "test-client")
os.environ.setdefault("S3_BUCKET_NAME", "test-bucket")
os.environ.setdefault("RESEND_API_KEY", "test")
os.environ.setdefault("RESEND_FROM_EMAIL", "test@example.com")
os.environ.setdefault("AWS_REGION", "ap-southeast-2")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-2")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
