import crypto from "crypto";

import pool from "@/lib/db";

let schemaReady: Promise<void> | null = null;

export async function ensureSubscriberSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        ALTER TABLE subscribers
        ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT
      `);
      await pool.query(`
        ALTER TABLE subscribers
        ADD COLUMN IF NOT EXISTS style_description TEXT
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS subscribers_unsubscribe_token_idx
        ON subscribers (unsubscribe_token)
        WHERE unsubscribe_token IS NOT NULL
      `);
    })();
  }
  await schemaReady;
}

export function newUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  await ensureSubscriberSchema();
  const trimmed = token.trim();
  if (!trimmed) return false;

  const { rowCount } = await pool.query(
    `UPDATE subscribers SET active = false WHERE unsubscribe_token = $1`,
    [trimmed]
  );
  return (rowCount ?? 0) > 0;
}

/** Legacy email-based unsubscribe (older email links). */
export async function unsubscribeByEmail(email: string): Promise<boolean> {
  await ensureSubscriberSchema();
  const { rowCount } = await pool.query(
    `UPDATE subscribers SET active = false WHERE LOWER(email) = LOWER($1)`,
    [email.trim()]
  );
  return (rowCount ?? 0) > 0;
}

export async function getUnsubscribeTokenForEmail(
  email: string
): Promise<string | null> {
  await ensureSubscriberSchema();
  const { rows } = await pool.query<{ unsubscribe_token: string | null }>(
    `SELECT unsubscribe_token FROM subscribers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email.trim()]
  );
  return rows[0]?.unsubscribe_token ?? null;
}

export function unsubscribePageUrl(token: string): string {
  const base = (
    process.env.DROPALERT_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://dropalert-sigma.vercel.app"
  ).replace(/\/$/, "");
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
}
