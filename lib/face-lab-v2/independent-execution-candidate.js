import {
  getFaceLabAppearanceSlotDefinition,
  FACE_LAB_APPEARANCE_SLOTS
} from "./appearance-registry.js";
import {
  evaluateFaceLabCandidateCapability,
  validateFaceLabCandidateCapabilityCandidate
} from "./candidate-capability.js";
import {
  validateFaceLabShadeProfile
} from "./product-variant-authority.js";
import {
  getFaceLabVisualTryOnCategory,
  FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY,
  getFaceLabVisualTryOnSlotSupport
} from "./visual-try-on-registry.js";

export const FACE_LAB_INDEPENDENT_EXECUTION_CANDIDATE_VERSION =
  "face-lab-independent-execution-candidate-v1";

export const FACE_LAB_INDEPENDENT_EXECUTION_KINDS = Object.freeze([
  "product",
  "style_reference",
  "service",
  "color_palette"
]);

const KINDS = new Set(FACE_LAB_INDEPENDENT_EXECUTION_KINDS);
const KEY = /^[a-z0-9][a-z0-9._-]{0,159}$/;
const EVIDENCE_REF = /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i;

function object(value) {
  return Boolean(value) && typeof value === "object" &&
    !Array.isArray(value);
}

function key(value) {
  return typeof value === "string" && KEY.test(value);
}

function reviewedRefs(value) {
  return Array.isArray(value) &&
    value.length > 0 && value.length <= 32 &&
    value.every(ref => typeof ref === "string" && EVIDENCE_REF.test(ref));
}

function outcome(status, reason, extra = {}) {
  return {
    contractVersion: FACE_LAB_INDEPENDENT_EXECUTION_CANDIDATE_VERSION,
    status,
    reason,
    candidate: null,
    slotKey: null,
    faceLabItemId: null,
    faceLabVariantId: null,
    mode: null,
    shadeProfile: null,
    // This is an offline shape/proof-claim validator, not an authorized
    // catalog reader. A client can forge approval flags and evidence strings.
    governedSourceVerified: false,
    renderReady: false,
    providerRequest: null,
    imageModelInvoked: false,
    ...extra
  };
}

/**
 * Validate a Face Lab-owned executable candidate without borrowing skincare
 * Product Fact Subject, shared catalog taxonomy, or recommendation authority.
 *
 * The caller MUST separately establish source provenance and permissions.
 * A contract-valid fixture is never a production-approved or render-ready item.
 * No DB, network, storage, or paid provider action is performed here.
 */
export function validateFaceLabIndependentExecutionCandidate(input = {}) {
  const { item, variant = null, slotKey, capabilityClaims } =
    object(input) ? input : {};
  if (!object(item) || !key(item.faceLabItemId) ||
      !KINDS.has(item.kind)) {
    return outcome("invalid", "face_lab_item_identity_invalid");
  }

  if (
    item.approvalState !== "approved" ||
    item.lifecycleState !== "active" ||
    !reviewedRefs(item.evidenceRefs) ||
    !key(item.sourceVersion)
  ) {
    return outcome("invalid", "face_lab_item_approval_missing");
  }

  const slot = typeof slotKey === "string" &&
    Object.hasOwn(FACE_LAB_APPEARANCE_SLOTS, slotKey)
    ? getFaceLabAppearanceSlotDefinition(slotKey)
    : null;
  if (!slot) {
    return outcome("invalid", "face_lab_slot_unknown");
  }

  const visualSlot =
    getFaceLabVisualTryOnSlotSupport(slotKey)?.supportState === "supported";
  if (!visualSlot && slotKey !== "overall_palette") {
    return outcome("invalid", "face_lab_slot_unsupported");
  }

  let faceLabVariantId = null;
  let shadeProfile = null;
  let entityType = item.kind;
  let candidateRef = "face_lab_item:" + item.kind + ":" + item.faceLabItemId;

  if (item.kind === "product") {
    const category = typeof item.executionType === "string" &&
      Object.hasOwn(FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY, item.executionType)
      ? getFaceLabVisualTryOnCategory(item.executionType)
      : null;
    if (!category || !category.slotKeys.includes(slotKey) || !visualSlot) {
      return outcome("invalid", "face_lab_execution_type_slot_mismatch");
    }

    if (!object(variant) || !key(variant.faceLabVariantId) ||
        variant.faceLabItemId !== item.faceLabItemId) {
      return outcome("invalid", "face_lab_variant_identity_invalid");
    }

    if (
      variant.identityState !== "resolved" ||
      variant.lifecycleState !== "active" ||
      variant.approvalState !== "approved" ||
      !reviewedRefs(variant.identityEvidenceRefs) ||
      !key(variant.identityVersion)
    ) {
      return outcome("invalid", "face_lab_variant_approval_missing");
    }

    if (variant.shadeProfile !== undefined && variant.shadeProfile !== null) {
      const checked = validateFaceLabShadeProfile(variant.shadeProfile);
      if (!checked.valid) {
        return outcome("invalid", "face_lab_shade_profile_invalid", {
          shadeReason: checked.reason
        });
      }
      shadeProfile = checked.profile;
    }

    faceLabVariantId = variant.faceLabVariantId;
    entityType = "product_variant";
    candidateRef = "face_lab_variant:" +
      item.faceLabItemId + ":" + faceLabVariantId;
  } else if (variant != null) {
    return outcome("invalid", "face_lab_nonproduct_variant_forbidden");
  } else if (item.executionType != null) {
    return outcome("invalid", "face_lab_nonproduct_category_forbidden");
  }

  if (!Array.isArray(capabilityClaims) || !capabilityClaims.length) {
    return outcome("invalid", "face_lab_capability_claims_missing");
  }

  const checkedCandidate = validateFaceLabCandidateCapabilityCandidate({
    candidateRef,
    entityType,
    entityId: item.faceLabItemId,
    ...(faceLabVariantId ? { variantId: faceLabVariantId } : {}),
    capabilityClaims
  });
  if (!checkedCandidate.valid) {
    return outcome("invalid", "face_lab_capability_claims_invalid", {
      capabilityReason: checkedCandidate.reason
    });
  }

  const evaluated = evaluateFaceLabCandidateCapability({
    slot: slotKey,
    candidate: checkedCandidate.candidate
  });
  if (evaluated.status !== "eligible") {
    return outcome("invalid", "face_lab_slot_capability_not_proven", {
      capabilityReason: evaluated.reason
    });
  }

  const mode = item.kind === "service" || item.kind === "color_palette"
    ? "guidance_only"
    : "visual_candidate";

  return outcome("contract_valid", "independent_candidate_contract_valid", {
    candidate: checkedCandidate.candidate,
    slotKey,
    faceLabItemId: item.faceLabItemId,
    faceLabVariantId,
    mode,
    shadeProfile,
    evidenceRefs: {
      item: [...item.evidenceRefs],
      variant: variant ? [...variant.identityEvidenceRefs] : [],
      capability: [...evaluated.evidenceRefs]
    }
  });
}
