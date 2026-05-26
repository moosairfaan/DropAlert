import { NextRequest, NextResponse } from "next/server";

import pool from "@/lib/db";
import { BRANDS } from "@/lib/brands";
import {
  ensureSubscriberSchema,
  newUnsubscribeToken,
} from "@/lib/subscribers";
import { sendWelcomeEmail } from "@/lib/welcomeEmail";

const VALID_BRANDS = BRANDS;

export const dynamic = "force-dynamic";

function pgErrCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

function pgErrMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : "Unknown error";
  }
  return "Unknown error";
}

export async function POST(req: NextRequest) {
  try {
    let body: {
      email?: unknown;
      brandPrefs?: unknown;
      brand_prefs?: unknown;
      styleDescription?: unknown;
      style_description?: unknown;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

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

    const rawStyle =
      typeof body.styleDescription === "string"
        ? body.styleDescription
        : typeof body.style_description === "string"
          ? body.style_description
          : "";
    const styleDescription = rawStyle.trim().slice(0, 500) || null;

    if (!process.env.DATABASE_URL) {
      console.error("Subscribe error: DATABASE_URL is not set");
      return NextResponse.json(
        { error: "Server is missing database configuration." },
        { status: 500 }
      );
    }

    await ensureSubscriberSchema();
    const token = newUnsubscribeToken();

    try {
      await pool.query(
        `
        INSERT INTO subscribers (
          email, brand_prefs, active, unsubscribe_token, style_description
        )
        VALUES ($1, $2::text[], true, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          brand_prefs = EXCLUDED.brand_prefs,
          active = true,
          style_description = EXCLUDED.style_description,
          unsubscribe_token = COALESCE(
            subscribers.unsubscribe_token,
            EXCLUDED.unsubscribe_token
          )
        `,
        [email, prefs, token, styleDescription]
      );
    } catch (err: unknown) {
      if (pgErrCode(err) === "23505") {
        await pool.query(
          `
          UPDATE subscribers
          SET brand_prefs = $1::text[],
              active = true,
              style_description = $4,
              unsubscribe_token = COALESCE(unsubscribe_token, $3)
          WHERE email = $2
          `,
          [prefs, email, token, styleDescription]
        );
      } else {
        throw err;
      }
    }

    const { rows } = await pool.query<{ unsubscribe_token: string }>(
      `SELECT unsubscribe_token FROM subscribers WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    const unsubscribeToken = rows[0]?.unsubscribe_token ?? token;

    let welcomeEmailSent = false;
    try {
      await sendWelcomeEmail(email, prefs, unsubscribeToken);
      welcomeEmailSent = true;
    } catch (emailErr: unknown) {
      console.error("Welcome email failed:", emailErr);
    }

    return NextResponse.json(
      { success: true, brands: prefs, welcomeEmailSent },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      {
        error: "Could not save subscription. Please try again.",
        detail:
          process.env.NODE_ENV === "development"
            ? pgErrMessage(err)
            : undefined,
      },
      { status: 500 }
    );
  }
}
