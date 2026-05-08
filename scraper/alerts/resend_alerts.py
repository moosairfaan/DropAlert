"""
Resend HTML drop alerts.

Named ``resend_alerts.py`` (not ``email.py``) so running
``python alerts/<script>.py`` does not shadow Python's stdlib ``email`` package
and break urllib3 / requests / Resend imports.

Run tests: ``cd scraper && python -m alerts.resend_alerts``

Troubleshooting "API says OK but no inbox":
  • With ``from`` = ``onboarding@resend.dev``, Resend only delivers to the email
    address tied to your Resend account (testing restriction).
  • Use ``TEST_EMAIL_TO`` = that same inbox, or verify a domain and set
    ``ALERT_FROM_EMAIL`` to an address on that domain.
  • Check spam/promotions; Resend dashboard → Logs for delivery status.
"""

import logging
import os
from html import escape

import resend
from dotenv import load_dotenv

load_dotenv(override=True)

log = logging.getLogger(__name__)


def send_email(to_email: str, drop: dict) -> None:
    """
    Sends an HTML email drop alert.
    Raises on failure — caller handles exception.
    """
    key = (os.getenv("RESEND_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("RESEND_API_KEY is not set")
    resend.api_key = key

    from_email = (os.getenv("ALERT_FROM_EMAIL") or "onboarding@resend.dev").strip()

    price_str = (
        f"${drop['price']:.2f}"
        if drop.get("price") is not None
        else "Price TBA"
    )
    brand = drop["brand"]
    name = drop["name"]
    url = drop.get("product_url") or "#"
    img = drop.get("image_url") or ""

    brand_e = escape(str(brand))
    name_e = escape(str(name))
    url_e = escape(str(url), quote=True)
    img_e = escape(str(img), quote=True)

    img_block = (
        f'<img src="{img_e}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px">'
        if img
        else ""
    )

    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#f9fafb">
<div style="background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<p style="color:#6B7280;font-size:12px;margin:0 0 16px">DROPALERT · {brand_e.upper()} DROP ALERT</p>
{img_block}
<h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">{name_e}</h1>
<p style="font-size:28px;font-weight:700;color:#1A56DB;margin:0 0 20px">{price_str}</p>
<a href="{url_e}" style="display:block;background:#111;color:white;text-align:center;
padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Shop Now →</a>
<p style="color:#9CA3AF;font-size:11px;margin:20px 0 0;text-align:center">
You're receiving this because you subscribed to {brand_e} alerts on DropAlert.<br>
<a href="#" style="color:#9CA3AF">Unsubscribe</a>
</p>
</div>
</body>
</html>"""

    params = {
        "from": from_email,
        "to": [to_email.strip()],
        "subject": f"🔔 {brand} Drop Alert: {name}",
        "html": html,
    }
    out = resend.Emails.send(params)
    eid = getattr(out, "id", None)
    if eid:
        log.info("Resend email queued id=%s to=%s", eid, to_email)


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
        print(
            "\nIf nothing arrives:\n"
            "  • onboarding@resend.dev usually only delivers TO your Resend signup email.\n"
            "  • Set TEST_EMAIL_TO to that address, or verify a domain and ALERT_FROM_EMAIL.\n"
            "  • Spam folder / Gmail Promotions.\n"
        )
    except Exception as e:
        msg = str(e)
        if hasattr(e, "message"):
            msg = getattr(e, "message", msg)
        print(f"Send failed: {msg}")
        if hasattr(e, "suggested_action") and e.suggested_action:
            print(e.suggested_action)
        raise SystemExit(1) from e
