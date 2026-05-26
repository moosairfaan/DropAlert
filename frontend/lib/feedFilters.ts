import type { DropRow } from "@/lib/dropDisplay";

export type FeedFilterOptions = {
  brand: string | null;
  hypeOnly: boolean;
};

/** Client-side hype filter keywords (name only). */
const HYPE_PATTERNS: RegExp[] = [
  /\bcollab\b/i,
  /\blimited\b/i,
  /\bOG\b/,
  /\bretro\b/i,
  /\brelease\b/i,
  /\sx\s/i,
];

export function isHypeDrop(drop: DropRow): boolean {
  const name = (drop.name || "").trim();
  if (!name) return false;
  return HYPE_PATTERNS.some((re) => re.test(name));
}

export function filterDropsByBrand(
  drops: DropRow[],
  brand: string | null
): DropRow[] {
  if (!brand) return drops;
  return drops.filter((d) => d.brand === brand);
}

export function filterDropsClient(
  drops: DropRow[],
  opts: FeedFilterOptions
): DropRow[] {
  let out = filterDropsByBrand(drops, opts.brand);
  if (opts.hypeOnly) out = out.filter(isHypeDrop);
  return out;
}
