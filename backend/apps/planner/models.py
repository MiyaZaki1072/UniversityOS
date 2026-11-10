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
