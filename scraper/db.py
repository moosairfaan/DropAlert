import os
from typing import Any, Optional

import psycopg2
from dotenv import load_dotenv
from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor


# Prefer values from scraper/.env over a stale DATABASE_URL exported in the shell
# (default dotenv behavior leaves existing env vars untouched).
load_dotenv(override=True)


def get_connection() -> PGConnection:
    """
    Opens a new psycopg2 connection using DATABASE_URL.
    Returns the connection object.
    """
    database_url = (os.getenv("DATABASE_URL") or "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set in the environment")
    # Railway public proxy (e.g. *.proxy.rlwy.net) expects TLS; without sslmode
    # libpq may negotiate poorly and the server closes the connection.
    if "sslmode=" not in database_url:
        sep = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{sep}sslmode=require"
    return psycopg2.connect(database_url)


def insert_drop(drop: dict) -> Optional[int]:
    """
    Inserts a drop into the drops table.
    Uses INSERT ... ON CONFLICT (brand, name) DO NOTHING.
    Returns the new drop id if inserted, None if it already existed.
    """
    sql = """
        INSERT INTO drops (brand, name, drop_date, price, image_url, product_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (brand, name) DO NOTHING
        RETURNING id
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    drop.get("brand"),
                    drop.get("name"),
                    drop.get("drop_date"),
                    drop.get("price"),
                    drop.get("image_url"),
                    drop.get("product_url"),
                ),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None


def touch_drop(drop: dict) -> None:
    """Refresh scrape metadata so existing items sort to the top of the feed."""
    sql = """
        UPDATE drops
        SET drop_date = %s,
            price = %s,
            image_url = %s,
            product_url = %s,
            scraped_at = NOW()
        WHERE brand = %s AND name = %s
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    drop.get("drop_date"),
                    drop.get("price"),
                    drop.get("image_url"),
                    drop.get("product_url"),
                    drop.get("brand"),
                    drop.get("name"),
                ),
            )


def get_subscribers_for_brand(brand: str) -> list[dict]:
    """
    Queries subscribers WHERE active=TRUE AND brand_prefs @> ARRAY[brand]
    Returns list of dicts with keys: id, email
    """
    sql = """
        SELECT id, email
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
