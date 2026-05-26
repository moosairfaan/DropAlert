"use client";

import { useCallback, useMemo, useState } from "react";

import { ProductList, PRODUCT_LIST_POLL_MS } from "@/components/ProductList";
import { BRAND_OPTIONS } from "@/lib/brands";
import { num, type DropRow } from "@/lib/dropDisplay";

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

export function LiveFeed({
  initialDrops,
  initialStats,
  initialDbError,
  brandsMonitored,
}: Props) {
  const [stats, setStats] = useState(initialStats);
  const [dbError, setDbError] = useState(initialDbError);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [hypeOnly, setHypeOnly] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const filter = useMemo(
    () => ({ brand: brandFilter, hypeOnly }),
    [brandFilter, hypeOnly]
  );

  const handleFeedUpdate = useCallback(
    (payload: {
      drops: DropRow[];
      stats: FeedStats;
      updatedAt: string | null;
      error: string | null;
      changed: boolean;
    }) => {
      if (payload.error) {
        setDbError(payload.error);
        setRefreshing(false);
        return;
      }

      setDbError(null);
      setStats(payload.stats);
      if (payload.updatedAt) setLastUpdated(payload.updatedAt);
      if (payload.changed) {
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 2500);
      }
      setRefreshing(false);
    },
    []
  );

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
        <div className="mb-6 flex flex-col items-center justify-center gap-3">
          <p className="text-center font-sans text-sm font-bold uppercase tracking-widest text-neutral-500">
            {justUpdated ? (
              <span className="text-[#ff2d6f]">New data loaded</span>
            ) : (
              <>Live · refreshes every {PRODUCT_LIST_POLL_MS / 1000}s</>
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
            onClick={() => {
              setRefreshing(true);
              setRefreshNonce((n) => n + 1);
            }}
            disabled={refreshing}
            className="border-4 border-black bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-pop-sm transition hover:bg-[#ffe600] disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setBrandFilter(null)}
            className={`rounded-lg border-4 px-3 py-2 text-xs font-extrabold uppercase transition ${
              brandFilter === null
                ? "border-black bg-black text-white shadow-pop-sm"
                : "border-black bg-white text-black hover:bg-[#ffe600]"
            }`}
          >
            All
          </button>
          {BRAND_OPTIONS.map(({ label, value, on }) => {
            const selected = brandFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setBrandFilter(value)}
                className={`rounded-lg border-4 px-3 py-2 text-xs font-extrabold transition ${
                  selected
                    ? `${on} border-black shadow-pop-sm`
                    : "border-black bg-white text-black hover:bg-[#ffe600]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mb-8 flex justify-center">
          <button
            type="button"
            role="switch"
            aria-checked={hypeOnly}
            onClick={() => setHypeOnly((v) => !v)}
            className={`flex items-center gap-3 border-4 border-black px-4 py-2.5 font-extrabold uppercase tracking-wide shadow-pop-sm transition ${
              hypeOnly
                ? "bg-[#ff2d6f] text-white"
                : "bg-white text-black hover:bg-[#ffe600]"
            }`}
          >
            <span
              className={`inline-block h-5 w-10 rounded-full border-2 border-black ${
                hypeOnly ? "bg-white" : "bg-neutral-200"
              }`}
            >
              <span
                className={`mt-0.5 block h-3.5 w-3.5 rounded-full border-2 border-black bg-black transition-transform ${
                  hypeOnly ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
            Hype only
          </button>
        </div>

        {dbError ? (
          <div className="mb-6 border-4 border-black bg-[#ff2d6f] px-4 py-3 text-center text-sm font-bold text-white shadow-pop-sm">
            {dbError}
          </div>
        ) : null}

        <ProductList
          initialDrops={initialDrops}
          filter={filter}
          refreshSignal={refreshNonce}
          onFeedUpdate={handleFeedUpdate}
        />
      </section>
    </>
  );
}
