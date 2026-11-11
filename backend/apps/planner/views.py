import json
import secrets

from django.db import transaction
from django.http import Http404, HttpRequest, HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .ics import build_calendar
from .models import CalendarFeed, PlannerState

MAX_BYTES = 5 * 1024 * 1024


class StateSerializer(serializers.Serializer):
    version = serializers.IntegerField(read_only=True)
    data = serializers.JSONField()
    updated_at = serializers.DateTimeField(read_only=True, allow_null=True)


class SaveSerializer(serializers.Serializer):
    base_version = serializers.IntegerField(min_value=0)
    data = serializers.JSONField()

    def validate_data(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        if value.get("version") != 1:
            raise serializers.ValidationError("Unsupported planner format.")
        for key in ("courses", "tasks"):
            if not isinstance(value.get(key), list):
                raise serializers.ValidationError(f'"{key}" must be a list.')
        if not isinstance(value.get("nextId"), int):
            raise serializers.ValidationError('"nextId" must be a number.')
        if len(json.dumps(value)) > MAX_BYTES:
            raise serializers.ValidationError("Planner is too large (5 MB max).")
        return value


class VersionConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The planner was changed on another device."
    default_code = "version_conflict"

    def __init__(self, current: dict):
        super().__init__()
        self.current = current


def payload(state: PlannerState | None) -> dict:
    if state is None:
        return {"version": 0, "data": None, "updated_at": None}
    return {"version": state.version, "data": state.data, "updated_at": state.updated_at}


class PlannerStateView(APIView):
    """GET the saved planner; PUT a new copy based on the version you last saw."""

    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get the saved planner", responses={200: StateSerializer})
    def get(self, request: Request) -> Response:
        state = PlannerState.objects.filter(user=request.user).first()
        return Response(payload(state))

    @extend_schema(
        summary="Save the planner",
        request=SaveSerializer,
        responses={200: StateSerializer, 409: StateSerializer},
    )
    def put(self, request: Request) -> Response:
        s = SaveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        base = s.validated_data["base_version"]

        with transaction.atomic():
            state, _ = PlannerState.objects.select_for_update().get_or_create(user=request.user)
            if state.version != base:
                raise VersionConflict(payload(state))
            state.data = s.validated_data["data"]
            state.version += 1
            state.save()
        return Response(payload(state))

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        # Send the newer copy with a conflict so the device can catch up in one round trip.
        if isinstance(exc, VersionConflict) and response is not None:
            response.data["current"] = exc.current
            response.data["code"] = "version_conflict"
        return response


# --- Calendar feed --------------------------------------------------------------------------


class FeedSerializer(serializers.Serializer):
    path = serializers.CharField(allow_null=True)


def feed_payload(feed: CalendarFeed | None) -> dict:
    return {"path": f"/api/v1/planner/calendar/{feed.token}.ics" if feed else None}


class CalendarFeedView(APIView):
    """See, create/rotate (POST) or turn off (DELETE) the private calendar feed link."""

    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get the calendar feed link", responses={200: FeedSerializer})
    def get(self, request: Request) -> Response:
        return Response(feed_payload(CalendarFeed.objects.filter(user=request.user).first()))

    @extend_schema(
        summary="Create or replace the calendar feed link",
        request=None,
        responses={200: FeedSerializer},
    )
    def post(self, request: Request) -> Response:
        feed, _ = CalendarFeed.objects.update_or_create(
            user=request.user, defaults={"token": secrets.token_urlsafe(32)}
        )
        return Response(feed_payload(feed))

    @extend_schema(summary="Turn off the calendar feed", responses={204: None})
    def delete(self, request: Request) -> Response:
        CalendarFeed.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def calendar_feed_ics(request: HttpRequest, token: str) -> HttpResponse:
    """Public .ics for calendar apps; the long random token in the URL is the only key."""
    feed = CalendarFeed.objects.select_related("user").filter(token=token).first()
    if feed is None:
        raise Http404
    state = PlannerState.objects.filter(user=feed.user).first()
    body = build_calendar(state.data if state else {})
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["Content-Disposition"] = 'inline; filename="university-os.ics"'
    response["Cache-Control"] = "private, max-age=300"
    response["X-Robots-Tag"] = "noindex"
    return response
