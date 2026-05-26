"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CountdownTimer } from "@/components/CountdownTimer";
import {
  brandBadgeClass,
  formatPrice,
  scrapedAtIso,
  type DropRow,
} from "@/lib/dropDisplay";
import { fetchFeed, FEED_POLL_MS, type FeedStats } from "@/lib/feedApi";
import { filterDropsClient, type FeedFilterOptions } from "@/lib/feedFilters";

type FeedPayload = {
  drops: DropRow[];
  stats: FeedStats;
  updatedAt: string | null;
  error: string | null;
  changed: boolean;
};

type Props = {
  initialDrops: DropRow[];
  filter: FeedFilterOptions;
  refreshSignal?: number;
  onFeedUpdate?: (payload: FeedPayload) => void;
};

function feedFingerprint(drops: DropRow[], stats: FeedStats): string {
  return JSON.stringify({
    s: stats,
    d: drops.map((row) => [
      row.id,
      row.scraped_at,
      row.price,
      row.name,
      row.image_url,
    ]),
  });
}

export function ProductList({
  initialDrops,
  filter,
  refreshSignal = 0,
  onFeedUpdate,
}: Props) {
  const [drops, setDrops] = useState(initialDrops);
  const fingerprintRef = useRef(feedFingerprint(initialDrops, {}));

  const visibleDrops = useMemo(
    () => filterDropsClient(drops, filter),
    [drops, filter]
  );

  const loadProducts = useCallback(async () => {
    try {
      const result = await fetchFeed();

      if (!result.ok) {
        onFeedUpdate?.({
          drops: result.drops,
          stats: result.stats,
          updatedAt: result.updatedAt,
          error: result.error,
          changed: false,
        });
        return;
      }

      const nextFp = feedFingerprint(result.drops, result.stats);
      const changed = nextFp !== fingerprintRef.current;
      fingerprintRef.current = nextFp;

      setDrops(result.drops);

      onFeedUpdate?.({
        drops: result.drops,
        stats: result.stats,
        updatedAt: result.updatedAt,
        error: null,
        changed,
      });
    } catch {
      onFeedUpdate?.({
        drops: [],
        stats: {},
        updatedAt: null,
        error: "Could not reach the server to refresh.",
        changed: false,
      });
    }
  }, [onFeedUpdate]);

  useEffect(() => {
    void loadProducts();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId != null) return;
      intervalId = setInterval(() => {
        void loadProducts();
      }, FEED_POLL_MS);
    };

    const stopPolling = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadProducts();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadProducts, refreshSignal]);

  if (drops.length === 0) {
    return (
      <p className="text-center font-serif text-lg italic text-neutral-600">
        No drops yet — the scraper will populate this feed on its next run.
      </p>
    );
  }

  if (visibleDrops.length === 0) {
    return (
      <p className="text-center font-serif text-lg italic text-neutral-600">
        No drops match these filters. Try &quot;All&quot; or turn off Hype only.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {visibleDrops.map((drop) => (
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
              <CountdownTimer scrapedAt={scrapedAtIso(drop.scraped_at)} />
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
  );
}

export { FEED_POLL_MS as PRODUCT_LIST_POLL_MS };
