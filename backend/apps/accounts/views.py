"""Session authentication endpoints (spec §12.1). There is no registration endpoint."""

from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

DEFAULT_TIMEZONE = "Asia/Bangkok"


def me_payload(user) -> dict:
    return {
        "id": user.id,
        "username": user.get_username(),
        "display_name": user.get_full_name() or user.first_name or user.get_username(),
        "timezone": DEFAULT_TIMEZONE,
    }


MeSerializer = inline_serializer(
    "Me",
    {
        "id": serializers.IntegerField(),
        "username": serializers.CharField(),
        "display_name": serializers.CharField(),
        "timezone": serializers.CharField(),
    },
)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=256, trim_whitespace=False)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(summary="Set the CSRF cookie", responses={204: None})
    def get(self, request: Request) -> Response:
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_scope = "login"

    @extend_schema(summary="Log in", request=LoginSerializer, responses={200: MeSerializer})
    def post(self, request: Request) -> Response:
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = authenticate(
            request, username=s.validated_data["username"], password=s.validated_data["password"]
        )
        if user is None:
            raise serializers.ValidationError("Wrong username or password.")
        login(request, user)
        return Response(me_payload(user))


class LogoutView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(summary="Log out", request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Current user", responses={200: MeSerializer})
    def get(self, request: Request) -> Response:
        return Response(me_payload(request.user))
