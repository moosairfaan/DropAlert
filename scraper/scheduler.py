"""Run the scrape pipeline every 30 minutes (local or long-running Railway worker)."""

import asyncio
import logging

from apscheduler.schedulers.blocking import BlockingScheduler

from pipeline import run_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def _run_once() -> None:
    asyncio.run(run_pipeline())


if __name__ == "__main__":
    scheduler = BlockingScheduler()
    scheduler.add_job(_run_once, "interval", minutes=30, id="dropalert_pipeline")
    log.info("DropAlert scheduler started (every 30 minutes)")
    _run_once()
    scheduler.start()
