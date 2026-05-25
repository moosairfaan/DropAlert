export type DropRow = {
  id: number;
  brand: string;
  name: string;
  price?: unknown;
  image_url?: string | null;
  product_url?: string | null;
  scraped_at?: string | Date | null;
};

export function brandBadgeClass(brand: string): string {
  const b = brand.toLowerCase();
  if (b === "supreme") return "bg-red-500 text-white";
  if (b === "nike") return "bg-violet-600 text-white";
  if (b === "jordan") return "bg-orange-500 text-white";
  if (b === "adidas") return "bg-black text-white";
  if (b === "new balance") return "bg-neutral-600 text-white";
  if (b === "puma") return "bg-red-600 text-white";
  if (b === "asics") return "bg-blue-600 text-white";
  if (b === "kith") return "bg-zinc-800 text-white";
  if (b === "palace") return "bg-[#ffe600] text-black";
  return "bg-[#2d5bff] text-white";
}

export function formatPrice(price: unknown): string {
  if (price == null) return "—";
  const n = typeof price === "string" ? parseFloat(price) : Number(price);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function scrapedAtIso(v: string | Date | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

export function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
