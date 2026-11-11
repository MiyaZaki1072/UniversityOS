from django.urls import path

from .views import CalendarFeedView, PlannerStateView, calendar_feed_ics

urlpatterns = [
    path("state/", PlannerStateView.as_view(), name="planner-state"),
    path("calendar-feed/", CalendarFeedView.as_view(), name="planner-calendar-feed"),
    path("calendar/<str:token>.ics", calendar_feed_ics, name="planner-calendar-ics"),
]
