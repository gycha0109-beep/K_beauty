import crypto from "node:crypto";

export const PRODUCT_FACT_PROPOSITION_SERIALIZER_V2 =
  "product-fact-proposition-schema-v2";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid_${name}`);
  }
  return value.trim();
}

export function canonicalProductFactPropositionV2(value) {
  return JSON.stringify(stable(value));
}

export function buildProductFactPropositionIdentityV2({
  definition,
  subjectSemanticKey,
  registryVersion,
  factKey,
  valueIdentity,
  scope = {},
  qualifier = {},
  parentPropositionKey = null,
}) {
  const schema = definition?.proposition_identity_schema;
  if (!schema || schema.include_fact_key !== true) {
    throw new Error("invalid_proposition_identity_schema");
  }
  if (schema.include_subject_ref === true) {
    throw new Error("relationship_subject_ref_not_supported_by_schema_v2_pilot");
  }

  const identityScope = Object.fromEntries(
    (schema.scope_dimensions || [])
      .filter((key) => scope?.[key] != null)
      .map((key) => [key, scope[key]]),
  );
  const identityQualifier = Object.fromEntries(
    (schema.qualifier_dimensions || []).map((key) => [
      key,
      qualifier?.[key] ?? null,
    ]),
  );

  return {
    serializer_version: PRODUCT_FACT_PROPOSITION_SERIALIZER_V2,
    subject_semantic_key: requireText(
      subjectSemanticKey,
      "subject_semantic_key",
    ),
    registry_version: requireText(registryVersion, "registry_version"),
    fact_key: requireText(factKey, "fact_key"),
    value_identity:
      schema.include_value_identity === true ? valueIdentity ?? null : null,
    scope: identityScope,
    qualifier: identityQualifier,
    parent_proposition_key: parentPropositionKey ?? null,
  };
}

export function productFactPropositionKeyV2(input) {
  const identity = buildProductFactPropositionIdentityV2(input);
  return crypto
    .createHash("sha256")
    .update(canonicalProductFactPropositionV2(identity))
    .digest("hex");
}
