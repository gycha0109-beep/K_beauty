#!/usr/bin/env node

export const INITIAL_ADMISSION_POLICY_VERSION = "initial-admission-grant-policy-v1";
export const INITIAL_ADMISSION_AUTHORITY_OWNER = "Canonical Recommendation Admission Governance";
export const LEGACY_CORPUS_VERSION = "LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1";
export const LEGACY_CORPUS_COUNT = 164;
export const LEGACY_CORPUS_SHA256 = "b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05";

export const ACCEPTED_REGISTRY = Object.freeze({
  version: "product-fact-registry-cross-category-v1",
  checksum: "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575",
});
export const ACCEPTED_SUBJECT_IDENTITY_SERIALIZER_VERSION = "product-fact-subject-identity-v1";
export const ACCEPTED_SUBJECT_IDENTITY_RESOLUTION_VERSIONS = Object.freeze([
  "catalog-evidence-research-wave-1-identity-v1",
  "cross-category-real-evidence-pilot-v1",
]);
export const ACCEPTED_PROPOSITION_SERIALIZER_VERSION = "product-fact-proposition-pilot-v1";
export const ACCEPTED_PDA = Object.freeze({
  axisKey: "exfoliation_load",
  contractVersion: "exfoliation-non-numeric-pda-contract-v1",
  mapperVersion: "exfoliation-non-numeric-pda-offline-shadow-v1",
  activeIdentityMappingVersion: "exfoliating-active-identity-set-v1",
});

export const CATEGORY_CLASSIFICATION = Object.freeze({
  treatment: "INITIAL_ADMISSION_SUPPORTED",
  toner_essence: "INITIAL_ADMISSION_SUPPORTED",
  toner_pad: "INITIAL_ADMISSION_SUPPORTED",
  cleanser: "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
  sunscreen: "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
  moisturizer_lotion_emulsion: "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
  moisturizer_balm: "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
  moisturizer_cream: "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
  moisturizer_gel: "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
});

export const SUPPORTED_CATEGORIES = Object.freeze(
  Object.entries(CATEGORY_CLASSIFICATION)
    .filter(([, classification]) => classification === "INITIAL_ADMISSION_SUPPORTED")
    .map(([category]) => category)
    .sort(),
);

export const REQUIRED_PRODUCT_FACTS = Object.freeze({
  treatment: Object.freeze(["contains_active"]),
  toner_essence: Object.freeze(["contains_active"]),
  toner_pad: Object.freeze(["contains_active"]),
});

export const REQUIRED_PDAS = Object.freeze({
  treatment: Object.freeze(["exfoliation_load"]),
  toner_essence: Object.freeze(["exfoliation_load"]),
  toner_pad: Object.freeze(["exfoliation_load"]),
});

export const ACCEPTED_PDA_SIGNAL_STATES = Object.freeze([
  "GOVERNED_SIGNAL_ESTABLISHED",
  "GOVERNED_SIGNAL_NOT_ESTABLISHED",
]);
export const ACCEPTED_PDA_COVERAGE_STATES = Object.freeze([
  "active_identity_only",
  "active_identity_with_unscaled_context",
  "no_relevant_fact",
]);
export const DISQUALIFYING_PDA_UNCERTAINTY_REASONS = Object.freeze([
  "AUTHORITY_BELOW_PRODUCT_SPECIFIC_PRIMARY",
  "CATEGORY_UNKNOWN",
  "CONFLICTING_GOVERNED_FACT",
  "EVIDENCE_INSUFFICIENT",
  "IDENTITY_BLOCKED",
  "NOT_REVIEWED",
  "REVIEWED_NOT_ESTABLISHED",
  "SOURCE_BLOCKED_OR_MISSING_CURRENT",
]);

export const GRANT_SEMANTICS = Object.freeze({
  createsInitialCandidateEligibilityOnly: true,
  impliesRecommendationRank: false,
  impliesSafety: false,
  impliesEfficacy: false,
  impliesApproval: false,
  impliesUniversalSuitability: false,
  bypassesCandidatePolicy: false,
  bypassesLaterPolicyRestriction: false,
  authorizesEnforce: false,
  activatesEnforce: false,
  modifiesScoring: false,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCKED_FACT_STATES = new Set([
  "evidence_conflict",
  "evidence_insufficient",
  "reviewed_not_established",
  "not_reviewed",
  "unknown",
]);

function noGrant(...reasons) {
  return Object.freeze({
    policyVersion: INITIAL_ADMISSION_POLICY_VERSION,
    owner: INITIAL_ADMISSION_AUTHORITY_OWNER,
    decision: "NO_GRANT",
    grant: false,
    reasons: Object.freeze([...new Set(reasons)].sort()),
    semantics: GRANT_SEMANTICS,
  });
}

function yesGrant() {
  return Object.freeze({
    policyVersion: INITIAL_ADMISSION_POLICY_VERSION,
    owner: INITIAL_ADMISSION_AUTHORITY_OWNER,
    decision: "INITIAL_ADMISSION_GRANT",
    grant: true,
    reasons: Object.freeze(["AUTHORITATIVE_PRODUCT_LEVEL_LINEAGE_COMPLETE"]),
    semantics: GRANT_SEMANTICS,
  });
}

export function isCanonicalUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isLegacyCorpusMember(productId, legacyIds) {
  if (!isCanonicalUuid(productId)) return false;
  const normalized = productId.toLowerCase();
  return legacyIds instanceof Set ? legacyIds.has(normalized) : new Set(legacyIds || []).has(normalized);
}

export function classifyInitialAdmissionCategory(category) {
  return CATEGORY_CLASSIFICATION[category] || "INITIAL_ADMISSION_UNSUPPORTED";
}

export function evaluateInitialAdmissionGrant(input, { legacyIds = new Set() } = {}) {
  const product = input?.product || {};
  const subject = input?.subject || {};
  const authority = input?.authority || {};
  const currentFacts = Array.isArray(input?.currentFacts) ? input.currentFacts : [];
  const pda = input?.pda || {};

  if (!isCanonicalUuid(product.id) || product.canonicalProduct !== true || product.identityStatus !== "resolved") {
    return noGrant("CANONICAL_PRODUCT_IDENTITY_UNRESOLVED");
  }

  if (isLegacyCorpusMember(product.id, legacyIds)) {
    return noGrant("LEGACY_CORPUS_MEMBER_USES_FROZEN_LEGACY_AUTHORITY");
  }

  const categoryClass = classifyInitialAdmissionCategory(product.category);
  if (categoryClass !== "INITIAL_ADMISSION_SUPPORTED") {
    return noGrant(categoryClass);
  }

  if (
    !isCanonicalUuid(subject.subjectId) ||
    subject.productId !== product.id ||
    subject.identityStatus !== "resolved" ||
    subject.currentState !== "current"
  ) {
    return noGrant("PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT");
  }
  if (subject.subjectIdentitySerializerVersion !== ACCEPTED_SUBJECT_IDENTITY_SERIALIZER_VERSION) {
    return noGrant("SUBJECT_IDENTITY_SERIALIZER_MISMATCH");
  }
  if (!ACCEPTED_SUBJECT_IDENTITY_RESOLUTION_VERSIONS.includes(subject.identityResolutionVersion)) {
    return noGrant("SUBJECT_IDENTITY_RESOLUTION_VERSION_UNSUPPORTED");
  }

  if (authority.registryVersion !== ACCEPTED_REGISTRY.version || authority.registryChecksum !== ACCEPTED_REGISTRY.checksum) {
    return noGrant("PRODUCT_FACT_REGISTRY_MISMATCH");
  }

  const requiredFacts = REQUIRED_PRODUCT_FACTS[product.category] || [];
  for (const factKey of requiredFacts) {
    const rows = currentFacts.filter((fact) => fact?.factKey === factKey);
    if (!rows.length) return noGrant(`REQUIRED_CURRENT_FACT_MISSING:${factKey}`);
    if (rows.some((fact) => BLOCKED_FACT_STATES.has(fact?.semanticStatus))) {
      return noGrant(`REQUIRED_CURRENT_FACT_NON_POSITIVE_AUTHORITY:${factKey}`);
    }
    const authoritativeRows = rows.filter((fact) =>
      fact?.isCurrent === true &&
      fact?.subjectId === subject.subjectId &&
      fact?.semanticStatus === "supported" &&
      fact?.authorityCeiling === "product_specific_primary" &&
      fact?.registryVersion === ACCEPTED_REGISTRY.version &&
      fact?.propositionSerializerVersion === ACCEPTED_PROPOSITION_SERIALIZER_VERSION &&
      fact?.stale !== true &&
      typeof fact?.propositionKey === "string" && fact.propositionKey.length > 0 &&
      typeof fact?.factInstanceId === "string" && fact.factInstanceId.length > 0 &&
      typeof fact?.confirmationId === "string" && fact.confirmationId.length > 0
    );
    if (!authoritativeRows.length) return noGrant(`REQUIRED_CURRENT_FACT_AUTHORITY_INCOMPLETE:${factKey}`);
  }

  if (pda.axisKey !== ACCEPTED_PDA.axisKey) return noGrant("REQUIRED_PDA_ABSENT_OR_AXIS_MISMATCH");
  if (pda.contractVersion !== ACCEPTED_PDA.contractVersion) return noGrant("PDA_CONTRACT_VERSION_MISMATCH");
  if (pda.mapperVersion !== ACCEPTED_PDA.mapperVersion) return noGrant("PDA_MAPPER_VERSION_MISMATCH");
  if (pda.activeIdentityMappingVersion !== ACCEPTED_PDA.activeIdentityMappingVersion) {
    return noGrant("PDA_IDENTITY_MAPPING_VERSION_MISMATCH");
  }
  if (pda.stale === true || pda.current !== true) return noGrant("PDA_NON_CURRENT_OR_STALE");
  if (!ACCEPTED_PDA_SIGNAL_STATES.includes(pda.signalStatus)) return noGrant("PDA_SIGNAL_STATE_UNSUPPORTED");
  if (!ACCEPTED_PDA_COVERAGE_STATES.includes(pda.coverageState)) return noGrant("PDA_COVERAGE_STATE_UNSUPPORTED");

  const uncertaintyReasons = Array.isArray(pda.uncertaintyReasons) ? pda.uncertaintyReasons : [];
  const blockingUncertainty = uncertaintyReasons.filter((reason) => DISQUALIFYING_PDA_UNCERTAINTY_REASONS.includes(reason));
  if (blockingUncertainty.length) return noGrant(...blockingUncertainty.map((reason) => `PDA_AUTHORITY_BLOCKED:${reason}`));

  const requiredPdas = REQUIRED_PDAS[product.category] || [];
  if (!requiredPdas.includes(pda.axisKey)) return noGrant("CATEGORY_REQUIRED_PDA_MISMATCH");

  return yesGrant();
}
