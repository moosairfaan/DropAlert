# Deploy frontend to Vercel

The Next.js app lives in **`frontend/`**. Vercel must use that folder as the project root.

## Required settings

1. **Vercel** → your project → **Settings** → **General**
2. **Root Directory** → click **Edit** → enter **`frontend`** → **Save**
3. **Build & Development** → turn **off** any override for:
   - Install Command
   - Build Command  
   (leave empty so Vercel auto-detects Next.js from `frontend/package.json`)

4. **Environment Variables** (Production + Preview):

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | Postgres (same as Railway) |
   | `RESEND_API_KEY` | Welcome + (via scraper) drop alert emails |
   | `ALERT_FROM_EMAIL` | e.g. `alerts@moosairfaan.dev` |
   | `DROPALERT_APP_URL` | e.g. `https://dropalert-sigma.vercel.app` (unsubscribe links) |
   | `ANTHROPIC_API_KEY` | Find My Drop chat + personalized alert filtering (scraper) |

   For local dev, copy `RESEND_API_KEY` and `ALERT_FROM_EMAIL` into `frontend/.env.local` too.

5. **Redeploy** the latest `main` branch.

## Why you see “No Next.js version detected”

That error means Vercel is building from the **repo root**, where there is no Next.js app. The real `package.json` with `"next"` is in **`frontend/package.json`**.

Do **not** use install commands like `cd frontend && npm install` while Root Directory is still the repo root — set Root Directory to **`frontend`** instead.

## Monorepo layout

```
dropalert/
├── frontend/          ← Vercel Root Directory
│   ├── package.json   ← has "next" dependency
│   ├── package-lock.json
│   ├── next.config.ts
│   └── app/
├── scraper/           ← Railway (separate service)
└── ...
```
