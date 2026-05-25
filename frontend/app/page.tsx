import Link from "next/link";

import { LiveFeed } from "@/components/LiveFeed";
import { SubscribeForm } from "@/components/SubscribeForm";
import { BRAND_TAGLINE, BRANDS } from "@/lib/brands";
import { type DropRow } from "@/lib/dropDisplay";
import { getDrops, getStats } from "@/lib/db";

/** Fresh stats/drops from Postgres on first paint; client polls /api/feed after */
export const dynamic = "force-dynamic";

export default async function Home() {
  let initialStats: Record<string, unknown> = {};
  let initialDrops: DropRow[] = [];
  let dbError: string | null = null;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    initialStats = (await getStats()) as Record<string, unknown>;
    initialDrops = (await getDrops(50)) as DropRow[];
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

          <div className="mt-10">
            <a
              href="#subscribe"
              className="inline-block border-4 border-black bg-[#ff2d6f] px-8 py-3.5 font-extrabold uppercase tracking-wide text-white shadow-pop transition hover:bg-[#e82663]"
            >
              Get email alerts
            </a>
          </div>
        </header>

        <LiveFeed
          initialDrops={initialDrops}
          initialStats={initialStats}
          initialDbError={dbError}
          brandsMonitored={BRANDS.length}
        />

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
            href="https://moosairfaan.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-[#2d5bff] underline-offset-4 hover:text-[#ff2d6f] hover:underline"
          >
            moosairfaan.dev
          </Link>
        </footer>
      </div>
    </div>
  );
}
