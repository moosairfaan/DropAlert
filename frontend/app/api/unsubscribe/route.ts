import { NextRequest, NextResponse } from "next/server";

import pool from "@/lib/db";

async function unsubscribeEmail(email: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "UPDATE subscribers SET active = false WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return (rowCount ?? 0) > 0;
}

function htmlResponse(message: string, status = 200) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><body style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:24px;color:#111"><p>${message}</p></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

/** GET /api/unsubscribe?email=... — link in email footer */
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "").trim();
  if (!email) {
    return htmlResponse("Missing email parameter.", 400);
  }
  try {
    const found = await unsubscribeEmail(email);
    if (!found) {
      return htmlResponse(
        "No active subscription found for that email address."
      );
    }
    return htmlResponse("You have been unsubscribed from DropAlert emails.");
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return htmlResponse("Something went wrong. Please try again later.", 500);
  }
}

/** POST — Gmail one-click unsubscribe (RFC 8058) */
export async function POST(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "").trim();
  if (!email) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    await unsubscribeEmail(email);
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("Unsubscribe POST error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
