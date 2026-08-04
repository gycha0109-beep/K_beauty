const WHITESPACE = /\s+/g;
const BRAND_PUNCTUATION = /[._:+/&-]+/g;
const WRAPPING_PUNCTUATION = /[{}[\]()<>]+/g;
const PRODUCT_VOLUME =
  /\b\d+(?:\.\d+)?\s?(?:ml|g|kg|oz|ea|pcs?|ct|pack|sheet|sheets)\b/gi;
const PRODUCT_OPTION =
  /\b(?:refill|limited|special|set|gift|option|bundle|edition|renewal|1\+1|리필|한정|기획|옵션)\b/gi;

function basic(value: string): string {
  return value.toLowerCase().replace(WHITESPACE, " ").trim();
}

function collapse(value: string): string {
  return value.replace(WHITESPACE, " ").trim();
}

export function normalizePromotionBrand(value: string): string {
  const normalized = collapse(
    basic(value)
      .replace(BRAND_PUNCTUATION, " ")
      .replace(WRAPPING_PUNCTUATION, " "),
  );

  if (normalized === "laroche posay") return "la roche posay";
  if (normalized === "makep rem") return "makep rem";
  return normalized;
}

export function normalizePromotionProduct(value: string): string {
  return collapse(
    basic(value)
      .replace(PRODUCT_VOLUME, " ")
      .replace(PRODUCT_OPTION, " ")
      .replace(BRAND_PUNCTUATION, " "),
  );
}
