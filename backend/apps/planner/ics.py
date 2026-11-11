"""Turn a saved planner (the JSON the web app syncs) into an iCalendar feed.

The planner is user-supplied JSON, so every field is checked and bad entries are skipped
instead of failing the whole feed.
"""

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from icalendar import Calendar, Event

TZ = ZoneInfo("Asia/Bangkok")
UTC = ZoneInfo("UTC")
UID_DOMAIN = "university-os"
# Weekly classes without semester dates still need an end, so calendars don't repeat them forever.
DEFAULT_WEEKS = 18


def _str(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _date(v: Any) -> date | None:
    try:
        return date.fromisoformat(v) if isinstance(v, str) and v else None
    except ValueError:
        return None


def _time(v: Any) -> time | None:
    try:
        return time.fromisoformat(v) if isinstance(v, str) and v else None
    except ValueError:
        return None


def _datetime(v: Any) -> datetime | None:
    if not isinstance(v, str) or not v:
        return None
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=TZ)


def _list(v: Any) -> list:
    return v if isinstance(v, list) else []


def _dict(v: Any) -> dict:
    return v if isinstance(v, dict) else {}


def _label(code: str, title: str) -> str:
    return f"{code} · {title}" if code else title


def _event(uid: str, summary: str, start: datetime, end: datetime, **extra: Any) -> Event:
    ev = Event()
    ev.add("uid", f"{uid}@{UID_DOMAIN}")
    ev.add("summary", summary)
    ev.add("dtstart", start)
    ev.add("dtend", end if end > start else start)
    ev.add("dtstamp", datetime.now(tz=UTC))
    for key, value in extra.items():
        if value:
            ev.add(key, value)
    return ev


def build_calendar(data: Any, today: date | None = None) -> bytes:
    data = _dict(data)
    today = today or datetime.now(tz=TZ).date()
    semester = _dict(data.get("semester"))
    sem_start = _date(semester.get("start_date"))
    sem_end = _date(semester.get("end_date"))

    cal = Calendar()
    cal.add("prodid", "-//University OS//Planner//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", "University OS")
    cal.add("x-wr-timezone", "Asia/Bangkok")
    cal.add("x-published-ttl", "PT1H")

    courses = [_dict(c) for c in _list(data.get("courses"))]
    for course in courses:
        code = _str(course.get("code"))
        name = _str(course.get("name")) or code or "Class"

        for m in _list(course.get("meetings")):
            m = _dict(m)
            weekday = m.get("weekday")
            start_t, end_t = _time(m.get("start_time")), _time(m.get("end_time"))
            if type(weekday) is not int or not 0 <= weekday <= 6 or not start_t or not end_t:
                continue
            first = (
                _date(m.get("starts_on")) or sem_start or (today - timedelta(days=today.weekday()))
            )
            last = _date(m.get("ends_on")) or sem_end or (first + timedelta(weeks=DEFAULT_WEEKS))
            first += timedelta(days=(weekday - first.weekday()) % 7)
            if first > last:
                continue
            start = datetime.combine(first, start_t, TZ)
            end = datetime.combine(first, end_t, TZ)
            until = datetime.combine(last, time(23, 59, 59), TZ).astimezone(UTC)
            ev = _event(
                f"class-{m.get('id')}",
                _label(code, name),
                start,
                end,
                location=_str(m.get("location")),
            )
            ev.add("rrule", {"freq": "weekly", "until": until})
            cal.add_component(ev)

        for e in _list(course.get("exams")):
            e = _dict(e)
            start, end = _datetime(e.get("start_at")), _datetime(e.get("end_at"))
            if not start:
                continue
            kind = "Quiz" if e.get("event_type") == "QUIZ" else "Exam"
            title = _str(e.get("title")) or kind
            cal.add_component(
                _event(
                    f"exam-{e.get('id')}",
                    _label(code, title),
                    start,
                    end or start,
                    location=_str(e.get("location")),
                    categories=kind,
                )
            )

        for g in _list(course.get("categories")):
            for a in _list(_dict(g).get("assessments")):
                a = _dict(a)
                due = _datetime(a.get("due_at"))
                if not due or a.get("points_earned") not in (None, ""):
                    continue
                title = _str(a.get("title")) or "Graded item"
                cal.add_component(
                    _event(f"item-{a.get('id')}", f"Due: {_label(code, title)}", due, due)
                )

    codes = {c.get("id"): _str(c.get("code")) for c in courses}
    for t in _list(data.get("tasks")):
        t = _dict(t)
        due = _datetime(t.get("due_at"))
        if not due or t.get("status") == "COMPLETED":
            continue
        title = _str(t.get("title")) or "Task"
        code = codes.get(t.get("course_id"), "")
        cal.add_component(_event(f"task-{t.get('id')}", f"Due: {_label(code, title)}", due, due))

    return cal.to_ical()
