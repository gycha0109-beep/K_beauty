import assert from "node:assert/strict";

export const REGISTRY_VERSION = "product-fact-registry-cross-category-v1";
export const ALLOWED_VALUE_TYPES = new Set([
  "boolean",
  "enum",
  "number",
  "number_unit",
  "range_unit",
  "entity_identifier"
]);
export const FORBIDDEN_REGISTRY_KEYS = new Set([
  "weight",
  "score",
  "penalty",
  "hero_boost",
  "user_concern_coefficient",
  "intensity",
  "strength"
]);

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walkKeys(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, visit);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child);
    walkKeys(child, visit);
  }
}

export function validateRegistry(registry) {
  assert.equal(registry?.registry_version, REGISTRY_VERSION, "registry version");
  assert(Array.isArray(registry?.facts) && registry.facts.length > 0, "facts required");

  const seen = new Set();
  for (const definition of registry.facts) {
    if (!definition?.fact_key || typeof definition.fact_key !== "string") fail("invalid_fact_key");
    if (seen.has(definition.fact_key)) fail("duplicate_fact_key");
    seen.add(definition.fact_key);
    if (definition.registry_version !== REGISTRY_VERSION) fail("registry_version_mismatch");
    if (!ALLOWED_VALUE_TYPES.has(definition.value_type)) fail("invalid_value_type_definition");
    if (!Array.isArray(definition.domain_scope) || definition.domain_scope.length === 0) fail("missing_domain_scope");
    if (!["one", "many"].includes(definition.cardinality)) fail("invalid_cardinality");
    if (!definition.semantic_definition || typeof definition.semantic_definition !== "string") fail("missing_semantic_definition");
    if (!definition.positive_evidence_requirement) fail("missing_positive_evidence_requirement");
    if (!definition.negative_evidence_requirement) fail("missing_negative_evidence_requirement");
    if (!definition.conflict_semantics) fail("missing_conflict_semantics");
    if (!Array.isArray(definition.permitted_evidence_classes) || definition.permitted_evidence_classes.length === 0) {
      fail("missing_evidence_class_contract");
    }
    if (definition.value_type === "enum" && (!Array.isArray(definition.allowed_values) || definition.allowed_values.length === 0)) {
      fail("enum_values_required");
    }
    if (["number_unit", "range_unit"].includes(definition.value_type)) {
      if (!Array.isArray(definition?.unit_schema?.allowed_units) || definition.unit_schema.allowed_units.length === 0) {
        fail("unit_schema_required");
      }
    }
  }

  walkKeys(registry, (key) => {
    if (FORBIDDEN_REGISTRY_KEYS.has(key)) fail("forbidden_registry_scoring_or_intensity_key", key);
  });

  assert.equal(registry?.downstream_consumption_boundary?.fact_registry_does_not_create_decision_axes, true);
  assert.equal(registry?.downstream_consumption_boundary?.recommendation_policy_separate, true);
  return true;
}

export function getFactDefinition(registry, factKey) {
  const definition = registry.facts.find((item) => item.fact_key === factKey);
  if (!definition) fail("unknown_fact_key", factKey);
  return definition;
}

function validateNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail("invalid_number");
}

function validateUnitValue(definition, value, range = false) {
  if (!isPlainObject(value)) fail("invalid_unit_value");
  const allowed = definition.unit_schema.allowed_units;
  if (!allowed.includes(value.unit)) fail("invalid_unit");
  if (range) {
    validateNumber(value.min);
    validateNumber(value.max);
    if (value.min > value.max) fail("invalid_range");
  } else {
    validateNumber(value.amount);
  }
}

function validateValue(definition, value) {
  switch (definition.value_type) {
    case "boolean":
      if (typeof value !== "boolean") fail("invalid_boolean");
      return;
    case "enum":
      if (!definition.allowed_values.includes(value)) fail("invalid_enum");
      return;
    case "number":
      validateNumber(value);
      return;
    case "number_unit":
      validateUnitValue(definition, value, false);
      return;
    case "range_unit":
      validateUnitValue(definition, value, true);
      return;
    case "entity_identifier":
      if (typeof value !== "string" || !value.trim()) fail("invalid_entity_identifier");
      return;
    default:
      fail("invalid_value_type_definition");
  }
}

function validateScope(definition, scope) {
  const actual = isPlainObject(scope) ? scope : {};
  const allowed = new Set(definition?.scope_schema?.allowed_fields || []);
  for (const key of Object.keys(actual)) {
    if (!allowed.has(key)) fail("invalid_scope_field");
  }
  for (const required of definition?.scope_schema?.required_fields || []) {
    if (actual[required] == null || actual[required] === "") fail("missing_required_scope");
  }
}

function validateMeasurementContext(instance, definition) {
  if (instance.evidence_class !== "measurement") return;
  const context = instance.qualifier_context;
  if (!isPlainObject(context) || !context.metric || !context.method_context) {
    fail("missing_measurement_context");
  }
  for (const required of definition?.qualifier_schema?.required_context_fields || []) {
    if (context[required] == null || context[required] === "") fail("missing_measurement_context");
  }
  if (!["number", "number_unit", "range_unit"].includes(definition.value_type)) {
    fail("measurement_requires_numeric_fact");
  }
}

export function validateFactInstance(registry, instance, { domain } = {}) {
  const definition = getFactDefinition(registry, instance?.fact_key);
  if (!instance?.fact_instance_id || typeof instance.fact_instance_id !== "string") fail("missing_fact_instance_id");
  if (domain && !definition.domain_scope.includes(domain)) fail("fact_outside_domain_scope");
  if (!registry.status_values.includes(instance.status)) fail("invalid_fact_status");
  if (!registry.evidence_classes.includes(instance.evidence_class)) fail("invalid_evidence_class");
  if (instance.evidence_class === "legacy_catalog_observation" && instance.status === "supported") {
    fail("legacy_cannot_establish_supported_fact");
  }
  if (!definition.permitted_evidence_classes.includes(instance.evidence_class)) fail("evidence_class_not_permitted_for_fact");
  if (!registry.evidence_authority_values.includes(instance.evidence_authority)) fail("invalid_evidence_authority");
  if (!registry.confidence_values.includes(instance.confidence)) fail("invalid_confidence");

  validateScope(definition, instance.scope);

  if (instance.status === "supported") {
    if (instance.value == null) fail("supported_value_required");
    if (!Array.isArray(instance.evidence_refs) || instance.evidence_refs.length === 0) fail("supported_evidence_required");
    validateValue(definition, instance.value);
    if (instance.value === false && instance.negative_proposition_evidence !== true) {
      fail("explicit_negative_evidence_required");
    }
    validateMeasurementContext(instance, definition);
  } else {
    if (instance.value !== null) fail("non_supported_authoritative_value_must_be_null");
  }

  return definition;
}

function stableScope(scope = {}) {
  return JSON.stringify(Object.fromEntries(Object.entries(scope).sort(([a], [b]) => a.localeCompare(b))));
}

export function validateFactSet(registry, product) {
  const facts = product?.facts || [];
  const byId = new Map();
  const cardinalityGroups = new Map();

  for (const instance of facts) {
    if (byId.has(instance.fact_instance_id)) fail("duplicate_fact_instance_id");
    const definition = validateFactInstance(registry, instance, { domain: product.domain });
    byId.set(instance.fact_instance_id, instance);
    const key = `${instance.fact_key}::${stableScope(instance.scope)}`;
    const group = cardinalityGroups.get(key) || [];
    group.push(instance);
    cardinalityGroups.set(key, group);
    if (definition.cardinality === "one" && group.length > 1) fail("cardinality_one_violation");
  }

  for (const instance of facts) {
    const definition = getFactDefinition(registry, instance.fact_key);
    const relationship = definition.relationship_schema || {};
    if (relationship.subject_ref_required) {
      if (!instance.subject_ref) fail("subject_ref_required");
      const subject = byId.get(instance.subject_ref);
      if (!subject) fail("orphan_subject_ref");
      if (subject.fact_key !== relationship.subject_ref_fact_key) fail("subject_ref_wrong_fact_key");
    }
  }
  return true;
}

export function fuseSameProposition({ support = [], opposition = [] } = {}) {
  if (support.length > 0 && opposition.length > 0) {
    return { status: "evidence_conflict", value: null, support, opposition };
  }
  if (support.length > 0) return { status: "supported", value: true, support, opposition: [] };
  if (opposition.length > 0) return { status: "supported", value: false, support: [], opposition };
  return { status: "not_reviewed", value: null, support: [], opposition: [] };
}

export function independentFactKeysConflict(facts = []) {
  const keys = new Set(facts.map((item) => item.fact_key));
  return keys.size !== facts.length && false;
}

export function observationPrevalence({ positive_count, raw_source_sample_size, analyzed_sample_size }) {
  if (analyzed_sample_size == null) return { status: "forbidden", prevalence: null };
  if (!Number.isInteger(analyzed_sample_size) || analyzed_sample_size <= 0) fail("invalid_analyzed_sample_size");
  if (raw_source_sample_size != null && analyzed_sample_size > raw_source_sample_size) fail("analyzed_exceeds_raw");
  if (!Number.isInteger(positive_count) || positive_count < 0 || positive_count > analyzed_sample_size) fail("invalid_positive_count");
  return { status: "available", prevalence: positive_count / analyzed_sample_size };
}

export function missingFactState() {
  return { status: "not_reviewed", value: null };
}

export function assertNoAutomaticDecisionAxisCreation(registry) {
  walkKeys(registry, (key) => {
    if (["decision_axis", "decision_axis_key", "axis_weight", "axis_score"].includes(key)) {
      fail("automatic_decision_axis_contract_forbidden");
    }
  });
  return true;
}

export function assertAuthorityConfidenceSeparated(instance) {
  assert(Object.prototype.hasOwnProperty.call(instance, "evidence_authority"));
  assert(Object.prototype.hasOwnProperty.call(instance, "confidence"));
  return true;
}

export function expectErrorCode(fn, code) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, code, `expected ${code}, received ${error.code || error.message}`);
    return true;
  }
  assert.fail(`expected error ${code}`);
}
