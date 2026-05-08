"""
StockX Playwright scrapers. StockX often serves Cloudflare challenges to headless
browsers; use a headed browser, stealth plugins, or a proxy if you need this to
pass in production.

If you see timeouts on [data-testid="product-card"], try:

  STOCKX_HEADLESS=0 ./venv/bin/python scrapers/stockx.py

headed Chromium often passes the challenge once; CI / servers may still need a
residential proxy.
"""

import asyncio
import os
import re
from urllib.parse import quote, urljoin

from playwright.async_api import Locator, Playwright
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright


STOCKX_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
TRENDING_URL = "https://stockx.com/sneakers?sort=trending"
BASE_ORIGIN = "https://stockx.com"
MAX_ITEMS = 15


def _extra_headers() -> dict[str, str]:
    return {"Accept-Language": "en-US,en;q=0.9"}


def _headless() -> bool:
    return os.environ.get("STOCKX_HEADLESS", "1").lower() not in (
        "0",
        "false",
        "no",
    )


async def _cloudflare_challenge(page) -> bool:
    title = (await page.title()).lower()
    if "just a moment" in title or title.strip() == "attention required!":
        return True
    html = await page.content()
    return "challenges.cloudflare.com" in html


async def _new_stockx_page(p: Playwright):
    browser = await p.chromium.launch(
        headless=_headless(),
        args=["--disable-blink-features=AutomationControlled"],
    )
    context = await browser.new_context(
        user_agent=STOCKX_UA,
        locale="en-US",
        viewport={"width": 1280, "height": 800},
    )
    page = await context.new_page()
    await page.set_extra_http_headers(_extra_headers())
    return browser, page


async def _goto_and_settle(page, url: str) -> None:
    await page.goto(url, wait_until="load", timeout=50_000)
    try:
        await page.wait_for_load_state("networkidle", timeout=25_000)
    except PlaywrightTimeoutError:
        pass


def _parse_price_from_text(text: str) -> float | None:
    """
    Prefer Last Sale, then Retail Price; avoid Bid/Ask if labeled.
    """
    t = text.replace("\u00a0", " ")
    for pattern in (
        r"Last\s+Sale[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)",
        r"Retail\s*(?:Price)?[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)",
    ):
        m = re.search(pattern, t, re.I)
        if m:
            try:
                return float(m.group(1).replace(",", ""))
            except ValueError:
                continue
    # Unlabeled dollar amounts: skip obvious Bid/Ask lines
    candidates: list[float] = []
    for line in t.splitlines():
        if re.search(r"\b(?:Bid|Ask|View)\b", line, re.I):
            continue
        for m in re.finditer(r"\$\s*([\d,]+(?:\.\d{2})?)", line):
            try:
                candidates.append(float(m.group(1).replace(",", "")))
            except ValueError:
                pass
    return candidates[0] if candidates else None


async def _extract_card(card: Locator) -> dict | None:
    text = await card.inner_text()
    price = _parse_price_from_text(text)
    if price is None:
        return None

    name: str | None = None
    product_url: str | None = None
    for testid in (
        "product-card-title",
        "ProductTile-Name",
        "product-tile-title",
        "product-card-name",
    ):
        loc = card.locator(f'[data-testid="{testid}"]')
        if await loc.count() > 0:
            name = (await loc.first.inner_text()).strip()
            link = loc.locator('a[href^="/"]').first
            if await link.count() > 0:
                href = await link.get_attribute("href")
                if href:
                    product_url = urljoin(BASE_ORIGIN, href.split("?")[0])
            break

    if not name or not product_url:
        links = card.locator('a[href^="/"]')
        n_links = await links.count()
        for i in range(n_links):
            href = await links.nth(i).get_attribute("href") or ""
            if not href or href.startswith("//"):
                continue
            low = href.lower()
            if any(
                x in low
                for x in (
                    "/search",
                    "/login",
                    "/signup",
                    "/help",
                    "/about",
                    "/sell",
                    "/buying",
                )
            ):
                continue
            seg = href.strip("/").split("/")
            if len(seg) < 1:
                continue
            raw_txt = (await links.nth(i).inner_text()).strip()
            first_line = raw_txt.split("\n")[0].strip() if raw_txt else ""
            if first_line and not re.match(r"^\$", first_line):
                name = first_line
                product_url = urljoin(BASE_ORIGIN, href.split("?")[0])
                break

    if not name:
        return None
    if not product_url:
        return None

    img = card.locator("img").first
    image_url = await img.get_attribute("src") if await img.count() > 0 else None

    return {
        "brand": "StockX",
        "name": name,
        "price": price,
        "image_url": image_url,
        "product_url": product_url,
        "drop_date": None,
    }


async def scrape_stockx() -> list[dict]:
    try:
        async with async_playwright() as p:
            browser, page = await _new_stockx_page(p)
            try:
                await _goto_and_settle(page, TRENDING_URL)
                try:
                    await page.wait_for_selector(
                        '[data-testid="product-card"]', timeout=15_000
                    )
                except PlaywrightTimeoutError:
                    if await _cloudflare_challenge(page):
                        print(
                            "StockX: Cloudflare challenge — no product grid. "
                            "Try STOCKX_HEADLESS=0 or a headed browser / proxy."
                        )
                    else:
                        print("StockX: timed out waiting for product cards.")
                    return []

                cards = page.locator('[data-testid="product-card"]')
                n = await cards.count()
                out: list[dict] = []
                for i in range(n):
                    if len(out) >= MAX_ITEMS:
                        break
                    row = await _extract_card(cards.nth(i))
                    if row:
                        out.append(row)
                return out
            finally:
                await browser.close()
    except Exception as e:
        print(e)
        return []


async def get_resell_estimate(product_name: str) -> float | None:
    try:
        async with async_playwright() as p:
            browser, page = await _new_stockx_page(p)
            try:
                q = quote(product_name, safe="")
                search_url = f"{BASE_ORIGIN}/search?s={q}"
                await _goto_and_settle(page, search_url)
                try:
                    await page.wait_for_selector(
                        '[data-testid="product-card"]', timeout=15_000
                    )
                except PlaywrightTimeoutError:
                    if await _cloudflare_challenge(page):
                        print(
                            "StockX search: Cloudflare challenge. "
                            "Try STOCKX_HEADLESS=0 or a headed browser / proxy."
                        )
                    else:
                        print("StockX search: timed out waiting for product cards.")
                    return None

                card = page.locator('[data-testid="product-card"]').first
                text = await card.inner_text()
                return _parse_price_from_text(text)
            finally:
                await browser.close()
    except Exception as e:
        print(e)
        return None


if __name__ == "__main__":
    async def _main() -> None:
        items = await scrape_stockx()
        for it in items:
            print(it)
        print(f"Found {len(items)} StockX items")
        est = await get_resell_estimate('Air Jordan 1 Retro High OG "Chicago"')
        print(f"Resell estimate (first search hit): {est}")

    asyncio.run(_main())
