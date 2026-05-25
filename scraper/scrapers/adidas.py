import asyncio

from scrapers._common import MAX_ITEMS, scrape_link_grid

RELEASE_URL = "https://www.adidas.com/us/release-dates"


async def scrape_adidas() -> list[dict]:
    return await scrape_link_grid(
        RELEASE_URL,
        "Adidas",
        link_pattern="/release-dates/",
        max_items=MAX_ITEMS,
        require_product_url=True,
    )


if __name__ == "__main__":
    results = asyncio.run(scrape_adidas())
    for r in results:
        print(r)
    print(f"Found {len(results)} Adidas items")
