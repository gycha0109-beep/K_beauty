export const RECOMMENDATION_CATEGORY_AUTHORITY_SHADOW_CONTRACT_VERSION =
  "recommendation-category-authority-shadow-v1";

export const RECOMMENDATION_CATEGORY_AUTHORITY_REVIEW_POLICY_VERSION =
  "recommendation-category-authority-review-policy-v1";

export const RECOMMENDATION_CATEGORY_AUTHORITY_TAXONOMY_VERSION =
  "catalog-taxonomy-v1";

export const RECOMMENDATION_CATEGORY_AUTHORITY_STATUS = Object.freeze({
  RESOLVED: "CATEGORY_AUTHORITY_SHADOW_RESOLVED",
  NONE: "CATEGORY_AUTHORITY_SHADOW_UNAVAILABLE",
});

export const RECOMMENDATION_CATEGORY_AUTHORITY_SUPPORTED_CATEGORIES =
  Object.freeze(new Set(["treatment", "toner_essence", "toner_pad"]));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function noAuthority(reason) {
  return Object.freeze({
    contractVersion: RECOMMENDATION_CATEGORY_AUTHORITY_SHADOW_CONTRACT_VERSION,
    status: RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE,
    reason,
    authority: null,
    recommendationAdmissionMutated: false,
    productionCutoverAuthorized: false,
  });
}

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

function normalizedCategoryFromTerm(termId) {
  if (typeof termId !== "string") return null;
  const prefix =
    `${RECOMMENDATION_CATEGORY_AUTHORITY_TAXONOMY_VERSION}:category:`;
  if (!termId.startsWith(prefix)) return null;
  const value = termId.slice(prefix.length);
  return value || null;
}

export function evaluateRecommendationCategoryAuthorityShadow({
  product,
  assignment,
  grant,
} = {}) {
  if (!product || !isUuid(product.id)) {
    return noAuthority("CANONICAL_PRODUCT_ID_INVALID");
  }

  if (product.legacyCategory != null && product.legacyCategory !== "") {
    return noAuthority("LEGACY_CATEGORY_PRESENT");
  }

  if (!assignment) return noAuthority("CANONICAL_TAXONOMY_ASSIGNMENT_MISSING");
  if (assignment.productId !== product.id) {
    return noAuthority("ASSIGNMENT_PRODUCT_MISMATCH");
  }
  if (
    assignment.taxonomyVersion !==
    RECOMMENDATION_CATEGORY_AUTHORITY_TAXONOMY_VERSION
  ) {
    return noAuthority("TAXONOMY_VERSION_MISMATCH");
  }
  if (
    assignment.assignmentState !== "shadow" ||
    assignment.assignmentMethod !== "source_classification"
  ) {
    return noAuthority("ASSIGNMENT_STATE_NOT_ELIGIBLE");
  }
  if (assignment.legacyProjectionKey != null) {
    return noAuthority("LEGACY_PROJECTION_PRESENT");
  }
  if (
    assignment.taxonomyLifecycleState !== "shadow" ||
    assignment.taxonomyAuthorityMode !== "shadow_only"
  ) {
    return noAuthority("TAXONOMY_GLOBAL_AUTHORITY_DRIFT");
  }

  const category = normalizedCategoryFromTerm(assignment.categoryTermId);
  if (
    !category ||
    !RECOMMENDATION_CATEGORY_AUTHORITY_SUPPORTED_CATEGORIES.has(category)
  ) {
    return noAuthority("INITIAL_ADMISSION_CATEGORY_UNSUPPORTED");
  }

  if (!grant) return noAuthority("REVIEWED_CATEGORY_GRANT_MISSING");
  if (grant.productId !== product.id) {
    return noAuthority("GRANT_PRODUCT_MISMATCH");
  }
  if (
    grant.taxonomyVersion !== assignment.taxonomyVersion ||
    grant.categoryTermId !== assignment.categoryTermId
  ) {
    return noAuthority("GRANT_TAXONOMY_BINDING_MISMATCH");
  }
  if (
    grant.reviewPolicyVersion !==
    RECOMMENDATION_CATEGORY_AUTHORITY_REVIEW_POLICY_VERSION
  ) {
    return noAuthority("GRANT_REVIEW_POLICY_MISMATCH");
  }
  if (grant.reviewState !== "established" || grant.isCurrent !== true) {
    return noAuthority("GRANT_NOT_CURRENT_ESTABLISHED");
  }
  if (
    !SHA256_RE.test(String(grant.assignmentSnapshotDigest || "")) ||
    grant.assignmentSnapshotDigest !== assignment.assignmentSnapshotDigest
  ) {
    return noAuthority("GRANT_ASSIGNMENT_SNAPSHOT_DRIFT");
  }
  if (
    !isUuid(grant.candidateId) ||
    grant.candidateId !== assignment.candidateId
  ) {
    return noAuthority("GRANT_CANDIDATE_MISMATCH");
  }
  if (
    typeof grant.sourceRuleKey !== "string" ||
    grant.sourceRuleKey !== assignment.sourceRuleKey
  ) {
    return noAuthority("GRANT_SOURCE_RULE_MISMATCH");
  }

  return Object.freeze({
    contractVersion: RECOMMENDATION_CATEGORY_AUTHORITY_SHADOW_CONTRACT_VERSION,
    status: RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.RESOLVED,
    reason: null,
    authority: Object.freeze({
      productId: product.id,
      category,
      taxonomyVersion: assignment.taxonomyVersion,
      categoryTermId: assignment.categoryTermId,
      recommendationFamilyTermId:
        assignment.recommendationFamilyTermId || null,
      assignmentSnapshotDigest: assignment.assignmentSnapshotDigest,
      candidateId: assignment.candidateId,
      sourceRuleKey: assignment.sourceRuleKey,
      reviewPolicyVersion: grant.reviewPolicyVersion,
      reviewId: grant.reviewId || null,
    }),
    recommendationAdmissionMutated: false,
    productionCutoverAuthorized: false,
  });
}
