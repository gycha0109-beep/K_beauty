const DUPLICATE_WHITESPACE_REGEX = /\s+/g;
const INVISIBLE_CHAR_REGEX = /[\u200B-\u200D\uFEFF]/g;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_CHAR_REGEX, " ")
    .replace(/\u00A0/g, " ")
    .replace(DUPLICATE_WHITESPACE_REGEX, " ")
    .trim()
    .toLowerCase();
}

export function normalizeProductName(value: string | null | undefined): string {
  return normalizeText(value);
}

export function normalizeBrandName(value: string | null | undefined): string {
  return normalizeText(value);
}
