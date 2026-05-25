import asyncio

from scrapers._common import MAX_ITEMS
from scrapers.nike import fetch_nike_launch, is_jordan_drop


async def scrape_jordan() -> list[dict]:
    rows = await fetch_nike_launch()
    out = [{**d, "brand": "Jordan"} for d in rows if is_jordan_drop(d)]
    return out[:MAX_ITEMS]


if __name__ == "__main__":
    results = asyncio.run(scrape_jordan())
    for r in results:
        print(r)
    print(f"Found {len(results)} Jordan launch items")
