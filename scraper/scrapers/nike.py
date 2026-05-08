import asyncio
import re
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlparse

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright


LAUNCH_URL = "https://www.nike.com/launch"
MAX_ITEMS = 15
NIKE_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def _parse_price_text(text: str) -> float | None:
    t = text.strip().upper()
    if "SOLD OUT" in t:
        return None
    m = re.search(r"\$\s*([\d,]+\.?\d*)", text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _slug_from_product_url(url: str) -> str | None:
    path = urlparse(url).path.rstrip("/")
    if "/launch/t/" not in path:
        return None
    return path.split("/launch/t/")[-1].split("?")[0] or None


def _normalize_drop_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    try:
        if raw.endswith("Z") or "+" in raw or raw.count("-") >= 2:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.isoformat()
    except ValueError:
        pass
    return raw or None


async def _extract_from_dom(page: Any) -> list[dict]:
    cards = page.locator(".product-card")
    n = await cards.count()
    out: list[dict] = []
    for i in range(n):
        if len(out) >= MAX_ITEMS:
            break
        card = cards.nth(i)
        href = await card.evaluate(
            "el => el.closest('a')?.getAttribute('href') || ''"
        )
        if "/launch/t/" not in href:
            continue
        product_url = urljoin(page.url, href)

        h1 = card.locator("h1")
        h2 = card.locator("h2")
        name_parts: list[str] = []
        if await h1.count() > 0:
            t = (await h1.first.inner_text()).strip()
            if t:
                name_parts.append(t)
        if await h2.count() > 0:
            t = (await h2.first.inner_text()).strip()
            if t:
                name_parts.append(t)
        name = (
            "\n".join(name_parts)
            if name_parts
            else (await card.inner_text()).strip()
        )
        if not name.strip():
            continue

        img = card.locator('img[data-testid="image-img"], img.product-image, img').first
        image_url = await img.get_attribute("src") if await img.count() > 0 else None

        body = (await card.inner_text()).upper()
        price: float | None = None
        if "SOLD OUT" not in body:
            price = _parse_price_text(await card.inner_text())

        drop_date: str | None = None
        time_el = card.locator("time")
        if await time_el.count() > 0:
            iso = await time_el.first.get_attribute("datetime")
            drop_date = _normalize_drop_date(iso)
        if not drop_date:
            dm = re.search(
                r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s*\d{4})?\b",
                await card.inner_text(),
                re.I,
            )
            if dm:
                drop_date = dm.group(0)

        out.append(
            {
                "brand": "Nike",
                "name": name,
                "price": price,
                "image_url": image_url,
                "product_url": product_url,
                "drop_date": drop_date,
            }
        )
    return out


async def _enrich_from_next_data(page: Any, rows: list[dict]) -> list[dict]:
    payload = await page.evaluate(
        """() => {
          const nd = window.__NEXT_DATA__;
          if (!nd || !nd.props?.pageProps?.initialState) return null;
          let state;
          try {
            state = JSON.parse(nd.props.pageProps.initialState);
          } catch {
            return null;
          }
          function findItemsMap(root) {
            let found = null;
            function w(o) {
              if (!o || typeof o !== "object" || found) return;
              if (o.items && typeof o.items === "object") {
                const vals = Object.values(o.items);
                if (
                  vals.length &&
                  typeof vals[0] === "object" &&
                  vals[0] !== null &&
                  "currentPrice" in vals[0]
                ) {
                  found = o.items;
                  return;
                }
              }
              for (const v of Object.values(o)) w(v);
            }
            w(root);
            return found;
          }
          const itemsMap = findItemsMap(state);
          const threads = [];
          const seen = new Set();
          function walk(o) {
            if (!o || typeof o !== "object") return;
            if (
              o.subType === "product-card" &&
              o.seo &&
              typeof o.seo.slug === "string" &&
              o.productId &&
              o.coverCard
            ) {
              if (!seen.has(o.id)) {
                seen.add(o.id);
                threads.push(o);
              }
            }
            for (const v of Object.values(o)) walk(v);
          }
          walk(state);
          return { itemsMap, threads };
        }"""
    )
    if not payload:
        return rows

    items_map: dict[str, Any] = payload.get("itemsMap") or {}
    threads: list[dict[str, Any]] = payload.get("threads") or []
    by_slug: dict[str, dict[str, Any]] = {}
    for t in threads:
        slug = (t.get("seo") or {}).get("slug")
        if slug:
            by_slug[slug] = t

    for row in rows:
        slug = _slug_from_product_url(row["product_url"])
        if not slug:
            continue
        thread = by_slug.get(slug)
        if not thread:
            continue
        pid = thread.get("productId")
        item = items_map.get(pid) if pid else None
        if item:
            status = str(item.get("launchStatus") or "").upper()
            merch = str(item.get("merchStatus") or "").upper()
            if "SOLD" in status or status == "SOLD_OUT" or "SOLD OUT" in str(
                item.get("title") or ""
            ).upper():
                row["price"] = None
            elif row["price"] is None and item.get("currentPrice") is not None:
                try:
                    row["price"] = float(item["currentPrice"])
                except (TypeError, ValueError):
                    pass
            cs = item.get("commerceStartDate")
            if cs and not row.get("drop_date"):
                row["drop_date"] = _normalize_drop_date(str(cs))
        cc = thread.get("coverCard") or {}
        if not row.get("image_url") and cc.get("portraitURL"):
            row["image_url"] = cc["portraitURL"]
    return rows


async def _products_from_next_data_only(page: Any) -> list[dict]:
    raw = await page.evaluate(
        """() => {
          const nd = window.__NEXT_DATA__;
          if (!nd || !nd.props?.pageProps?.initialState) return null;
          let state;
          try {
            state = JSON.parse(nd.props.pageProps.initialState);
          } catch {
            return null;
          }
          function findItemsMap(root) {
            let found = null;
            function w(o) {
              if (!o || typeof o !== "object" || found) return;
              if (o.items && typeof o.items === "object") {
                const vals = Object.values(o.items);
                if (
                  vals.length &&
                  typeof vals[0] === "object" &&
                  vals[0] !== null &&
                  "currentPrice" in vals[0]
                ) {
                  found = o.items;
                  return;
                }
              }
              for (const v of Object.values(o)) w(v);
            }
            w(root);
            return found;
          }
          const itemsMap = findItemsMap(state) || {};
          const threads = [];
          const seen = new Set();
          function walk(o) {
            if (!o || typeof o !== "object") return;
            if (
              o.subType === "product-card" &&
              o.seo &&
              typeof o.seo.slug === "string" &&
              o.productId &&
              o.coverCard
            ) {
              if (!seen.has(o.id)) {
                seen.add(o.id);
                threads.push(o);
              }
            }
            for (const v of Object.values(o)) walk(v);
          }
          walk(state);
          return { itemsMap, threads };
        }"""
    )
    if not raw:
        return []

    items_map: dict[str, Any] = raw.get("itemsMap") or {}
    threads: list[dict[str, Any]] = raw.get("threads") or []
    out: list[dict] = []
    for t in threads:
        if len(out) >= MAX_ITEMS:
            break
        slug = (t.get("seo") or {}).get("slug")
        if not slug:
            continue
        product_url = f"https://www.nike.com/launch/t/{slug}"
        cc = t.get("coverCard") or {}
        title = (t.get("title") or cc.get("subtitle") or "").strip()
        subtitle = (cc.get("title") or "").strip()
        name = title
        if subtitle:
            name = f"{title}\n{subtitle}" if title else subtitle
        pid = t.get("productId")
        item = items_map.get(pid) if pid else None
        price: float | None = None
        drop_date: str | None = None
        if item:
            drop_date = _normalize_drop_date(
                str(item.get("commerceStartDate") or "") or None
            )
            st = str(item.get("launchStatus") or "").upper()
            if "SOLD" in st or st == "SOLD_OUT":
                price = None
            elif item.get("currentPrice") is not None:
                try:
                    price = float(item["currentPrice"])
                except (TypeError, ValueError):
                    price = None
        image_url = cc.get("portraitURL") or cc.get("defaultURL")
        out.append(
            {
                "brand": "Nike",
                "name": name.strip() or slug,
                "price": price,
                "image_url": image_url,
                "product_url": product_url,
                "drop_date": drop_date,
            }
        )
    return out


async def scrape_nike() -> list[dict]:
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                await page.set_extra_http_headers({"User-Agent": NIKE_UA})
                await page.goto(LAUNCH_URL)
                await page.wait_for_load_state("networkidle")

                try:
                    await page.wait_for_selector(".product-card", timeout=15000)
                except PlaywrightTimeoutError:
                    await page.wait_for_timeout(2000)
                    rows_nd = await _products_from_next_data_only(page)
                    return rows_nd[:MAX_ITEMS]

                rows = await _extract_from_dom(page)
                if not rows:
                    await page.wait_for_timeout(2000)
                    rows = await _products_from_next_data_only(page)
                else:
                    rows = await _enrich_from_next_data(page, rows)
                return rows[:MAX_ITEMS]
            finally:
                await browser.close()
    except Exception as e:
        print(e)
        return []


if __name__ == "__main__":
    results = asyncio.run(scrape_nike())
    for r in results:
        print(r)
    print(f"Found {len(results)} Nike launch items")
