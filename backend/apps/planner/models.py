from django.conf import settings
from django.db import models


class PlannerState(models.Model):
    """The user's whole planner (courses, timetable, grades, tasks) as one JSON document.

    The web app keeps a copy on each device and syncs it here. `version` goes up by one on
    every save so two devices can't silently overwrite each other.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="planner"
    )
    data = models.JSONField(default=dict)
    version = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Planner of {self.user} (v{self.version})"


class CalendarFeed(models.Model):
    """A secret link that calendar apps (Google, Apple, Outlook) subscribe to.

    Anyone with the token can read the user's schedule, so it is long and random and can be
    rotated or turned off at any time.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calendar_feed"
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Calendar feed of {self.user}"
