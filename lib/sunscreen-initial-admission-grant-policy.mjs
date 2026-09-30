import {
  evaluateSunscreenSemanticEnvelope,
} from "./sunscreen-recommendation-semantic-projection.mjs";
import {
  isExactLegacyRecommendationCorpusMember,
} from "./recommendation-legacy-corpus-v1.mjs";

export const SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION =
  "sunscreen-initial-admission-grant-policy-v1";

export const SUNSCREEN_INITIAL_ADMISSION_AUTHORITY_OWNER =
  "Canonical Sunscreen Recommendation Admission Governance";

export const SUNSCREEN_INITIAL_ADMISSION_REQUIRED_FACTS = Object.freeze([
  "spf_value",
  "uva_label",
  "uv_filter_type",
]);

export const SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY = Object.freeze({
  version: "product-fact-registry-cross-category-v1",
  checksum: "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575",
});

export const SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_SERIALIZER =
  "product-fact-subject-identity-v1";

export const SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS =
  Object.freeze(["trust-phase5-admin-subject-review-v1"]);

export const SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_PROPOSITION_SERIALIZER =
  "product-fact-proposition-pilot-v1";

export const SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_TAXONOMY = Object.freeze({
  taxonomyVersion: "catalog-taxonomy-v1",
  entityKindTermId: "catalog-taxonomy-v1:entity_kind:cosmetic",
  domainTermId: "catalog-taxonomy-v1:domain:skincare",
  recommendationFamilyTermId:
    "catalog-taxonomy-v1:recommendation_family:sunscreen",
  categoryTermId: "catalog-taxonomy-v1:category:sunscreen",
  assignmentState: "shadow",
});

export const SUNSCREEN_INITIAL_ADMISSION_GRANT_SEMANTICS = Object.freeze({
  createsInitialCandidateAuthorityOnly: true,
  productionAdmissionGateWired: false,
  impliesSafety: false,
  impliesEfficacy: false,
  impliesRecommendation: false,
  impliesHighScore: false,
  impliesTopPick: false,
  bypassesSemanticContextGate: false,
  bypassesHardReject: false,
  modifiesScoring: false,
  modifiesProductionRanking: false,
  authorizesOutdoorRankableSignal: false,
  authorizesPublicActivation: false,
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const ACCEPTED_CONFIDENCE = new Set(["high", "medium"]);
const ACCEPTED_UVA = new Set([
  "PA+",
  "PA++",
  "PA+++",
  "PA++++",
  "UVA-PF-declared",
]);
const ACCEPTED_UV_FILTER = new Set(["mineral", "organic", "hybrid"]);

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

function isStale(validTo, nowDate = new Date()) {
  if (!validTo) return false;
  return String(validTo) <= nowDate.toISOString().slice(0, 10);
}

function noGrant(...reasons) {
  return Object.freeze({
    policyVersion: SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION,
    owner: SUNSCREEN_INITIAL_ADMISSION_AUTHORITY_OWNER,
    decision: "NO_GRANT",
    grant: false,
    reasons: Object.freeze([...new Set(reasons)].sort()),
    semantics: SUNSCREEN_INITIAL_ADMISSION_GRANT_SEMANTICS,
  });
}

function yesGrant() {
  return Object.freeze({
    policyVersion: SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION,
    owner: SUNSCREEN_INITIAL_ADMISSION_AUTHORITY_OWNER,
    decision: "SUNSCREEN_INITIAL_ADMISSION_GRANT",
    grant: true,
    reasons: Object.freeze([
      "SUNSCREEN_IDENTITY_PROTECTION_AND_SEMANTIC_AUTHORITY_COMPLETE",
    ]),
    semantics: SUNSCREEN_INITIAL_ADMISSION_GRANT_SEMANTICS,
  });
}

function validateTaxonomy(taxonomy, productId) {
  const accepted = SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_TAXONOMY;
  return Boolean(
    taxonomy &&
      taxonomy.productId === productId &&
      taxonomy.taxonomyVersion === accepted.taxonomyVersion &&
      taxonomy.entityKindTermId === accepted.entityKindTermId &&
      taxonomy.domainTermId === accepted.domainTermId &&
      taxonomy.recommendationFamilyTermId ===
        accepted.recommendationFamilyTermId &&
      taxonomy.categoryTermId === accepted.categoryTermId &&
      taxonomy.assignmentState === accepted.assignmentState,
  );
}

function validateFactShape(fact, subjectId) {
  return Boolean(
    fact &&
      fact.isCurrent === true &&
      fact.subjectId === subjectId &&
      isUuid(fact.factInstanceId) &&
      isUuid(fact.confirmationId) &&
      typeof fact.propositionKey === "string" &&
      HEX64_RE.test(fact.propositionKey) &&
      fact.registryVersion ===
        SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY.version &&
      fact.propositionSerializerVersion ===
        SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_PROPOSITION_SERIALIZER &&
      fact.semanticStatus === "supported" &&
      fact.authorityCeiling === "product_specific_primary" &&
      ACCEPTED_CONFIDENCE.has(fact.fusedConfidence) &&
      !isStale(fact.validTo),
  );
}

function validateFactValue(fact) {
  if (fact.factKey === "spf_value") {
    if (fact.valueType !== "number") return false;
    const value = Number(fact.valueNumber);
    return Number.isFinite(value) && value > 0;
  }
  if (fact.factKey === "uva_label") {
    return fact.valueType === "enum" && ACCEPTED_UVA.has(fact.valueEnum);
  }
  if (fact.factKey === "uv_filter_type") {
    return (
      fact.valueType === "enum" &&
      ACCEPTED_UV_FILTER.has(fact.valueEnum)
    );
  }
  return false;
}

export function evaluateSunscreenInitialAdmissionGrant(input) {
  const product = input?.product || {};
  const taxonomy = input?.taxonomy || {};
  const subject = input?.subject || {};
  const registry = input?.registry || {};
  const currentFacts = Array.isArray(input?.currentFacts)
    ? input.currentFacts
    : [];
  const semanticBundle = input?.semanticBundle || null;

  if (!isUuid(product.id) || product.canonicalProduct !== true) {
    return noGrant("CANONICAL_PRODUCT_IDENTITY_UNRESOLVED");
  }

  if (isExactLegacyRecommendationCorpusMember(product.id)) {
    return noGrant("LEGACY_CORPUS_MEMBER_USES_FROZEN_LEGACY_AUTHORITY");
  }

  if (!validateTaxonomy(taxonomy, product.id)) {
    return noGrant("CANONICAL_SUNSCREEN_TAXONOMY_UNRESOLVED");
  }

  if (
    !isUuid(subject.subjectId) ||
    subject.productId !== product.id ||
    subject.identityStatus !== "resolved" ||
    subject.currentState !== "current" ||
    subject.subjectIdentitySerializerVersion !==
      SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_SERIALIZER ||
    !SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS.includes(
      subject.identityResolutionVersion,
    ) ||
    isStale(subject.validTo)
  ) {
    return noGrant("PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT");
  }

  if (
    registry.registryVersion !==
      SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY.version ||
    registry.registryChecksum !==
      SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY.checksum ||
    registry.identitySerializerVersion !==
      SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_SERIALIZER
  ) {
    return noGrant("PRODUCT_FACT_REGISTRY_MISMATCH");
  }

  const factByKey = new Map();
  for (const fact of currentFacts) {
    if (factByKey.has(fact?.factKey)) {
      return noGrant(`AMBIGUOUS_CURRENT_FACT:${String(fact?.factKey || "unknown")}`);
    }
    factByKey.set(fact?.factKey, fact);
  }

  for (const factKey of SUNSCREEN_INITIAL_ADMISSION_REQUIRED_FACTS) {
    const fact = factByKey.get(factKey);
    if (!fact) {
      return noGrant(`REQUIRED_CURRENT_FACT_MISSING:${factKey}`);
    }
    if (!validateFactShape(fact, subject.subjectId)) {
      return noGrant(`REQUIRED_CURRENT_FACT_AUTHORITY_INCOMPLETE:${factKey}`);
    }
    if (!validateFactValue(fact)) {
      return noGrant(`REQUIRED_CURRENT_FACT_VALUE_INVALID:${factKey}`);
    }
  }

  const envelope = evaluateSunscreenSemanticEnvelope(semanticBundle);
  if (!envelope.envelopeReady) {
    return noGrant("SUNSCREEN_RECOMMENDATION_SEMANTIC_ENVELOPE_NOT_READY");
  }
  if (
    envelope.productId !== product.id ||
    envelope.subjectId !== subject.subjectId
  ) {
    return noGrant("SUNSCREEN_RECOMMENDATION_SEMANTIC_BINDING_MISMATCH");
  }

  const categorySemantic = semanticBundle?.fields?.category_slot;
  const uvSemantic = semanticBundle?.fields?.uv_filter_type;
  const uvFact = factByKey.get("uv_filter_type");

  if (
    categorySemantic?.state !== "established" ||
    categorySemantic?.value !== "sunscreen"
  ) {
    return noGrant("SUNSCREEN_CATEGORY_SEMANTIC_NOT_ESTABLISHED");
  }
  if (
    uvSemantic?.state !== "established" ||
    !ACCEPTED_UV_FILTER.has(uvSemantic?.value) ||
    uvSemantic.value !== uvFact?.valueEnum
  ) {
    return noGrant("SUNSCREEN_UV_FILTER_SEMANTIC_FACT_MISMATCH");
  }

  return yesGrant();
}
