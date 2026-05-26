import asyncio
import re
from urllib.parse import urljoin

from playwright.async_api import Locator, async_playwright
from playwright.async_api import TimeoutError as PlaywrightTimeoutError


from scrapers._common import filter_shoe_drops, is_shoe_drop, launch_chromium

BASE_URL = "https://www.supremenewyork.com"
SHOES_URL = f"{BASE_URL}/shop/shoes"
MAX_ITEMS = 20


def _parse_price(text: str) -> float | None:
    cleaned = text.replace("$", "").replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


async def _extract_product(card: Locator, page_url: str) -> dict | None:
    link = card.locator('a[href*="/products/"]').first
    if await link.count() == 0:
        link = card.locator("a").first
    if await link.count() == 0:
        return None

    name: str | None = None
    h1 = card.locator("h1")
    if await h1.count() > 0:
        name = (await h1.first.inner_text()).strip()

    if not name:
        aria = await link.get_attribute("aria-label")
        if aria:
            name = re.sub(r"\s*product link\s*$", "", aria, flags=re.I).strip()

    if not name:
        a_txt = (await link.inner_text()).strip()
        if a_txt:
            name = a_txt.split("\n")[0].strip()

    if not name:
        return None

    price: float | None = None
    price_loc = card.locator('[aria-label="product price"]')
    if await price_loc.count() == 0:
        price_loc = card.locator('[class*="price"]')
    if await price_loc.count() > 0:
        price = _parse_price(await price_loc.first.inner_text())
    if price is None:
        inner = await card.inner_text()
        m = re.search(r"\$\s*([\d,]+\.?\d*)", inner)
        if m:
            price = _parse_price(m.group(0))
    if price is None:
        return None

    img = card.locator("img")
    image_url = None
    if await img.count() > 0:
        image_url = await img.first.get_attribute("src")
        if image_url and image_url.startswith("//"):
            image_url = "https:" + image_url

    href = await link.get_attribute("href")
    if not href:
        return None
    product_url = urljoin(page_url, href)

    drop = {
        "brand": "Supreme",
        "name": name,
        "price": price,
        "image_url": image_url,
        "product_url": product_url,
        "drop_date": None,
    }
    if not is_shoe_drop(drop):
        return None
    return drop


async def scrape_supreme() -> list[dict]:
    try:
        async with async_playwright() as p:
            browser = await launch_chromium(p)
            try:
                page = await browser.new_page()
                await page.goto(SHOES_URL)
                await page.wait_for_load_state("networkidle")

                try:
                    await page.wait_for_selector("article", timeout=15000)
                    cards = page.locator("article")
                except PlaywrightTimeoutError:
                    await page.wait_for_selector(
                        'a[href*="/products/"]', timeout=15000
                    )
                    cards = page.locator('li:has(a[href*="/products/"])')

                page_url = page.url
                n = await cards.count()
                results: list[dict] = []
                for i in range(n):
                    if len(results) >= MAX_ITEMS:
                        break
                    item = await _extract_product(cards.nth(i), page_url)
                    if item:
                        results.append(item)
                return filter_shoe_drops(results)
            finally:
                await browser.close()
    except Exception as e:
        print(e)
        return []


if __name__ == "__main__":
    results = asyncio.run(scrape_supreme())
    for r in results:
        print(r)
    print(f"Found {len(results)} Supreme items")
