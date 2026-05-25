import { NextResponse } from "next/server";

import { getDrops, getStats } from "@/lib/db";

export const dynamic = "force-dynamic";

/** JSON feed for live polling (drops + stats). */
export async function GET() {
  try {
    const [stats, drops] = await Promise.all([getStats(), getDrops(50)]);
    return NextResponse.json(
      {
        stats,
        drops,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
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
