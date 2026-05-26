#!/bin/sh
# Railway start script — set SCRAPER_MODE: worker | cron | http
set -e
MODE="${SCRAPER_MODE:-worker}"
case "$MODE" in
  worker) exec python scheduler.py ;;
  cron)   exec python run_scrape.py ;;
  http)   exec python http_server.py ;;
  *)
    echo "Unknown SCRAPER_MODE=$MODE (use worker, cron, or http)" >&2
    exit 1
    ;;
esac
