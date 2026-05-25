import Link from "next/link";

import { CountdownTimer } from "@/components/CountdownTimer";
import { SubscribeForm } from "@/components/SubscribeForm";
import { BRAND_TAGLINE } from "@/lib/brands";
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
  if (b === "supreme") return "bg-red-500 text-white";
  if (b === "nike") return "bg-violet-600 text-white";
  if (b === "jordan") return "bg-orange-500 text-white";
  if (b === "adidas") return "bg-black text-white";
  if (b === "new balance") return "bg-neutral-600 text-white";
  if (b === "puma") return "bg-red-600 text-white";
  if (b === "asics") return "bg-blue-600 text-white";
  if (b === "kith") return "bg-zinc-800 text-white";
  if (b === "palace") return "bg-[#ffe600] text-black";
  return "bg-[#2d5bff] text-white";
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
  image_url?: string | null;
  product_url?: string | null;
  scraped_at?: string | Date | null;
};

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
    <div className="min-h-screen bg-[#fff8f0] text-black">
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-14 text-center">
          <p className="font-sans text-xs font-extrabold uppercase tracking-[0.2em] text-[#ff2d6f]">
            Streetwear + sneakers
          </p>
          <h1 className="mt-2 font-serif text-5xl font-bold italic tracking-tight text-black sm:text-6xl">
            Drop<span className="font-sans not-italic text-[#2d5bff]">Alert</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl font-sans text-base font-medium leading-relaxed text-neutral-800 sm:text-lg">
            <span className="font-serif font-bold italic">Free email alerts</span>{" "}
            for {BRAND_TAGLINE}. Catch releases{" "}
            <span className="font-extrabold">before they sell out.</span>
          </p>

          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-3">
            <span className="border-4 border-black bg-[#ffe600] px-4 py-2 font-extrabold shadow-pop-sm">
              {subscriberCount.toLocaleString()}{" "}
              <span className="font-serif font-bold italic">subscribers</span>
            </span>
            <span className="border-4 border-black bg-white px-4 py-2 font-extrabold shadow-pop-sm">
              {alertsSent.toLocaleString()}{" "}
              <span className="font-serif font-bold italic">emails sent</span>
            </span>
            <span className="border-4 border-black bg-[#2d5bff] px-4 py-2 font-extrabold text-white shadow-pop-sm">
              {dropsTracked.toLocaleString()}{" "}
              <span className="font-serif font-bold italic">drops</span>
            </span>
          </div>

          <div className="mt-10">
            <a
              href="#subscribe"
              className="inline-block border-4 border-black bg-[#ff2d6f] px-8 py-3.5 font-extrabold uppercase tracking-wide text-white shadow-pop transition hover:bg-[#e82663]"
            >
              Get email alerts
            </a>
          </div>
        </header>

        <section className="mb-20">
          <h2 className="mb-2 text-center font-serif text-4xl font-bold italic text-black">
            Latest drops
          </h2>
          <p className="mb-8 text-center font-sans text-sm font-bold uppercase tracking-widest text-neutral-500">
            Live from the scraper
          </p>

          {dbError ? (
            <div className="border-4 border-black bg-[#ff2d6f] px-4 py-3 text-center text-sm font-bold text-white shadow-pop-sm">
              Could not load drops: {dbError}. Check{" "}
              <code className="bg-black/20 px-1">DATABASE_URL</code> in Vercel
              (or <code className="bg-black/20 px-1">frontend/.env.local</code>{" "}
              locally).
            </div>
          ) : null}

          {!dbError && drops.length === 0 ? (
            <p className="text-center font-serif text-lg italic text-neutral-600">
              No drops yet — run{" "}
              <code className="rounded border-2 border-black bg-white px-1 font-sans text-sm font-bold not-italic">
                python scheduler.py
              </code>{" "}
              on Railway.
            </p>
          ) : null}

          {!dbError && drops.length > 0 ? (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {drops.map((drop) => (
                <article
                  key={drop.id}
                  className="group flex flex-col overflow-hidden border-4 border-black bg-white shadow-pop transition hover:-translate-y-1 hover:shadow-pop-lg"
                >
                  <div className="relative h-52 w-full shrink-0 border-b-4 border-black bg-[#ffe600]">
                    <span
                      className={`absolute left-3 top-3 z-10 border-2 border-black px-3 py-1 text-xs font-extrabold uppercase ${brandBadgeClass(drop.brand)}`}
                    >
                      {String(drop.brand).toUpperCase()}
                    </span>
                    {drop.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external scrape URLs
                      <img
                        src={drop.image_url}
                        alt={drop.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl">
                        👟
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-2 font-serif text-lg font-bold leading-snug text-black">
                      {drop.name}
                    </h3>
                    <p className="mt-2 font-sans text-2xl font-extrabold text-[#ff2d6f]">
                      {formatPrice(drop.price)}
                    </p>
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
                        className="mt-4 block w-full border-4 border-black bg-[#2d5bff] py-3 text-center text-sm font-extrabold uppercase tracking-wide text-white transition hover:bg-[#2449d4]"
                      >
                        Shop now →
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
          className="scroll-mt-8 border-4 border-black bg-[#00d4aa] px-4 py-14 shadow-pop-lg sm:px-8"
        >
          <h2 className="text-center font-serif text-3xl font-bold italic text-black sm:text-4xl">
            Get alerts before sellout
          </h2>
          <p className="mb-8 mt-3 text-center font-sans text-sm font-bold text-black/80">
            Pick your brands. <span className="italic">Email only</span> — no SMS.
          </p>
          <SubscribeForm />
        </section>

        <footer className="mt-16 flex flex-col items-center justify-center gap-2 border-t-4 border-black pt-10 text-center">
          <p className="font-sans text-sm font-bold">
            © 2025 DropAlert ·{" "}
            <span className="font-serif italic">Moosa Irfaan</span>
          </p>
          <Link
            href="https://github.com/moosairfaan/DropAlert"
            className="font-extrabold text-[#2d5bff] underline-offset-4 hover:text-[#ff2d6f] hover:underline"
          >
            GitHub
          </Link>
        </footer>
      </div>
    </div>
  );
}
