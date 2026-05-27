import logging
import os
import secrets
from dataclasses import dataclass
from typing import Any, Literal, Optional
from urllib.parse import urlparse, urlunparse

import psycopg2
from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor

from config import get_database_url, load_env
from scrapers._common import (
    canonical_shopify_product_url,
    extract_shopify_product_handle,
    is_palace_product_handle,
)

load_env()

log = logging.getLogger(__name__)

_schema_ready = False

DropWriteAction = Literal["inserted", "updated", "failed"]


@dataclass(frozen=True)
class DropWriteResult:
    drop_id: Optional[int]
    action: DropWriteAction
    inserted: bool


def normalize_product_url(url: str | None) -> str | None:
    """Canonical URL for dedup (no query/fragment, trimmed path)."""
    raw = (url or "").strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        return raw.rstrip("/")
    path = parsed.path.rstrip("/") or "/"
    return urlunparse(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, "", "", "")
    )


def extract_product_id(url: str | None, explicit: str | None = None) -> str | None:
    """Stable id from URL path tail or explicit scraper field."""
    if explicit and str(explicit).strip():
        return str(explicit).strip()
    norm = normalize_product_url(url)
    if not norm:
        return None
    path = urlparse(norm).path.strip("/")
    if not path:
        return None
    return path.split("/")[-1] or path


def ensure_drops_schema() -> None:
    """Columns and indexes for URL / product_id upserts."""
    global _schema_ready
    if _schema_ready:
        return
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "ALTER TABLE drops ADD COLUMN IF NOT EXISTS product_id TEXT"
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS drops_brand_product_url_uidx
                ON drops (brand, product_url)
                WHERE product_url IS NOT NULL AND product_url <> ''
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS drops_brand_product_id_uidx
                ON drops (brand, product_id)
                WHERE product_id IS NOT NULL AND product_id <> ''
                """
            )
            cur.execute(
                """
                UPDATE drops
                SET product_id = NULLIF(
                  regexp_replace(
                    regexp_replace(COALESCE(product_url, ''), '[?#].*$', ''),
                    '.*/', ''
                  ),
                  ''
                )
                WHERE (product_id IS NULL OR product_id = '')
                  AND product_url IS NOT NULL
                  AND product_url <> ''
                """
            )
        conn.commit()
    _schema_ready = True


def get_connection() -> PGConnection:
    """
    Opens a new psycopg2 connection using DATABASE_URL.
    Returns the connection object.
    """
    database_url = get_database_url()
    # Railway public proxy (e.g. *.proxy.rlwy.net) expects TLS; without sslmode
    # libpq may negotiate poorly and the server closes the connection.
    if "sslmode=" not in database_url:
        sep = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{sep}sslmode=require"
    return psycopg2.connect(database_url)


def _find_drop_id(
    cur: Any,
    *,
    brand: str,
    name: str,
    product_url: str | None,
    product_id: str | None,
) -> Optional[int]:
    if product_url:
        cur.execute(
            """
            SELECT id FROM drops
            WHERE brand = %s AND product_url = %s
            LIMIT 1
            """,
            (brand, product_url),
        )
        row = cur.fetchone()
        if row:
            return int(row[0])

    if product_id:
        cur.execute(
            """
            SELECT id FROM drops
            WHERE brand = %s AND product_id = %s
            LIMIT 1
            """,
            (brand, product_id),
        )
        row = cur.fetchone()
        if row:
            return int(row[0])

    cur.execute(
        """
        SELECT id FROM drops
        WHERE brand = %s AND name = %s
        LIMIT 1
        """,
        (brand, name),
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


def _prepare_drop_fields(drop: dict) -> dict[str, Any]:
    brand = str(drop.get("brand") or "").strip()
    name = str(drop.get("name") or "").strip()
    product_url = normalize_product_url(drop.get("product_url"))
    if brand.lower() == "palace":
        handle = extract_shopify_product_handle(product_url)
        if handle and is_palace_product_handle(handle):
            product_url = canonical_shopify_product_url(handle)
        elif handle:
            product_url = None
    product_id = extract_product_id(product_url, drop.get("product_id"))
    return {
        "brand": brand,
        "name": name,
        "drop_date": drop.get("drop_date"),
        "price": drop.get("price"),
        "image_url": drop.get("image_url"),
        "product_url": product_url,
        "product_id": product_id,
    }


def upsert_drop(drop: dict) -> DropWriteResult:
    """
    Insert a new drop or update an existing row matched by product_url,
    product_id, or (brand, name). Refreshes scraped_at on update.

    Frontend reads these rows via Vercel GET /api/feed → frontend/lib/db.getDrops().
    Both services must use the same DATABASE_URL (Railway Postgres).
    """
    fields = _prepare_drop_fields(drop)
    brand = fields["brand"]
    name = fields["name"]

    if not brand or not name:
        log.error(
            "Drop write FAILED: missing brand or name (brand=%r name=%r)",
            brand,
            name,
        )
        return DropWriteResult(drop_id=None, action="failed", inserted=False)

    try:
        ensure_drops_schema()
        with get_connection() as conn:
            with conn.cursor() as cur:
                existing_id = _find_drop_id(
                    cur,
                    brand=brand,
                    name=name,
                    product_url=fields["product_url"],
                    product_id=fields["product_id"],
                )

                if existing_id is not None:
                    cur.execute(
                        """
                        UPDATE drops
                        SET name = %s,
                            drop_date = %s,
                            price = %s,
                            image_url = %s,
                            product_url = %s,
                            product_id = %s,
                            scraped_at = NOW()
                        WHERE id = %s
                        RETURNING id
                        """,
                        (
                            name,
                            fields["drop_date"],
                            fields["price"],
                            fields["image_url"],
                            fields["product_url"],
                            fields["product_id"],
                            existing_id,
                        ),
                    )
                    row = cur.fetchone()
                    drop_id = int(row[0]) if row else existing_id
                    conn.commit()
                    log.info(
                        "Drop write OK: updated id=%s brand=%s name=%r url=%s",
                        drop_id,
                        brand,
                        name,
                        fields["product_url"] or "-",
                    )
                    return DropWriteResult(
                        drop_id=drop_id, action="updated", inserted=False
                    )

                cur.execute(
                    """
                    INSERT INTO drops (
                        brand, name, drop_date, price, image_url, product_url, product_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (brand, name) DO UPDATE SET
                        drop_date = EXCLUDED.drop_date,
                        price = EXCLUDED.price,
                        image_url = EXCLUDED.image_url,
                        product_url = EXCLUDED.product_url,
                        product_id = EXCLUDED.product_id,
                        scraped_at = NOW()
                    RETURNING id, (xmax = 0) AS inserted
                    """,
                    (
                        brand,
                        name,
                        fields["drop_date"],
                        fields["price"],
                        fields["image_url"],
                        fields["product_url"],
                        fields["product_id"],
                    ),
                )
                row = cur.fetchone()
                if not row:
                    conn.commit()
                    log.error(
                        "Drop write FAILED: no row returned brand=%s name=%r",
                        brand,
                        name,
                    )
                    return DropWriteResult(
                        drop_id=None, action="failed", inserted=False
                    )

                drop_id = int(row[0])
                inserted = bool(row[1])
                conn.commit()
                action: DropWriteAction = "inserted" if inserted else "updated"
                log.info(
                    "Drop write OK: %s id=%s brand=%s name=%r url=%s",
                    action,
                    drop_id,
                    brand,
                    name,
                    fields["product_url"] or "-",
                )
                return DropWriteResult(
                    drop_id=drop_id, action=action, inserted=inserted
                )
    except Exception as exc:
        log.exception(
            "Drop write FAILED: brand=%s name=%r url=%s — %s",
            brand,
            name,
            fields.get("product_url") or "-",
            exc,
        )
        return DropWriteResult(drop_id=None, action="failed", inserted=False)


def insert_drop(drop: dict) -> Optional[int]:
    """Backward-compatible wrapper; returns id only on insert."""
    result = upsert_drop(drop)
    return result.drop_id if result.inserted else None


def ensure_subscriber_schema() -> None:
    """Add per-subscriber unsubscribe_token (unique) if missing."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE subscribers
                ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT
                """
            )
            cur.execute(
                """
                ALTER TABLE subscribers
                ADD COLUMN IF NOT EXISTS style_description TEXT
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS subscribers_unsubscribe_token_idx
                ON subscribers (unsubscribe_token)
                WHERE unsubscribe_token IS NOT NULL
                """
            )
            cur.execute(
                """
                SELECT id FROM subscribers
                WHERE unsubscribe_token IS NULL AND email IS NOT NULL
                """
            )
            missing = cur.fetchall()
            for (sub_id,) in missing:
                cur.execute(
                    """
                    UPDATE subscribers
                    SET unsubscribe_token = %s
                    WHERE id = %s
                    """,
                    (secrets.token_urlsafe(32), sub_id),
                )
        conn.commit()


def get_subscribers_for_brand(brand: str) -> list[dict]:
    """
    Queries subscribers WHERE active=TRUE AND brand_prefs @> ARRAY[brand]
    Returns list of dicts with keys: id, email, unsubscribe_token, style_description
    """
    ensure_subscriber_schema()
    sql = """
        SELECT id, email, unsubscribe_token, style_description
        FROM subscribers
        WHERE active = TRUE
          AND email IS NOT NULL
          AND brand_prefs @> ARRAY[%s]::text[]
        ORDER BY id ASC
    """

    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (brand,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]


def has_alert_been_sent(drop_id: int, subscriber_id: int, channel: str) -> bool:
    """
    Checks alerts_sent table for an exact match.
    Returns True if already sent, False if not.
    """
    sql = """
        SELECT 1
        FROM alerts_sent
        WHERE drop_id = %s
          AND subscriber_id = %s
          AND channel = %s
        LIMIT 1
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (drop_id, subscriber_id, channel))
            return cur.fetchone() is not None


def log_alert_sent(drop_id: int, subscriber_id: int, channel: str) -> None:
    """
    Inserts a row into alerts_sent.
    Uses INSERT ... ON CONFLICT DO NOTHING to be safe.
    """
    sql = """
        INSERT INTO alerts_sent (drop_id, subscriber_id, channel)
        VALUES (%s, %s, %s)
        ON CONFLICT (drop_id, subscriber_id, channel) DO NOTHING
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (drop_id, subscriber_id, channel))


def get_upcoming_drops(limit: int = 50) -> list[dict]:
    """
    Returns the most recently scraped drops ordered by scraped_at DESC.
    Returns list of dicts with all drop fields.
    """
    sql = """
        SELECT id, brand, name, drop_date, price, image_url, product_url, scraped_at
        FROM drops
        ORDER BY scraped_at DESC
        LIMIT %s
    """

    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (limit,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]


def prune_non_shoe_drops() -> int:
    """Delete drops that fail shoe/promo filters (cleans old bad rows)."""
    from scrapers._common import is_shoe_drop

    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, brand, name, price, image_url, product_url FROM drops"
            )
            rows = cur.fetchall()

        to_delete = [int(r["id"]) for r in rows if not is_shoe_drop(dict(r))]
        if not to_delete:
            return 0

        with conn.cursor() as cur:
            cur.execute("DELETE FROM alerts_sent WHERE drop_id = ANY(%s)", (to_delete,))
            cur.execute("DELETE FROM drops WHERE id = ANY(%s)", (to_delete,))
        conn.commit()
        return len(to_delete)


def get_stats() -> dict[str, Any]:
    """
    Returns: {subscriber_count, alerts_sent, drops_tracked}
    Each is a COUNT from the relevant table.
    """
    sql = """
        SELECT
          (SELECT COUNT(*) FROM subscribers) AS subscriber_count,
          (SELECT COUNT(*) FROM alerts_sent) AS alerts_sent,
          (SELECT COUNT(*) FROM drops) AS drops_tracked
    """

    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql)
            row = cur.fetchone() or {}
            return {
                "subscriber_count": int(row.get("subscriber_count", 0)),
                "alerts_sent": int(row.get("alerts_sent", 0)),
                "drops_tracked": int(row.get("drops_tracked", 0)),
            }


if __name__ == "__main__":
    print(get_stats())
