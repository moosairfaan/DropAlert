import { Pool } from "pg";

import { filterShoeDrops } from "@/lib/shoeFilter";

declare global {
  // eslint-disable-next-line no-var -- required for global singleton pattern in Next.js
  var pgPool: Pool | undefined;
}

function poolSsl():
  | boolean
  | { rejectUnauthorized: boolean }
  | undefined {
  const url = (process.env.DATABASE_URL || "").toLowerCase();
  if (!url) return undefined;
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

const DROP_COLUMNS = `
  id, brand, name, drop_date, price, image_url, product_url, scraped_at
`.trim();

export async function getDrops(limit = 50) {
  const { rows } = await pool.query(
    `SELECT ${DROP_COLUMNS}
     FROM drops
     ORDER BY scraped_at DESC
     LIMIT $1`,
    [limit * 3]
  );
  return filterShoeDrops(rows).slice(0, limit);
}

export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM subscribers WHERE active = true) as subscriber_count,
      (SELECT COUNT(*) FROM alerts_sent) as alerts_sent,
      (SELECT COUNT(*) FROM drops) as drops_tracked
  `);
  return rows[0];
}
