"""
Long-running worker: runs scrape every 30 minutes (default).

Railway start command: python scheduler.py

Override interval: SCRAPE_INTERVAL_MINUTES=30
"""

import logging
import os

from apscheduler.schedulers.blocking import BlockingScheduler

from scrape_job import check_scraper_env, run_scrape_sync

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEFAULT_INTERVAL_MINUTES = 30


def _interval_minutes() -> int:
    raw = (os.getenv("SCRAPE_INTERVAL_MINUTES") or "").strip()
    if not raw:
        return DEFAULT_INTERVAL_MINUTES
    try:
        minutes = int(raw)
    except ValueError:
        log.warning(
            "Invalid SCRAPE_INTERVAL_MINUTES=%r; using %s",
            raw,
            DEFAULT_INTERVAL_MINUTES,
        )
        return DEFAULT_INTERVAL_MINUTES
    if minutes < 5:
        log.warning(
            "SCRAPE_INTERVAL_MINUTES=%s is below 5; using 5 (Railway cron minimum)",
            minutes,
        )
        return 5
    return minutes


if __name__ == "__main__":
    check_scraper_env()
    interval = _interval_minutes()
    scheduler = BlockingScheduler()
    scheduler.add_job(
        run_scrape_sync,
        "interval",
        minutes=interval,
        id="dropalert_scrape",
        max_instances=1,
    )
    log.info(
        "DropAlert scheduler started (scrape every %s minutes via run_scrape pipeline)",
        interval,
    )
    run_scrape_sync()
    scheduler.start()
