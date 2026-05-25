import Link from "next/link";

import { CountdownTimer } from "@/components/CountdownTimer";
import { SubscribeForm } from "@/components/SubscribeForm";
import { getDrops, getStats } from "@/lib/db";

/** Fresh stats/drops from Postgres on every request */
export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function brandBadgeClass(brand: string): string {
  const b = brand.toLowerCase();
  if (b === "supreme") return "bg-red-500 text-white shadow-md shadow-red-500/30";
  if (b === "nike") return "bg-violet-600 text-white shadow-md shadow-violet-600/30";
  if (b === "stockx") return "bg-emerald-500 text-white shadow-md shadow-emerald-500/30";
  return "bg-cyan-500 text-white shadow-md shadow-cyan-500/30";
}

function formatPrice(price: unknown): string {
  if (price == null) return "—";
  const n = typeof price === "string" ? parseFloat(price) : Number(price);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.replace(/\$/g, "").replace(/,/g, "").trim();
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function hasResellUpside(resell: number, retail: number): boolean {
  if (retail <= 0) return false;
  return Math.round(resell * 100) > Math.round(retail * 100);
}

function scrapedAtIso(v: string | Date | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

type DropRow = {
  id: number;
  brand: string;
  name: string;
  price?: unknown;
  resell_estimate?: unknown;
  image_url?: string | null;
  product_url?: string | null;
  scraped_at?: string | Date | null;
};

function ResellUpside({ drop }: { drop: DropRow }) {
  const resell = parseMoney(drop.resell_estimate);
  const retail = parseMoney(drop.price);
  if (resell == null || retail == null || !hasResellUpside(resell, retail)) {
    return null;
  }
  const pct = (((resell - retail) / retail) * 100).toFixed(0);
  return (
    <div className="mt-2">
      <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 ring-2 ring-emerald-300">
        📈 Est. resell: {formatPrice(drop.resell_estimate)}
      </div>
      <p className="mt-1 text-xs font-bold text-emerald-600">+{pct}% profit</p>
    </div>
  );
}

export default async function Home() {
  let subscriberCount = 0;
  let alertsSent = 0;
  let dropsTracked = 0;
  let drops: DropRow[] = [];
  let dbError: string | null = null;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    const s = await getStats();
    if (s && typeof s === "object") {
      const row = s as Record<string, unknown>;
      subscriberCount = num(row.subscriber_count);
      alertsSent = num(row.alerts_sent);
      dropsTracked = num(row.drops_tracked);
    }
    const rows = await getDrops(50);
    drops = rows as DropRow[];
  } catch (err) {
    console.error(err);
    dbError =
      err instanceof Error
        ? err.message
        : "Could not load drops from the database.";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-violet-50 to-cyan-50 text-[#1a1033]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-rose-300/40 blur-3xl" />
        <div className="absolute -right-16 top-40 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-56 w-56 rounded-full bg-cyan-300/35 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-14 text-center">
          <h1 className="bg-gradient-to-r from-rose-500 via-violet-600 to-cyan-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            🔔 DropAlert
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg font-medium text-violet-900/80">
            Free email alerts for Supreme, Nike SNKRS, and StockX — catch releases
            before they sell out.
          </p>

          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-3 text-sm font-semibold">
            <span className="rounded-full bg-white px-4 py-2 text-violet-700 shadow-md ring-2 ring-violet-200">
              {subscriberCount.toLocaleString()} Subscribers
            </span>
            <span className="text-violet-400">·</span>
            <span className="rounded-full bg-white px-4 py-2 text-rose-600 shadow-md ring-2 ring-rose-200">
              {alertsSent.toLocaleString()} Emails Sent
            </span>
            <span className="text-violet-400">·</span>
            <span className="rounded-full bg-white px-4 py-2 text-cyan-700 shadow-md ring-2 ring-cyan-200">
              {dropsTracked.toLocaleString()} Drops Tracked
            </span>
          </div>

          <div className="mt-10">
            <a
              href="#subscribe"
              className="inline-block rounded-full bg-gradient-to-r from-rose-500 to-violet-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-violet-500/40 transition hover:scale-105 hover:shadow-xl"
            >
              Get Email Alerts
            </a>
          </div>
        </header>

        <section className="mb-20">
          <h2 className="mb-8 text-center text-3xl font-extrabold text-violet-900">
            Latest Drops
          </h2>

          {dbError ? (
            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-800">
              Could not load drops: {dbError}. Check{" "}
              <code className="rounded bg-white px-1">DATABASE_URL</code> in Vercel
              (or <code className="rounded bg-white px-1">frontend/.env.local</code>{" "}
              locally).
            </div>
          ) : null}

          {!dbError && drops.length === 0 ? (
            <p className="text-center font-medium text-violet-700/70">
              No drops yet. Run the scraper on Railway (
              <code className="rounded bg-white/80 px-1">python scheduler.py</code>
              ) to populate this feed.
            </p>
          ) : null}

          {!dbError && drops.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {drops.map((drop) => (
                <article
                  key={drop.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg ring-2 ring-violet-100 transition hover:-translate-y-1 hover:shadow-xl hover:ring-violet-300"
                >
                  <div className="relative h-52 w-full shrink-0 bg-gradient-to-br from-violet-100 to-rose-100">
                    <span
                      className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-xs font-bold uppercase ${brandBadgeClass(drop.brand)}`}
                    >
                      {String(drop.brand).toUpperCase()}
                    </span>
                    {drop.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external scrape URLs
                      <img
                        src={drop.image_url}
                        alt={drop.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl">
                        👟
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-2 font-bold leading-snug text-violet-950">
                      {drop.name}
                    </h3>
                    <p className="mt-2 text-xl font-extrabold text-rose-500">
                      {formatPrice(drop.price)}
                    </p>
                    <ResellUpside drop={drop} />
                    <div className="mt-2">
                      <CountdownTimer
                        scrapedAt={scrapedAtIso(drop.scraped_at)}
                      />
                    </div>
                    {drop.product_url ? (
                      <a
                        href={drop.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-3 text-center text-sm font-bold text-white shadow-md transition hover:from-violet-500 hover:to-cyan-400"
                      >
                        Shop Now →
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section
          id="subscribe"
          className="scroll-mt-8 rounded-3xl bg-white/90 px-4 py-14 shadow-xl ring-2 ring-violet-200 backdrop-blur sm:px-8"
        >
          <h2 className="mb-2 text-center text-2xl font-extrabold text-violet-900 sm:text-3xl">
            Get Email Alerts — Before They Sell Out
          </h2>
          <p className="mb-8 text-center text-sm font-medium text-violet-700/80">
            Enter your email and pick the brands you want. We only send email —
            no SMS.
          </p>
          <SubscribeForm />
        </section>

        <footer className="mt-16 flex flex-col items-center justify-center gap-2 border-t-2 border-violet-200/60 pt-10 text-center text-sm font-medium text-violet-700/70">
          <p>© 2025 DropAlert · Built by Moosa Irfaan</p>
          <Link
            href="https://github.com/moosairfaan/DropAlert"
            className="text-violet-600 underline-offset-4 hover:text-rose-500 hover:underline"
          >
            GitHub
          </Link>
        </footer>
      </div>
    </div>
  );
}
