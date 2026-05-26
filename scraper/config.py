"""Environment loading for local dev and Railway."""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent
_ENV_FILE = _ROOT / ".env"

_DB_URL_KEYS = (
    "DATABASE_URL",
    "DATABASE_PRIVATE_URL",
    "DATABASE_PUBLIC_URL",
    "POSTGRES_URL",
)


def _on_railway() -> bool:
    return bool(
        os.getenv("RAILWAY_ENVIRONMENT")
        or os.getenv("RAILWAY_SERVICE_ID")
        or os.getenv("RAILWAY_PROJECT_ID")
    )


def load_env() -> None:
    """
    Local: scraper/.env overrides stale shell exports.
    Railway: platform variables must win (never override with a missing .env).
    """
    if _ENV_FILE.is_file():
        load_dotenv(_ENV_FILE, override=not _on_railway())
    elif not _on_railway():
        load_dotenv(override=True)


def _database_url_from_pg_vars() -> str | None:
    """Build URL when Railway exposes PG* vars but not DATABASE_URL."""
    user = (os.getenv("PGUSER") or os.getenv("POSTGRES_USER") or "").strip()
    password = (os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD") or "").strip()
    host = (
        os.getenv("PGHOST")
        or os.getenv("POSTGRES_HOST")
        or os.getenv("RAILWAY_TCP_PROXY_DOMAIN")
        or ""
    ).strip()
    port = (os.getenv("PGPORT") or os.getenv("POSTGRES_PORT") or "5432").strip()
    database = (os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB") or "").strip()
    if not (user and password and host and database):
        return None
    user_q = quote_plus(user)
    password_q = quote_plus(password)
    return f"postgresql://{user_q}:{password_q}@{host}:{port}/{database}"


def get_database_url() -> str:
    load_env()
    for key in _DB_URL_KEYS:
        value = (os.getenv(key) or "").strip()
        if value:
            return value
    built = _database_url_from_pg_vars()
    if built:
        return built
    raise RuntimeError(
        "DATABASE_URL is not set. In Railway → scraper service → Variables, add "
        "DATABASE_URL = ${{Postgres.DATABASE_URL}} (match your Postgres service name), "
        "or reference PGHOST/PGUSER/PGPASSWORD/PGDATABASE from Postgres. "
        "Redeploy after saving. See scraper/RAILWAY.md."
    )
