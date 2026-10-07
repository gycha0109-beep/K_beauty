export const D5E_E_COSRX_CANARY_AUTHORITY_CONTRACT_VERSION =
  "data-ai29c-d5e-e-cosrx-canary-authority-read-v1";

export const D5E_E_COSRX_CANARY_AUTHORITY_STATUS = Object.freeze({
  RESOLVED: "AUTHORITY_RESOLVED",
  NONE: "NO_AUTHORITY",
});

export const D5E_E_COSRX_CANARY_PRODUCT_ID =
  "888eca86-af25-4a12-b9ea-47922d83f520";

export const D5E_E_COSRX_CANARY_REQUIRED_FACT_KEYS = Object.freeze([
  "spf_value",
  "uva_label",
  "uv_filter_type",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const PRODUCT_IDS = new Set([D5E_E_COSRX_CANARY_PRODUCT_ID]);
const FACT_KEYS = new Set(D5E_E_COSRX_CANARY_REQUIRED_FACT_KEYS);

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

function isDateOrNull(value) {
  return (
    value == null ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
  );
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function noAuthority(reason) {
  return Object.freeze({
    readContractVersion: D5E_E_COSRX_CANARY_AUTHORITY_CONTRACT_VERSION,
    status: D5E_E_COSRX_CANARY_AUTHORITY_STATUS.NONE,
    reason: String(reason || "D5E_E_COSRX_CANARY_AUTHORITY_UNAVAILABLE"),
    authority: null,
  });
}

function validateResolved(payload) {
  const product = payload.product;
  const taxonomy = payload.taxonomy;
  const subject = payload.subject;
  const registry = payload.registry;
  const facts = payload.current_facts;
  const semantic = payload.semantic_bundle;

  if (!isObject(product) || !PRODUCT_IDS.has(product.id)) {
    return "D5E_E_COSRX_CANARY_PRODUCT_ID_INVALID";
  }
  if (!isNonEmpty(product.brand) || !isNonEmpty(product.name)) {
    return "D5E_E_COSRX_CANARY_PRODUCT_PRESENTATION_INVALID";
  }

  if (
    !isObject(taxonomy) ||
    taxonomy.product_id !== product.id ||
    taxonomy.taxonomy_version !== "catalog-taxonomy-v1" ||
    taxonomy.entity_kind_term_id !==
      "catalog-taxonomy-v1:entity_kind:cosmetic" ||
    taxonomy.domain_term_id !== "catalog-taxonomy-v1:domain:skincare" ||
    taxonomy.recommendation_family_term_id !==
      "catalog-taxonomy-v1:recommendation_family:sunscreen" ||
    taxonomy.category_term_id !==
      "catalog-taxonomy-v1:category:sunscreen" ||
    taxonomy.assignment_state !== "shadow"
  ) {
    return "D5E_E_COSRX_CANARY_TAXONOMY_INVALID";
  }

  if (
    !isObject(subject) ||
    !isUuid(subject.subject_id) ||
    subject.product_id !== product.id ||
    subject.identity_status !== "resolved" ||
    subject.current_state !== "current" ||
    !isNonEmpty(subject.subject_identity_serializer_version) ||
    !isNonEmpty(subject.identity_resolution_version) ||
    !isDateOrNull(subject.valid_from) ||
    !isDateOrNull(subject.valid_to)
  ) {
    return "D5E_E_COSRX_CANARY_SUBJECT_INVALID";
  }

  if (
    !isObject(registry) ||
    !isNonEmpty(registry.registry_version) ||
    !HEX64_RE.test(String(registry.registry_checksum || "")) ||
    !isNonEmpty(registry.identity_serializer_version)
  ) {
    return "D5E_E_COSRX_CANARY_REGISTRY_INVALID";
  }

  if (!Array.isArray(facts) || facts.length !== 3) {
    return "D5E_E_COSRX_CANARY_FACT_SET_INVALID";
  }

  const seen = new Set();
  for (const fact of facts) {
    if (
      !isObject(fact) ||
      !FACT_KEYS.has(fact.fact_key) ||
      seen.has(fact.fact_key) ||
      !isUuid(fact.fact_instance_id) ||
      !isUuid(fact.confirmation_id) ||
      fact.subject_id !== subject.subject_id ||
      fact.registry_version !== registry.registry_version ||
      !HEX64_RE.test(String(fact.proposition_key || "")) ||
      !isNonEmpty(fact.proposition_serializer_version) ||
      !isNonEmpty(fact.semantic_status) ||
      !isNonEmpty(fact.authority_ceiling) ||
      !isNonEmpty(fact.fused_confidence) ||
      !isDateOrNull(fact.valid_from) ||
      !isDateOrNull(fact.valid_to)
    ) {
      return "D5E_E_COSRX_CANARY_FACT_INVALID";
    }
    seen.add(fact.fact_key);
  }

  for (const key of FACT_KEYS) {
    if (!seen.has(key)) return `D5E_E_COSRX_CANARY_FACT_MISSING:${key}`;
  }

  if (
    !isObject(semantic) ||
    semantic.contractVersion !==
      "sunscreen-recommendation-semantic-bundle-v1" ||
    semantic.productId !== product.id ||
    semantic.subjectId !== subject.subject_id ||
    semantic.subjectCount !== 1 ||
    !isObject(semantic.fields)
  ) {
    return "D5E_E_COSRX_CANARY_SEMANTIC_BUNDLE_INVALID";
  }

  return null;
}

export function normalizeD5eECosrxCanaryAuthorityPayload(payload) {
  if (!isObject(payload)) {
    return noAuthority("D5E_E_COSRX_CANARY_RPC_OUTPUT_INVALID");
  }

  if (
    payload.read_contract_version !==
    D5E_E_COSRX_CANARY_AUTHORITY_CONTRACT_VERSION
  ) {
    return noAuthority("D5E_E_COSRX_CANARY_READ_CONTRACT_VERSION_MISMATCH");
  }

  if (payload.status === D5E_E_COSRX_CANARY_AUTHORITY_STATUS.NONE) {
    return noAuthority(
      isNonEmpty(payload.reason)
        ? payload.reason
        : "D5E_E_COSRX_CANARY_AUTHORITY_UNAVAILABLE",
    );
  }

  if (payload.status !== D5E_E_COSRX_CANARY_AUTHORITY_STATUS.RESOLVED) {
    return noAuthority("D5E_E_COSRX_CANARY_STATUS_INVALID");
  }

  const invalidReason = validateResolved(payload);
  if (invalidReason) return noAuthority(invalidReason);

  return Object.freeze({
    readContractVersion: payload.read_contract_version,
    status: D5E_E_COSRX_CANARY_AUTHORITY_STATUS.RESOLVED,
    reason: null,
    authority: Object.freeze({
      product: Object.freeze({ ...payload.product }),
      taxonomy: Object.freeze({ ...payload.taxonomy }),
      subject: Object.freeze({ ...payload.subject }),
      registry: Object.freeze({ ...payload.registry }),
      currentFacts: Object.freeze(
        payload.current_facts.map((fact) => Object.freeze({ ...fact })),
      ),
      semanticBundle: Object.freeze({
        ...payload.semantic_bundle,
        fields: Object.freeze({ ...payload.semantic_bundle.fields }),
      }),
    }),
  });
}
