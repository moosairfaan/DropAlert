import asyncio

from scrapers._common import MAX_ITEMS, scrape_shopify_products

SHOP_URL = "https://shop-usa.palaceskateboards.com/"


async def scrape_palace() -> list[dict]:
    return await scrape_shopify_products(SHOP_URL, "Palace", max_items=MAX_ITEMS)


if __name__ == "__main__":
    results = asyncio.run(scrape_palace())
    for r in results:
        print(r)
    print(f"Found {len(results)} Palace items")
