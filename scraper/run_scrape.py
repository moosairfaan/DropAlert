#!/usr/bin/env python3
"""
One-shot scrape for Railway Cron (runs pipeline then exits).

Railway → Settings → Cron Schedule: */30 * * * *
Start command: python run_scrape.py
"""

import logging
import sys

from scrape_job import check_scraper_env, run_scrape_sync

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

if __name__ == "__main__":
    check_scraper_env()
    try:
        summary = run_scrape_sync()
        print(summary)
        sys.exit(0)
    except Exception:
        logging.exception("Scrape job failed")
        sys.exit(1)
