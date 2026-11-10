import os
import subprocess
import sys

from django.apps import apps
from django.conf import settings
from django.core.management.utils import get_random_secret_key
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
        "DJANGO_SECRET_KEY": get_random_secret_key(),
        "DATABASE_URL": "postgres://uos:uos@localhost:5432/uos",
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


def test_production_settings_requires_env_vars() -> None:
    env = {k: v for k, v in os.environ.items() if k not in {"DJANGO_SECRET_KEY", "DATABASE_URL"}}
    result = subprocess.run(
        [
            sys.executable,
            "manage.py",
            "check",
            "--settings=config.settings.production",
        ],
        cwd=settings.BASE_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "ImproperlyConfigured" in result.stderr
