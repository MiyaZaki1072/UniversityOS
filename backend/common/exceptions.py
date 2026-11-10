"""Standard error shape for every API error: {"detail", "code", "fields"} (spec §13.2)."""

from typing import Any

from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

CODES = {
    status.HTTP_400_BAD_REQUEST: "validation_error",
    status.HTTP_401_UNAUTHORIZED: "not_authenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE: "too_large",
    status.HTTP_429_TOO_MANY_REQUESTS: "throttled",
}


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    fields: dict[str, Any] = {}
    if isinstance(exc, exceptions.ValidationError):
        detail = "Validation failed."
        if isinstance(data, dict):
            non_field = data.pop("non_field_errors", None)
            fields = data
            if non_field:
                detail = str(non_field[0])
        elif isinstance(data, list) and data:
            detail = str(data[0])
        code = "validation_error"
    else:
        detail = str(data.get("detail", "")) if isinstance(data, dict) else str(data)
        code = CODES.get(response.status_code, "error")

    response.data = {"detail": detail, "code": code, "fields": fields}
    return response
