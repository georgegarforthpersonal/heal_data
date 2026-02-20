"""
Authentication module for admin password protection.

Simple shared admin password with HMAC-signed session cookies.
No external dependencies beyond FastAPI.
"""

import hashlib
import hmac
import os
import time
from fastapi import Request, HTTPException, status


SESSION_COOKIE_NAME = "admin_session"
SESSION_MAX_AGE = 60 * 60 * 24  # 24 hours


def verify_admin_password(password: str) -> bool:
    expected = os.getenv("ADMIN_PASSWORD", "")
    if not expected:
        return False
    return password == expected


def create_session_token() -> str:
    timestamp = str(int(time.time()))
    secret = os.getenv("SESSION_SECRET_KEY", "")
    signature = hmac.new(secret.encode(), timestamp.encode(), hashlib.sha256).hexdigest()
    return f"{timestamp}.{signature}"


def validate_session_token(token: str) -> bool:
    try:
        timestamp, signature = token.split(".", 1)
        secret = os.getenv("SESSION_SECRET_KEY", "")
        expected = hmac.new(secret.encode(), timestamp.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return False
        return (time.time() - int(timestamp)) < SESSION_MAX_AGE
    except (ValueError, TypeError):
        return False


async def require_admin(request: Request):
    """FastAPI dependency — raises 401 if not authenticated."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token or not validate_session_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
        )
