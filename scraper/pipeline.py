import asyncio
import logging
from datetime import datetime
from typing import Awaitable, Callable

from scrapers.supreme import scrape_supreme
from scrapers.nike import scrape_nike
from scrapers.jordan import scrape_jordan
from scrapers.adidas import scrape_adidas
from scrapers.newbalance import scrape_new_balance
from scrapers.puma import scrape_puma
from scrapers.asics import scrape_asics
from scrapers.kith import scrape_kith
from scrapers.palace import scrape_palace
from db import (
    ensure_drops_schema,
    upsert_drop,
    prune_non_shoe_drops,
    get_subscribers_for_brand,
    has_alert_been_sent,
    log_alert_sent,
    get_stats,
)
from redis_client import is_already_alerted, mark_as_alerted
from scrapers._common import filter_shoe_drops

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

ScraperFn = Callable[[], Awaitable[list[dict]]]

SCRAPERS: list[tuple[ScraperFn, str]] = [
    (scrape_supreme, "Supreme"),
    (scrape_nike, "Nike"),
    (scrape_jordan, "Jordan"),
    (scrape_adidas, "Adidas"),
    (scrape_new_balance, "New Balance"),
    (scrape_puma, "Puma"),
    (scrape_asics, "ASICS"),
    (scrape_kith, "Kith"),
    (scrape_palace, "Palace"),
]


async def _run_scraper(scraper_fn: ScraperFn, scraper_name: str) -> tuple[list[dict], str | None]:
    try:
        drops = await scraper_fn()
        log.info("%s: found %d items", scraper_name, len(drops))
        return drops, None
    except Exception as e:
        log.error("%s scraper failed: %s", scraper_name, e)
        return [], f"{scraper_name}: {str(e)}"


async def run_pipeline() -> dict:
    """
    Main pipeline. Runs all scrapers, deduplicates, inserts new drops, sends alerts.
    Returns a summary dict of what happened.
    """
    start = datetime.now()
    summary = {
        "new_drops": 0,
        "updated_drops": 0,
        "write_failures": 0,
        "alerts_sent": 0,
        "errors": [],
    }

    ensure_drops_schema()
    removed = prune_non_shoe_drops()
    if removed:
        log.info("Pruned %d non-shoe / promo rows from database", removed)

    log.info("Starting scrape pipeline...")
    scrape_results = await asyncio.gather(
        *[_run_scraper(fn, name) for fn, name in SCRAPERS]
    )

    results: list[dict] = []
    for drops, err in scrape_results:
        if err:
            summary["errors"].append(err)
        results.extend(drops)

    before = len(results)
    results = filter_shoe_drops(results)
    skipped = before - len(results)
    if skipped:
        log.info("Filtered %d non-shoe / promo items", skipped)

    for drop in results:
        brand = drop["brand"]
        name = drop["name"]

        write = upsert_drop(drop)
        if write.action == "failed" or write.drop_id is None:
            summary["write_failures"] += 1
            continue

        if write.inserted:
            summary["new_drops"] += 1
            log.info("NEW DROP: %s - %s", brand, name)
        else:
            summary["updated_drops"] += 1

        if is_already_alerted(brand, name):
            log.debug("SKIP alerts (already alerted): %s - %s", brand, name)
            continue

        if write.inserted:
            alerts = await send_alerts_for_drop(write.drop_id, drop)
            summary["alerts_sent"] += alerts
            mark_as_alerted(brand, name)

    elapsed = (datetime.now() - start).total_seconds()
    log.info(
        "Pipeline complete: %d new, %d updated, %d write failures, %d alerts sent, %.1fs",
        summary["new_drops"],
        summary["updated_drops"],
        summary["write_failures"],
        summary["alerts_sent"],
        elapsed,
    )
    return summary


async def send_alerts_for_drop(drop_id: int, drop: dict) -> int:
    """Sends email alerts to eligible subscribers. Returns count of alerts sent."""
    from alerts.resend_alerts import send_email
    from alerts.style_match import drop_matches_style

    count = 0
    subscribers = get_subscribers_for_brand(drop["brand"])
    for sub in subscribers:
        token = sub.get("unsubscribe_token")
        if not sub.get("email") or not token:
            continue
        if has_alert_been_sent(drop_id, sub["id"], "email"):
            continue

        style = sub.get("style_description")
        if not drop_matches_style(
            style,
            name=str(drop.get("name") or ""),
            brand=str(drop.get("brand") or ""),
            price=drop.get("price"),
        ):
            log.info(
                "SKIP alert (style filter): subscriber %s — %s",
                sub["id"],
                drop.get("name"),
            )
            continue

        try:
            send_email(sub["email"], drop, unsubscribe_token=str(token))
            log_alert_sent(drop_id, sub["id"], "email")
            count += 1
        except Exception as e:
            log.error("Email failed for subscriber %s: %s", sub["id"], e)

    return count


if __name__ == "__main__":
    result = asyncio.run(run_pipeline())
    print(result)
