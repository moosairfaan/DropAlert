import type { DropRow } from "@/lib/dropDisplay";

const PALACE_STORE = "https://palaceskateboards.com";

/** Palace uses opaque Shopify handles (wbyj02l3ekil). Readable slugs 404. */
function isPalaceOpaqueHandle(handle: string): boolean {
  return /^[a-z0-9]{8,20}$/.test(handle);
}

/** Resolve a clickable product URL; fixes bad Palace slug links from old scrapes. */
export function getProductUrl(drop: DropRow): string | null {
  const raw = (drop.product_url || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const match = parsed.pathname.match(/\/products\/([^/]+)/i);
    if (!match) return raw;

    const handle = match[1].toLowerCase();
    if (drop.brand?.toLowerCase() === "palace") {
      if (!isPalaceOpaqueHandle(handle)) return null;
      return `${PALACE_STORE}/products/${handle}`;
    }

    return raw;
  } catch {
    return raw.startsWith("http") ? raw : null;
  }
}
