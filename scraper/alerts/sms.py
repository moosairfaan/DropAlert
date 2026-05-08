import logging
import os

from twilio.rest import Client

log = logging.getLogger(__name__)


def send_sms(phone: str, drop: dict) -> None:
    """Send SMS via Twilio. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER."""
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_num = os.getenv("TWILIO_FROM_NUMBER")
    if not all([sid, token, from_num]):
        raise RuntimeError(
            "Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)"
        )

    brand = drop.get("brand", "")
    name = drop.get("name", "")
    url = drop.get("product_url", "")
    price = drop.get("price")
    price_part = f" ${price}" if price is not None else ""
    body = f"{brand}: {name}{price_part}\n{url}"

    client = Client(sid, token)
    client.messages.create(to=phone, from_=from_num, body=body[:1600])
