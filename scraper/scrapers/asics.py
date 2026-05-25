import asyncio

from scrapers._common import MAX_ITEMS, scrape_link_grid

RELEASE_URL = "https://www.asics.com/us/en-us/release-calendar"


async def scrape_asics() -> list[dict]:
    rows = await scrape_link_grid(
        RELEASE_URL,
        "ASICS",
        link_pattern="/product/",
        max_items=MAX_ITEMS,
    )
    if rows:
        return rows
    return await scrape_link_grid(
        RELEASE_URL,
        "ASICS",
        link_pattern="/us/en-us/",
        max_items=MAX_ITEMS,
        name_min_len=4,
    )


if __name__ == "__main__":
    results = asyncio.run(scrape_asics())
    for r in results:
        print(r)
    print(f"Found {len(results)} ASICS items")
