"""
Fill `resell_estimate` for drops that don't have one yet.

Run from the scraper directory:
  python backfill_resell_estimates.py

Uses StockX search (Playwright); needs the same env/proxy as the main scraper.
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from db import get_connection, update_drop_resell_estimate  # noqa: E402
from scrapers.stockx import get_resell_estimate  # noqa: E402


async def main() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name FROM drops
                WHERE resell_estimate IS NULL
                ORDER BY scraped_at DESC
                LIMIT 40
                """
            )
            rows = cur.fetchall()

    if not rows:
        print("No drops with missing resell_estimate.")
        return

    print(f"Backfilling up to {len(rows)} drops...")
    for drop_id, name in rows:
        est = await get_resell_estimate(name)
        if est:
            update_drop_resell_estimate(drop_id, est)
            print(f"  ok id={drop_id} ${est:.2f} — {name[:60]}")
        else:
            print(f"  skip id={drop_id} (no StockX hit) — {name[:60]}")


if __name__ == "__main__":
    asyncio.run(main())
