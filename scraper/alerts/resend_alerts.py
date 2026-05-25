"""
Resend HTML + plain-text drop notifications.

Named ``resend_alerts.py`` (not ``email.py``) so running
``python alerts/<script>.py`` does not shadow Python's stdlib ``email`` package.

Run tests: ``cd scraper && python -m alerts.resend_alerts``
"""

from __future__ import annotations

import logging
import os
from html import escape
from urllib.parse import quote

import resend
from dotenv import load_dotenv

load_dotenv(override=True)

log = logging.getLogger(__name__)


def _app_base_url() -> str:
    return (
        os.getenv("DROPALERT_APP_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or "https://dropalert-sigma.vercel.app"
    ).rstrip("/")


def _from_address() -> str:
    """Always send as DropAlert <address@your-domain>."""
    raw = (os.getenv("ALERT_FROM_EMAIL") or "alerts@moosairfaan.dev").strip()
    if "<" in raw and ">" in raw:
        return raw
    return f"DropAlert <{raw}>"


def _unsubscribe_page_url(token: str) -> str:
    base = _app_base_url()
    return f"{base}/unsubscribe?token={quote(token, safe='')}"


def _unsubscribe_api_url(token: str) -> str:
    """RFC 8058 one-click POST target."""
    base = _app_base_url()
    return f"{base}/api/unsubscribe?token={quote(token, safe='')}"


def _format_price(drop: dict) -> str:
    if drop.get("price") is not None:
        try:
            return f"${float(drop['price']):.2f}"
        except (TypeError, ValueError):
            pass
    return "Price not listed"


def _build_content(drop: dict, unsubscribe_url: str) -> tuple[str, str, str]:
    brand = str(drop.get("brand") or "DropAlert")
    name = str(drop.get("name") or "New item")
    url = str(drop.get("product_url") or "").strip() or _app_base_url()
    price_str = _format_price(drop)

    subject = f"New Release: {name} is live"

    img = (drop.get("image_url") or "").strip()
    image_line = f"Image: {img}\n" if img else ""

    text = f"""{brand} — new release

{name}
Price: {price_str}
{image_line}Shop here: {url}

---
You're receiving this because you subscribed to DropAlert. To unsubscribe, visit {unsubscribe_url}
"""

    brand_e = escape(brand)
    name_e = escape(name)
    price_e = escape(price_str)
    url_e = escape(url, quote=True)
    unsub_e = escape(unsubscribe_url, quote=True)
    name_alt_e = escape(name)

    if img:
        img_e = escape(img, quote=True)
        hero_block = f"""
    <a href="{url_e}" style="display:block;text-decoration:none;margin:0 0 20px">
      <img src="{img_e}" alt="{name_alt_e}" width="504"
        style="display:block;width:100%;max-width:504px;height:auto;border-radius:16px;border:3px solid #7c3aed">
    </a>"""
    else:
        hero_block = f"""
    <div style="background:linear-gradient(135deg,#ff3366,#7c3aed);border-radius:16px;padding:48px 24px;text-align:center;margin:0 0 20px">
      <span style="font-size:48px;line-height:1">👟</span>
      <p style="margin:12px 0 0;color:#fff;font-size:14px;font-weight:600">{brand_e}</p>
    </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1a1033;max-width:560px;margin:0 auto;padding:24px;background:#fff5f0">
  <div style="background:#ffffff;border-radius:20px;padding:28px;border:3px solid #7c3aed;box-shadow:0 8px 24px rgba(124,58,237,0.15)">
    <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#ff3366;text-transform:uppercase;letter-spacing:0.08em">DropAlert · {brand_e}</p>
    {hero_block}
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1033;line-height:1.25">
      <a href="{url_e}" style="color:#1a1033;text-decoration:none">{name_e}</a>
    </h1>
    <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#7c3aed">{price_e}</p>
    <a href="{url_e}" style="display:block;background:linear-gradient(90deg,#ff3366,#7c3aed);color:#ffffff;text-align:center;padding:16px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px">
      View release →
    </a>
    <hr style="border:none;border-top:2px solid #f3e8ff;margin:28px 0 20px">
    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6">
      You're receiving this because you subscribed to DropAlert.
      <a href="{unsub_e}" style="color:#7c3aed;font-weight:600">Unsubscribe</a>
    </p>
  </div>
</body>
</html>"""

    return subject, text, html


def send_email(to_email: str, drop: dict, *, unsubscribe_token: str) -> None:
    """
    Sends a transactional drop notification via Resend.
    Raises on failure — caller handles exception.
    """
    key = (os.getenv("RESEND_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("RESEND_API_KEY is not set")
    resend.api_key = key

    recipient = to_email.strip().lower()
    page_url = _unsubscribe_page_url(unsubscribe_token)
    api_url = _unsubscribe_api_url(unsubscribe_token)
    subject, text, html = _build_content(drop, page_url)

    params: resend.Emails.SendParams = {
        "from": _from_address(),
        "to": [recipient],
        "subject": subject,
        "text": text,
        "html": html,
        "headers": {
            "List-Unsubscribe": f"<{api_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    }
    out = resend.Emails.send(params)
    eid = getattr(out, "id", None)
    if eid:
        log.info("Resend email queued id=%s to=%s", eid, recipient)


if __name__ == "__main__":
    test_drop = {
        "brand": "Supreme",
        "name": "Box Logo Hoodie Black",
        "price": 168.00,
        "product_url": "https://www.supremenewyork.com",
        "image_url": "https://via.placeholder.com/400x400?text=Supreme",
    }
    to = (os.getenv("TEST_EMAIL_TO") or "").strip()
    if not to:
        print("Set TEST_EMAIL_TO in scraper/.env to run this test.")
        raise SystemExit(1)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        send_email(to, test_drop)
        print("Resend accepted the send (check Logs in dashboard for delivery).")
    except Exception as e:
        print(f"Send failed: {e}")
        raise SystemExit(1) from e
