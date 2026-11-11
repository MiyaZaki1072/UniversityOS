from datetime import date

import pytest
from django.contrib.auth import get_user_model
from icalendar import Calendar
from rest_framework.test import APIClient

from apps.planner.ics import build_calendar
from apps.planner.models import CalendarFeed, PlannerState

pytestmark = pytest.mark.django_db

PLANNER = {
    "version": 1,
    "semester": {"name": "S1", "start_date": "2026-11-02", "end_date": "2026-12-18"},
    "courses": [
        {
            "id": 1,
            "code": "MATH101",
            "name": "Calculus I",
            "meetings": [
                {
                    "id": 2,
                    "weekday": 2,
                    "start_time": "09:00:00",
                    "end_time": "10:30:00",
                    "location": "SC1-201",
                    "starts_on": None,
                    "ends_on": None,
                },
                {"id": 99, "weekday": "bad", "start_time": "x", "end_time": None},
            ],
            "exams": [
                {
                    "id": 3,
                    "title": "Midterm",
                    "event_type": "EXAM",
                    "start_at": "2026-11-20T13:00:00+07:00",
                    "end_at": "2026-11-20T16:00:00+07:00",
                    "location": "Hall",
                }
            ],
            "categories": [
                {
                    "id": 4,
                    "assessments": [
                        {
                            "id": 5,
                            "title": "HW1",
                            "due_at": "2026-11-12T23:59:00+07:00",
                            "points_earned": None,
                        },
                        {
                            "id": 6,
                            "title": "HW0",
                            "due_at": "2026-11-05T23:59:00+07:00",
                            "points_earned": "9",
                        },
                    ],
                }
            ],
        }
    ],
    "tasks": [
        {
            "id": 7,
            "title": "Lab report",
            "course_id": 1,
            "due_at": "2026-11-13T17:00:00+07:00",
            "status": "TODO",
        },
        {
            "id": 8,
            "title": "Done one",
            "course_id": None,
            "due_at": "2026-11-13T17:00:00+07:00",
            "status": "COMPLETED",
        },
    ],
    "nextId": 9,
}


def events(body: bytes) -> dict[str, object]:
    cal = Calendar.from_ical(body)
    return {str(c["uid"]).split("@")[0]: c for c in cal.walk("VEVENT")}


def test_build_calendar_contents():
    ev = events(build_calendar(PLANNER, today=date(2026, 11, 11)))
    assert set(ev) == {"class-2", "exam-3", "item-5", "task-7"}

    cls = ev["class-2"]
    assert str(cls["summary"]) == "MATH101 · Calculus I"
    # First Wednesday on or after the semester start (Mon 2 Nov) is 4 Nov, 09:00 Bangkok time.
    assert cls.decoded("dtstart").isoformat() == "2026-11-04T09:00:00+07:00"
    rule = cls["rrule"]
    assert rule["FREQ"] == ["WEEKLY"]
    assert rule["UNTIL"][0].isoformat() == "2026-12-18T16:59:59+00:00"
    assert str(cls["location"]) == "SC1-201"

    assert str(ev["exam-3"]["summary"]) == "MATH101 · Midterm"
    assert str(ev["task-7"]["summary"]) == "Due: MATH101 · Lab report"


def test_build_calendar_survives_garbage():
    assert b"BEGIN:VCALENDAR" in build_calendar({"courses": "nope", "tasks": [1, None, {}]})
    assert b"BEGIN:VCALENDAR" in build_calendar(None)


@pytest.fixture
def user():
    return get_user_model().objects.create_user("freyr", password="correct-horse-1")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_feed_requires_login():
    assert APIClient().get("/api/v1/planner/calendar-feed/").status_code == 403
    assert APIClient().post("/api/v1/planner/calendar-feed/").status_code == 403


def test_feed_lifecycle(client, user):
    assert client.get("/api/v1/planner/calendar-feed/").json() == {"path": None}

    PlannerState.objects.create(user=user, data=PLANNER, version=1)
    path = client.post("/api/v1/planner/calendar-feed/").json()["path"]
    assert path.startswith("/api/v1/planner/calendar/") and path.endswith(".ics")
    assert len(CalendarFeed.objects.get().token) >= 40

    r = APIClient().get(path)  # calendar apps send no login
    assert r.status_code == 200
    assert r["Content-Type"].startswith("text/calendar")
    assert "exam-3" in events(r.content)

    new_path = client.post("/api/v1/planner/calendar-feed/").json()["path"]
    assert new_path != path
    assert APIClient().get(path).status_code == 404  # rotated: old link stops working

    assert client.delete("/api/v1/planner/calendar-feed/").status_code == 204
    assert APIClient().get(new_path).status_code == 404


def test_unknown_token_is_404():
    assert APIClient().get("/api/v1/planner/calendar/not-a-real-token.ics").status_code == 404


def test_feed_only_shows_owner(user):
    other = get_user_model().objects.create_user("other", password="correct-horse-2")
    PlannerState.objects.create(user=other, data=PLANNER, version=1)
    feed = CalendarFeed.objects.create(user=user, token="t" * 43)
    r = APIClient().get(f"/api/v1/planner/calendar/{feed.token}.ics")
    assert r.status_code == 200
    assert events(r.content) == {}
