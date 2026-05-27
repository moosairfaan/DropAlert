import type { DropRow } from "@/lib/dropDisplay";

/** Match drops whose names appear in the AI response (for product cards). */
export function dropsMentionedInResponse(
  response: string,
  drops: DropRow[]
): DropRow[] {
  const lower = response.toLowerCase();
  const seen = new Set<number>();

  const matched = drops
    .filter((drop) => {
      const name = (drop.name || "").trim();
      if (name.length < 4) return false;
      if (!lower.includes(name.toLowerCase())) return false;
      if (seen.has(drop.id)) return false;
      seen.add(drop.id);
      return true;
    })
    .sort((a, b) => b.name.length - a.name.length);

  return matched.slice(0, 3);
}
