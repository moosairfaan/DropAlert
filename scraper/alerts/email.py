import logging
import os

import resend

log = logging.getLogger(__name__)


def send_email(to: str, drop: dict) -> None:
    """Send email via Resend. Requires RESEND_API_KEY and RESEND_FROM_EMAIL."""
    key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL")
    if not key or not from_email:
        raise RuntimeError("Resend not configured (RESEND_API_KEY, RESEND_FROM_EMAIL)")

    resend.api_key = key
    brand = drop.get("brand", "")
    name = drop.get("name", "")
    url = drop.get("product_url", "")
    price = drop.get("price")
    price_part = f" ${price}" if price is not None else ""
    subject = f"[DropAlert] {brand}: {name}"[:998]
    html = (
        f"<p><strong>{brand}</strong>: {name}{price_part}</p>"
        f'<p><a href="{url}">View product</a></p>'
    )

    resend.Emails.send(
        {
            "from": from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        }
    )
