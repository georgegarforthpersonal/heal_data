"""
Authentication module for admin password protection.

Simple shared admin password checked via plaintext comparison.
Session tokens use itsdangerous signed cookies.
"""

import os
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


def verify_admin_password(password: str) -> bool:
    expected = os.getenv("ADMIN_PASSWORD", "")
    if not expected:
        return False
    return password == expected


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
