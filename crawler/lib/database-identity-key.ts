const DUPLICATE_WHITESPACE_REGEX = /\s+/g;
const BRAND_PUNCTUATION_REGEX = /[._:+/&-]+/g;
const BRAND_WRAPPING_PUNCTUATION_REGEX = /[{}[\]()<>]+/g;
const PRODUCT_PUNCTUATION_REGEX = /[._:+/&-]+/g;
const PRODUCT_VOLUME_REGEX =
  /\b\d+(?:\.\d+)?\s?(?:ml|g|kg|oz|ea|pcs?|ct|pack|sheet|sheets)\b/gi;
const PRODUCT_OPTION_REGEX =
  /\b(?:refill|limited|special|set|gift|option|bundle|edition|renewal|1\+1|리필|한정|기획|옵션)\b/gi;

function normalizeDatabaseBasicText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(DUPLICATE_WHITESPACE_REGEX, " ")
    .trim();
}

/**
 * Mirrors the current public.normalize_brand_key SQL function.
 * Keep this separate from crawler matching normalization: crawler matching
 * removes source noise and applies a wider alias map, while this helper only
 * previews the database contract used by structural adoption checks.
 */
export function normalizeDatabaseBrandKey(value: string | null | undefined): string {
  const normalized = normalizeDatabaseBasicText(value)
    .replace(BRAND_PUNCTUATION_REGEX, " ")
    .replace(BRAND_WRAPPING_PUNCTUATION_REGEX, " ")
    .replace(DUPLICATE_WHITESPACE_REGEX, " ")
    .trim();

  switch (normalized) {
    case "dr g":
      return "dr g";
    case "laroche posay":
      return "la roche posay";
    case "la roche posay":
      return "la roche posay";
    case "makep rem":
      return "makep rem";
    default:
      return normalized;
  }
}

/** Mirrors the current public.normalize_product_key SQL function. */
export function normalizeDatabaseProductKey(value: string | null | undefined): string {
  return normalizeDatabaseBasicText(value)
    .replace(PRODUCT_VOLUME_REGEX, " ")
    .replace(PRODUCT_OPTION_REGEX, " ")
    .replace(PRODUCT_PUNCTUATION_REGEX, " ")
    .replace(DUPLICATE_WHITESPACE_REGEX, " ")
    .trim();
}

export interface DatabaseIdentityKeyInspectionInput {
  brand: string | null | undefined;
  name: string | null | undefined;
  normalized_brand?: string | null;
  normalized_name?: string | null;
}

export interface DatabaseIdentityKeyInspection {
  storedBrandKey: string | null;
  storedNameKey: string | null;
  recomputedBrandKey: string;
  recomputedNameKey: string;
  brandKeyConsistent: boolean;
  nameKeyConsistent: boolean;
  consistent: boolean;
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function inspectDatabaseIdentityKeys(
  input: DatabaseIdentityKeyInspectionInput,
): DatabaseIdentityKeyInspection {
  const storedBrandKey = nullableTrimmed(input.normalized_brand);
  const storedNameKey = nullableTrimmed(input.normalized_name);
  const recomputedBrandKey = normalizeDatabaseBrandKey(input.brand);
  const recomputedNameKey = normalizeDatabaseProductKey(input.name);
  const brandKeyConsistent = Boolean(storedBrandKey) && storedBrandKey === recomputedBrandKey;
  const nameKeyConsistent = Boolean(storedNameKey) && storedNameKey === recomputedNameKey;

  return {
    storedBrandKey,
    storedNameKey,
    recomputedBrandKey,
    recomputedNameKey,
    brandKeyConsistent,
    nameKeyConsistent,
    consistent: brandKeyConsistent && nameKeyConsistent,
  };
}
