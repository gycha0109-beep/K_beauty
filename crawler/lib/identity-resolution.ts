import {
  normalizeCanonicalBrandName,
  normalizeCanonicalProductName,
} from "./normalize.js";

export type IdentityResolutionState = "resolved" | "identity_ambiguous" | "unresolved";
export type IdentityMatchMethod =
  | "external_id_exact"
  | "localized_exact"
  | "english_exact"
  | null;

export interface IdentityCandidateRecord {
  id: string;
  source_name: string | null;
  external_type?: string | null;
  external_id?: string | null;
  brand_name_raw: string | null;
  product_name_raw: string | null;
  canonical_brand?: string | null;
  canonical_name?: string | null;
  category_path?: string | null;
}

export interface IdentityProductRecord {
  id: string;
  brand: string | null;
  name: string | null;
  brand_en?: string | null;
  name_en?: string | null;
  normalized_brand?: string | null;
  normalized_name?: string | null;
  category?: string | null;
  external_source?: string | null;
  external_type?: string | null;
  external_id?: string | null;
}

export interface IdentitySourceBindingRecord {
  product_id: string;
  source_name: string | null;
  external_type?: string | null;
  external_id?: string | null;
  binding_state?: string | null;
}

export interface IdentitySuggestion {
  productId: string;
  productBrand: string;
  productName: string;
  identitySource: "localized" | "english";
  score: number;
}

export interface IdentityResolutionResult {
  candidateId: string;
  state: IdentityResolutionState;
  productId: string | null;
  method: IdentityMatchMethod;
  matchedIdentitySource: "localized" | "english" | null;
  blockers: string[];
  suggestions: IdentitySuggestion[];
}

type ProductIdentity = {
  source: "localized" | "english";
  brand: string;
  name: string;
};

const BROAD_CATEGORY: Record<string, string> = {
  cleanser: "cleanser",
  toner_essence: "toner",
  toner_pad: "toner_pad",
  treatment: "treatment",
  moisturizer: "moisturizer",
  moisturizer_lotion_emulsion: "moisturizer",
  moisturizer_gel: "moisturizer",
  moisturizer_cream: "moisturizer",
  moisturizer_balm: "moisturizer",
  sunscreen: "sunscreen",
};

function normalizeCategory(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  return BROAD_CATEGORY[normalized] ?? normalized;
}

function categoriesCompatible(
  candidateCategory: string | null | undefined,
  productCategory: string | null | undefined,
): boolean {
  const candidate = normalizeCategory(candidateCategory);
  const product = normalizeCategory(productCategory);

  if (!candidate || !product) {
    return true;
  }

  return candidate === product;
}

function uniqueIdentities(identities: ProductIdentity[]): ProductIdentity[] {
  const seen = new Set<string>();
  const output: ProductIdentity[] = [];

  for (const identity of identities) {
    if (!identity.brand || !identity.name) {
      continue;
    }

    const key = `${identity.brand}::${identity.name}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(identity);
  }

  return output;
}

export function buildProductIdentities(product: IdentityProductRecord): ProductIdentity[] {
  const localizedBrand = normalizeCanonicalBrandName(product.normalized_brand || product.brand);
  const localizedName = normalizeCanonicalProductName(product.normalized_name || product.name);
  const englishBrand = normalizeCanonicalBrandName(product.brand_en);
  const englishName = normalizeCanonicalProductName(product.name_en);

  return uniqueIdentities([
    {
      source: "localized",
      brand: localizedBrand,
      name: localizedName,
    },
    {
      source: "english",
      brand: englishBrand,
      name: englishName,
    },
  ]);
}

function candidateIdentity(candidate: IdentityCandidateRecord): {
  brand: string;
  name: string;
} {
  return {
    brand: normalizeCanonicalBrandName(candidate.canonical_brand || candidate.brand_name_raw),
    name: normalizeCanonicalProductName(candidate.canonical_name || candidate.product_name_raw),
  };
}

function productLabel(product: IdentityProductRecord): {
  brand: string;
  name: string;
} {
  return {
    brand: String(product.brand ?? product.brand_en ?? "").trim(),
    name: String(product.name ?? product.name_en ?? "").trim(),
  };
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = Array.from(new Set(left.split(" ").filter(Boolean)));
  const rightTokens = Array.from(new Set(right.split(" ").filter(Boolean)));

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter((token) => rightSet.has(token)).length;

  return (shared / leftTokens.length + shared / rightTokens.length) / 2;
}

function containment(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const compactLeft = left.replace(/\s+/g, "");
  const compactRight = right.replace(/\s+/g, "");

  if (!compactLeft || !compactRight) {
    return 0;
  }

  if (compactLeft.includes(compactRight) || compactRight.includes(compactLeft)) {
    return Math.min(compactLeft.length, compactRight.length) / Math.max(compactLeft.length, compactRight.length);
  }

  return 0;
}

function suggestionScore(left: string, right: string): number {
  return Number((tokenOverlap(left, right) * 0.8 + containment(left, right) * 0.2).toFixed(2));
}

function buildSuggestions(
  candidate: IdentityCandidateRecord,
  products: IdentityProductRecord[],
  limit = 3,
): IdentitySuggestion[] {
  const identity = candidateIdentity(candidate);

  if (!identity.brand || !identity.name) {
    return [];
  }

  const perProduct = new Map<string, IdentitySuggestion>();

  for (const product of products) {
    if (!categoriesCompatible(candidate.category_path, product.category)) {
      continue;
    }

    for (const productIdentity of buildProductIdentities(product)) {
      if (productIdentity.brand !== identity.brand) {
        continue;
      }

      const score = suggestionScore(identity.name, productIdentity.name);
      if (score < 0.6 || score >= 1) {
        continue;
      }

      const label = productLabel(product);
      const existing = perProduct.get(product.id);

      if (!existing || score > existing.score) {
        perProduct.set(product.id, {
          productId: product.id,
          productBrand: label.brand,
          productName: label.name,
          identitySource: productIdentity.source,
          score,
        });
      }
    }
  }

  return [...perProduct.values()]
    .sort((left, right) => right.score - left.score || left.productId.localeCompare(right.productId))
    .slice(0, limit);
}

function resolveExternalProductIds(
  candidate: IdentityCandidateRecord,
  products: IdentityProductRecord[],
  sourceBindings: IdentitySourceBindingRecord[],
): Set<string> {
  if (!candidate.source_name || !candidate.external_type || !candidate.external_id) {
    return new Set<string>();
  }

  const productIds = new Set<string>();

  for (const binding of sourceBindings) {
    if (
      binding.binding_state === "resolved" &&
      binding.source_name === candidate.source_name &&
      binding.external_type === candidate.external_type &&
      binding.external_id === candidate.external_id
    ) {
      productIds.add(binding.product_id);
    }
  }

  for (const product of products) {
    if (
      product.external_source === candidate.source_name &&
      product.external_type === candidate.external_type &&
      product.external_id === candidate.external_id
    ) {
      productIds.add(product.id);
    }
  }

  for (const productId of productIds) {
    if (!products.some((product) => product.id === productId)) {
      throw new Error("identity_resolution_internal_product_missing");
    }
  }

  return productIds;
}

export function resolveProductIdentity(
  candidate: IdentityCandidateRecord,
  products: IdentityProductRecord[],
  sourceBindings: IdentitySourceBindingRecord[] = [],
): IdentityResolutionResult {
  const identity = candidateIdentity(candidate);
  const blockers: string[] = [];

  if (!identity.brand) {
    blockers.push("missing_brand");
  }

  if (!identity.name) {
    blockers.push("missing_name");
  }

  const externalProductIds = resolveExternalProductIds(candidate, products, sourceBindings);

  const nameMatches: Array<{
    product: IdentityProductRecord;
    source: "localized" | "english";
  }> = [];

  if (identity.brand && identity.name) {
    for (const product of products) {
      for (const productIdentity of buildProductIdentities(product)) {
        if (productIdentity.brand === identity.brand && productIdentity.name === identity.name) {
          nameMatches.push({
            product,
            source: productIdentity.source,
          });
        }
      }
    }
  }

  const strongProductIds = new Set<string>([
    ...externalProductIds,
    ...nameMatches.map((match) => match.product.id),
  ]);

  if (strongProductIds.size > 1) {
    blockers.push("strong_signal_conflict");

    return {
      candidateId: candidate.id,
      state: "identity_ambiguous",
      productId: null,
      method: null,
      matchedIdentitySource: null,
      blockers,
      suggestions: buildSuggestions(candidate, products),
    };
  }

  const strongProductId = [...strongProductIds][0] ?? null;

  if (strongProductId) {
    const product = products.find((entry) => entry.id === strongProductId) ?? null;

    if (!product) {
      throw new Error("identity_resolution_internal_product_missing");
    }

    if (!categoriesCompatible(candidate.category_path, product.category)) {
      blockers.push("category_conflict");

      return {
        candidateId: candidate.id,
        state: "unresolved",
        productId: null,
        method: null,
        matchedIdentitySource: null,
        blockers,
        suggestions: buildSuggestions(candidate, products),
      };
    }

    const externalExact = externalProductIds.has(strongProductId);
    const nameMatch = nameMatches.find((entry) => entry.product.id === strongProductId) ?? null;

    return {
      candidateId: candidate.id,
      state: "resolved",
      productId: strongProductId,
      method: externalExact
        ? "external_id_exact"
        : nameMatch?.source === "english"
          ? "english_exact"
          : "localized_exact",
      matchedIdentitySource: nameMatch?.source ?? null,
      blockers,
      suggestions: [],
    };
  }

  return {
    candidateId: candidate.id,
    state: "unresolved",
    productId: null,
    method: null,
    matchedIdentitySource: null,
    blockers,
    suggestions: buildSuggestions(candidate, products),
  };
}

export function resolveProductIdentities(
  candidates: IdentityCandidateRecord[],
  products: IdentityProductRecord[],
  sourceBindings: IdentitySourceBindingRecord[] = [],
): IdentityResolutionResult[] {
  return candidates.map((candidate) => resolveProductIdentity(candidate, products, sourceBindings));
}
