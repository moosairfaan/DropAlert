import asyncio

from scrapers._common import MAX_ITEMS, scrape_shopify_products

FOOTWEAR_URL = "https://kith.com/collections/mens-footwear"


async def scrape_kith() -> list[dict]:
    rows = await scrape_shopify_products(FOOTWEAR_URL, "Kith", max_items=MAX_ITEMS)
    if rows:
        return rows
    return await scrape_shopify_products(
        "https://kith.com/collections/new",
        "Kith",
        max_items=MAX_ITEMS,
    )


if __name__ == "__main__":
    results = asyncio.run(scrape_kith())
    for r in results:
        print(r)
    print(f"Found {len(results)} Kith items")
