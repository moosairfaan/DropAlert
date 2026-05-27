import asyncio

from scrapers._common import (
    MAX_ITEMS,
    canonical_shopify_product_url,
    extract_shopify_product_handle,
    is_palace_product_handle,
    scrape_shopify_products,
)

PALACE_STORE = "https://palaceskateboards.com"

FOOTWEAR_URLS = (
    "https://palaceskateboards.com/collections/footwear",
    "https://usa.palaceskateboards.com/collections/footwear",
    "https://shop-usa.palaceskateboards.com/collections/footwear",
)


def _fix_palace_drop(row: dict) -> dict | None:
    handle = extract_shopify_product_handle(row.get("product_url"))
    if not handle or not is_palace_product_handle(handle):
        return None
    url = canonical_shopify_product_url(handle, PALACE_STORE)
    return {
        **row,
        "brand": "Palace",
        "product_url": url,
        "product_id": handle,
    }


async def scrape_palace() -> list[dict]:
    for url in FOOTWEAR_URLS:
        rows = await scrape_shopify_products(url, "Palace", max_items=MAX_ITEMS)
        fixed: list[dict] = []
        for row in rows:
            drop = _fix_palace_drop(row)
            if drop:
                fixed.append(drop)
        if fixed:
            return fixed
    return []


if __name__ == "__main__":
    results = asyncio.run(scrape_palace())
    for r in results:
        print(r)
    print(f"Found {len(results)} Palace items")
