"""
Tests for Surveyors Router

Tests CRUD operations for the /api/surveyors endpoints.
"""

import pytest
from fastapi.testclient import TestClient


class TestGetSurveyors:
    """Tests for GET /api/surveyors"""

    def test_get_surveyors_empty(self, client: TestClient, auth_headers: dict):
        """Should return empty list when no surveyors exist."""
        response = client.get("/api/surveyors", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_surveyors_returns_list(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should return list of surveyors."""
        create_surveyor(first_name="Alice", last_name="Smith")
        create_surveyor(first_name="Bob", last_name="Jones")

        response = client.get("/api/surveyors", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2
        # Surveyors are sorted by last_name, first_name
        assert data[0]["first_name"] == "Bob"  # Jones comes before Smith
        assert data[1]["first_name"] == "Alice"

    def test_get_surveyors_excludes_inactive_by_default(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should exclude inactive surveyors by default."""
        create_surveyor(first_name="Active", last_name="User", is_active=True)
        create_surveyor(first_name="Inactive", last_name="User", is_active=False)

        response = client.get("/api/surveyors", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["first_name"] == "Active"

    def test_get_surveyors_includes_inactive_when_requested(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should include inactive surveyors when include_inactive=true."""
        create_surveyor(first_name="Active", last_name="User", is_active=True)
        create_surveyor(first_name="Inactive", last_name="User", is_active=False)

        response = client.get(
            "/api/surveyors?include_inactive=true", headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2


class TestGetSurveyorById:
    """Tests for GET /api/surveyors/{id}"""

    def test_get_surveyor_by_id(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should return surveyor by ID."""
        surveyor = create_surveyor(first_name="John", last_name="Doe")

        response = client.get(f"/api/surveyors/{surveyor.id}", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == surveyor.id
        assert data["first_name"] == "John"
        assert data["last_name"] == "Doe"

    def test_get_surveyor_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent surveyor."""
        response = client.get("/api/surveyors/99999", headers=auth_headers)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestCreateSurveyor:
    """Tests for POST /api/surveyors"""

    def test_create_surveyor(self, client: TestClient, auth_headers: dict):
        """Should create a new surveyor."""
        response = client.post(
            "/api/surveyors",
            json={"first_name": "Jane", "last_name": "Doe"},
            headers=auth_headers,
        )
        assert response.status_code == 201

        data = response.json()
        assert data["first_name"] == "Jane"
        assert data["last_name"] == "Doe"
        assert data["is_active"] is True
        assert "id" in data

    def test_create_surveyor_without_last_name(
        self, client: TestClient, auth_headers: dict
    ):
        """Should create surveyor with only first name."""
        response = client.post(
            "/api/surveyors",
            json={"first_name": "Madonna"},
            headers=auth_headers,
        )
        assert response.status_code == 201

        data = response.json()
        assert data["first_name"] == "Madonna"
        assert data["last_name"] is None

    def test_create_surveyor_duplicate_name(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should return 409 for duplicate surveyor name."""
        create_surveyor(first_name="John", last_name="Doe")

        response = client.post(
            "/api/surveyors",
            json={"first_name": "John", "last_name": "Doe"},
            headers=auth_headers,
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

    def test_create_surveyor_unauthorized(self, client: TestClient):
        """Should return 401 without authentication."""
        response = client.post(
            "/api/surveyors",
            json={"first_name": "Jane", "last_name": "Doe"},
        )
        assert response.status_code == 401


class TestUpdateSurveyor:
    """Tests for PUT /api/surveyors/{id}"""

    def test_update_surveyor(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should update surveyor fields."""
        surveyor = create_surveyor(first_name="John", last_name="Doe")

        response = client.put(
            f"/api/surveyors/{surveyor.id}",
            json={"first_name": "Jane", "last_name": "Smith"},
            headers=auth_headers,
        )
        assert response.status_code == 200

        data = response.json()
        assert data["first_name"] == "Jane"
        assert data["last_name"] == "Smith"

    def test_update_surveyor_partial(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should update only provided fields."""
        surveyor = create_surveyor(first_name="John", last_name="Doe")

        response = client.put(
            f"/api/surveyors/{surveyor.id}",
            json={"first_name": "Jane"},
            headers=auth_headers,
        )
        assert response.status_code == 200

        data = response.json()
        assert data["first_name"] == "Jane"
        assert data["last_name"] == "Doe"  # Unchanged

    def test_update_surveyor_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent surveyor."""
        response = client.put(
            "/api/surveyors/99999",
            json={"first_name": "Jane"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_surveyor_unauthorized(
        self, client: TestClient, create_surveyor
    ):
        """Should return 401 without authentication."""
        surveyor = create_surveyor(first_name="John", last_name="Doe")

        response = client.put(
            f"/api/surveyors/{surveyor.id}",
            json={"first_name": "Jane"},
        )
        assert response.status_code == 401


class TestDeleteSurveyor:
    """Tests for DELETE /api/surveyors/{id}"""

    def test_delete_surveyor(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should delete surveyor."""
        surveyor = create_surveyor(first_name="John", last_name="Doe")

        response = client.delete(
            f"/api/surveyors/{surveyor.id}", headers=auth_headers
        )
        assert response.status_code == 204

        # Verify surveyor is deleted
        get_response = client.get(
            f"/api/surveyors/{surveyor.id}", headers=auth_headers
        )
        assert get_response.status_code == 404

    def test_delete_surveyor_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent surveyor."""
        response = client.delete("/api/surveyors/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_surveyor_unauthorized(self, client: TestClient, create_surveyor):
        """Should return 401 without authentication."""
        surveyor = create_surveyor(first_name="John", last_name="Doe")

        response = client.delete(f"/api/surveyors/{surveyor.id}")
        assert response.status_code == 401


class TestDeactivateSurveyor:
    """Tests for POST /api/surveyors/{id}/deactivate"""

    def test_deactivate_surveyor(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should deactivate surveyor."""
        surveyor = create_surveyor(first_name="John", last_name="Doe", is_active=True)

        response = client.post(
            f"/api/surveyors/{surveyor.id}/deactivate", headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert data["is_active"] is False

    def test_deactivate_already_inactive(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should return 400 when deactivating already inactive surveyor."""
        surveyor = create_surveyor(first_name="John", last_name="Doe", is_active=False)

        response = client.post(
            f"/api/surveyors/{surveyor.id}/deactivate", headers=auth_headers
        )
        assert response.status_code == 400
        assert "already inactive" in response.json()["detail"].lower()


class TestReactivateSurveyor:
    """Tests for POST /api/surveyors/{id}/reactivate"""

    def test_reactivate_surveyor(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should reactivate surveyor."""
        surveyor = create_surveyor(first_name="John", last_name="Doe", is_active=False)

        response = client.post(
            f"/api/surveyors/{surveyor.id}/reactivate", headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert data["is_active"] is True

    def test_reactivate_already_active(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should return 400 when reactivating already active surveyor."""
        surveyor = create_surveyor(first_name="John", last_name="Doe", is_active=True)

        response = client.post(
            f"/api/surveyors/{surveyor.id}/reactivate", headers=auth_headers
        )
        assert response.status_code == 400
        assert "already active" in response.json()["detail"].lower()
