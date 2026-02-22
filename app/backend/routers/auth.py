"""
Auth Router - Admin authentication endpoints

Endpoints:
  POST /api/auth/login   - Verify admin password and set session cookie
  POST /api/auth/logout  - Clear session cookie
  GET  /api/auth/status  - Check if currently authenticated
"""

import os
from fastapi import APIRouter, HTTPException, Response, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import (
    verify_org_password,
    create_session_token,
    validate_session_token,
    get_token_from_request,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
)
from database.connection import get_db
from dependencies import get_current_organisation
from models import Organisation, OrganisationRead

_is_production = os.getenv("ENV", "").lower() in ("production", "prod", "staging")

router = APIRouter()


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    org: Organisation = Depends(get_current_organisation)
):
    """
    Login with organisation-specific admin password.

    The organisation is determined from the request hostname.
    """
    if not verify_org_password(body.password, org):
        raise HTTPException(status_code=401, detail="Incorrect password")

    token = create_session_token(org.slug)
    # Set cookie for same-origin requests (still useful for local dev)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="none" if _is_production else "lax",
        secure=_is_production,
        path="/",
    )
    # Return token in body for cross-origin requests (stored in localStorage)
    return {"authenticated": True, "token": token}


@router.post("/logout")
async def logout(response: Response):
    """Clear session cookie."""
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"authenticated": False}


@router.get("/status")
async def auth_status(
    request: Request,
    org: Organisation = Depends(get_current_organisation)
):
    """
    Check authentication status and return organisation info.

    Returns organisation details for the frontend to use.
    Checks Authorization header first, then cookie.
    """
    token = get_token_from_request(request)
    is_valid, _ = validate_session_token(token) if token else (False, None)
    authenticated = is_valid
    return {
        "authenticated": authenticated,
        "organisation": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug
        }
    }
