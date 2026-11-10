from django.urls import path

from .views import PlannerStateView

urlpatterns = [
    path("state/", PlannerStateView.as_view(), name="planner-state"),
]
