import {
  inspectDatabaseIdentityKeys,
  type DatabaseIdentityKeyInspection,
} from "./database-identity-key.js";

export type IdentityKeyRepairDisposition =
  | "current"
  | "safe_mechanical_candidate"
  | "manual_review_required"
  | "blocked_proposed_collision"
  | "blocked_missing_identity";

export interface IdentityKeyRepairProduct {
  id: string;
  brand: string | null;
  name: string | null;
  normalized_brand?: string | null;
  normalized_name?: string | null;
}

export interface IdentityKeyRepairPlanRow {
  productId: string;
  brand: string | null;
  name: string | null;
  disposition: IdentityKeyRepairDisposition;
  reasons: string[];
  inspection: DatabaseIdentityKeyInspection;
  proposedIdentityKey: string | null;
  proposedCollisionProductIds: string[];
}

function compact(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function buildProposedIdentityKey(inspection: DatabaseIdentityKeyInspection): string | null {
  if (!inspection.recomputedBrandKey || !inspection.recomputedNameKey) {
    return null;
  }

  return `${inspection.recomputedBrandKey}::${inspection.recomputedNameKey}`;
}

export function buildIdentityKeyRepairPlan(
  products: IdentityKeyRepairProduct[],
): IdentityKeyRepairPlanRow[] {
  const inspected = products.map((product) => {
    const inspection = inspectDatabaseIdentityKeys(product);
    return {
      product,
      inspection,
      proposedIdentityKey: buildProposedIdentityKey(inspection),
    };
  });

  const proposedIdsByKey = new Map<string, string[]>();
  for (const entry of inspected) {
    if (!entry.proposedIdentityKey) {
      continue;
    }

    const ids = proposedIdsByKey.get(entry.proposedIdentityKey) ?? [];
    ids.push(entry.product.id);
    proposedIdsByKey.set(entry.proposedIdentityKey, ids);
  }

  return inspected.map(({ product, inspection, proposedIdentityKey }) => {
    const collisionIds = proposedIdentityKey
      ? (proposedIdsByKey.get(proposedIdentityKey) ?? []).filter((id) => id !== product.id)
      : [];
    const reasons: string[] = [];

    if (
      !String(product.brand ?? "").trim() ||
      !String(product.name ?? "").trim() ||
      !inspection.storedBrandKey ||
      !inspection.storedNameKey ||
      !proposedIdentityKey
    ) {
      reasons.push("missing_identity_component");
      return {
        productId: product.id,
        brand: product.brand,
        name: product.name,
        disposition: "blocked_missing_identity" as const,
        reasons,
        inspection,
        proposedIdentityKey,
        proposedCollisionProductIds: collisionIds,
      };
    }

    if (collisionIds.length > 0) {
      reasons.push("proposed_identity_collision");
      return {
        productId: product.id,
        brand: product.brand,
        name: product.name,
        disposition: "blocked_proposed_collision" as const,
        reasons,
        inspection,
        proposedIdentityKey,
        proposedCollisionProductIds: collisionIds,
      };
    }

    if (inspection.consistent) {
      return {
        productId: product.id,
        brand: product.brand,
        name: product.name,
        disposition: "current" as const,
        reasons,
        inspection,
        proposedIdentityKey,
        proposedCollisionProductIds: [],
      };
    }

    if (!inspection.brandKeyConsistent) {
      reasons.push("brand_key_drift");
    }

    if (!inspection.nameKeyConsistent) {
      const whitespaceOnly =
        compact(inspection.storedNameKey) === compact(inspection.recomputedNameKey);
      reasons.push(whitespaceOnly ? "legacy_compact_name_key" : "material_name_key_drift");
    }

    const safeMechanical =
      inspection.brandKeyConsistent &&
      !inspection.nameKeyConsistent &&
      compact(inspection.storedNameKey) === compact(inspection.recomputedNameKey);

    return {
      productId: product.id,
      brand: product.brand,
      name: product.name,
      disposition: safeMechanical
        ? "safe_mechanical_candidate"
        : "manual_review_required",
      reasons,
      inspection,
      proposedIdentityKey,
      proposedCollisionProductIds: [],
    };
  });
}
