"""
Tests for Auth Router

Tests authentication endpoints: login, logout, status.
"""

from fastapi.testclient import TestClient


class TestLogin:
    """Tests for POST /api/auth/login"""

    def test_login_success(self, client: TestClient, test_org):
        """Should return token on successful login."""
        response = client.post(
            "/api/auth/login",
            json={"password": "test-password"},
        )
        assert response.status_code == 200

        data = response.json()
        assert data["authenticated"] is True
        assert "token" in data

    def test_login_wrong_password(self, client: TestClient, test_org):
        """Should return 401 for wrong password."""
        response = client.post(
            "/api/auth/login",
            json={"password": "wrong-password"},
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()


class TestLogout:
    """Tests for POST /api/auth/logout"""

    def test_logout(self, client: TestClient):
        """Should return authenticated=false on logout."""
        response = client.post("/api/auth/logout")
        assert response.status_code == 200
        assert response.json()["authenticated"] is False


class TestAuthStatus:
    """Tests for GET /api/auth/status"""

    def test_status_authenticated(
        self, client: TestClient, auth_headers: dict, test_org
    ):
        """Should return authenticated=true with valid token."""
        response = client.get("/api/auth/status", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert data["authenticated"] is True
        assert data["organisation"]["slug"] == test_org.slug

    def test_status_unauthenticated(self, client: TestClient):
        """Should return authenticated=false without token."""
        response = client.get("/api/auth/status")
        assert response.status_code == 200
        assert response.json()["authenticated"] is False

    def test_status_invalid_token(self, client: TestClient):
        """Should return authenticated=false with invalid token."""
        response = client.get(
            "/api/auth/status",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 200
        assert response.json()["authenticated"] is False
