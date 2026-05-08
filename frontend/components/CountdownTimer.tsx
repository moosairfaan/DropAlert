"use client";

import { useEffect, useMemo, useState } from "react";

function formatRelative(scrapedAtIso: string): string {
  if (!scrapedAtIso.trim()) return "—";
  const d = new Date(scrapedAtIso);
  if (Number.isNaN(d.getTime())) return "—";

  const ms = Date.now() - d.getTime();
  if (ms < 0) return "Just found";

  if (ms < 60_000) return "Just found";

  if (ms < 60 * 60_000) {
    const minutes = Math.floor(ms / 60_000);
    return `Found ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (ms < 24 * 60 * 60_000) {
    const hours = Math.floor(ms / (60 * 60_000));
    return `Found ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(ms / (24 * 60 * 60_000));
  return `Found ${days} day${days === 1 ? "" : "s"} ago`;
}

export function CountdownTimer({ scrapedAt }: { scrapedAt: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const label = useMemo(
    () => formatRelative(scrapedAt),
    [scrapedAt, tick]
  );

  return (
    <span className="text-[12px] text-zinc-500">{label}</span>
  );
}
