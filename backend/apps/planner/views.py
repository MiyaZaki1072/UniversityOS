import json

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlannerState

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
