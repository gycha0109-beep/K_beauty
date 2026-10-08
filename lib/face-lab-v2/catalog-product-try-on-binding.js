import {
  getFaceLabVisualTryOnCategory
} from "./visual-try-on-registry.js";
import {
  createFaceLabProductVariantRef,
  buildFaceLabProductVariantCandidateRecord
} from "./product-variant-authority.js";
import {
  buildFaceLabVisualTryOnAuthority
} from "./visual-try-on-authority.js";

export const FACE_LAB_PRODUCT_DRIVEN_TRY_ON_BINDING_VERSION =
  "face-lab-product-driven-try-on-binding-v1";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EVIDENCE_REF = /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i;

function object(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function string(value) {
  return typeof value === "string" && value.trim()
    ? value.trim() : null;
}

function invalid(reason, extra = {}) {
  return {
    bindingVersion: FACE_LAB_PRODUCT_DRIVEN_TRY_ON_BINDING_VERSION,
    status: "invalid",
    reason,
    selection: null,
    imageModelInvoked: false,
    ...extra
  };
}

/**
 * Accept only an already-authorized catalog read bundle. This function does not
 * infer a category from a product name, create a shade, query the DB, or elevate
 * a shadow taxonomy to canonical authority.
 */
export function buildFaceLabCatalogProductTryOnSelection({
  product,
  subject,
  taxonomyVersion,
  taxonomyTerm,
  taxonomyAssignment,
  categoryBinding,
  variant,
  capabilityClaims,
  slotKey,
  referenceAssets = []
} = {}) {
  const productId = string(product?.id);
  const subjectId = string(subject?.subject_id);
  const variantKey = string(subject?.variant_key);
  const version = string(taxonomyVersion?.version);
  const termId = string(taxonomyTerm?.term_id);
  const slot = string(slotKey);

  if (!productId || !UUID.test(productId)) {
    return invalid("catalog_product_id_invalid");
  }
  if (
    !subjectId || !UUID.test(subjectId) ||
    string(subject?.product_id) !== productId
  ) {
    return invalid("subject_product_identity_mismatch");
  }
  if (
    subject.identity_status !== "resolved" ||
    subject.current_state !== "current" ||
    !variantKey
  ) {
    return invalid("subject_variant_not_current_resolved");
  }

  if (
    !version ||
    taxonomyVersion.lifecycle_state !== "active" ||
    taxonomyVersion.authority_mode !== "canonical"
  ) {
    return invalid("taxonomy_not_canonical");
  }
  if (
    !termId ||
    taxonomyTerm.taxonomy_version !== version ||
    taxonomyTerm.axis !== "category" ||
    taxonomyTerm.lifecycle_state !== "active" ||
    termId !== `${version}:category:${taxonomyTerm.term_key}`
  ) {
    return invalid("taxonomy_category_term_not_active");
  }
  if (
    taxonomyAssignment?.product_id !== productId ||
    taxonomyAssignment?.taxonomy_version !== version ||
    taxonomyAssignment?.category_term_id !== termId ||
    taxonomyAssignment?.assignment_state !== "canonical"
  ) {
    return invalid("product_taxonomy_assignment_not_canonical");
  }

  const categoryKey = string(categoryBinding?.tryOnCategoryKey);
  const category = categoryKey
    ? getFaceLabVisualTryOnCategory(categoryKey)
    : null;
  const refs = categoryBinding?.evidenceRefs;
  if (
    categoryBinding?.approvalState !== "approved" ||
    !string(categoryBinding?.mappingVersion) ||
    categoryBinding?.taxonomyVersion !== version ||
    categoryBinding?.categoryTermId !== termId ||
    !category ||
    !Array.isArray(refs) ||
    !refs.length ||
    !refs.every((ref) => typeof ref === "string" && EVIDENCE_REF.test(ref))
  ) {
    return invalid("category_slot_mapping_not_governed");
  }
  if (!slot || !category.slotKeys.includes(slot)) {
    return invalid("slot_not_in_governed_category");
  }

  if (
    !object(variant) ||
    variant.productId !== productId ||
    variant.variantId !== variantKey ||
    variant.identityState !== "resolved" ||
    variant.lifecycleState !== "active" ||
    variant.variantAxes?.shade &&
      variant.variantAxes.shade !== variantKey
  ) {
    return invalid("variant_subject_identity_mismatch");
  }
  if (
    !Array.isArray(variant.sourceVariantRefs) ||
    !variant.sourceVariantRefs.includes(`product_fact_subject:${subjectId}`)
  ) {
    return invalid("variant_subject_provenance_missing");
  }
  const variantRef = createFaceLabProductVariantRef({
    productId,
    variantId: variantKey
  });
  if (!variantRef) {
    return invalid("variant_identity_unrepresentable");
  }

  const binding = buildFaceLabProductVariantCandidateRecord({
    variant,
    capabilityClaims
  });
  if (
    !["ready", "identity_only"].includes(binding.status) ||
    binding.candidate?.candidateRef !== variantRef
  ) {
    return invalid("variant_candidate_not_authorized", {
      candidateReason: binding.reason || null
    });
  }
  if (
    !Array.isArray(referenceAssets) ||
    (binding.status === "identity_only" && !referenceAssets.length)
  ) {
    return invalid("product_visual_evidence_missing");
  }

  return {
    bindingVersion: FACE_LAB_PRODUCT_DRIVEN_TRY_ON_BINDING_VERSION,
    status: "ready",
    reason: "catalog_product_variant_bound",
    productId,
    subjectId,
    variantRef,
    taxonomyVersion: version,
    taxonomyCategoryTermId: termId,
    categoryKey,
    slotKey: slot,
    mappingVersion: categoryBinding.mappingVersion,
    mappingEvidenceRefs: [...new Set(refs)].sort(),
    selection: {
      slotKey: slot,
      binding,
      referenceAssets: structuredClone(referenceAssets)
    },
    imageModelInvoked: false
  };
}

/**
 * Convert a collection of explicitly selected catalog records to the existing
 * Visual Try-On render authority. No product lookup or provider invocation.
 */
export function buildFaceLabCatalogProductTryOnAuthority({
  sessionId,
  productSelections,
  presentationPreference = null
} = {}) {
  if (!Array.isArray(productSelections) || !productSelections.length) {
    return invalid("catalog_product_selections_missing");
  }

  const selections = [];
  const provenance = [];
  for (const productSelection of productSelections) {
    const bound = buildFaceLabCatalogProductTryOnSelection(
      productSelection
    );
    if (bound.status !== "ready") {
      return invalid(bound.reason, {
        candidateReason: bound.candidateReason || null
      });
    }
    selections.push(bound.selection);
    provenance.push({
      productId: bound.productId,
      subjectId: bound.subjectId,
      variantRef: bound.variantRef,
      taxonomyVersion: bound.taxonomyVersion,
      taxonomyCategoryTermId: bound.taxonomyCategoryTermId,
      categoryKey: bound.categoryKey,
      slotKey: bound.slotKey,
      mappingVersion: bound.mappingVersion,
      mappingEvidenceRefs: bound.mappingEvidenceRefs
    });
  }

  const authority = buildFaceLabVisualTryOnAuthority({
    sessionId,
    selections,
    presentationPreference
  });
  if (authority.status !== "ready") {
    return invalid("visual_try_on_authority_unavailable", {
      authorityReason: authority.reason
    });
  }
  return {
    bindingVersion: FACE_LAB_PRODUCT_DRIVEN_TRY_ON_BINDING_VERSION,
    status: "ready",
    reason: "catalog_selection_authority_built",
    provenance: provenance.sort((a, b) =>
      a.slotKey.localeCompare(b.slotKey)
    ),
    authority,
    imageModelInvoked: false
  };
}
