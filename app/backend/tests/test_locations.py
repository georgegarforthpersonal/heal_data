"""
Tests for Locations Router

Tests CRUD operations for the /api/locations endpoints.
"""

from fastapi.testclient import TestClient


class TestGetLocations:
    """Tests for GET /api/locations"""

    def test_get_locations_empty(self, client: TestClient, auth_headers: dict):
        """Should return empty list when no locations exist."""
        response = client.get("/api/locations", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_locations_returns_list(
        self, client: TestClient, auth_headers: dict, create_location
    ):
        """Should return list of locations sorted by name."""
        create_location(name="Woodland")
        create_location(name="Meadow")

        response = client.get("/api/locations", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Meadow"  # Sorted alphabetically
        assert data[1]["name"] == "Woodland"


class TestGetLocationById:
    """Tests for GET /api/locations/{id}"""

    def test_get_location_by_id(
        self, client: TestClient, auth_headers: dict, create_location
    ):
        """Should return location by ID."""
        location = create_location(name="Test Field")

        response = client.get(f"/api/locations/{location.id}", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == location.id
        assert data["name"] == "Test Field"

    def test_get_location_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent location."""
        response = client.get("/api/locations/99999", headers=auth_headers)
        assert response.status_code == 404


class TestCreateLocation:
    """Tests for POST /api/locations"""

    def test_create_location(self, client: TestClient, auth_headers: dict):
        """Should create a new location."""
        response = client.post(
            "/api/locations",
            json={"name": "New Meadow"},
            headers=auth_headers,
        )
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == "New Meadow"
        assert "id" in data

    def test_create_location_unauthorized(self, client: TestClient):
        """Should return 401 without authentication."""
        response = client.post("/api/locations", json={"name": "Test"})
        assert response.status_code == 401


class TestUpdateLocation:
    """Tests for PUT /api/locations/{id}"""

    def test_update_location(
        self, client: TestClient, auth_headers: dict, create_location
    ):
        """Should update location name."""
        location = create_location(name="Old Name")

        response = client.put(
            f"/api/locations/{location.id}",
            json={"name": "New Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    def test_update_location_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent location."""
        response = client.put(
            "/api/locations/99999",
            json={"name": "Test"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeleteLocation:
    """Tests for DELETE /api/locations/{id}"""

    def test_delete_location(
        self, client: TestClient, auth_headers: dict, create_location
    ):
        """Should delete location."""
        location = create_location(name="To Delete")

        response = client.delete(
            f"/api/locations/{location.id}", headers=auth_headers
        )
        assert response.status_code == 204

        # Verify deleted
        get_response = client.get(
            f"/api/locations/{location.id}", headers=auth_headers
        )
        assert get_response.status_code == 404

    def test_delete_location_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent location."""
        response = client.delete("/api/locations/99999", headers=auth_headers)
        assert response.status_code == 404
