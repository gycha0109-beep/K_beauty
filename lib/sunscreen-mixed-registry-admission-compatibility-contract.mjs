import {
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_PROPOSITION_SERIALIZER,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_SERIALIZER,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_TAXONOMY,
} from "./sunscreen-initial-admission-grant-policy.mjs";
import {
  evaluateSunscreenSemanticEnvelope,
} from "./sunscreen-recommendation-semantic-projection.mjs";
import {
  isExactLegacyRecommendationCorpusMember,
} from "./recommendation-legacy-corpus-v1.mjs";

// R4-B is an isolated, non-authorizing authority-compatibility check.
// It MUST NOT be wired into any candidate reader, scorer, beta or public route.
export const BUSHMAN_MIXED_REGISTRY_COMPATIBILITY_VERSION =
  "data-ai29c-filter-r4-b-bushman-mixed-registry-compatibility-contract-v1";

export const BUSHMAN_MIXED_REGISTRY_TARGET = Object.freeze({
  productId: "4608b3b4-8b51-4464-b46e-380b05c1a3d7",
  subjectId: "0b5963bb-67d6-4738-a620-32ec86c1e3d0",
  subjectSemanticKey: "33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584",
  formulationRevisionKey: "data-ai29c-c5-bushman-waterproof-pro-current",
  market: "KR",
});

const REGISTRY_V1 = SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY.version;
const REGISTRY_V2 = "product-fact-registry-cross-category-v2";
const REGISTRY_V2_CHECKSUM =
  "923256ca2468b2af31e1b7026655739408035daf62d3ff40a7132eca22afddd7";
const PROPOSITION_V2_SERIALIZER = "product-fact-proposition-schema-v2";

export const BUSHMAN_MIXED_REGISTRY_FACT_CONTRACT = Object.freeze({
  spf_value: Object.freeze({
    registryVersion: REGISTRY_V1,
    propositionSerializerVersion:
      SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_PROPOSITION_SERIALIZER,
    valueType: "number",
    valueNumber: 50,
  }),
  uva_label: Object.freeze({
    registryVersion: REGISTRY_V1,
    propositionSerializerVersion:
      SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_PROPOSITION_SERIALIZER,
    valueType: "enum",
    valueEnum: "PA++++",
  }),
  uv_filter_type: Object.freeze({
    registryVersion: REGISTRY_V2,
    propositionSerializerVersion: PROPOSITION_V2_SERIALIZER,
    valueType: "enum",
    valueEnum: "hybrid",
  }),
});

export const BUSHMAN_MIXED_REGISTRY_CHECKSUMS = Object.freeze({
  [REGISTRY_V1]: SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY.checksum,
  [REGISTRY_V2]: REGISTRY_V2_CHECKSUM,
});

const HEX64 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_FACT_KEYS = Object.freeze([
  "spf_value", "uva_label", "uv_filter_type",
]);

function staleOrInvalid(validTo, now) {
  if (validTo === null || validTo === undefined) return false;
  if (typeof validTo !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(validTo)) {
    return true;
  }
  if (Number.isNaN(Date.parse(validTo))) return true;
  return validTo <= now.toISOString().slice(0, 10);
}

function uniqueSorted(items) {
  return Object.freeze([...new Set(items)].sort());
}

function taxonomyMatches(taxonomy, productId) {
  const accepted = SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_TAXONOMY;
  return taxonomy?.productId === productId &&
    Object.entries(accepted).every(([key, value]) => taxonomy?.[key] === value);
}

function valueMatches(fact, contract) {
  if (fact?.valueType !== contract.valueType) return false;
  if (contract.valueType === "number") {
    return typeof fact.valueNumber === "number" &&
      Number.isFinite(fact.valueNumber) &&
      fact.valueNumber === contract.valueNumber &&
      fact.valueEnum === null;
  }
  return fact.valueEnum === contract.valueEnum &&
    fact.valueNumber === null;
}

export function evaluateBushmanMixedRegistryCompatibility(input, options = {}) {
  const now = options.now instanceof Date && !Number.isNaN(options.now.getTime())
    ? options.now
    : new Date();
  const facts = Array.isArray(input?.currentFacts) ? input.currentFacts : [];
  const registries = input?.registrySnapshots;
  const product = input?.product;
  const subject = input?.subject;
  const scope = input?.subjectScope;
  const errors = [];

  if (product?.id !== BUSHMAN_MIXED_REGISTRY_TARGET.productId ||
      product?.canonicalProduct !== true ||
      isExactLegacyRecommendationCorpusMember(product?.id)) {
    errors.push("PRODUCT_OUTSIDE_EXACT_NONLEGACY_TARGET");
  }

  if (!taxonomyMatches(input?.taxonomy, BUSHMAN_MIXED_REGISTRY_TARGET.productId)) {
    errors.push("CANONICAL_SUNSCREEN_TAXONOMY_MISMATCH");
  }

  if (input?.exactCurrentSubjectCount !== 1 ||
      subject?.subjectId !== BUSHMAN_MIXED_REGISTRY_TARGET.subjectId ||
      subject?.productId !== BUSHMAN_MIXED_REGISTRY_TARGET.productId ||
      subject?.identityStatus !== "resolved" ||
      subject?.currentState !== "current" ||
      subject?.subjectIdentitySerializerVersion !==
        SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_SERIALIZER ||
      staleOrInvalid(subject?.validTo, now) ||
      scope?.subjectSemanticKey !== BUSHMAN_MIXED_REGISTRY_TARGET.subjectSemanticKey ||
      scope?.formulationRevisionKey !== BUSHMAN_MIXED_REGISTRY_TARGET.formulationRevisionKey ||
      scope?.market !== BUSHMAN_MIXED_REGISTRY_TARGET.market) {
    errors.push("EXACT_CURRENT_SUBJECT_OR_FORMULATION_SCOPE_MISMATCH");
  }

  const expectedRegistryKeys = Object.keys(BUSHMAN_MIXED_REGISTRY_CHECKSUMS).sort();
  if (!registries || typeof registries !== "object" ||
      Array.isArray(registries) ||
      JSON.stringify(Object.keys(registries).sort()) !== JSON.stringify(expectedRegistryKeys)) {
    errors.push("REGISTRY_SNAPSHOT_SET_MISMATCH");
  }

  for (const registryVersion of expectedRegistryKeys) {
    const snapshot = registries?.[registryVersion];
    if (snapshot?.registryVersion !== registryVersion ||
        snapshot?.registryChecksum !== BUSHMAN_MIXED_REGISTRY_CHECKSUMS[registryVersion] ||
        snapshot?.identitySerializerVersion !==
          SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_SERIALIZER) {
      errors.push("REGISTRY_CHECKSUM_OR_SERIALIZER_MISMATCH:" + registryVersion);
    }
  }

  if (facts.length !== REQUIRED_FACT_KEYS.length) {
    errors.push("FACT_CARDINALITY_MISMATCH");
  }
  const factByKey = new Map();
  for (const fact of facts) {
    const key = String(fact?.factKey ?? "unknown");
    if (factByKey.has(key)) errors.push("DUPLICATE_CURRENT_FACT:" + key);
    factByKey.set(key, fact);
    if (!REQUIRED_FACT_KEYS.includes(key)) errors.push("UNEXPECTED_CURRENT_FACT:" + key);
  }

  for (const key of REQUIRED_FACT_KEYS) {
    const contract = BUSHMAN_MIXED_REGISTRY_FACT_CONTRACT[key];
    const fact = factByKey.get(key);
    if (!fact) {
      errors.push("REQUIRED_CURRENT_FACT_MISSING:" + key);
      continue;
    }
    if (fact.registryVersion !== contract.registryVersion ||
        fact.propositionSerializerVersion !== contract.propositionSerializerVersion) {
      errors.push("FACT_REGISTRY_OR_PROPOSITION_SERIALIZER_MISMATCH:" + key);
    }
    if (fact.isCurrent !== true ||
        fact.subjectId !== BUSHMAN_MIXED_REGISTRY_TARGET.subjectId ||
        !UUID.test(String(fact.factInstanceId)) ||
        !UUID.test(String(fact.confirmationId)) ||
        !HEX64.test(String(fact.propositionKey)) ||
        fact.semanticStatus !== "supported" ||
        fact.authorityCeiling !== "product_specific_primary" ||
        !["high", "medium"].includes(fact.fusedConfidence) ||
        staleOrInvalid(fact.validTo, now)) {
      errors.push("FACT_AUTHORITY_OR_CURRENT_MISMATCH:" + key);
    }
    if (!valueMatches(fact, contract)) {
      errors.push("FACT_VALUE_MISMATCH:" + key);
    }
  }

  // Never auto-upgrade this lineage. R4-C owns governed Subject authority.
  const subjectAuthorityReady = subject?.identityResolutionVersion !== undefined &&
    SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS.includes(
      subject.identityResolutionVersion,
    );

  // R4-D owns 12/12 review. No synthetic bundle can be treated as evidence.
  const semanticEnvelope = evaluateSunscreenSemanticEnvelope(input?.semanticBundle);
  const semanticEnvelopeReady =
    input?.semanticReviewCount === 12 &&
    semanticEnvelope.envelopeReady &&
    semanticEnvelope.productId === BUSHMAN_MIXED_REGISTRY_TARGET.productId &&
    semanticEnvelope.subjectId === BUSHMAN_MIXED_REGISTRY_TARGET.subjectId &&
    input?.semanticBundle?.fields?.category_slot?.state === "established" &&
    input.semanticBundle.fields.category_slot.value === "sunscreen" &&
    input?.semanticBundle?.fields?.uv_filter_type?.state === "established" &&
    input.semanticBundle.fields.uv_filter_type.value === "hybrid";

  const lineageBlockers = uniqueSorted(errors);
  const lineageCompatible = lineageBlockers.length === 0;
  const independentGates = uniqueSorted([
    ...(subjectAuthorityReady ? [] : ["SUBJECT_AUTHORITY_NOT_GOVERNED"]),
    ...(semanticEnvelopeReady ? [] : ["SEMANTIC_12_OF_12_ENVELOPE_NOT_READY"]),
  ]);

  return Object.freeze({
    contractVersion: BUSHMAN_MIXED_REGISTRY_COMPATIBILITY_VERSION,
    decision: lineageCompatible
      ? "MIXED_REGISTRY_LINEAGE_VALID_ADMISSION_HOLD"
      : "MIXED_REGISTRY_LINEAGE_INVALID_ADMISSION_HOLD",
    lineageCompatible,
    lineageBlockers,
    subjectAuthorityReady,
    semanticEnvelopeReady,
    independentGates,
    prerequisiteShapeReady: lineageCompatible &&
      subjectAuthorityReady && semanticEnvelopeReady,
    admissionGranted: false,
    productionCandidateAdded: false,
    runtimeWired: false,
    rankingChanged: false,
    publicActivation: false,
    uvaActivation: false,
    waterActivation: false,
  });
}
