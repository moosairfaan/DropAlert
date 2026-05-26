/**
 * Client fetch for live feed — always bypasses caches.
 * Reads from GET /api/feed → lib/db.ts → Railway Postgres `drops` table
 * (same table scraper/pipeline.py writes via db.upsert_drop).
 */

import type { DropRow } from "@/lib/dropDisplay";

export const FEED_POLL_MS = 15_000;

export type FeedStats = {
  subscriber_count?: unknown;
  drops_tracked?: unknown;
  brands_live?: unknown;
};

export type FeedResponse = {
  ok: boolean;
  drops: DropRow[];
  stats: FeedStats;
  updatedAt: string | null;
  error: string | null;
};

export async function fetchFeed(): Promise<FeedResponse> {
  const url = `/api/feed?_=${Date.now()}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    next: { revalidate: 0 },
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  const data = (await res.json().catch(() => ({}))) as {
    drops?: DropRow[];
    stats?: FeedStats;
    updatedAt?: string;
    error?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      drops: [],
      stats: {},
      updatedAt: null,
      error: data.error ?? "Could not refresh feed.",
    };
  }

  return {
    ok: true,
    drops: Array.isArray(data.drops) ? data.drops : [],
    stats: data.stats ?? {},
    updatedAt: data.updatedAt ?? null,
    error: null,
  };
}
