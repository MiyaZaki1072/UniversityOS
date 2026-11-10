import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.planner.models import PlannerState

pytestmark = pytest.mark.django_db

PLANNER = {"version": 1, "semester": None, "courses": [], "tasks": [], "nextId": 1}


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()


@pytest.fixture
def user():
    return get_user_model().objects.create_user(
        "freyr", password="correct-horse-1", first_name="Freyr"
    )


@pytest.fixture
def other():
    return get_user_model().objects.create_user("other", password="correct-horse-2")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


# --- auth -------------------------------------------------------------------


def test_login_wrong_password_uses_error_shape(user):
    c = APIClient(enforce_csrf_checks=True)
    c.get("/api/v1/auth/csrf/")
    token = c.cookies["csrftoken"].value
    r = c.post(
        "/api/v1/auth/login/",
        {"username": "freyr", "password": "nope"},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert r.status_code == 400
    assert r.json() == {
        "detail": "Wrong username or password.",
        "code": "validation_error",
        "fields": {},
    }


def test_login_sets_session_and_me_works(user):
    c = APIClient(enforce_csrf_checks=True)
    c.get("/api/v1/auth/csrf/")
    token = c.cookies["csrftoken"].value
    r = c.post(
        "/api/v1/auth/login/",
        {"username": "freyr", "password": "correct-horse-1"},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert r.status_code == 200
    assert "sessionid" in c.cookies
    me = c.get("/api/v1/auth/me/")
    assert me.json() == {
        "id": user.id,
        "username": "freyr",
        "display_name": "Freyr",
        "timezone": "Asia/Bangkok",
    }


def test_login_without_csrf_is_rejected(user):
    c = APIClient(enforce_csrf_checks=True)
    r = c.post(
        "/api/v1/auth/login/", {"username": "freyr", "password": "correct-horse-1"}, format="json"
    )
    assert r.status_code == 403


def test_login_is_throttled(user):
    c = APIClient()
    for _ in range(5):
        c.post("/api/v1/auth/login/", {"username": "freyr", "password": "bad"}, format="json")
    r = c.post("/api/v1/auth/login/", {"username": "freyr", "password": "bad"}, format="json")
    assert r.status_code == 429
    assert r.json()["code"] == "throttled"


def test_me_requires_login():
    r = APIClient().get("/api/v1/auth/me/")
    assert r.status_code == 403
    assert r.json()["code"] == "permission_denied"


def test_no_registration_endpoint():
    assert APIClient().post("/api/v1/auth/register/", {}, format="json").status_code == 404


# --- planner sync -------------------------------------------------------------


def test_planner_requires_login():
    assert APIClient().get("/api/v1/planner/state/").status_code == 403
    assert APIClient().put("/api/v1/planner/state/", {}, format="json").status_code == 403


def test_empty_planner_has_version_zero(client):
    r = client.get("/api/v1/planner/state/")
    assert r.status_code == 200
    assert r.json() == {"version": 0, "data": None, "updated_at": None}


def test_save_then_load(client):
    r = client.put("/api/v1/planner/state/", {"base_version": 0, "data": PLANNER}, format="json")
    assert r.status_code == 200
    assert r.json()["version"] == 1
    r = client.get("/api/v1/planner/state/")
    assert r.json()["data"] == PLANNER
    assert r.json()["version"] == 1


def test_stale_save_is_a_conflict_and_returns_current(client):
    client.put("/api/v1/planner/state/", {"base_version": 0, "data": PLANNER}, format="json")
    newer = {**PLANNER, "nextId": 5}
    client.put("/api/v1/planner/state/", {"base_version": 1, "data": newer}, format="json")

    r = client.put("/api/v1/planner/state/", {"base_version": 1, "data": PLANNER}, format="json")
    assert r.status_code == 409
    body = r.json()
    assert body["code"] == "version_conflict"
    assert body["current"]["version"] == 2
    assert body["current"]["data"]["nextId"] == 5
    assert PlannerState.objects.get().data["nextId"] == 5


@pytest.mark.parametrize(
    "data",
    [
        [],
        {"version": 2, "courses": [], "tasks": [], "nextId": 1},
        {"version": 1, "courses": {}, "tasks": [], "nextId": 1},
        {"version": 1, "courses": [], "tasks": [], "nextId": "1"},
    ],
)
def test_invalid_planner_is_rejected(client, data):
    r = client.put("/api/v1/planner/state/", {"base_version": 0, "data": data}, format="json")
    assert r.status_code == 400
    assert "data" in r.json()["fields"]
    assert not PlannerState.objects.exists()


def test_users_never_see_each_other(client, other):
    client.put("/api/v1/planner/state/", {"base_version": 0, "data": PLANNER}, format="json")
    c2 = APIClient()
    c2.force_authenticate(other)
    assert c2.get("/api/v1/planner/state/").json()["version"] == 0
    c2.put(
        "/api/v1/planner/state/",
        {"base_version": 0, "data": {**PLANNER, "nextId": 9}},
        format="json",
    )
    assert client.get("/api/v1/planner/state/").json()["data"]["nextId"] == 1
