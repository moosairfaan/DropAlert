import asyncio

from scrapers._common import MAX_ITEMS, scrape_shopify_products

FOOTWEAR_URLS = (
    "https://shop-usa.palaceskateboards.com/collections/footwear",
    "https://palaceskateboards.com/collections/footwear",
)


async def scrape_palace() -> list[dict]:
    for url in FOOTWEAR_URLS:
        rows = await scrape_shopify_products(url, "Palace", max_items=MAX_ITEMS)
        if rows:
            return rows
    return []


if __name__ == "__main__":
    results = asyncio.run(scrape_palace())
    for r in results:
        print(r)
    print(f"Found {len(results)} Palace items")
