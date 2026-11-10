from django.conf import settings
from django.contrib import admin
from django.urls import path
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


@extend_schema(
    summary="Health check",
    responses={
        200: {
            "type": "object",
            "properties": {"status": {"type": "string", "example": "ok"}},
            "required": ["status"],
        }
    },
    auth=[],
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health_check(request: Request) -> Response:
    return Response({"status": "ok"})


admin_url = settings.ADMIN_URL.lstrip("/")
if not admin_url.endswith("/"):
    admin_url = f"{admin_url}/"

urlpatterns = [
    path(admin_url, admin.site.urls),
    path("api/health/", health_check, name="health-check"),
]
