export const RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_READ_CONTRACT_VERSION =
  "recommendation-sunscreen-protection-authority-read-v1";

export const RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS = Object.freeze({
  RESOLVED: "AUTHORITY_RESOLVED",
  NONE: "NO_AUTHORITY"
});

export const RECOMMENDATION_SUNSCREEN_PROTECTION_FACT_KEYS = Object.freeze([
  "spf_value",
  "uva_label",
  "water_resistance_duration"
]);

export const RECOMMENDATION_SUNSCREEN_PROTECTION_UVA_LABELS = Object.freeze([
  "PA+",
  "PA++",
  "PA+++",
  "PA++++",
  "UVA-PF-declared"
]);

const FACT_KEY_SET = new Set(RECOMMENDATION_SUNSCREEN_PROTECTION_FACT_KEYS);
const UVA_LABEL_SET = new Set(RECOMMENDATION_SUNSCREEN_PROTECTION_UVA_LABELS);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

const TOP_LEVEL_KEYS = new Set([
  "read_contract_version",
  "status",
  "product",
  "subject",
  "registry",
  "current_facts"
]);
const PRODUCT_KEYS = new Set(["product_id", "category"]);
const SUBJECT_KEYS = new Set([
  "subject_id",
  "product_id",
  "subject_identity_serializer_version",
  "identity_status",
  "identity_resolution_version",
  "current_state",
  "market_applicability",
  "region_applicability",
  "valid_from",
  "valid_to"
]);
const REGISTRY_KEYS = new Set([
  "registry_version",
  "registry_checksum",
  "identity_serializer_version"
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
  "value_number",
  "value_unit",
  "value_enum",
  "market",
  "region",
  "locale",
  "qualifier",
  "authority_ceiling",
  "fused_confidence",
  "valid_from",
  "valid_to"
]);

const PROTECTION_AUTHORITY_CEILINGS = new Set(["product_specific_primary"]);
const PROTECTION_CONFIDENCE = new Set(["high", "medium"]);

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactKeys(value, allowed) {
  return isObject(value) && Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value) {
  return value == null || typeof value === "string";
}

function isNullableDateString(value) {
  return value == null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isStaleDate(validTo, nowDate = new Date()) {
  if (!validTo) return false;
  return validTo <= nowDate.toISOString().slice(0, 10);
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateFactValue(fact) {
  if (fact.fact_key === "spf_value") {
    if (fact.value_type !== "number") return "MALFORMED_SPF_VALUE_TYPE";
    const value = finiteNumber(fact.value_number);
    if (value == null || value <= 0) return "MALFORMED_SPF_VALUE";
    if (fact.value_unit != null || fact.value_enum != null) return "MALFORMED_SPF_VALUE_FIELDS";
    const plusModifier = fact.qualifier?.plus_modifier;
    if (plusModifier !== "none" && plusModifier !== "plus") {
      return "MALFORMED_SPF_QUALIFIER";
    }
    return null;
  }

  if (fact.fact_key === "uva_label") {
    if (fact.value_type !== "enum") return "MALFORMED_UVA_VALUE_TYPE";
    if (!UVA_LABEL_SET.has(fact.value_enum)) return "MALFORMED_UVA_VALUE";
    if (fact.value_number != null || fact.value_unit != null) return "MALFORMED_UVA_VALUE_FIELDS";
    return null;
  }

  if (fact.fact_key === "water_resistance_duration") {
    if (fact.value_type !== "number_unit") return "MALFORMED_WATER_VALUE_TYPE";
    const value = finiteNumber(fact.value_number);
    if (value == null || value <= 0) return "MALFORMED_WATER_VALUE";
    if (fact.value_unit !== "minutes" || fact.value_enum != null) {
      return "MALFORMED_WATER_VALUE_FIELDS";
    }
    return null;
  }

  return "MALFORMED_FACT_SCOPE";
}

export function isCanonicalProtectionProductUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function noRecommendationSunscreenProtectionAuthority(
  reason = "PF_PROTECTION_AUTHORITY_UNAVAILABLE"
) {
  return Object.freeze({
    readContractVersion:
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_READ_CONTRACT_VERSION,
    status: RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.NONE,
    reason: String(reason || "PF_PROTECTION_AUTHORITY_UNAVAILABLE"),
    authority: null
  });
}

function validateResolvedPayload(payload) {
  if (!hasExactKeys(payload, TOP_LEVEL_KEYS)) return "MALFORMED_RPC_TOP_LEVEL";
  if (!hasExactKeys(payload.product, PRODUCT_KEYS)) return "MALFORMED_RPC_PRODUCT";
  if (!hasExactKeys(payload.subject, SUBJECT_KEYS)) return "MALFORMED_RPC_SUBJECT";
  if (!hasExactKeys(payload.registry, REGISTRY_KEYS)) return "MALFORMED_RPC_REGISTRY";
  if (!Array.isArray(payload.current_facts) || payload.current_facts.length < 1 || payload.current_facts.length > 3) {
    return "MALFORMED_RPC_FACT_CARDINALITY";
  }

  const productId = payload.product.product_id;
  const subjectId = payload.subject.subject_id;

  if (!isCanonicalProtectionProductUuid(productId) || !isCanonicalProtectionProductUuid(subjectId)) {
    return "MALFORMED_RPC_IDENTITY";
  }
  if (payload.product.category !== "sunscreen") return "NON_SUNSCREEN_PRODUCT";
  if (payload.subject.product_id !== productId) return "MALFORMED_RPC_SUBJECT_BINDING";
  if (!isNonEmptyString(payload.subject.subject_identity_serializer_version)) {
    return "MALFORMED_RPC_SUBJECT_SERIALIZER";
  }
  if (payload.subject.identity_status !== "resolved" || !isNonEmptyString(payload.subject.identity_resolution_version)) {
    return "MALFORMED_RPC_SUBJECT_IDENTITY";
  }
  if (payload.subject.current_state !== "current") return "NON_CURRENT_SUBJECT";
  if (!isNullableString(payload.subject.market_applicability) ||
      !isNullableString(payload.subject.region_applicability)) {
    return "MALFORMED_RPC_SUBJECT_SCOPE";
  }
  if (!isNullableDateString(payload.subject.valid_from) ||
      !isNullableDateString(payload.subject.valid_to)) {
    return "MALFORMED_RPC_SUBJECT_VALIDITY";
  }
  if (isStaleDate(payload.subject.valid_to)) return "STALE_SUBJECT";

  if (!isNonEmptyString(payload.registry.registry_version) ||
      !HEX64_RE.test(payload.registry.registry_checksum || "") ||
      !isNonEmptyString(payload.registry.identity_serializer_version)) {
    return "MALFORMED_RPC_REGISTRY_LINEAGE";
  }

  const seenFactIds = new Set();
  const seenPropositions = new Set();
  const seenFactKeys = new Set();

  for (const fact of payload.current_facts) {
    if (!hasExactKeys(fact, FACT_KEYS)) return "MALFORMED_RPC_FACT_FIELDS";
    if (!FACT_KEY_SET.has(fact.fact_key)) return "MALFORMED_RPC_FACT_SCOPE";
    if (seenFactKeys.has(fact.fact_key)) return "AMBIGUOUS_CURRENT_FACT_KEY";
    seenFactKeys.add(fact.fact_key);

    if (!isCanonicalProtectionProductUuid(fact.fact_instance_id) ||
        !isCanonicalProtectionProductUuid(fact.confirmation_id)) {
      return "MALFORMED_RPC_FACT_IDENTITY";
    }
    if (fact.subject_id !== subjectId) return "MALFORMED_RPC_FACT_SUBJECT_BINDING";
    if (!HEX64_RE.test(fact.proposition_key || "")) return "MALFORMED_RPC_PROPOSITION";
    if (fact.registry_version !== payload.registry.registry_version) {
      return "MALFORMED_RPC_FACT_REGISTRY_BINDING";
    }
    if (!isNonEmptyString(fact.proposition_serializer_version) ||
        !isNonEmptyString(fact.semantic_status) ||
        !isNonEmptyString(fact.authority_ceiling) ||
        !isNonEmptyString(fact.fused_confidence)) {
      return "MALFORMED_RPC_FACT_SEMANTICS";
    }
    if (!isNullableDateString(fact.valid_from) || !isNullableDateString(fact.valid_to)) {
      return "MALFORMED_RPC_FACT_VALIDITY";
    }
    if (isStaleDate(fact.valid_to)) return "STALE_CURRENT_FACT";
    if (!isNullableString(fact.market) ||
        !isNullableString(fact.region) ||
        !isNullableString(fact.locale) ||
        (fact.qualifier != null && !isObject(fact.qualifier))) {
      return "MALFORMED_RPC_FACT_SCOPE_FIELDS";
    }
    if (seenFactIds.has(fact.fact_instance_id) || seenPropositions.has(fact.proposition_key)) {
      return "AMBIGUOUS_CURRENT_AUTHORITY";
    }
    seenFactIds.add(fact.fact_instance_id);
    seenPropositions.add(fact.proposition_key);

    const valueError = validateFactValue(fact);
    if (valueError) return valueError;
  }

  return null;
}

export function normalizeRecommendationSunscreenProtectionAuthorityPayload(payload) {
  if (!isObject(payload)) {
    return noRecommendationSunscreenProtectionAuthority("MALFORMED_RPC_OUTPUT");
  }
  if (
    payload.read_contract_version !==
    RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_READ_CONTRACT_VERSION
  ) {
    return noRecommendationSunscreenProtectionAuthority(
      "READ_CONTRACT_VERSION_MISMATCH"
    );
  }
  if (
    payload.status ===
    RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.NONE
  ) {
    return noRecommendationSunscreenProtectionAuthority(
      isNonEmptyString(payload.reason)
        ? payload.reason
        : "PF_PROTECTION_AUTHORITY_UNAVAILABLE"
    );
  }
  if (
    payload.status !==
    RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED
  ) {
    return noRecommendationSunscreenProtectionAuthority("MALFORMED_RPC_STATUS");
  }

  const invalidReason = validateResolvedPayload(payload);
  if (invalidReason) {
    return noRecommendationSunscreenProtectionAuthority(invalidReason);
  }

  return Object.freeze({
    readContractVersion:
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_READ_CONTRACT_VERSION,
    status: RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED,
    reason: null,
    authority: Object.freeze({
      product: Object.freeze({ ...payload.product }),
      subject: Object.freeze({ ...payload.subject }),
      registry: Object.freeze({ ...payload.registry }),
      currentFacts: Object.freeze(
        payload.current_facts.map((fact) =>
          Object.freeze({
            ...fact,
            qualifier:
              fact.qualifier && typeof fact.qualifier === "object"
                ? Object.freeze({ ...fact.qualifier })
                : null
          })
        )
      )
    })
  });
}

export function isProtectionFactRankingAuthorityEligible(fact) {
  return Boolean(
    fact &&
      FACT_KEY_SET.has(fact.fact_key) &&
      fact.semantic_status === "supported" &&
      PROTECTION_AUTHORITY_CEILINGS.has(fact.authority_ceiling) &&
      PROTECTION_CONFIDENCE.has(fact.fused_confidence) &&
      !isStaleDate(fact.valid_to)
  );
}
