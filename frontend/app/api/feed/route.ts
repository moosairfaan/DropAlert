import { NextResponse } from "next/server";

import { getDrops, getStats } from "@/lib/db";

/** Always hit Postgres — never static/cache (scraper → DB → this route → UI poll). */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/** JSON feed for live polling (drops + stats). */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured" },
        { status: 503 }
      );
    }

    const [stats, drops] = await Promise.all([getStats(), getDrops(50)]);
    return NextResponse.json(
      {
        stats,
        drops,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err) {
    console.error("Feed API error:", err);
    return NextResponse.json(
      { error: "Failed to load feed" },
      { status: 500 }
    );
  }
}
