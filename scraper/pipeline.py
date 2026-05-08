import asyncio
import logging
from datetime import datetime

from scrapers.supreme import scrape_supreme
from scrapers.nike import scrape_nike
from scrapers.stockx import scrape_stockx
from db import (
    insert_drop,
    get_subscribers_for_brand,
    has_alert_been_sent,
    log_alert_sent,
    get_stats,
)
from redis_client import is_already_alerted, mark_as_alerted

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


async def run_pipeline() -> dict:
    """
    Main pipeline. Runs all scrapers, deduplicates, inserts new drops, sends alerts.
    Returns a summary dict of what happened.
    """
    start = datetime.now()
    summary = {"new_drops": 0, "alerts_sent": 0, "errors": []}

    # STEP 1: Run all scrapers (concurrently for speed)
    log.info("Starting scrape pipeline...")
    results = []
    for scraper_fn, scraper_name in [
        (scrape_supreme, "Supreme"),
        (scrape_nike, "Nike"),
        (scrape_stockx, "StockX"),
    ]:
        try:
            drops = await scraper_fn()
            log.info(f"{scraper_name}: found {len(drops)} items")
            results.extend(drops)
        except Exception as e:
            log.error(f"{scraper_name} scraper failed: {e}")
            summary["errors"].append(f"{scraper_name}: {str(e)}")

    # STEP 2: For each drop, check Redis dedup → insert DB → trigger alerts
    for drop in results:
        brand = drop["brand"]
        name = drop["name"]

        # Redis check — skip if already alerted
        if is_already_alerted(brand, name):
            log.debug(f"SKIP (already alerted): {brand} - {name}")
            continue

        # Insert into DB
        drop_id = insert_drop(drop)
        if drop_id is None:
            # Drop already in DB (UNIQUE conflict) but Redis key missing — mark it
            mark_as_alerted(brand, name)
            continue

        # New drop — alert subscribers
        log.info(f"NEW DROP: {brand} - {name}")
        summary["new_drops"] += 1
        alerts = await send_alerts_for_drop(drop_id, drop)
        summary["alerts_sent"] += alerts

        # Mark as alerted in Redis AFTER successful alerts
        mark_as_alerted(brand, name)

    elapsed = (datetime.now() - start).total_seconds()
    log.info(
        f'Pipeline complete: {summary["new_drops"]} new drops, '
        f'{summary["alerts_sent"]} alerts sent, {elapsed:.1f}s'
    )
    return summary


async def send_alerts_for_drop(drop_id: int, drop: dict) -> int:
    """Sends SMS and email alerts to all eligible subscribers. Returns count of alerts sent."""
    from alerts.sms import send_sms
    from alerts.email import send_email

    count = 0
    subscribers = get_subscribers_for_brand(drop["brand"])
    for sub in subscribers:
        # SMS alert
        if sub.get("phone") and not has_alert_been_sent(drop_id, sub["id"], "sms"):
            try:
                send_sms(sub["phone"], drop)
                log_alert_sent(drop_id, sub["id"], "sms")
                count += 1
            except Exception as e:
                log.error(f'SMS failed for subscriber {sub["id"]}: {e}')

        # Email alert
        if sub.get("email") and not has_alert_been_sent(drop_id, sub["id"], "email"):
            try:
                send_email(sub["email"], drop)
                log_alert_sent(drop_id, sub["id"], "email")
                count += 1
            except Exception as e:
                log.error(f'Email failed for subscriber {sub["id"]}: {e}')

    return count


if __name__ == "__main__":
    result = asyncio.run(run_pipeline())
    print(result)
