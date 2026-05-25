import asyncio

from scrapers._common import MAX_ITEMS, scrape_link_grid

LAUNCH_URL = "https://www.newbalance.com/launch-calendar/"


async def scrape_new_balance() -> list[dict]:
    return await scrape_link_grid(
        LAUNCH_URL,
        "New Balance",
        link_pattern="/pd/",
        max_items=MAX_ITEMS,
    )


if __name__ == "__main__":
    results = asyncio.run(scrape_new_balance())
    for r in results:
        print(r)
    print(f"Found {len(results)} New Balance items")
