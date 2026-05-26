"""
HTTP scrape API for Railway (or cron curl).

POST/GET /api/scrape — run pipeline and save to DB
GET /health — liveness

Optional: set SCRAPE_SECRET and pass Authorization: Bearer <secret>
"""

from __future__ import annotations

import asyncio
import logging
import os

from aiohttp import web

from scrape_job import check_scraper_env, run_scrape

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def _authorized(request: web.Request) -> bool:
    secret = (os.getenv("SCRAPE_SECRET") or "").strip()
    if not secret:
        return True
    auth = request.headers.get("Authorization", "")
    if auth == f"Bearer {secret}":
        return True
    if request.query.get("secret") == secret:
        return True
    return False


async def handle_health(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "dropalert-scraper"})


async def handle_scrape(request: web.Request) -> web.Response:
    if not _authorized(request):
        return web.json_response({"ok": False, "error": "unauthorized"}, status=401)

    if request.app.get("scrape_running"):
        return web.json_response(
            {"ok": False, "error": "scrape already in progress"},
            status=409,
        )

    request.app["scrape_running"] = True
    try:
        summary = await run_scrape()
        return web.json_response({"ok": True, "summary": summary})
    except Exception as exc:
        log.exception("Scrape endpoint failed")
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    finally:
        request.app["scrape_running"] = False


def create_app() -> web.Application:
    app = web.Application()
    app["scrape_running"] = False
    app.router.add_get("/health", handle_health)
    app.router.add_get("/api/scrape", handle_scrape)
    app.router.add_post("/api/scrape", handle_scrape)
    return app


def main() -> None:
    check_scraper_env()
    port = int(os.getenv("PORT", "8080"))
    log.info("Scrape API listening on 0.0.0.0:%s (POST /api/scrape)", port)
    web.run_app(create_app(), host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
