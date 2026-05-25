import { NextRequest, NextResponse } from "next/server";

import {
  ensureSubscriberSchema,
  unsubscribeByEmail,
  unsubscribeByToken,
} from "@/lib/subscribers";

export const dynamic = "force-dynamic";

function redirectToPage(status: "confirmed" | "invalid") {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(
    new URL(`/unsubscribe?status=${status}`, base.replace(/\/$/, ""))
  );
}

/** GET — token (redirect to page) or legacy ?email= */
export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") || "").trim();
  const email = (req.nextUrl.searchParams.get("email") || "").trim();

  try {
    await ensureSubscriberSchema();

    if (token) {
      const ok = await unsubscribeByToken(token);
      return redirectToPage(ok ? "confirmed" : "invalid");
    }

    if (email) {
      const found = await unsubscribeByEmail(email);
      return redirectToPage(found ? "confirmed" : "invalid");
    }

    return NextResponse.redirect(
      new URL("/unsubscribe", req.nextUrl.origin)
    );
  } catch (err) {
    console.error("Unsubscribe GET error:", err);
    return redirectToPage("invalid");
  }
}

/** POST — Gmail one-click (RFC 8058); ?token= or ?email= */
export async function POST(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") || "").trim();
  const email = (req.nextUrl.searchParams.get("email") || "").trim();

  try {
    await ensureSubscriberSchema();
    if (token) {
      await unsubscribeByToken(token);
    } else if (email) {
      await unsubscribeByEmail(email);
    } else {
      return new NextResponse(null, { status: 400 });
    }
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("Unsubscribe POST error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
