"""
Authentication module for admin password protection.

Provides a shared admin password mechanism using:
- bcrypt for password hashing/verification
- itsdangerous for signed session cookies

No individual user accounts - just a single admin password
that grants edit privileges when verified.
"""

import os
import bcrypt as _bcrypt
from fastapi import Request, HTTPException, status
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired


SESSION_COOKIE_NAME = "admin_session"
SESSION_MAX_AGE = 60 * 60 * 24  # 24 hours


def _get_secret_key() -> str:
    key = os.getenv("SESSION_SECRET_KEY", "")
    if not key:
        raise RuntimeError("SESSION_SECRET_KEY environment variable is not set")
    return key


def _get_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_get_secret_key())


def get_admin_password_hash() -> str:
    pw_hash = os.getenv("ADMIN_PASSWORD_HASH", "")
    if not pw_hash:
        raise RuntimeError("ADMIN_PASSWORD_HASH environment variable is not set")
    return pw_hash


def verify_admin_password(password: str) -> bool:
    try:
        pw_hash = get_admin_password_hash()
        return _bcrypt.checkpw(
            password.encode("utf-8"),
            pw_hash.encode("utf-8"),
        )
    except (RuntimeError, ValueError):
        return False


def create_session_token() -> str:
    serializer = _get_serializer()
    return serializer.dumps({"role": "admin"})


def validate_session_token(token: str) -> bool:
    try:
        serializer = _get_serializer()
        serializer.loads(token, max_age=SESSION_MAX_AGE)
        return True
    except (BadSignature, SignatureExpired):
        return False


async def require_admin(request: Request):
    """
    FastAPI dependency that checks for a valid admin session cookie.
    Raises 401 if not authenticated.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token or not validate_session_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
        )
