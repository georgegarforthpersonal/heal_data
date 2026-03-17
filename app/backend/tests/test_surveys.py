"""
Tests for Surveys Router

Tests CRUD operations for the /api/surveys endpoints.
"""

from datetime import date
from fastapi.testclient import TestClient


class TestGetSurveys:
    """Tests for GET /api/surveys"""

    def test_get_surveys_empty(self, client: TestClient, auth_headers: dict):
        """Should return empty data when no surveys exist."""
        response = client.get("/api/surveys", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert data["data"] == []
        assert data["total"] == 0

    def test_get_surveys_returns_paginated_list(
        self, client: TestClient, auth_headers: dict, create_survey, create_surveyor
    ):
        """Should return paginated list of surveys."""
        surveyor = create_surveyor()
        create_survey(surveyor_ids=[surveyor.id])
        create_survey(surveyor_ids=[surveyor.id])

        response = client.get("/api/surveys", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 2
        assert data["total"] == 2
        assert data["page"] == 1

    def test_get_surveys_pagination(
        self, client: TestClient, auth_headers: dict, create_survey, create_surveyor
    ):
        """Should respect pagination parameters."""
        surveyor = create_surveyor()
        for _ in range(5):
            create_survey(surveyor_ids=[surveyor.id])

        response = client.get(
            "/api/surveys?page=1&limit=2", headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 2
        assert data["total"] == 5
        assert data["total_pages"] == 3


class TestGetSurveyById:
    """Tests for GET /api/surveys/{id}"""

    def test_get_survey_by_id(
        self, client: TestClient, auth_headers: dict, create_survey, create_surveyor
    ):
        """Should return survey by ID."""
        surveyor = create_surveyor()
        survey = create_survey(
            survey_date=date(2024, 6, 15),
            surveyor_ids=[surveyor.id],
        )

        response = client.get(f"/api/surveys/{survey.id}", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == survey.id
        assert data["date"] == "2024-06-15"
        assert surveyor.id in data["surveyor_ids"]

    def test_get_survey_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent survey."""
        response = client.get("/api/surveys/99999", headers=auth_headers)
        assert response.status_code == 404


class TestCreateSurvey:
    """Tests for POST /api/surveys"""

    def test_create_survey(
        self, client: TestClient, auth_headers: dict, create_surveyor
    ):
        """Should create a new survey."""
        surveyor = create_surveyor()

        response = client.post(
            "/api/surveys",
            json={
                "date": "2024-07-01",
                "surveyor_ids": [surveyor.id],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        data = response.json()
        assert data["date"] == "2024-07-01"
        assert surveyor.id in data["surveyor_ids"]

    def test_create_survey_with_location(
        self, client: TestClient, auth_headers: dict,
        create_surveyor, create_location
    ):
        """Should create survey with location."""
        surveyor = create_surveyor()
        location = create_location(name="Field A")

        response = client.post(
            "/api/surveys",
            json={
                "date": "2024-07-01",
                "surveyor_ids": [surveyor.id],
                "location_id": location.id,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["location_id"] == location.id

    def test_create_survey_unauthorized(self, client: TestClient):
        """Should return 401 without authentication."""
        response = client.post(
            "/api/surveys",
            json={"date": "2024-07-01", "surveyor_ids": []},
        )
        assert response.status_code == 401


class TestUpdateSurvey:
    """Tests for PUT /api/surveys/{id}"""

    def test_update_survey(
        self, client: TestClient, auth_headers: dict, create_survey, create_surveyor
    ):
        """Should update survey fields."""
        surveyor = create_surveyor()
        survey = create_survey(surveyor_ids=[surveyor.id])

        response = client.put(
            f"/api/surveys/{survey.id}",
            json={"notes": "Updated notes"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notes"] == "Updated notes"

    def test_update_survey_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent survey."""
        response = client.put(
            "/api/surveys/99999",
            json={"notes": "Test"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeleteSurvey:
    """Tests for DELETE /api/surveys/{id}"""

    def test_delete_survey(
        self, client: TestClient, auth_headers: dict, create_survey, create_surveyor
    ):
        """Should delete survey."""
        surveyor = create_surveyor()
        survey = create_survey(surveyor_ids=[surveyor.id])

        response = client.delete(f"/api/surveys/{survey.id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify deleted
        get_response = client.get(f"/api/surveys/{survey.id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_delete_survey_not_found(self, client: TestClient, auth_headers: dict):
        """Should return 404 for non-existent survey."""
        response = client.delete("/api/surveys/99999", headers=auth_headers)
        assert response.status_code == 404


class TestSurveySightings:
    """Tests for survey sighting endpoints"""

    def test_get_sightings_empty(
        self, client: TestClient, auth_headers: dict, create_survey, create_surveyor
    ):
        """Should return empty list when no sightings exist."""
        surveyor = create_surveyor()
        survey = create_survey(surveyor_ids=[surveyor.id])

        response = client.get(
            f"/api/surveys/{survey.id}/sightings", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_create_sighting(
        self, client: TestClient, auth_headers: dict,
        create_survey, create_surveyor, create_species
    ):
        """Should create a sighting for a survey."""
        surveyor = create_surveyor()
        survey = create_survey(surveyor_ids=[surveyor.id])
        species = create_species(name="Red Admiral")

        response = client.post(
            f"/api/surveys/{survey.id}/sightings",
            json={
                "species_id": species.id,
                "count": 5,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        data = response.json()
        assert data["species_id"] == species.id
        assert data["count"] == 5

    def test_get_sightings_for_nonexistent_survey(
        self, client: TestClient, auth_headers: dict
    ):
        """Should return 404 for non-existent survey."""
        response = client.get("/api/surveys/99999/sightings", headers=auth_headers)
        assert response.status_code == 404
