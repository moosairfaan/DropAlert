import { NextRequest, NextResponse } from "next/server";

import pool from "@/lib/db";
import { BRANDS } from "@/lib/brands";

const VALID_BRANDS = BRANDS;

function pgErrCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    email?: unknown;
    brandPrefs?: unknown;
    brand_prefs?: unknown;
  };

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  const rawPrefs = Array.isArray(body.brandPrefs)
    ? body.brandPrefs
    : Array.isArray(body.brand_prefs)
      ? body.brand_prefs
      : [];

  if (!email) {
    return NextResponse.json(
      { error: "Please enter your email address." },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const prefs: string[] = rawPrefs.filter(
    (b): b is string =>
      typeof b === "string" &&
      VALID_BRANDS.includes(b as (typeof VALID_BRANDS)[number])
  );

  if (prefs.length === 0) {
    return NextResponse.json(
      { error: "Please select at least one brand." },
      { status: 400 }
    );
  }

  try {
    await pool.query(
      `
      INSERT INTO subscribers (email, brand_prefs, active)
      VALUES ($1, $2::text[], true)
      ON CONFLICT (email) DO UPDATE SET
        brand_prefs = EXCLUDED.brand_prefs,
        active = true
      `,
      [email, prefs]
    );

    return NextResponse.json({ success: true, brands: prefs }, { status: 200 });
  } catch (err: unknown) {
    if (pgErrCode(err) === "23505") {
      await pool.query(
        "UPDATE subscribers SET brand_prefs = $1::text[], active = true WHERE email = $2",
        [prefs, email]
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
