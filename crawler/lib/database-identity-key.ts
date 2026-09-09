const DUPLICATE_WHITESPACE_REGEX = /\s+/g;

/**
 * Mirrors the current database identity-key rule used by
 * public.normalize_brand_key/public.normalize_product_key:
 * trim -> lowercase -> collapse whitespace -> remove spaces.
 *
 * This is intentionally separate from crawler matching normalization.
 * The crawler matcher may remove source noise and apply aliases; database
 * identity keys must remain a faithful preview of the stored DB contract.
 */
export function normalizeDatabaseIdentityKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(DUPLICATE_WHITESPACE_REGEX, " ")
    .replace(/ /g, "");
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
  const recomputedBrandKey = normalizeDatabaseIdentityKey(input.brand);
  const recomputedNameKey = normalizeDatabaseIdentityKey(input.name);
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
