/** Client-side guard — mirrors scraper shoe/promo filters for the live feed. */

type DropLike = {
  brand?: string;
  name?: string;
  product_url?: string | null;
  price?: unknown;
};

const JUNK_NAME =
  /\b(refer\s*a\s*friend|join\s*the\s*celebration|store\s*locator|contact\s*us|gift\s*card|newsletter|sign\s*up|log\s*in|customer\s*service|about\s*us|rewards?\s*program|membership|road\s*tested|road-tested|benefits?|loyalty|one\s*asics|asics\s*benefits|size\s*guide|fit\s*guide|our\s*story|sustainability|partners?|order\s*status|live\s*chat|warranty|learn\s*more|discover\s*more|join\s*us|store\s*finder)\b/i;

const JUNK_URL =
  /\/(refer|celebration|benefits|loyalty|rewards|contact|locator|newsletter|login|signup|account|help|about|privacy|terms|blog|careers|faq|wishlist|cart|checkout|road-tested|one-asics)/i;

const NON_SHOE =
  /\b(t-?shirt|tee|hoodie|sweatshirt|jacket|coat|puffer|varsity|avirex|reversible|leather|denim|crewneck|fleece|pants|shorts|beanie|backpack|tote|keychain|sticker|deck|skateboard|sunglasses|watch|wallet|belt|sweater|cardigan|blazer|vest|skirt|dress)\b/i;

const SHOE_SIGNAL =
  /\b(sneaker|sneakers|shoe|shoes|footwear|runner|running|trainer|boot|slide|sandal|gel-|air\s*max|air\s*force|air\s*jordan|dunk|yeezy|ultraboost|samba|gazelle|990|991|992|993|2002r|550|574|1906r|9060|foam\s*runner)\b/i;

const PRODUCT_URL =
  /\/(product|products|pd\/|launch\/t\/|release-dates|footwear|sneaker|shoes)/i;

const JUNK_SLUG =
  /(refer|friend|celebration|benefits|loyalty|rewards|contact|locator|newsletter|road-tested|one-asics|size-guide|programs?)/i;

function urlSlug(url: string): string {
  const path = url.split("?")[0].replace(/\/$/, "");
  return path.split("/").pop()?.toLowerCase() ?? "";
}

function slugLooksLikeProduct(slug: string): boolean {
  if (!slug || slug.length < 5) return false;
  if (JUNK_SLUG.test(slug)) return false;
  if (/\d/.test(slug)) return true;
  if (slug.split("-").length >= 3 && slug.length >= 12) return true;
  return false;
}

export function isShoeDrop(drop: DropLike): boolean {
  const name = (drop.name ?? "").trim();
  const url = (drop.product_url ?? "").trim();
  if (name.length < 4 || !url) return false;
  if (JUNK_NAME.test(name)) return false;
  if (JUNK_URL.test(url)) return false;
  const blob = `${name} ${url}`;
  if (NON_SHOE.test(blob)) return false;
  if (SHOE_SIGNAL.test(blob)) return true;
  if (!PRODUCT_URL.test(url)) return false;
  const slug = urlSlug(url);
  return slugLooksLikeProduct(slug) && name.length >= 6;
}

export function filterShoeDrops<T extends DropLike>(drops: T[]): T[] {
  return drops.filter(isShoeDrop);
}
