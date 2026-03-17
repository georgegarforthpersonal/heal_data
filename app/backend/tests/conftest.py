"""
Pytest Configuration and Shared Fixtures

Provides fixtures for:
- Test database session with cleanup
- FastAPI TestClient with dependency overrides
- Test organisation
- Authentication tokens
"""

import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlmodel import SQLModel

# Set test environment variables before importing app modules
os.environ.setdefault("SESSION_SECRET_KEY", "test-secret-key")

from main import app
from database.connection import get_db
from dependencies import get_current_organisation
from auth import create_session_token
from models import Organisation, Surveyor


# ============================================================================
# Database Fixtures
# ============================================================================

def get_test_database_url() -> str:
    """Build database URL from environment variables."""
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    database = os.getenv("DB_NAME", "test_db")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "postgres")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine (session-scoped for performance)."""
    engine = create_engine(
        get_test_database_url(),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    # Create all tables
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """
    Provide a database session for each test.

    Uses a transaction that is rolled back after each test for isolation.
    """
    connection = test_engine.connect()
    transaction = connection.begin()

    TestSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=connection,
    )
    session = TestSessionLocal()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


# ============================================================================
# Test Organisation Fixture
# ============================================================================

@pytest.fixture
def test_org(db_session: Session) -> Organisation:
    """
    Create a test organisation.

    This organisation is used for all tests and cleaned up after each test
    via transaction rollback.
    """
    org = Organisation(
        name="Test Organisation",
        slug="test-org",
        admin_password="test-password",
        is_active=True,
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest.fixture
def auth_token(test_org: Organisation) -> str:
    """Generate a valid session token for the test organisation."""
    return create_session_token(test_org.slug)


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Return headers with Authorization bearer token."""
    return {"Authorization": f"Bearer {auth_token}"}


# ============================================================================
# FastAPI TestClient Fixture
# ============================================================================

@pytest.fixture
def client(db_session: Session, test_org: Organisation) -> Generator[TestClient, None, None]:
    """
    Create a FastAPI TestClient with dependency overrides.

    Overrides:
    - get_db: Use test database session
    - get_current_organisation: Return test organisation
    """

    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # Session cleanup handled by db_session fixture

    async def override_get_current_organisation():
        return test_org

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_organisation] = override_get_current_organisation

    with TestClient(app) as test_client:
        yield test_client

    # Clear overrides after test
    app.dependency_overrides.clear()


# ============================================================================
# Helper Fixtures
# ============================================================================

@pytest.fixture
def create_surveyor(db_session: Session, test_org: Organisation):
    """
    Factory fixture to create surveyors.

    Usage:
        def test_something(create_surveyor):
            surveyor = create_surveyor(first_name="John", last_name="Doe")
    """
    def _create_surveyor(
        first_name: str = "Test",
        last_name: str = "Surveyor",
        is_active: bool = True,
    ) -> Surveyor:
        surveyor = Surveyor(
            first_name=first_name,
            last_name=last_name,
            organisation_id=test_org.id,
            is_active=is_active,
        )
        db_session.add(surveyor)
        db_session.commit()
        db_session.refresh(surveyor)
        return surveyor

    return _create_surveyor
