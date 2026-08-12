import { normalizeCurrentFactRow, sha256Json } from "./product-fact-current-resolver-v1.mjs";

export const VERSION = "product-fact-current-group-resolver-v1";
export const RESOLVER_SOURCE = "hosted_product_fact_current";

export const GROUPED_CURRENT_FACT_SELECT_V1 = `
select
  s.product_id::text as product_id,
  s.subject_id::text as subject_id,
  s.identity_status,
  s.current_state as subject_current_state,
  s.variant_key as subject_variant_key,
  s.formulation_revision_key as subject_formulation_revision_key,
  s.market_applicability as subject_market_applicability,
  s.region_applicability as subject_region_applicability,
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
  f.market,
  f.region,
  f.locale,
  f.valid_from,
  f.valid_to,
  f.qualifier,
  f.parent_proposition_key,
  f.parent_fact_instance_id::text as parent_fact_instance_id,
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

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function scopeFromRow(row) {
  return {
    market: row.market ?? null,
    region: row.region ?? null,
    locale: row.locale ?? null,
    valid_from: row.valid_from ?? null,
    valid_to: row.valid_to ?? null,
    subject_variant_key: row.subject_variant_key ?? null,
    subject_formulation_revision_key: row.subject_formulation_revision_key ?? null,
    subject_market_applicability: row.subject_market_applicability ?? null,
    subject_region_applicability: row.subject_region_applicability ?? null,
  };
}

export function normalizeGroupedCurrentFactRow(row) {
  const base = normalizeCurrentFactRow(row);
  return {
    ...base,
    proposition_key: row.proposition_key ?? null,
    scope: scopeFromRow(row),
    qualifier: row.qualifier ?? {},
    parent_proposition_key: row.parent_proposition_key ?? null,
    parent_fact_instance_id: row.parent_fact_instance_id ?? null,
  };
}

export function resolveProductCurrentFactGroups({ product_id: productId, current_rows: currentRows, fact_definitions: factDefinitions, fact_keys: factKeys }) {
  invariant(typeof productId === "string" && productId.length > 0, "product_id required");
  invariant(Array.isArray(currentRows), "current_rows must be an array");
  invariant(Array.isArray(factDefinitions), "fact_definitions must be an array");
  invariant(Array.isArray(factKeys) && new Set(factKeys).size === factKeys.length, "fact_keys must be unique");

  const definitions = new Map(factDefinitions.map((definition) => [definition.fact_key, definition]));
  const normalized = currentRows.filter((row) => row.product_id === productId).map(normalizeGroupedCurrentFactRow);
  const groups = factKeys.map((factKey) => {
    const definition = definitions.get(factKey);
    invariant(definition, `missing registry definition ${factKey}`);
    invariant(definition.cardinality === "one" || definition.cardinality === "many", `invalid cardinality for ${factKey}`);
    const facts = normalized.filter((fact) => fact.fact_key === factKey).sort((a, b) => String(a.proposition_key).localeCompare(String(b.proposition_key), "en"));
    invariant(new Set(facts.map((fact) => fact.proposition_key)).size === facts.length, `duplicate proposition_key for ${factKey}`);
    if (definition.cardinality === "one") invariant(facts.length <= 1, `cardinality-one Current Fact duplicated for ${factKey}`);
    return { fact_key: factKey, cardinality: definition.cardinality, presence: facts.length ? "current" : "missing_current", facts };
  });

  return {
    resolver_version: VERSION,
    resolver_source: RESOLVER_SOURCE,
    hosted_current: true,
    product_id: productId,
    groups,
    resolver_input_digest: sha256Json({ product_id: productId, groups }),
  };
}
