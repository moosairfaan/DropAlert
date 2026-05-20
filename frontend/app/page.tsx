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
  if (b === "supreme") return "bg-red-600 text-white";
  if (b === "nike") return "bg-black text-white ring-1 ring-zinc-600";
  if (b === "stockx") return "bg-green-600 text-white";
  return "bg-zinc-600 text-white";
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

/** Parsed USD amount for comparisons, or null if missing / invalid. */
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

/** Compare dollars using cents to avoid float noise and treat tiny spreads as flat. */
function hasResellUpside(resell: number, retail: number): boolean {
  if (retail <= 0) return false;
  return Math.round(resell * 100) > Math.round(retail * 100);
}

/** ISO string for CountdownTimer (`scraped_at` from pg may be Date or string). */
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
      <div className="inline-flex items-center rounded-md bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-800/60">
        📈 Est. resell: {formatPrice(drop.resell_estimate)}
      </div>
      <p className="mt-1 text-[11px] font-medium text-emerald-500/90">
        +{pct}% profit
      </p>
    </div>
  );
}

export default async function Home() {
  let subscriberCount = 0;
  let alertsSent = 0;
  let dropsTracked = 0;
  let drops: DropRow[] = [];

  try {
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
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            🔔 DropAlert
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-zinc-400">
            Free email alerts for Supreme, Nike SNKRS, and StockX — no phone
            number required.
          </p>

          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-3 text-sm">
            <span className="rounded-full bg-[#1a1a1a] px-4 py-2 text-zinc-300 ring-1 ring-zinc-800">
              {subscriberCount.toLocaleString()} Subscribers
            </span>
            <span className="text-zinc-600">·</span>
            <span className="rounded-full bg-[#1a1a1a] px-4 py-2 text-zinc-300 ring-1 ring-zinc-800">
              {alertsSent.toLocaleString()} Alerts Sent
            </span>
            <span className="text-zinc-600">·</span>
            <span className="rounded-full bg-[#1a1a1a] px-4 py-2 text-zinc-300 ring-1 ring-zinc-800">
              {dropsTracked.toLocaleString()} Drops Tracked
            </span>
          </div>

          <div className="mt-10">
            <a
              href="#subscribe"
              className="inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
            >
              Get Email Alerts
            </a>
          </div>
        </header>

        {/* Drops grid */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-white">Latest Drops</h2>

          {drops.length === 0 ? (
            <p className="text-center text-zinc-500">
              No drops yet. Run the scraper pipeline to populate the calendar.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {drops.map((drop) => (
                <article
                  key={drop.id}
                  className="relative flex flex-col overflow-hidden rounded-xl bg-[#1a1a1a] ring-1 ring-zinc-800"
                >
                  <div className="relative h-48 w-full shrink-0 bg-zinc-800">
                    <span
                      className={`absolute left-3 top-3 z-10 rounded px-2 py-1 text-xs font-bold uppercase ${brandBadgeClass(drop.brand)}`}
                    >
                      {String(drop.brand).toUpperCase()}
                    </span>
                    {drop.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external scrape URLs
                      <img
                        src={drop.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-600">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-2 font-semibold leading-snug text-white">
                      {drop.name}
                    </h3>
                    <p className="mt-2 text-lg font-bold text-white">
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
                        className="mt-4 block w-full rounded-lg bg-zinc-900 py-3 text-center text-sm font-semibold text-white ring-1 ring-zinc-700 transition hover:bg-zinc-800"
                      >
                        Shop Now
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Subscribe */}
        <section
          id="subscribe"
          className="scroll-mt-8 rounded-2xl bg-[#111] px-4 py-14 ring-1 ring-zinc-800 sm:px-8"
        >
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">
            Get Email Alerts — Before They Sell Out
          </h2>
          <p className="mb-8 text-center text-sm text-zinc-500">
            Enter your email and pick the brands you want. We only send email —
            no SMS.
          </p>
          <SubscribeForm />
        </section>

        {/* Footer */}
        <footer className="mt-16 flex flex-col items-center justify-center gap-2 border-t border-zinc-800 pt-10 text-center text-sm text-zinc-500">
          <p>© 2025 DropAlert · Built by Moosa Irfaan</p>
          <Link
            href="https://github.com/moosairfaan/DropAlert"
            className="text-zinc-400 underline-offset-4 hover:text-white hover:underline"
          >
            GitHub
          </Link>
        </footer>
      </div>
    </div>
  );
}
