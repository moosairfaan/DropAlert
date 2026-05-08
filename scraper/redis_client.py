import time

import redis, os
from dotenv import load_dotenv

load_dotenv(override=True)

r = redis.from_url(os.getenv("REDIS_URL"), decode_responses=True)


def make_drop_key(brand: str, name: str) -> str:
    """Creates a normalized Redis key for a drop."""
    normalized = name.lower().strip().replace(" ", "_").replace("/", "_")
    # Remove special characters
    import re

    normalized = re.sub(r"[^a-z0-9_]", "", normalized)
    return f"alerted:{brand.lower()}:{normalized}"


def is_already_alerted(brand: str, name: str) -> bool:
    """Returns True if we have already sent alerts for this drop."""
    key = make_drop_key(brand, name)
    return r.exists(key) == 1


def mark_as_alerted(brand: str, name: str, ttl_seconds: int = 172800) -> None:
    """Marks a drop as alerted. Default TTL = 172800 seconds = 48 hours."""
    key = make_drop_key(brand, name)
    r.setex(key, ttl_seconds, "alerted")


def get_alerted_count() -> int:
    """Returns number of alerted drops currently in Redis."""
    keys = r.keys("alerted:*")
    return len(keys)


def clear_all_alerted() -> None:
    """DEV ONLY: clears all alerted keys. Never call in production."""
    keys = r.keys("alerted:*")
    if keys:
        r.delete(*keys)


if __name__ == "__main__":
    brand = "Supreme"
    name = "Box Logo Hoodie"
    key = make_drop_key(brand, name)

    try:
        # Clean so the script is idempotent if a stale key exists
        r.delete(key)

        ok1 = not is_already_alerted(brand, name)
        print(f"Test 1 (expect False / not alerted): {'PASS' if ok1 else 'FAIL'}")

        try:
            mark_as_alerted(brand, name, ttl_seconds=10)
            ok2 = True
        except Exception:
            ok2 = False
        print(f"Test 2 (mark_as_alerted): {'PASS' if ok2 else 'FAIL'}")

        ok3 = is_already_alerted(brand, name)
        print(f"Test 3 (expect True / alerted): {'PASS' if ok3 else 'FAIL'}")

        print("Test 4: waiting 11 seconds for TTL expiry...")
        time.sleep(11)

        ok5 = not is_already_alerted(brand, name)
        print(f"Test 5 (expect False after TTL): {'PASS' if ok5 else 'FAIL'}")
    except redis.ConnectionError as e:
        url = os.getenv("REDIS_URL") or ""
        print(e)
        if "railway.internal" in url:
            print(
                "REDIS_URL uses a Railway *private* host (redis.*.railway.internal). "
                "That only works inside Railway. On your Mac, paste the *public* "
                "Redis URL from Railway → Redis → Connect (or Variables), into scraper/.env."
            )
        elif not url:
            print("REDIS_URL is not set. Add it to scraper/.env.")
        else:
            print(
                "Could not reach Redis. Check REDIS_URL, firewall, and that Redis allows "
                "your IP if required."
            )
        raise SystemExit(1) from e
