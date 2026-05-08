import { NextRequest, NextResponse } from "next/server";

import pool from "@/lib/db";

const VALID_BRANDS = ["Supreme", "Nike", "StockX"] as const;

function pgErrCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    phone?: unknown;
    email?: unknown;
    brandPrefs?: unknown;
    brand_prefs?: unknown;
  };

  const phone =
    typeof body.phone === "string" ? body.phone.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim() : "";

  const rawPrefs = Array.isArray(body.brandPrefs)
    ? body.brandPrefs
    : Array.isArray(body.brand_prefs)
      ? body.brand_prefs
      : [];

  // VALIDATION

  // 1. Must have at least phone or email
  if (!phone && !email) {
    return NextResponse.json(
      { error: "Please enter a phone number or email address." },
      { status: 400 }
    );
  }

  // 2. Validate phone format (E.164: starts with +, then digits only, 8-15 chars total)
  if (phone) {
    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: "Phone must be in E.164 format: +12125551234" },
        { status: 400 }
      );
    }
  }

  // 3. Validate email format
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
  }

  // 4. Validate brandPrefs
  const prefs: string[] = rawPrefs.filter(
    (b): b is string =>
      typeof b === "string" && VALID_BRANDS.includes(b as (typeof VALID_BRANDS)[number])
  );

  if (prefs.length === 0) {
    return NextResponse.json(
      { error: "Please select at least one brand." },
      { status: 400 }
    );
  }

  // INSERT SUBSCRIBER
  try {
    await pool.query(
      `
      INSERT INTO subscribers (phone, email, brand_prefs, active)
      VALUES ($1, $2, $3::text[], true)
      ON CONFLICT (phone) DO UPDATE SET
        brand_prefs = EXCLUDED.brand_prefs,
        active = true
      `,
      [phone || null, email || null, prefs]
    );

    return NextResponse.json({ success: true, brands: prefs }, { status: 200 });
  } catch (err: unknown) {
    // Handle unique constraint on email if it conflicts
    if (pgErrCode(err) === "23505") {
      await pool.query(
        "UPDATE subscribers SET brand_prefs = $1::text[], active = true WHERE email = $2 OR phone = $3",
        [prefs, email || null, phone || null]
      );
      return NextResponse.json({ success: true, brands: prefs }, { status: 200 });
    }

    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
