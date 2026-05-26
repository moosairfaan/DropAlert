"""Personalized drop alerts via Anthropic Claude (yes/no style match)."""

from __future__ import annotations

import logging
import os
import re

log = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_STYLE_CHARS = 500


def _format_price(price: float | None) -> str:
    if price is None:
        return "unknown price"
    try:
        return f"${float(price):.2f}"
    except (TypeError, ValueError):
        return "unknown price"


def _parse_yes_no(text: str) -> bool | None:
    cleaned = text.strip().upper()
    if re.match(r"^YES\b", cleaned):
        return True
    if re.match(r"^NO\b", cleaned):
        return False
    return None


def drop_matches_style(
    style_description: str | None,
    *,
    name: str,
    brand: str,
    price: float | None,
) -> bool:
    """
    Return True if the drop should be emailed to this subscriber.
    Blank style → always True. Claude YES → True, NO → False.
    On API errors, default True so brand alerts are not blocked.
    """
    style = (style_description or "").strip()
    if not style:
        return True

    if len(style) > MAX_STYLE_CHARS:
        style = style[:MAX_STYLE_CHARS]

    api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if not api_key:
        log.warning(
            "ANTHROPIC_API_KEY not set; skipping style filter for %s — %s",
            brand,
            name,
        )
        return True

    prompt = (
        f"A user described their style as: {style}. "
        f"A new drop just came in: {name} by {brand} for {_format_price(price)}. "
        f"Does this match their style? Reply with only YES or NO."
    )

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=MODEL,
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
        )
        block = response.content[0]
        text = getattr(block, "text", str(block))
        verdict = _parse_yes_no(text)
        if verdict is None:
            log.warning(
                "Unexpected Claude reply %r for %s — %s; sending alert",
                text,
                brand,
                name,
            )
            return True
        log.info(
            "Style match %s for %s — %s (subscriber style: %.40s…)",
            "YES" if verdict else "NO",
            brand,
            name,
            style,
        )
        return verdict
    except Exception as exc:
        log.exception(
            "Claude style check failed for %s — %s; sending alert anyway: %s",
            brand,
            name,
            exc,
        )
        return True
