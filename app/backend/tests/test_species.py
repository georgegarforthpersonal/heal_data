"""
Tests for Species Router

Tests CRUD operations for the /api/species endpoints.

Note: The species router uses raw SQL (psycopg2) instead of SQLAlchemy ORM.
These tests verify the raw SQL code path works correctly.
"""

import pytest
from fastapi.testclient import TestClient


class TestGetSpecies:
    """Tests for GET /api/species"""

    def test_get_species_returns_list(self, client: TestClient, auth_headers: dict):
        """Should return list of species."""
        response = client.get("/api/species", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_species_filter_by_type(
        self, client: TestClient, auth_headers: dict
    ):
        """Should filter species by type."""
        response = client.get(
            "/api/species?survey_type=butterfly", headers=auth_headers
        )
        assert response.status_code == 200

        # All returned species should be butterflies
        for species in response.json():
            assert species["type"] == "butterfly"


class TestGetSpeciesById:
    """Tests for GET /api/species/{id}"""

    def test_get_species_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent species."""
        response = client.get("/api/species/999999", headers=auth_headers)
        assert response.status_code == 404


class TestCreateSpecies:
    """Tests for POST /api/species"""

    def test_create_species(self, client: TestClient, auth_headers: dict):
        """Should create a new species."""
        response = client.post(
            "/api/species",
            json={
                "name": "Test Butterfly",
                "scientific_name": "Testus butterflicus",
                "type": "butterfly",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == "Test Butterfly"
        assert data["scientific_name"] == "Testus butterflicus"
        assert data["type"] == "butterfly"

        # Clean up - delete the created species
        client.delete(f"/api/species/{data['id']}", headers=auth_headers)

    def test_create_species_unauthorized(self, client: TestClient):
        """Should return 401 without authentication."""
        response = client.post(
            "/api/species",
            json={"name": "Test", "type": "butterfly"},
        )
        assert response.status_code == 401


class TestUpdateSpecies:
    """Tests for PUT /api/species/{id}"""

    def test_update_species(self, client: TestClient, auth_headers: dict):
        """Should update species fields."""
        # Create a species first
        create_response = client.post(
            "/api/species",
            json={
                "name": "Original Name",
                "type": "butterfly",
            },
            headers=auth_headers,
        )
        species_id = create_response.json()["id"]

        try:
            # Update it
            response = client.put(
                f"/api/species/{species_id}",
                json={"name": "Updated Name"},
                headers=auth_headers,
            )
            assert response.status_code == 200
            assert response.json()["name"] == "Updated Name"
        finally:
            # Clean up
            client.delete(f"/api/species/{species_id}", headers=auth_headers)

    def test_update_species_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent species."""
        response = client.put(
            "/api/species/999999",
            json={"name": "Test"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeleteSpecies:
    """Tests for DELETE /api/species/{id}"""

    def test_delete_species(self, client: TestClient, auth_headers: dict):
        """Should delete species."""
        # Create a species first
        create_response = client.post(
            "/api/species",
            json={
                "name": "To Delete",
                "type": "butterfly",
            },
            headers=auth_headers,
        )
        species_id = create_response.json()["id"]

        # Delete it
        response = client.delete(
            f"/api/species/{species_id}", headers=auth_headers
        )
        assert response.status_code == 204

        # Verify deleted
        get_response = client.get(
            f"/api/species/{species_id}", headers=auth_headers
        )
        assert get_response.status_code == 404

    def test_delete_species_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent species."""
        response = client.delete("/api/species/999999", headers=auth_headers)
        assert response.status_code == 404
