# Deploy scraper on Railway

The scraper container does **not** read `scraper/.env` from git (secrets stay out of the repo). You must set variables on the **scraper service** in Railway.

## Service settings

1. **Root Directory:** `scraper` (or repo root with root `Dockerfile` — both work)
2. **Builder:** Dockerfile (`scraper/Dockerfile`)
3. **Automatic scraping every 30 minutes** — pick one option below

### Option A — Background worker (recommended)

Keeps one container running; scrapes every 30 minutes internally.

| Setting | Value |
|---------|--------|
| **Start command** | `python scheduler.py` |
| **Cron Schedule** | *(leave empty)* |

Runs `run_pipeline()` → upserts drops → sends alerts. First run starts immediately, then every 30 minutes.

Optional: `SCRAPE_INTERVAL_MINUTES=30` (minimum 5).

### Option B — Railway Cron (run once, then exit)

Cheaper if you prefer Railway to start the container on a schedule.

| Setting | Value |
|---------|--------|
| **Start command** | `python run_scrape.py` |
| **Cron Schedule** | `*/30 * * * *` (UTC, every 30 minutes) |

The process **must exit** when finished (this script does). If a run is still going when the next cron fires, Railway skips that run.

Set cron in the **dashboard** (Settings → Cron Schedule). If cron from `railway.json` misbehaves, use the dashboard only.

See `railway.cron.example.json` for reference.

### Option C — HTTP scrape endpoint + Cron curl

| Setting | Value |
|---------|--------|
| **Start command** | `python http_server.py` |
| **Cron Schedule** | `*/30 * * * *` |
| **Public networking** | Enabled (generate domain) |

Endpoints:

- `GET /health` — liveness
- `POST` or `GET /api/scrape` — runs full scrape and saves to Postgres

Protect with `SCRAPE_SECRET`:

```bash
curl -X POST "https://YOUR-SERVICE.up.railway.app/api/scrape" \
  -H "Authorization: Bearer YOUR_SCRAPE_SECRET"
```

Or use **Option A/B** — they call the same pipeline directly (no HTTP).

### `SCRAPER_MODE` shortcut

Start command `./start.sh` and variable:

| `SCRAPER_MODE` | Behavior |
|----------------|----------|
| `worker` (default) | `python scheduler.py` |
| `cron` | `python run_scrape.py` (pair with Cron Schedule) |
| `http` | `python http_server.py` |

## Required environment variables

In Railway → **your scraper service** → **Variables**:

| Variable | How to set |
|----------|------------|
| `DATABASE_URL` | **Reference** your Postgres plugin: `${{Postgres.DATABASE_URL}}` (name may differ, e.g. `PostgreSQL`) |
| `REDIS_URL` | Reference Redis plugin or paste public Redis URL |
| `RESEND_API_KEY` | From [Resend](https://resend.com) |
| `ALERT_FROM_EMAIL` | e.g. `alerts@yourdomain.com` |
| `DROPALERT_APP_URL` | e.g. `https://dropalert-sigma.vercel.app` |

Optional:

| Variable | Purpose |
|----------|---------|
| `SCRAPE_INTERVAL_MINUTES` | Worker interval (default `30`) |
| `SCRAPE_SECRET` | Protect `POST /api/scrape` (HTTP mode) |
| `TEST_EMAIL_TO` | Manual email tests |

### Link Postgres to the scraper service

1. Open the **scraper** service (not Postgres, not Vercel).
2. **Variables** → **New Variable** → **Add Reference** (or raw value).
3. Name: `DATABASE_URL` — Value: `${{Postgres.DATABASE_URL}}`  
   Replace `Postgres` with your database service’s name in the dropdown.
4. Repeat for Redis: `REDIS_URL` = `${{Redis.REDIS_URL}}`.
5. Add `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `DROPALERT_APP_URL` as plain values.
6. **Deploy** → **Redeploy** the scraper (saving variables alone may not restart the container).

**Shared variables:** If you set vars at the **project** level, open the scraper service → Variables → ensure they are **linked** to that service.

If you only set `DATABASE_URL` on **Vercel**, the scraper will still crash — each Railway service needs its own variables.

**Logs still show the old error** `DATABASE_URL is not set in the environment` (no “See scraper/RAILWAY.md”)? The running image is an old deploy — push latest code and redeploy after adding variables.

## Verify

After deploy, **Logs** should show:

```text
DropAlert scheduler started (scrape every 30 minutes via run_scrape pipeline)
Starting scrape job...
Starting scrape pipeline...
Pipeline complete: 2 new, 15 updated, 0 write failures, ...
```

If you see `DATABASE_URL is not set`, the variable is missing on **this** service.

## Same database as Vercel

Use the **same** `DATABASE_URL` value as `frontend/.env.local` / Vercel (Railway public Postgres URL with `?sslmode=require` is fine).
