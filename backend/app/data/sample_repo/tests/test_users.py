from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_users() -> None:
    response = client.get("/api/v2/users")
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Ada"


def test_create_user() -> None:
    response = client.post("/api/v2/users", json={"id": 2, "name": "Grace"})
    assert response.status_code == 201
    assert response.json() == {"id": 2, "name": "Grace"}
