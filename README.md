# DropAlert

### Real-time email alerts for Supreme, Nike SNKRS, and StockX drops

DropAlert scrapes three of the most competitive streetwear and sneaker platforms every 30 minutes using Playwright. When a new drop is detected, subscribers get an email before it sells out.

**Live app:** [https://dropalert-sigma.vercel.app/#subscribe](https://dropalert-sigma.vercel.app/#subscribe)  
|  
**GitHub:** [https://github.com/moosairfaan/DropAlert](https://github.com/moosairfaan/DropAlert)

## Stats

| Metric | Value |
|--------|-------|
| Subscribers | 2+ |
| Alerts sent | 0+ |
| Drops tracked | 15+ |
| Uptime | 99.9% |
| Brands covered | Supreme, Nike SNKRS, StockX |
| Alert channels | Email (Resend) |
| Pipeline frequency | Every 30 minutes |

*Stats (subscribers, alerts, drops) are live from production as of the latest deploy. Uptime reflects UptimeRobot monitoring of the Vercel frontend.*

## How It Works

1. Playwright scrapes Supreme, Nike SNKRS, and StockX every 30 minutes on Railway
2. New drops are deduplicated using Redis (48hr TTL key per drop)
3. New drops are inserted into PostgreSQL
4. Email alerts are sent to subscribers who follow that brand
5. Every alert is logged to prevent duplicate sends
6. The Next.js frontend shows a live drop calendar and handles subscriptions

## Tech Stack

| Layer | Technology |
|-------|------------|
| Scraping | Python, Playwright (Chromium) |
| Scheduling | APScheduler (interval: 30 min) |
| Deduplication | Redis (TTL-based key per drop) |
| Database | PostgreSQL (Railway) |
| Email | Resend (HTML templates) |
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS |
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| Monitoring | UptimeRobot |

## Architecture

```
scheduler.py (APScheduler every 30min)
    └── pipeline.py (orchestrator)
         ├── scrapers/ (Playwright → drops list)
         ├── redis_client.py (dedup check)
         ├── db.py (insert drop + get subscribers)
         └── alerts/ (Resend email)
```

## Local Development

```bash
cd scraper && pip install -r requirements.txt && playwright install chromium
# Create scraper/.env with DATABASE_URL, REDIS_URL, Resend, etc.
python scheduler.py
```

```bash
cd frontend && npm install
# Create frontend/.env.local with DATABASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

- **Frontend (Vercel):** set **Root Directory** to **`frontend`**. See [VERCEL.md](./VERCEL.md) if you get “No Next.js version detected”.
- **Scraper (Railway):** set **Root Directory** to **`scraper`**, use the Dockerfile there.
