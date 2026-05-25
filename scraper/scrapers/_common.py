"""Shared Playwright helpers for brand scrapers."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
MAX_ITEMS = 15

# Marketing / nav / site pages — not product drops
_JUNK_NAME_RE = re.compile(
    r"(?i)\b("
    r"refer\s*a\s*friend|join\s*the\s*celebration|store\s*locator|find\s*a\s*store|"
    r"gift\s*card|newsletter|sign\s*up|log\s*in|customer\s*service|contact\s*us|"
    r"about\s*us|privacy\s*policy|terms\s*of|cookie\s*settings|rewards?\s*program|"
    r"membership|shipping\s*(&|and)\s*returns?|track\s*(my\s*)?order|wish\s*list|"
    r"shopping\s*bag|subscribe|careers|blog|help\s*center|faq|create\s*account|"
    r"my\s*account|order\s*history|exclusive\s*access|download\s*the\s*app|"
    r"get\s*10\s*%|promo\s*code|student\s*discount|military\s*discount|"
    r"road\s*tested|road-tested|\bbenefits?\b|loyalty|one\s*asics|asics\s*benefits|"
    r"size\s*guide|fit\s*guide|our\s*story|sustainability|partners?|order\s*status|"
    r"live\s*chat|warranty|repair\s*service|click\s*and\s*collect|gift\s*with\s*purchase|"
    r"learn\s*more|discover\s*more|explore\s*more|shop\s*now\s*for|join\s*us|"
    r"become\s*a\s*member|vip\s*access|early\s*access\s*program|"
    r"free\s*shipping|return\s*policy|store\s*finder|book\s*appointment|"
    r"^contact$|^benefits$|^rewards$|^loyalty$|^newsletter$|^membership$|^sustainability$"
    r")\b"
)

_JUNK_SLUG_RE = re.compile(
    r"(?i)(refer|friend|celebration|benefits|loyalty|rewards|contact|locator|"
    r"newsletter|account|login|signup|privacy|terms|help|faq|careers|blog|"
    r"shipping|returns|gift-card|giftcard|road-tested|roadtested|programs?|"
    r"membership|sustainability|partners|warranty|repair|size-guide|fit-guide|"
    r"order-status|live-chat|student-discount|military-discount|one-asics)"
)

_JUNK_URL_FRAGMENTS = (
    "/refer",
    "/celebration",
    "/store-locator",
    "/storelocator",
    "/gift-card",
    "/newsletter",
    "/login",
    "/signup",
    "/sign-up",
    "/account",
    "/help",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/legal",
    "/rewards",
    "/membership",
    "/blog",
    "/careers",
    "/faq",
    "/customer-service",
    "/track-order",
    "/wishlist",
    "/cart",
    "/checkout",
)

_PRODUCT_URL_HINTS = (
    "/product",
    "/products/",
    "/pd/",
    "/launch/t/",
    "/release-dates/",
    "/footwear",
    "/sneaker",
    "/shoes",
)

_SHOE_SIGNAL_RE = re.compile(
    r"(?i)\b("
    r"sneaker|sneakers|shoe|shoes|footwear|runner|running|runners|trainer|trainers|"
    r"boot|boots|slide|slides|sandal|cleat|skate\s*shoe|basketball\s*shoe|"
    r"gel[\s-]|air\s*max|air\s*force|air\s*jordan|dunk|yeezy|foamposite|"
    r"pegasus|vaporfly|ultraboost|samba|gazelle|campus|superstar|"
    r"new\s*balance|990|991|992|993|2002r|550|574|1906r|9060|"
    r"chuck|old\s*skool|sk8|sb\s+dunk|foam\s*runner|boost\s*og"
    r")\b"
)

_NON_SHOE_RE = re.compile(
    r"(?i)\b("
    r"t-?shirt|tee\b|hoodie|sweatshirt|jacket|coat|puffer|varsity|avirex|"
    r"reversible|leather|denim|crewneck|fleece|pants|trousers|shorts|"
    r"beanie|bucket\s*hat|\bcap\b|backpack|tote|sock\b|underwear|"
    r"gloves|scarf|shirt\b|polo\b|keychain|sticker|deck\b|skateboard\b|"
    r"water\s*bottle|mug\b|towel|blanket|pillow|hat\b|sunglasses|eyewear|"
    r"watch\b|wallet|belt\b|cargo\s*pant|sweater|cardigan|blazer|vest\b|"
    r"skirt|dress\b|bikini|swimwear|legging|bra\b"
    r")\b"
)

_GENERIC_SLUGS = frozenset(
    {
        "en",
        "us",
        "en-us",
        "shop",
        "collections",
        "products",
        "product",
        "release-dates",
        "launch-calendar",
    }
)


def _url_slug(url: str) -> str:
    slug = url.rstrip("/").split("/")[-1].lower()
    if "?" in slug:
        slug = slug.split("?")[0]
    return slug


def _slug_looks_like_product(slug: str) -> bool:
    if not slug or slug in _GENERIC_SLUGS or len(slug) < 5:
        return False
    if _JUNK_SLUG_RE.search(slug):
        return False
    if re.search(r"\d", slug):
        return True
    if slug.count("-") >= 2 and len(slug) >= 12:
        return True
    return False


def is_shoe_drop(drop: dict) -> bool:
    """True when name/URL look like footwear, not site promos or apparel."""
    name = (drop.get("name") or "").strip()
    url = (drop.get("product_url") or "").strip()
    if len(name) < 4 or not url:
        return False
    if _JUNK_NAME_RE.search(name):
        return False
    lower_url = url.lower()
    if any(j in lower_url for j in _JUNK_URL_FRAGMENTS):
        return False
    slug = _url_slug(url)
    if slug and _JUNK_SLUG_RE.search(slug):
        return False
    blob = f"{name} {url}"
    if _NON_SHOE_RE.search(blob):
        return False
    if _SHOE_SIGNAL_RE.search(blob):
        return True
    if not any(h in lower_url for h in _PRODUCT_URL_HINTS):
        return False
    if _slug_looks_like_product(slug) and len(name) >= 6:
        return True
    return False


def filter_shoe_drops(drops: list[dict]) -> list[dict]:
    return [d for d in drops if is_shoe_drop(d)]


def parse_price(text: str) -> float | None:
    if not text:
        return None
    if "SOLD OUT" in text.upper():
        return None
    m = re.search(r"\$\s*([\d,]+\.?\d*)", text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def make_drop(
    *,
    brand: str,
    name: str,
    product_url: str,
    price: float | None = None,
    image_url: str | None = None,
    drop_date: str | None = None,
) -> dict:
    return {
        "brand": brand,
        "name": name.strip(),
        "price": price,
        "image_url": image_url,
        "product_url": product_url,
        "drop_date": drop_date,
    }


async def scrape_shopify_products(url: str, brand: str, max_items: int = MAX_ITEMS) -> list[dict]:
    """Shopify collection / shop pages (Kith, Palace, etc.)."""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                await page.set_extra_http_headers({"User-Agent": DEFAULT_UA})
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=25000)
                except PlaywrightTimeoutError:
                    pass
                try:
                    await page.wait_for_selector('a[href*="/products/"]', timeout=20000)
                except PlaywrightTimeoutError:
                    return []

                raw: list[dict[str, Any]] = await page.evaluate(
                    """(limit) => {
                      const seen = new Set();
                      const out = [];
                      for (const a of document.querySelectorAll('a[href*="/products/"]')) {
                        let href = a.href || '';
                        if (!href || seen.has(href)) continue;
                        if (href.includes('/cart') || href.includes('/account')) continue;
                        seen.add(href);
                        const card = a.closest('article, li, .card, .product-card, .grid__item, .product-item') || a;
                        let name = '';
                        const title = card.querySelector('h1, h2, h3, .product-title, [class*="title"]');
                        if (title) name = title.innerText.trim();
                        if (!name) {
                          const img = card.querySelector('img');
                          name = (img && (img.alt || img.getAttribute('title'))) || '';
                          name = (name || '').trim();
                        }
                        if (!name) name = a.innerText.trim().split('\\n').filter(Boolean)[0] || '';
                        if (!name || name.length < 2) continue;
                        const img = card.querySelector('img');
                        let image_url = img ? (img.currentSrc || img.src || img.getAttribute('data-src')) : null;
                        if (image_url && image_url.startsWith('//')) image_url = 'https:' + image_url;
                        const body = card.innerText || '';
                        const pm = body.match(/\\$\\s*([\\d,]+\\.?\\d*)/);
                        const price = pm ? parseFloat(pm[1].replace(/,/g, '')) : null;
                        out.push({ name, product_url: href, image_url, price });
                        if (out.length >= limit) break;
                      }
                      return out;
                    }""",
                    max_items * 2,
                )

                results: list[dict] = []
                seen_names: set[str] = set()
                for item in raw:
                    name = (item.get("name") or "").strip()
                    url_p = (item.get("product_url") or "").strip()
                    if not name or not url_p or name in seen_names:
                        continue
                    seen_names.add(name)
                    results.append(
                        make_drop(
                            brand=brand,
                            name=name,
                            product_url=url_p,
                            price=item.get("price"),
                            image_url=item.get("image_url"),
                        )
                    )
                    if len(results) >= max_items:
                        break
                return filter_shoe_drops(results)
            finally:
                await browser.close()
    except Exception as e:
        print(f"{brand} scraper error: {e}")
        return []


async def scrape_link_grid(
    url: str,
    brand: str,
    *,
    link_pattern: str,
    max_items: int = MAX_ITEMS,
    name_min_len: int = 3,
    require_product_url: bool = True,
) -> list[dict]:
    """Generic product grid: find anchors matching link_pattern (substring)."""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                await page.set_extra_http_headers({"User-Agent": DEFAULT_UA})
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=25000)
                except PlaywrightTimeoutError:
                    pass

                anchors = page.locator(f'a[href*="{link_pattern}"]')
                try:
                    await anchors.first.wait_for(timeout=20000)
                except PlaywrightTimeoutError:
                    return []

                page_url = page.url
                n = min(await anchors.count(), max_items * 3)
                results: list[dict] = []
                seen_urls: set[str] = set()

                for i in range(n):
                    if len(results) >= max_items:
                        break
                    link = anchors.nth(i)
                    href = await link.get_attribute("href")
                    if not href:
                        continue
                    product_url = urljoin(page_url, href)
                    if product_url in seen_urls:
                        continue
                    lower_url = product_url.lower()
                    if require_product_url and not any(
                        h in lower_url for h in _PRODUCT_URL_HINTS
                    ):
                        continue
                    if any(j in lower_url for j in _JUNK_URL_FRAGMENTS):
                        continue
                    seen_urls.add(product_url)

                    card = link.locator(
                        "xpath=ancestor::article | ancestor::li | ancestor::div[contains(@class,'product')]"
                    ).first
                    if await card.count() == 0:
                        card = link

                    name = ""
                    for sel in ("h1", "h2", "h3", '[class*="title"]', '[class*="name"]'):
                        el = card.locator(sel).first
                        if await el.count() > 0:
                            name = (await el.inner_text()).strip()
                            if name:
                                break
                    if not name:
                        img = card.locator("img").first
                        if await img.count() > 0:
                            name = (await img.get_attribute("alt") or "").strip()
                    if not name:
                        name = (await link.inner_text()).strip().split("\n")[0].strip()
                    if len(name) < name_min_len:
                        continue
                    if _JUNK_NAME_RE.search(name):
                        continue

                    price = parse_price(await card.inner_text())
                    image_url = None
                    img = card.locator("img").first
                    if await img.count() > 0:
                        image_url = await img.get_attribute("src")
                        if image_url and image_url.startswith("//"):
                            image_url = "https:" + image_url

                    candidate = make_drop(
                        brand=brand,
                        name=name,
                        price=price,
                        image_url=image_url,
                        product_url=product_url,
                    )
                    if is_shoe_drop(candidate):
                        results.append(candidate)
                return results[:max_items]
            finally:
                await browser.close()
    except Exception as e:
        print(f"{brand} scraper error: {e}")
        return []
