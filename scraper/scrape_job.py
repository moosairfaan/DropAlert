"""Shared scrape entry — used by scheduler, cron, and HTTP /api/scrape."""

from __future__ import annotations

import asyncio
import logging
import os
import sys

from config import get_database_url
from db import ensure_drops_schema
from pipeline import run_pipeline

log = logging.getLogger(__name__)

REQUIRED_ENV = (
    "DATABASE_URL",
    "REDIS_URL",
    "RESEND_API_KEY",
    "ALERT_FROM_EMAIL",
)


def check_scraper_env() -> None:
    """Fail fast if Railway/local env is missing required vars."""
    try:
        get_database_url()
    except RuntimeError as e:
        log.error("%s", e)
        sys.exit(1)

    missing = [
        k
        for k in REQUIRED_ENV
        if k != "DATABASE_URL" and not (os.getenv(k) or "").strip()
    ]
    if missing:
        log.error(
            "Missing required environment variables: %s. "
            "Set them on the Railway scraper service. See scraper/RAILWAY.md.",
            ", ".join(missing),
        )
        sys.exit(1)


async def run_scrape() -> dict:
    """Run all brand scrapers, upsert drops, send alerts. Returns pipeline summary."""
    ensure_drops_schema()
    log.info("Starting scrape job...")
    summary = await run_pipeline()
    log.info("Scrape job finished: %s", summary)
    return summary


def run_scrape_sync() -> dict:
    return asyncio.run(run_scrape())
