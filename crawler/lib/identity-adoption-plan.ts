import {
  inspectDatabaseIdentityKeys,
  type DatabaseIdentityKeyInspection,
} from "./database-identity-key.js";
import type {
  IdentityCandidateRecord,
  IdentityProductRecord,
  IdentityResolutionResult,
} from "./identity-resolution.js";

export type IdentityQueueStatus = "queued" | "reviewing" | "deferred" | string | null;

export type StructuralIdentityState =
  | "identity_side_ready"
  | "waiting_for_promotion_queue"
  | "blocked_identity_not_resolved"
  | "blocked_target_product_missing"
  | "blocked_target_canonical_identity_missing"
  | "blocked_target_identity_key_missing"
  | "blocked_target_identity_key_drift";

export interface IdentityAdoptionProductRecord extends IdentityProductRecord {
  product_form?: string | null;
}

export interface IdentityAdoptionEvidence {
  version: "crawler-identity-adoption-plan-v1";
  match_method: NonNullable<IdentityResolutionResult["method"]>;
  target_product_id: string;
  source_identity: {
    source_name: string | null;
    external_type: string | null;
    external_id: string | null;
    brand: string | null;
    name: string | null;
  };
  target_canonical_identity: {
    brand: string;
    name: string;
    category: string | null;
    product_form: string | null;
  };
  target_identity_keys: {
    stored_brand: string | null;
    stored_name: string | null;
    recomputed_brand: string;
    recomputed_name: string;
    consistent: boolean;
  };
}

export interface IdentityAdoptionPlan {
  candidateId: string;
  targetProductId: string | null;
  identityRecordReady: boolean;
  structuralIdentityState: StructuralIdentityState;
  blockers: string[];
  targetCanonicalBrand: string | null;
  targetCanonicalName: string | null;
  targetCategory: string | null;
  targetProductForm: string | null;
  targetIdentityKeys: DatabaseIdentityKeyInspection | null;
  evidence: IdentityAdoptionEvidence | null;
}

const STRUCTURAL_QUEUE_STATES = new Set(["queued", "reviewing", "deferred"]);

function trimmedOrNull(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function blockedPlan(
  candidate: IdentityCandidateRecord,
  state: StructuralIdentityState,
  blocker: string,
): IdentityAdoptionPlan {
  return {
    candidateId: candidate.id,
    targetProductId: null,
    identityRecordReady: false,
    structuralIdentityState: state,
    blockers: [blocker],
    targetCanonicalBrand: null,
    targetCanonicalName: null,
    targetCategory: null,
    targetProductForm: null,
    targetIdentityKeys: null,
    evidence: null,
  };
}

export function buildIdentityAdoptionPlan(
  candidate: IdentityCandidateRecord,
  products: IdentityAdoptionProductRecord[],
  resolution: IdentityResolutionResult,
  promotionQueueStatus: IdentityQueueStatus = null,
): IdentityAdoptionPlan {
  if (
    resolution.state !== "resolved" ||
    !resolution.productId ||
    !resolution.method
  ) {
    return blockedPlan(
      candidate,
      "blocked_identity_not_resolved",
      "identity_not_resolved",
    );
  }

  const target = products.find((product) => product.id === resolution.productId) ?? null;

  if (!target) {
    return blockedPlan(
      candidate,
      "blocked_target_product_missing",
      "target_product_missing",
    );
  }

  const targetCanonicalBrand = trimmedOrNull(target.brand);
  const targetCanonicalName = trimmedOrNull(target.name);

  if (!targetCanonicalBrand || !targetCanonicalName) {
    return {
      ...blockedPlan(
        candidate,
        "blocked_target_canonical_identity_missing",
        "target_canonical_identity_missing",
      ),
      targetProductId: target.id,
    };
  }

  const targetIdentityKeys = inspectDatabaseIdentityKeys(target);
  const targetCategory = trimmedOrNull(target.category);
  const targetProductForm = trimmedOrNull(target.product_form);
  const identityRecordReady = true;
  const evidence: IdentityAdoptionEvidence = {
    version: "crawler-identity-adoption-plan-v1",
    match_method: resolution.method,
    target_product_id: target.id,
    source_identity: {
      source_name: trimmedOrNull(candidate.source_name),
      external_type: trimmedOrNull(candidate.external_type),
      external_id: trimmedOrNull(candidate.external_id),
      brand: trimmedOrNull(candidate.brand_name_raw),
      name: trimmedOrNull(candidate.product_name_raw),
    },
    target_canonical_identity: {
      brand: targetCanonicalBrand,
      name: targetCanonicalName,
      category: targetCategory,
      product_form: targetProductForm,
    },
    target_identity_keys: {
      stored_brand: targetIdentityKeys.storedBrandKey,
      stored_name: targetIdentityKeys.storedNameKey,
      recomputed_brand: targetIdentityKeys.recomputedBrandKey,
      recomputed_name: targetIdentityKeys.recomputedNameKey,
      consistent: targetIdentityKeys.consistent,
    },
  };

  if (!targetIdentityKeys.storedBrandKey || !targetIdentityKeys.storedNameKey) {
    return {
      candidateId: candidate.id,
      targetProductId: target.id,
      identityRecordReady,
      structuralIdentityState: "blocked_target_identity_key_missing",
      blockers: ["target_identity_key_missing"],
      targetCanonicalBrand,
      targetCanonicalName,
      targetCategory,
      targetProductForm,
      targetIdentityKeys,
      evidence,
    };
  }

  if (!targetIdentityKeys.consistent) {
    return {
      candidateId: candidate.id,
      targetProductId: target.id,
      identityRecordReady,
      structuralIdentityState: "blocked_target_identity_key_drift",
      blockers: ["target_identity_key_drift"],
      targetCanonicalBrand,
      targetCanonicalName,
      targetCategory,
      targetProductForm,
      targetIdentityKeys,
      evidence,
    };
  }

  const queueStatus = trimmedOrNull(promotionQueueStatus)?.toLowerCase() ?? null;

  return {
    candidateId: candidate.id,
    targetProductId: target.id,
    identityRecordReady,
    structuralIdentityState: STRUCTURAL_QUEUE_STATES.has(queueStatus ?? "")
      ? "identity_side_ready"
      : "waiting_for_promotion_queue",
    blockers: STRUCTURAL_QUEUE_STATES.has(queueStatus ?? "")
      ? []
      : ["promotion_queue_missing_or_ineligible"],
    targetCanonicalBrand,
    targetCanonicalName,
    targetCategory,
    targetProductForm,
    targetIdentityKeys,
    evidence,
  };
}
