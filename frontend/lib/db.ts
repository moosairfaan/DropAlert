import { Pool } from "pg";

// Use a global pool to avoid creating new connections on every request
// This pattern is necessary because Next.js reloads modules in development
declare global {
  // eslint-disable-next-line no-var -- required for global singleton pattern in Next.js
  var pgPool: Pool | undefined;
  // eslint-disable-next-line no-var -- one-time DDL guard per Node process
  var ensuredDropsResellColumn: boolean | undefined;
}

function poolSsl():
  | boolean
  | { rejectUnauthorized: boolean }
  | undefined {
  const url = (process.env.DATABASE_URL || "").toLowerCase();
  if (!url) return undefined;
  // Railway / most hosted Postgres require TLS from local dev and Vercel.
  const needsSsl =
    url.includes("railway") ||
    url.includes("rlwy.net") ||
    url.includes("supabase") ||
    url.includes("neon.tech") ||
    url.includes("sslmode=require");
  if (needsSsl) return { rejectUnauthorized: false };
  if (process.env.NODE_ENV === "production") {
    return { rejectUnauthorized: false };
  }
  return false;
}

const pool =
  globalThis.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: poolSsl(),
  });

if (process.env.NODE_ENV !== "production") globalThis.pgPool = pool;

export default pool;

const DROP_COLUMNS_BASE = `
  id, brand, name, drop_date, price, image_url, product_url, scraped_at
`.trim();

/** Ensures `resell_estimate` exists when the DB role may run DDL (local / admin URL). */
async function ensureDropsResellColumn(): Promise<void> {
  if (globalThis.ensuredDropsResellColumn) return;
  try {
    await pool.query(`
      ALTER TABLE drops ADD COLUMN IF NOT EXISTS resell_estimate NUMERIC(10,2)
    `);
  } catch {
    // e.g. read-only or migration owned by another role — SELECT fallback below
  }
  globalThis.ensuredDropsResellColumn = true;
}

function pgErrCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

// Helper: get all upcoming drops (includes resell_estimate when the column exists)
export async function getDrops(limit = 50) {
  await ensureDropsResellColumn();
  try {
    const { rows } = await pool.query(
      `SELECT ${DROP_COLUMNS_BASE}, resell_estimate
       FROM drops
       ORDER BY scraped_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (err: unknown) {
    if (pgErrCode(err) !== "42703") throw err;
    const { rows } = await pool.query(
      `SELECT ${DROP_COLUMNS_BASE}
       FROM drops
       ORDER BY scraped_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({ ...r, resell_estimate: null }));
  }
}

// Helper: get site stats
export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM subscribers WHERE active = true) as subscriber_count,
      (SELECT COUNT(*) FROM alerts_sent) as alerts_sent,
      (SELECT COUNT(*) FROM drops) as drops_tracked
  `);
  return rows[0];
}
