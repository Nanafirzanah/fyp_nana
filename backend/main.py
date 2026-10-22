# CICD4
"""
FYP - FastAPI backend entrypoint

Auth Flow:
    Cognito token arrives
        -> backend verifies signature (auth.py)
        -> backend extracts user's email from the token
        -> DynamoDB lookup: what department is this email in?
        -> backend returns { email, name, department, role }

Run locally with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import config
import logging
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dependencies import get_current_employee
from documents import router as documents_router
from folders import router as folders_router
from admin import router as admin_router
from onboarding import router as onboarding_router
from forgot_password import router as forgot_password_router
from profile import router as profile_router
from auth_routes import router as auth_router
from overview import router as overview_router

logger = logging.getLogger(__name__)

app = FastAPI(title="FYP Cloud Document Management", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router)
app.include_router(folders_router)
app.include_router(admin_router)
app.include_router(onboarding_router)
app.include_router(forgot_password_router)
app.include_router(profile_router)
app.include_router(auth_router)
app.include_router(overview_router)


@app.get("/health")
def health():
    """Unauthenticated liveness check."""
    return {"status": "ok"}


@app.get("/me")
def read_current_user(employee: dict = Depends(get_current_employee)):
    """
    Returns the authenticated employee's profile (name, dept, role)
    looked up from DynamoDB by their Cognito email.
    """
    return employee


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s", request.method, request.url, exc_info=exc
    )
    return JSONResponse(
        status_code=500, content={"detail": "Internal server error"}
    )  # fresh deploy
