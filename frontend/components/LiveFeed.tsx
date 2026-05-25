"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CountdownTimer } from "@/components/CountdownTimer";
import {
  brandBadgeClass,
  formatPrice,
  num,
  scrapedAtIso,
  type DropRow,
} from "@/lib/dropDisplay";

/** How often to pull /api/feed while the tab is open */
const POLL_MS = 15_000;

type FeedStats = {
  subscriber_count?: unknown;
  drops_tracked?: unknown;
};

type Props = {
  initialDrops: DropRow[];
  initialStats: FeedStats;
  initialDbError: string | null;
  brandsMonitored: number;
};

function formatRefreshTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function feedFingerprint(drops: DropRow[], stats: FeedStats): string {
  return JSON.stringify({
    s: stats,
    d: drops.map((row) => [row.id, row.scraped_at, row.price, row.name]),
  });
}

export function LiveFeed({
  initialDrops,
  initialStats,
  initialDbError,
  brandsMonitored,
}: Props) {
  const [drops, setDrops] = useState(initialDrops);
  const [stats, setStats] = useState(initialStats);
  const [dbError, setDbError] = useState(initialDbError);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const fingerprintRef = useRef(
    feedFingerprint(initialDrops, initialStats)
  );

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const res = await fetch("/api/feed", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        drops?: DropRow[];
        stats?: FeedStats;
        updatedAt?: string;
        error?: string;
      };

      if (!res.ok) {
        setDbError(data.error ?? "Could not refresh feed.");
        return;
      }

      setDbError(null);
      const nextDrops = Array.isArray(data.drops) ? data.drops : [];
      const nextStats = data.stats ?? {};
      const nextFp = feedFingerprint(nextDrops, nextStats);

      if (nextFp !== fingerprintRef.current) {
        fingerprintRef.current = nextFp;
        setDrops(nextDrops);
        setStats(nextStats);
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 2500);
      }

      if (data.updatedAt) setLastUpdated(data.updatedAt);
    } catch {
      setDbError("Could not reach the server to refresh.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh({ silent: true });

    let pollId: number | null = null;

    const startPolling = () => {
      if (pollId != null) return;
      pollId = window.setInterval(
        () => void refresh({ silent: true }),
        POLL_MS
      ) as unknown as number;
    };

    const stopPolling = () => {
      if (pollId != null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true });
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const subscriberCount = num(stats.subscriber_count);
  const dropsTracked = num(stats.drops_tracked);

  return (
    <>
      <div className="mx-auto mb-10 flex max-w-3xl flex-wrap items-center justify-center gap-3">
        <span className="border-4 border-black bg-[#ffe600] px-4 py-2 font-extrabold shadow-pop-sm">
          {subscriberCount.toLocaleString()}{" "}
          <span className="font-serif font-bold italic">subscribers</span>
        </span>
        <span className="border-4 border-black bg-white px-4 py-2 font-extrabold shadow-pop-sm">
          {brandsMonitored.toLocaleString()}{" "}
          <span className="font-serif font-bold italic">brands monitored</span>
        </span>
        <span className="border-4 border-black bg-[#2d5bff] px-4 py-2 font-extrabold text-white shadow-pop-sm">
          {dropsTracked.toLocaleString()}{" "}
          <span className="font-serif font-bold italic">drops</span>
        </span>
      </div>

      <section className="mb-20 mt-14">
        <h2 className="mb-2 text-center font-serif text-4xl font-bold italic text-black">
          Latest drops
        </h2>
        <div className="mb-8 flex flex-col items-center justify-center gap-3">
          <p className="text-center font-sans text-sm font-bold uppercase tracking-widest text-neutral-500">
            {justUpdated ? (
              <span className="text-[#ff2d6f]">New data loaded</span>
            ) : (
              <>Live · refreshes every {POLL_MS / 1000}s</>
            )}
          </p>
          <p className="text-center font-sans text-xs font-medium text-neutral-500">
            {refreshing ? (
              <span>Updating…</span>
            ) : lastUpdated ? (
              <span>Last sync {formatRefreshTime(lastUpdated)}</span>
            ) : (
              <span>Railway scraper updates the database every 30 minutes</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="border-4 border-black bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-pop-sm transition hover:bg-[#ffe600] disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>

        {dbError ? (
          <div className="border-4 border-black bg-[#ff2d6f] px-4 py-3 text-center text-sm font-bold text-white shadow-pop-sm">
            {dbError}
          </div>
        ) : null}

        {!dbError && drops.length === 0 ? (
          <p className="text-center font-serif text-lg italic text-neutral-600">
            No drops yet — the scraper will populate this feed on its next run.
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
    </>
  );
}
