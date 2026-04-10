const DUPLICATE_WHITESPACE_REGEX = /\s+/g;
const INVISIBLE_CHAR_REGEX = /[\u200B-\u200D\uFEFF]/g;
const TRADEMARK_REGEX = /[™®©]/g;
const PRODUCT_VOLUME_REGEX =
  /\b\d+(?:\.\d+)?\s?(?:ml|g|kg|oz|ea|pcs?|ct|pack|sheet|sheets)\b/gi;
const PRODUCT_OPTION_REGEX =
  /\b(?:refill|limited|special|set|gift|option|bundle|edition|renewal|1\+1|리필|한정|기획|옵션)\b/gi;
const PRODUCT_PUNCTUATION_REGEX = /[._:+/&-]+/g;
const WRAPPING_PUNCTUATION_REGEX = /[{}[\]()<>]/g;

const BRAND_ALIAS_MAP = new Map<string, string>([
  ["dr g", "dr g"],
  ["dr.g", "dr g"],
  ["laroche posay", "la roche posay"],
  ["laroche-posay", "la roche posay"],
  ["la roche posay", "la roche posay"],
  ["makep rem", "makep rem"],
  ["makep:rem", "makep rem"],
]);

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_CHAR_REGEX, " ")
    .replace(/\u00A0/g, " ")
    .replace(DUPLICATE_WHITESPACE_REGEX, " ")
    .trim()
    .toLowerCase();
}

function collapseNoise(value: string): string {
  return value.replace(DUPLICATE_WHITESPACE_REGEX, " ").trim();
}

function normalizeCanonicalPunctuation(value: string): string {
  return collapseNoise(
    value
      .replace(TRADEMARK_REGEX, "")
      .replace(WRAPPING_PUNCTUATION_REGEX, " ")
      .replace(PRODUCT_PUNCTUATION_REGEX, " "),
  );
}

export function normalizeProductName(value: string | null | undefined): string {
  return normalizeText(value);
}

export function normalizeBrandName(value: string | null | undefined): string {
  return normalizeText(value);
}

export function normalizeCanonicalBrandName(value: string | null | undefined): string {
  const normalized = normalizeCanonicalPunctuation(normalizeText(value));

  return BRAND_ALIAS_MAP.get(normalized) ?? normalized;
}

export function normalizeCanonicalProductName(value: string | null | undefined): string {
  const normalized = normalizeText(value)
    .replace(TRADEMARK_REGEX, "")
    .replace(PRODUCT_VOLUME_REGEX, " ")
    .replace(PRODUCT_OPTION_REGEX, " ");

  return normalizeCanonicalPunctuation(normalized);
}
