"""
Authentication module for admin password protection.

Supports multi-organisation authentication with per-org passwords.
"""

import hashlib
import hmac
import os
import time
from fastapi import Request, HTTPException, status

from models import Organisation


SESSION_COOKIE_NAME = "admin_session"
SESSION_MAX_AGE = 60 * 60 * 24  # 24 hours


def verify_org_password(password: str, org: Organisation) -> bool:
    """
    Verify a password against an organisation's stored password.

    Args:
        password: Password to verify
        org: Organisation object with admin_password

    Returns:
        True if password matches, False otherwise
    """
    return password == org.admin_password


def create_session_token() -> str:
    """
    Create a signed session token.

    Returns:
        Session token string with timestamp and HMAC signature
    """
    timestamp = str(int(time.time()))
    secret = os.getenv("SESSION_SECRET_KEY", "")
    signature = hmac.new(secret.encode(), timestamp.encode(), hashlib.sha256).hexdigest()
    return f"{timestamp}.{signature}"


def validate_session_token(token: str) -> bool:
    """
    Validate a session token.

    Args:
        token: Session token to validate

    Returns:
        True if token is valid and not expired, False otherwise
    """
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
    """
    FastAPI dependency - raises 401 if not authenticated.

    This dependency only validates the session token.
    Organisation context should be validated separately using get_current_organisation.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token or not validate_session_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
        )
