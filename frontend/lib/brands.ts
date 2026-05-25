/** Canonical brands — must match scraper drop.brand and subscribe API allowlist. */

export const BRANDS = [
  "Supreme",
  "Nike",
  "Jordan",
  "Adidas",
  "New Balance",
  "Puma",
  "ASICS",
  "Kith",
  "Palace",
] as const;

export type Brand = (typeof BRANDS)[number];

export type BrandOption = {
  label: string;
  value: Brand;
  /** Tailwind classes when brand chip is selected (solid pop, black border) */
  on: string;
};

export const BRAND_OPTIONS: readonly BrandOption[] = [
  {
    label: "Supreme",
    value: "Supreme",
    on: "border-black bg-red-500 text-white shadow-pop-sm",
  },
  {
    label: "Nike SNKRS",
    value: "Nike",
    on: "border-black bg-violet-600 text-white shadow-pop-sm",
  },
  {
    label: "Jordan",
    value: "Jordan",
    on: "border-black bg-orange-500 text-white shadow-pop-sm",
  },
  {
    label: "Adidas",
    value: "Adidas",
    on: "border-black bg-black text-white shadow-pop-sm",
  },
  {
    label: "New Balance",
    value: "New Balance",
    on: "border-black bg-neutral-600 text-white shadow-pop-sm",
  },
  {
    label: "Puma",
    value: "Puma",
    on: "border-black bg-red-600 text-white shadow-pop-sm",
  },
  {
    label: "ASICS",
    value: "ASICS",
    on: "border-black bg-blue-600 text-white shadow-pop-sm",
  },
  {
    label: "Kith",
    value: "Kith",
    on: "border-black bg-zinc-800 text-white shadow-pop-sm",
  },
  {
    label: "Palace",
    value: "Palace",
    on: "border-black bg-[#ffe600] text-black shadow-pop-sm",
  },
] as const;

export function labelForBrand(value: string): string {
  const opt = BRAND_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}

export const BRAND_TAGLINE =
  "Supreme, Nike SNKRS, Jordan, Adidas, New Balance, Puma, ASICS, Kith, and Palace";
