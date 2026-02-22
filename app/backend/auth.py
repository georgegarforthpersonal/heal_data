"""
Authentication module for admin password protection.

Supports multi-organisation authentication with per-org passwords.
Session tokens embed the org_slug for security.
"""

import hashlib
import hmac
import os
import time
from typing import Optional, Tuple
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


def create_session_token(org_slug: str) -> str:
    """
    Create a signed session token with embedded org_slug.

    Token format: {org_slug}.{timestamp}.{signature}
    The signature covers both org_slug and timestamp.

    Args:
        org_slug: The organisation slug to embed in the token

    Returns:
        Session token string
    """
    timestamp = str(int(time.time()))
    secret = os.getenv("SESSION_SECRET_KEY", "")
    # Sign both org_slug and timestamp
    payload = f"{org_slug}.{timestamp}"
    signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{org_slug}.{timestamp}.{signature}"


def validate_session_token(token: str) -> Tuple[bool, Optional[str]]:
    """
    Validate a session token and extract the org_slug.

    Args:
        token: Session token to validate

    Returns:
        Tuple of (is_valid, org_slug). org_slug is None if invalid.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False, None

        org_slug, timestamp, signature = parts
        secret = os.getenv("SESSION_SECRET_KEY", "")
        payload = f"{org_slug}.{timestamp}"
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(signature, expected):
            return False, None

        if (time.time() - int(timestamp)) >= SESSION_MAX_AGE:
            return False, None

        return True, org_slug
    except (ValueError, TypeError):
        return False, None


def get_token_from_request(request: Request) -> Optional[str]:
    """
    Extract auth token from request, checking Authorization header first, then cookies.

    Args:
        request: FastAPI request object

    Returns:
        Token string if found, None otherwise
    """
    # Check Authorization header first (for cross-origin requests)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]  # Strip "Bearer " prefix

    # Fall back to cookie (for same-origin requests)
    return request.cookies.get(SESSION_COOKIE_NAME)


def get_session_org_slug(request: Request) -> Optional[str]:
    """
    Extract org_slug from a valid session token.

    Args:
        request: FastAPI request object

    Returns:
        org_slug if session is valid, None otherwise
    """
    token = get_token_from_request(request)
    if not token:
        return None

    is_valid, org_slug = validate_session_token(token)
    return org_slug if is_valid else None


async def require_admin(request: Request):
    """
    FastAPI dependency - raises 401 if not authenticated.

    Validates the session token exists and is properly signed.
    Checks Authorization header first, then falls back to cookie.
    """
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
        )

    is_valid, _ = validate_session_token(token)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
