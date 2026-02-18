"""
FastAPI Dependencies for Multi-Organisation Support

Provides dependencies for extracting organisation context from requests.
"""

from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from database.connection import get_db
from models import Organisation


async def get_current_organisation(
    request: Request,
    db: Session = Depends(get_db)
) -> Organisation:
    """
    Extract organisation from request hostname.

    For production: Matches request Host header against organisation.domain
    For local development: Uses X-Org-Slug header or defaults to 'heal'

    Args:
        request: FastAPI request object
        db: Database session

    Returns:
        Organisation object for the current request

    Raises:
        HTTPException 404: If organisation not found or inactive
    """
    host = request.headers.get("host", "").lower()

    # Strip port if present (for local dev)
    if ":" in host:
        host = host.split(":")[0]

    # For local development, allow override via header
    if host in ("localhost", "127.0.0.1"):
        org_slug = request.headers.get("x-org-slug", "heal")
        org = db.query(Organisation).filter(
            Organisation.slug == org_slug,
            Organisation.is_active == True
        ).first()
    else:
        # Production: match by domain
        org = db.query(Organisation).filter(
            Organisation.domain == host,
            Organisation.is_active == True
        ).first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail=f"Organisation not found for host: {host}"
        )

    return org
