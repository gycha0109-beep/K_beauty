const DUPLICATE_WHITESPACE_REGEX = /\s+/g;
const INVISIBLE_CHAR_REGEX = /[\u200B-\u200D\uFEFF]/g;
const TRADEMARK_REGEX = /[™®©℠]/g;
const STRAY_TRADEMARK_TOKEN_REGEX = /\b(?:tm|sm|rm)\b/gi;
const RED_WORD_MARK_REGEX = /\br(?:\s*[.]\s*|\s+)e(?:\s*[.]\s*|\s+)d\b/gi;
const PRODUCT_VOLUME_REGEX =
  /\b\d+(?:\.\d+)?\s?(?:ml|g|kg|oz|ea|pcs?|ct|pack|sheet|sheets)\b/gi;
const SUNSCREEN_RATING_REGEX = /\bspf\s*\d+\+?(?:\s*\/\s*pa\+{1,4})?\b|\bpa\+{1,4}\b/gi;
const PRODUCT_OPTION_REGEX =
  /\b(?:refill|limited(?:\s+edition)?|special(?:\s+edition)?|set|gift|option|bundle|edition|renewal|renew|mini|travel(?:\s+size)?|1\+1|2\+1|리필|한정|기획|옵션|세트|증정)\b/gi;
const PUNCTUATION_NOISE_REGEX = /[.,:;!?"'`~|\\/_+\-&]+/g;
const WRAPPING_PUNCTUATION_REGEX = /[()[\]{}<>]/g;

const BRAND_ALIAS_MAP = new Map<string, string>([
  ["a h c", "ahc"],
  ["ahc", "ahc"],
  ["bring green", "bring green"],
  ["bringgreen", "bring green"],
  ["d alba", "d alba"],
  ["dalba", "d alba"],
  ["dr g", "dr g"],
  ["dr jart", "dr jart"],
  ["dr jart plus", "dr jart"],
  ["drg", "dr g"],
  ["dewy tree", "dewytree"],
  ["beautyofjoseon", "beauty of joseon"],
  ["beauty of joseon", "beauty of joseon"],
  ["kiehl s", "kiehls"],
  ["kiehls", "kiehls"],
  ["centellian24", "centellian 24"],
  ["skin1004", "skin 1004"],
  ["iope", "iope"],
  ["la roche posay", "la roche posay"],
  ["laroche posay", "la roche posay"],
  ["make p rem", "makep rem"],
  ["make prem", "makep rem"],
  ["makep rem", "makep rem"],
  ["round lab", "round lab"],
  ["roundlab", "round lab"],
]);

function collapseWhitespace(value: string): string {
  return value.replace(DUPLICATE_WHITESPACE_REGEX, " ").trim();
}

function stripNoisePunctuation(value: string): string {
  return collapseWhitespace(
    value
      .replace(TRADEMARK_REGEX, "")
      .replace(RED_WORD_MARK_REGEX, "red")
      .replace(STRAY_TRADEMARK_TOKEN_REGEX, " ")
      .replace(WRAPPING_PUNCTUATION_REGEX, " ")
      .replace(PUNCTUATION_NOISE_REGEX, " "),
  );
}

export function normalizeText(value: string | null | undefined): string {
  return collapseWhitespace(
    String(value ?? "")
      .normalize("NFKC")
      .replace(INVISIBLE_CHAR_REGEX, " ")
      .replace(/\u00A0/g, " ")
      .toLowerCase(),
  );
}

export function normalizeProductName(value: string | null | undefined): string {
  return normalizeText(value);
}

export function normalizeBrandName(value: string | null | undefined): string {
  return normalizeText(value);
}

export function normalizeCanonicalBrandName(value: string | null | undefined): string {
  const normalized = stripNoisePunctuation(normalizeText(value));

  return BRAND_ALIAS_MAP.get(normalized) ?? normalized;
}

export function normalizeCanonicalProductName(value: string | null | undefined): string {
  const normalized = normalizeText(value)
    .replace(TRADEMARK_REGEX, "")
    .replace(RED_WORD_MARK_REGEX, "red")
    .replace(PRODUCT_VOLUME_REGEX, " ")
    .replace(SUNSCREEN_RATING_REGEX, " ")
    .replace(PRODUCT_OPTION_REGEX, " ");

  return stripNoisePunctuation(normalized);
}

export function tokenizeNormalizedText(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);

  if (!normalized) {
    return [];
  }

  return Array.from(new Set(normalized.split(" ").map((token) => token.trim()).filter(Boolean)));
}
