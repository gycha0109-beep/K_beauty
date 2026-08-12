import crypto from "node:crypto";

export const VERSION = "product-fact-current-resolver-v1";
export const RESOLVER_SOURCE = "hosted_product_fact_current";
export const SEMANTIC_STATUSES = Object.freeze([
  "supported",
  "reviewed_not_established",
  "not_reviewed",
  "evidence_insufficient",
  "evidence_conflict",
]);
export const PF_AUTHORITIES = Object.freeze([
  "none",
  "legacy_unreviewed",
  "ingredient_basis",
  "review_observation",
  "limited_non_product_specific",
  "product_specific_primary",
]);
export const PF_CONFIDENCE = Object.freeze(["high", "medium", "low", "unknown"]);

export const CURRENT_FACT_SELECT_V1 = `
select
  s.product_id::text as product_id,
  s.subject_id::text as subject_id,
  s.identity_status,
  s.current_state as subject_current_state,
  c.proposition_key,
  c.fact_instance_id::text as fact_instance_id,
  c.confirmation_id::text as confirmation_id,
  f.registry_version,
  f.fact_key,
  f.semantic_status,
  f.value_type,
  f.value_boolean,
  f.value_enum,
  f.value_number,
  f.value_unit,
  f.value_range_min,
  f.value_range_max,
  f.value_entity_identifier,
  f.authority_ceiling,
  f.fused_confidence,
  f.fusion_policy_version,
  f.fusion_input_digest
from public.product_fact_current c
join public.product_fact_instances f
  on f.fact_instance_id = c.fact_instance_id
 and f.proposition_key = c.proposition_key
 and f.subject_id = c.subject_id
join public.product_fact_subjects s
  on s.subject_id = c.subject_id
where s.product_id = $1
  and s.identity_status = 'resolved'
  and s.current_state = 'current'
  and f.fact_key = any($2::text[])
order by f.fact_key, c.proposition_key;
`.trim();
export const VALUE_TYPES = Object.freeze([
  "boolean",
  "enum",
  "number",
  "number_unit",
  "range_unit",
  "entity_identifier",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value)), "utf8").digest("hex");
}

function typedValue(row) {
  if (row.semantic_status !== "supported") {
    invariant(row.value_type == null, "non-supported Current Fact must not expose value_type");
    return null;
  }

  invariant(VALUE_TYPES.includes(row.value_type), `unsupported Current Fact value_type ${row.value_type}`);
  switch (row.value_type) {
    case "boolean":
      invariant(typeof row.value_boolean === "boolean", "supported boolean Current Fact requires value_boolean");
      return row.value_boolean;
    case "enum":
      invariant(typeof row.value_enum === "string" && row.value_enum.length > 0, "supported enum Current Fact requires value_enum");
      return row.value_enum;
    case "number":
      invariant(Number.isFinite(Number(row.value_number)), "supported number Current Fact requires value_number");
      return Number(row.value_number);
    case "number_unit":
      invariant(Number.isFinite(Number(row.value_number)), "supported number_unit Current Fact requires value_number");
      invariant(typeof row.value_unit === "string" && row.value_unit.length > 0, "supported number_unit Current Fact requires value_unit");
      return { value: Number(row.value_number), unit: row.value_unit };
    case "range_unit":
      invariant(Number.isFinite(Number(row.value_range_min)) && Number.isFinite(Number(row.value_range_max)), "supported range_unit Current Fact requires range bounds");
      invariant(Number(row.value_range_min) <= Number(row.value_range_max), "supported range_unit Current Fact range is inverted");
      invariant(typeof row.value_unit === "string" && row.value_unit.length > 0, "supported range_unit Current Fact requires value_unit");
      return { min: Number(row.value_range_min), max: Number(row.value_range_max), unit: row.value_unit };
    case "entity_identifier":
      invariant(typeof row.value_entity_identifier === "string" && row.value_entity_identifier.length > 0, "supported entity_identifier Current Fact requires value_entity_identifier");
      return row.value_entity_identifier;
    default:
      throw new Error(`unreachable value_type ${row.value_type}`);
  }
}

export function normalizeCurrentFactRow(row) {
  invariant(row && typeof row === "object", "Current Fact row must be an object");
  invariant(typeof row.product_id === "string" && row.product_id.length > 0, "Current Fact row product_id required");
  invariant(typeof row.subject_id === "string" && row.subject_id.length > 0, "Current Fact row subject_id required");
  invariant(row.identity_status === "resolved", "Current Fact resolver requires resolved subject identity");
  invariant(row.subject_current_state === "current", "Current Fact resolver requires current subject state");
  invariant(typeof row.fact_key === "string" && row.fact_key.length > 0, "Current Fact row fact_key required");
  invariant(SEMANTIC_STATUSES.includes(row.semantic_status), `invalid semantic_status ${row.semantic_status}`);
  invariant(PF_AUTHORITIES.includes(row.authority_ceiling), `invalid authority_ceiling ${row.authority_ceiling}`);
  invariant(PF_CONFIDENCE.includes(row.fused_confidence), `invalid fused_confidence ${row.fused_confidence}`);
  invariant(typeof row.fusion_input_digest === "string" && /^[0-9a-f]{64}$/.test(row.fusion_input_digest), "Current Fact row fusion_input_digest required");

  return {
    fact_key: row.fact_key,
    presence: "current",
    semantic_status: row.semantic_status,
    value_type: row.semantic_status === "supported" ? row.value_type : null,
    typed_value: typedValue(row),
    authority_ceiling: row.authority_ceiling,
    fused_confidence: row.fused_confidence,
    registry_version: row.registry_version ?? null,
    fusion_policy_version: row.fusion_policy_version ?? null,
    fusion_input_digest: row.fusion_input_digest,
    provenance: {
      source: RESOLVER_SOURCE,
      product_id: row.product_id,
      subject_id: row.subject_id,
      proposition_key: row.proposition_key ?? null,
      fact_instance_id: row.fact_instance_id ?? null,
      confirmation_id: row.confirmation_id ?? null,
    },
  };
}

export function missingCurrentFact(productId, factKey) {
  return {
    fact_key: factKey,
    presence: "missing_current",
    semantic_status: null,
    value_type: null,
    typed_value: null,
    authority_ceiling: "none",
    fused_confidence: "unknown",
    registry_version: null,
    fusion_policy_version: null,
    fusion_input_digest: null,
    provenance: {
      source: RESOLVER_SOURCE,
      product_id: productId,
      subject_id: null,
      proposition_key: null,
      fact_instance_id: null,
      confirmation_id: null,
    },
  };
}

export function resolveProductCurrentFacts({ product_id: productId, current_rows: currentRows, fact_keys: factKeys }) {
  invariant(typeof productId === "string" && productId.length > 0, "product_id required");
  invariant(Array.isArray(currentRows), "current_rows must be an array");
  invariant(Array.isArray(factKeys) && new Set(factKeys).size === factKeys.length, "fact_keys must be a unique array");

  const normalized = currentRows
    .filter((row) => row.product_id === productId)
    .map(normalizeCurrentFactRow);
  const byKey = new Map();
  for (const fact of normalized) {
    invariant(!byKey.has(fact.fact_key), `multiple Current Facts for ${fact.fact_key}`);
    byKey.set(fact.fact_key, fact);
  }
  const facts = factKeys.map((factKey) => byKey.get(factKey) ?? missingCurrentFact(productId, factKey));
  return {
    resolver_version: VERSION,
    resolver_source: RESOLVER_SOURCE,
    hosted_current: true,
    product_id: productId,
    facts,
    resolver_input_digest: sha256Json({ product_id: productId, facts }),
  };
}
