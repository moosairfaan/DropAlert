import asyncio

from scrapers._common import MAX_ITEMS, scrape_link_grid

RELEASE_URL = "https://us.puma.com/us/en/release-calendar"


async def scrape_puma() -> list[dict]:
    rows = await scrape_link_grid(
        RELEASE_URL,
        "Puma",
        link_pattern="/pd/",
        max_items=MAX_ITEMS,
    )
    if rows:
        return rows
    return await scrape_link_grid(
        RELEASE_URL,
        "Puma",
        link_pattern="/product/",
        max_items=MAX_ITEMS,
    )


if __name__ == "__main__":
    results = asyncio.run(scrape_puma())
    for r in results:
        print(r)
    print(f"Found {len(results)} Puma items")
