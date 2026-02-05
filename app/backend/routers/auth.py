"""
Auth Router - Admin authentication endpoints

Endpoints:
  POST /api/auth/login   - Verify admin password and set session cookie
  POST /api/auth/logout  - Clear session cookie
  GET  /api/auth/status  - Check if currently authenticated
"""

import os
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from auth import (
    verify_admin_password,
    create_session_token,
    validate_session_token,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
)

_is_production = os.getenv("ENV", "").lower() in ("production", "prod")

router = APIRouter()


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    if not verify_admin_password(body.password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    token = create_session_token()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="none" if _is_production else "lax",
        secure=_is_production,
    )
    return {"authenticated": True}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"authenticated": False}


@router.get("/status")
async def auth_status(request: Request):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    authenticated = bool(token and validate_session_token(token))
    return {"authenticated": authenticated}
