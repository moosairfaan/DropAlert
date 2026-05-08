import logging
from datetime import datetime

import os

from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv(override=True)

log = logging.getLogger(__name__)

_twilio_rest_client: Client | None = None


def get_twilio_client() -> Client:
    """Return a cached Twilio REST Client."""
    global _twilio_rest_client
    if _twilio_rest_client is None:
        sid = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
        token = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
        if not sid or not token:
            raise RuntimeError(
                "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in scraper/.env"
            )
        _twilio_rest_client = Client(sid, token)
    return _twilio_rest_client


def send_sms(to_phone: str, drop: dict) -> str | None:
    """
    Sends an SMS drop alert to a subscriber via Twilio.
    drop dict: {brand, name, price, product_url, drop_date}
    Returns message SID if the API returns one; raises on failure.
    """
    from_number = (os.getenv("TWILIO_PHONE_NUMBER") or "").strip()
    if not from_number:
        raise RuntimeError(
            "TWILIO_PHONE_NUMBER is not set (your Twilio SMS-capable E.164 sender)"
        )

    # Format price
    price_str = f"${drop['price']:.2f}" if drop.get("price") is not None else "Price TBA"

    # Format drop date
    if drop.get("drop_date"):
        try:
            raw = str(drop["drop_date"])
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            date_str = dt.strftime("%b %d at %I:%M %p")
        except Exception:
            date_str = str(drop["drop_date"])
    else:
        date_str = "Available now"

    message = (
        f"🔔 {drop['brand'].upper()} DROP\n"
        f"{drop['name']}\n"
        f"{price_str} · {date_str}\n"
        f"{drop.get('product_url', '')}\n"
        f"Reply STOP to unsubscribe"
    )

    msg = get_twilio_client().messages.create(
        body=message,
        from_=from_number,
        to=to_phone,
    )
    sid = getattr(msg, "sid", None)
    if sid:
        log.info("Twilio SMS queued sid=%s to=%s", sid, to_phone)
    return sid


# TEST BLOCK — set TEST_SMS_TO in .env or environment to your real E.164 number
if __name__ == "__main__":
    test_drop = {
        "brand": "Supreme",
        "name": "Box Logo Hoodie Black",
        "price": 168.00,
        "product_url": "https://www.supremenewyork.com/shop/hoodies/abc123",
        "drop_date": None,
    }
    to = os.getenv("TEST_SMS_TO")
    if not to:
        print(
            "Add TEST_SMS_TO to scraper/.env (E.164, e.g. +12125551234), "
            "or export it, then run again."
        )
        raise SystemExit(1)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        sid = send_sms(to, test_drop)
        print("SMS accepted by Twilio API.")
        if sid:
            print(f"Message SID: {sid}")
        print(
            "If you do not receive it:\n"
            "  • Twilio Console → Monitor → Logs → Messaging\n"
            "  • Trial: verify destination number is allowed\n"
            "  • US A2P 10DLC may apply for long codes\n"
        )
    except Exception as e:
        print(f"Send failed: {e}")
        raise SystemExit(1) from e
