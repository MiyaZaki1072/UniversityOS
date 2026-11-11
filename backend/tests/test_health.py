import os
import subprocess
import sys

import yaml
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
    # A local .env (loaded into this process by the settings) may relax the HTTPS settings;
    # check the production defaults instead.
    relaxed = ("SECURE_", "SESSION_COOKIE_", "CSRF_COOKIE_")
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith(relaxed)},
        "DJANGO_ENV_FILE": str(settings.BASE_DIR / ".nonexistent.env"),
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
    env = {
        k: v
        for k, v in os.environ.items()
        if k not in {"DJANGO_SECRET_KEY", "DATABASE_URL", "DJANGO_ENV_FILE"}
    }
    env["DJANGO_ENV_FILE"] = str(settings.BASE_DIR / ".nonexistent.env")
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


def test_docker_compose_and_env_example_configuration() -> None:
    repo_root = settings.BASE_DIR.parent
    compose_prod = yaml.safe_load((repo_root / "docker-compose.yml").read_text(encoding="utf-8"))
    compose_dev = yaml.safe_load((repo_root / "docker-compose.dev.yml").read_text(encoding="utf-8"))

    services = compose_prod["services"]
    assert {"db", "backend", "web"} <= set(services.keys())
    assert services["db"]["image"] == "postgres:16"
    assert "ports" not in services["db"]
    assert "expose" not in services["db"]

    dev_services = compose_dev["services"]
    assert dev_services["db"]["ports"] == ["127.0.0.1:5432:5432"]

    env_example = (repo_root / ".env.example").read_text(encoding="utf-8")
    for required_var in (
        "DJANGO_SECRET_KEY=",
        "DATABASE_URL=",
        "ALLOWED_HOSTS=",
        "CSRF_TRUSTED_ORIGINS=",
        "ADMIN_URL=",
    ):
        assert required_var in env_example
