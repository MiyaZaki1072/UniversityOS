import os
import subprocess
import sys

from django.apps import apps
from django.conf import settings
from rest_framework.test import APIClient


def test_health_endpoint_returns_ok_without_auth() -> None:
    client = APIClient()
    response = client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_installed_apps_and_timezone_configuration() -> None:
    assert settings.TIME_ZONE == "UTC"
    assert settings.USE_TZ is True
    assert settings.DEFAULT_AUTO_FIELD == "django.db.models.BigAutoField"

    expected_apps = [
        "accounts",
        "academics",
        "gradebook",
        "scheduling",
        "resources",
        "tasks",
        "habits",
        "study_sessions",
        "imports",
        "dashboard",
    ]
    for app_label in expected_apps:
        app_config = apps.get_app_config(app_label)
        assert app_config.name == f"apps.{app_label}"
        assert app_config.default_auto_field == "django.db.models.BigAutoField"


def test_production_settings_deploy_check() -> None:
    env = {
        **os.environ,
        "DJANGO_SECRET_KEY": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    }
    result = subprocess.run(
        [
            sys.executable,
            "manage.py",
            "check",
            "--deploy",
            "--fail-level=WARNING",
            "--settings=config.settings.production",
        ],
        cwd=settings.BASE_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
