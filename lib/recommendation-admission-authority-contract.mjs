export const RECOMMENDATION_ADMISSION_AUTHORITY_READ_CONTRACT_VERSION =
  "recommendation-admission-authority-read-v1";

export const RECOMMENDATION_ADMISSION_AUTHORITY_STATUS = Object.freeze({
  RESOLVED: "AUTHORITY_RESOLVED",
  NONE: "NO_AUTHORITY",
});

export const RECOMMENDATION_ADMISSION_AUTHORITY_FACT_KEYS = Object.freeze([
  "active_concentration",
  "contains_active",
  "pad_surface_texture",
  "product_format",
  "recommended_use_frequency",
  "wipe_off_use",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const TOP_LEVEL_KEYS = new Set([
  "read_contract_version",
  "status",
  "product",
  "subject",
  "registry",
  "current_facts",
]);
const PRODUCT_KEYS = new Set(["product_id", "category"]);
const SUBJECT_KEYS = new Set([
  "subject_id",
  "product_id",
  "subject_identity_serializer_version",
  "identity_status",
  "identity_resolution_version",
  "current_state",
  "valid_from",
  "valid_to",
]);
const REGISTRY_KEYS = new Set([
  "registry_version",
  "registry_checksum",
  "identity_serializer_version",
]);
const FACT_KEYS = new Set([
  "proposition_key",
  "fact_instance_id",
  "subject_id",
  "confirmation_id",
  "fact_key",
  "registry_version",
  "proposition_serializer_version",
  "semantic_status",
  "value_type",
  "value_boolean",
  "value_enum",
  "value_number",
  "value_unit",
  "value_range_min",
  "value_range_max",
  "value_entity_identifier",
  "parent_proposition_key",
  "parent_fact_instance_id",
  "authority_ceiling",
  "fused_confidence",
  "valid_from",
  "valid_to",
]);
const ALLOWED_FACT_KEYS = new Set(RECOMMENDATION_ADMISSION_AUTHORITY_FACT_KEYS);

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactKeys(value, allowed) {
  return isObject(value) && Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNullableDateString(value) {
  if (value == null) return true;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isStaleDate(validTo, nowDate = new Date()) {
  if (!validTo) return false;
  const today = nowDate.toISOString().slice(0, 10);
  return validTo <= today;
}

export function isCanonicalRecommendationUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function noRecommendationAdmissionAuthority(reason = "PF_AUTHORITY_UNAVAILABLE") {
  return Object.freeze({
    readContractVersion: RECOMMENDATION_ADMISSION_AUTHORITY_READ_CONTRACT_VERSION,
    status: RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.NONE,
    reason: String(reason || "PF_AUTHORITY_UNAVAILABLE"),
    authority: null,
  });
}

function validateResolvedPayload(payload) {
  if (!hasExactKeys(payload, TOP_LEVEL_KEYS)) return "MALFORMED_RPC_TOP_LEVEL";
  if (!hasExactKeys(payload.product, PRODUCT_KEYS)) return "MALFORMED_RPC_PRODUCT";
  if (!hasExactKeys(payload.subject, SUBJECT_KEYS)) return "MALFORMED_RPC_SUBJECT";
  if (!hasExactKeys(payload.registry, REGISTRY_KEYS)) return "MALFORMED_RPC_REGISTRY";
  if (!Array.isArray(payload.current_facts) || payload.current_facts.length === 0 || payload.current_facts.length > 64) {
    return "MALFORMED_RPC_FACT_CARDINALITY";
  }

  const productId = payload.product.product_id;
  const subjectId = payload.subject.subject_id;
  if (!isCanonicalRecommendationUuid(productId) || !isCanonicalRecommendationUuid(subjectId)) {
    return "MALFORMED_RPC_IDENTITY";
  }
  if (payload.subject.product_id !== productId) return "MALFORMED_RPC_SUBJECT_BINDING";
  if (!isNonEmptyString(payload.product.category)) return "MALFORMED_RPC_CATEGORY";
  if (!isNonEmptyString(payload.subject.subject_identity_serializer_version)) return "MALFORMED_RPC_SUBJECT_SERIALIZER";
  if (!isNonEmptyString(payload.subject.identity_status) || !isNonEmptyString(payload.subject.identity_resolution_version)) {
    return "MALFORMED_RPC_SUBJECT_IDENTITY";
  }
  if (payload.subject.current_state !== "current") return "NON_CURRENT_SUBJECT";
  if (!isNullableDateString(payload.subject.valid_from) || !isNullableDateString(payload.subject.valid_to)) {
    return "MALFORMED_RPC_SUBJECT_VALIDITY";
  }
  if (isStaleDate(payload.subject.valid_to)) return "STALE_SUBJECT";
  if (!isNonEmptyString(payload.registry.registry_version) || !HEX64_RE.test(payload.registry.registry_checksum || "")) {
    return "MALFORMED_RPC_REGISTRY_LINEAGE";
  }
  if (!isNonEmptyString(payload.registry.identity_serializer_version)) return "MALFORMED_RPC_REGISTRY_SERIALIZER";

  const seenFactIds = new Set();
  const seenPropositions = new Set();
  let containsActiveCount = 0;
  for (const fact of payload.current_facts) {
    if (!hasExactKeys(fact, FACT_KEYS)) return "MALFORMED_RPC_FACT_FIELDS";
    if (!ALLOWED_FACT_KEYS.has(fact.fact_key)) return "MALFORMED_RPC_FACT_SCOPE";
    if (!isCanonicalRecommendationUuid(fact.fact_instance_id) || !isCanonicalRecommendationUuid(fact.confirmation_id)) {
      return "MALFORMED_RPC_FACT_IDENTITY";
    }
    if (fact.subject_id !== subjectId) return "MALFORMED_RPC_FACT_SUBJECT_BINDING";
    if (!HEX64_RE.test(fact.proposition_key || "")) return "MALFORMED_RPC_PROPOSITION";
    if (fact.parent_proposition_key != null && !HEX64_RE.test(fact.parent_proposition_key)) {
      return "MALFORMED_RPC_PARENT_PROPOSITION";
    }
    if (fact.parent_fact_instance_id != null && !isCanonicalRecommendationUuid(fact.parent_fact_instance_id)) {
      return "MALFORMED_RPC_PARENT_FACT";
    }
    if (fact.registry_version !== payload.registry.registry_version) return "MALFORMED_RPC_FACT_REGISTRY_BINDING";
    if (!isNonEmptyString(fact.proposition_serializer_version) || !isNonEmptyString(fact.semantic_status)) {
      return "MALFORMED_RPC_FACT_SEMANTICS";
    }
    if (!isNonEmptyString(fact.authority_ceiling) || !isNonEmptyString(fact.fused_confidence)) {
      return "MALFORMED_RPC_FACT_AUTHORITY";
    }
    if (!isNullableDateString(fact.valid_from) || !isNullableDateString(fact.valid_to)) {
      return "MALFORMED_RPC_FACT_VALIDITY";
    }
    if (isStaleDate(fact.valid_to)) return "STALE_CURRENT_FACT";
    if (seenFactIds.has(fact.fact_instance_id) || seenPropositions.has(fact.proposition_key)) {
      return "AMBIGUOUS_CURRENT_AUTHORITY";
    }
    seenFactIds.add(fact.fact_instance_id);
    seenPropositions.add(fact.proposition_key);
    if (fact.fact_key === "contains_active") containsActiveCount += 1;
  }
  if (containsActiveCount === 0) return "REQUIRED_CURRENT_FACT_MISSING:contains_active";
  return null;
}

export function normalizeRecommendationAdmissionAuthorityPayload(payload) {
  if (!isObject(payload)) return noRecommendationAdmissionAuthority("MALFORMED_RPC_OUTPUT");
  if (payload.read_contract_version !== RECOMMENDATION_ADMISSION_AUTHORITY_READ_CONTRACT_VERSION) {
    return noRecommendationAdmissionAuthority("READ_CONTRACT_VERSION_MISMATCH");
  }
  if (payload.status === RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.NONE) {
    return noRecommendationAdmissionAuthority(
      isNonEmptyString(payload.reason) ? payload.reason : "PF_AUTHORITY_UNAVAILABLE",
    );
  }
  if (payload.status !== RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.RESOLVED) {
    return noRecommendationAdmissionAuthority("MALFORMED_RPC_STATUS");
  }

  const invalidReason = validateResolvedPayload(payload);
  if (invalidReason) return noRecommendationAdmissionAuthority(invalidReason);

  return Object.freeze({
    readContractVersion: payload.read_contract_version,
    status: RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.RESOLVED,
    reason: null,
    authority: Object.freeze({
      product: Object.freeze({ ...payload.product }),
      subject: Object.freeze({ ...payload.subject }),
      registry: Object.freeze({ ...payload.registry }),
      currentFacts: Object.freeze(payload.current_facts.map((fact) => Object.freeze({ ...fact }))),
    }),
  });
}

export function buildPdaMapperInput(resolved) {
  if (resolved?.status !== RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.RESOLVED || !resolved.authority) return null;
  const { product, subject, currentFacts } = resolved.authority;
  return Object.freeze({
    product: Object.freeze([product.product_id, product.category]),
    subject: Object.freeze({
      subject_id: subject.subject_id,
      identity_status: subject.identity_status,
      current_state: subject.current_state,
    }),
    facts: Object.freeze(currentFacts.map((fact) => Object.freeze({
      product_id: product.product_id,
      ...fact,
    }))),
  });
}

export function buildG2Input(resolved, mapperResult, mapperVersion) {
  if (resolved?.status !== RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.RESOLVED || !resolved.authority) return null;
  const { product, subject, registry, currentFacts } = resolved.authority;
  const pda = mapperResult?.pda || {};
  return Object.freeze({
    product: Object.freeze({
      id: product.product_id,
      category: product.category,
      canonicalProduct: true,
      identityStatus: subject.identity_status,
    }),
    subject: Object.freeze({
      subjectId: subject.subject_id,
      productId: subject.product_id,
      identityStatus: subject.identity_status,
      currentState: subject.current_state,
      subjectIdentitySerializerVersion: subject.subject_identity_serializer_version,
      identityResolutionVersion: subject.identity_resolution_version,
    }),
    authority: Object.freeze({
      registryVersion: registry.registry_version,
      registryChecksum: registry.registry_checksum,
    }),
    currentFacts: Object.freeze(currentFacts.map((fact) => Object.freeze({
      factKey: fact.fact_key,
      isCurrent: true,
      stale: isStaleDate(fact.valid_to),
      subjectId: fact.subject_id,
      semanticStatus: fact.semantic_status,
      authorityCeiling: fact.authority_ceiling,
      registryVersion: fact.registry_version,
      propositionSerializerVersion: fact.proposition_serializer_version,
      propositionKey: fact.proposition_key,
      factInstanceId: fact.fact_instance_id,
      confirmationId: fact.confirmation_id,
    }))),
    pda: Object.freeze({
      axisKey: pda.axis_key,
      contractVersion: pda.contract_version,
      mapperVersion,
      activeIdentityMappingVersion: pda.active_identity_mapping_version,
      current: true,
      stale: false,
      signalStatus: pda.signal_status,
      coverageState: pda.coverage?.state,
      uncertaintyReasons: Object.freeze(Array.isArray(pda.uncertainty?.reasons) ? [...pda.uncertainty.reasons] : []),
    }),
  });
}
