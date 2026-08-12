import { createHash } from "node:crypto";

export const VERSION = "product-decision-axis-shadow-recommendation-v1";
export const SHADOW_STATES = Object.freeze([
  "COMPUTED",
  "HELD_UNCALIBRATED",
  "NO_APPROVED_AXIS_INPUT",
  "NOT_CATALOG_ADOPTED",
  "IDENTITY_BLOCKED",
  "INSUFFICIENT_PRODUCT_FACT_COVERAGE",
  "CONFLICT_BLOCKED",
  "NOT_APPLICABLE",
]);

export const USER_CONCERN_AXES = Object.freeze([
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv",
]);

const RELEVANCE = Object.freeze({
  barrier: ["barrier_support", "hydration_preservation", "irritation_burden", "cleansing_burden", "exfoliation_load"],
  dehydration: ["hydration_preservation", "barrier_support", "cleansing_burden", "exfoliation_load"],
  oiliness: ["sebum_pore_control", "cleansing_burden", "exfoliation_load"],
  redness: ["irritation_burden", "cleansing_burden", "exfoliation_load"],
  acne: ["sebum_pore_control", "exfoliation_load", "irritation_burden"],
  pores: ["sebum_pore_control", "cleansing_burden", "exfoliation_load"],
  uneven_tone: ["photo_protection", "exfoliation_load"],
  uv: ["photo_protection"],
});

const NON_ACTIONABLE_COVERAGE = new Set([
  "missing_fact",
  "no_relevant_fact",
  "insufficient_fact",
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

export function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function list(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function userConcernSet(answers = {}) {
  const values = [answers.mainConcern, ...list(answers.mainConcerns)].filter(Boolean);
  return [...new Set(values.filter((value) => USER_CONCERN_AXES.includes(value)))].sort();
}

export function relevantProductAxisKeys(answers = {}) {
  const keys = new Set();
  for (const concern of userConcernSet(answers)) {
    for (const axis of RELEVANCE[concern] || []) keys.add(axis);
  }
  return [...keys].sort();
}

function compactProvenance(provenance = {}) {
  return {
    source: provenance.source ?? null,
    fixture_only: provenance.fixture_only === true,
    hosted_current: provenance.hosted_current === true,
    pilot_id: provenance.pilot_id ?? null,
    product_id: provenance.product_id ?? null,
    fact_instance_id: provenance.fact_instance_id ?? provenance.frozen_fact_instance_id ?? null,
    confirmation_id: provenance.confirmation_id ?? null,
    supporting_evidence_refs: [...new Set([
      ...list(provenance.supporting_evidence_refs),
      ...list(provenance.supporting_evidence),
    ])].sort(),
    opposing_evidence_refs: [...new Set([
      ...list(provenance.opposing_evidence_refs),
      ...list(provenance.opposing_evidence),
    ])].sort(),
    context_evidence_refs: [...new Set([
      ...list(provenance.context_evidence_refs),
      ...list(provenance.context_evidence),
    ])].sort(),
  };
}

function compactFact(fact = {}) {
  return {
    fact_key: fact.fact_key ?? null,
    semantic_status: fact.semantic_status ?? null,
    typed_value: fact.typed_value ?? null,
    authority_ceiling: fact.authority_ceiling ?? "none",
    fused_confidence: fact.fused_confidence ?? "unknown",
    proposition_key: fact.proposition_key ?? null,
    fusion_input_digest: fact.fusion_input_digest ?? null,
    provenance: compactProvenance(fact.provenance),
  };
}

function compactAxis(axis = {}) {
  return {
    axis_key: axis.axis_key,
    estimate: axis.estimate ?? null,
    coverage: axis.coverage,
    uncertainty: axis.uncertainty,
    authority_ceiling: axis.authority_ceiling,
    mapper_version: axis.mapper_version,
    mapper_input_digest: axis.mapper_input_digest,
    reason_codes: [...list(axis.reason_codes)],
    signal_families: list(axis.signal_families).map((family) => ({
      signal_family: family.signal_family,
      raw_fact_count: family.raw_fact_count,
      unique_lineage_count: family.unique_lineage_count,
      contribution_units: family.contribution_units,
      proposition_keys: [...list(family.proposition_keys)],
    })),
    fact_inputs: list(axis.fact_inputs).map(compactFact),
  };
}

export function buildAxisIndex(cleanserArtifact, crossCategoryArtifact) {
  const index = new Map();
  for (const product of cleanserArtifact.products || []) {
    index.set(String(product.product_id), {
      product_id: String(product.product_id),
      brand: product.brand,
      name: product.name,
      domain: "cleanser",
      catalog_adopted: product.catalog_adopted === true,
      fixture_only: true,
      hosted_current: product.hosted_current === true,
      identity_status: "resolved",
      axes: list(product.axes).map(compactAxis),
    });
  }
  for (const product of crossCategoryArtifact.products || []) {
    index.set(String(product.product_id), {
      product_id: String(product.product_id),
      brand: product.brand,
      name: product.name,
      domain: product.domain,
      pilot_id: product.pilot_id,
      catalog_adopted: product.catalog_adopted === true,
      fixture_only: true,
      hosted_current: product.hosted_current === true,
      identity_status: product.identity_status ?? (product.identity_blocked ? "ambiguous" : "resolved"),
      axes: [compactAxis(product.axis)],
    });
  }
  return index;
}

function hasDeepCleanAxisFact(axisRecord) {
  return list(axisRecord?.axes).some((axis) =>
    list(axis.fact_inputs).some((fact) =>
      fact.fact_key === "deep_cleansing" && fact.semantic_status === "supported" && fact.typed_value === true
    )
  );
}

function legacyDeepClean(rawProduct = {}) {
  const value = String(rawProduct.cleansing_profile ?? rawProduct.cleansingProfile ?? "").toLowerCase();
  return value.includes("deep");
}

function signalPathways({ rawProduct, axisRecord, answers }) {
  const pathways = [];
  const add = (family, active, source, lineage) => pathways.push({ family, active: Boolean(active), source, lineage });
  add("product_concern_metadata", list(rawProduct?.concerns).length > 0, "legacy_product_metadata", ["products-v1.json:concerns"]);
  add("ingredient_signal", list(rawProduct?.ingredient_signals).length > 0, "legacy_product_metadata", ["products-v1.json:ingredient_signals"]);
  add("review_signal", list(rawProduct?.review_signals).length > 0 || Boolean(rawProduct?.review_signals && typeof rawProduct.review_signals === "object"), "legacy_review_runtime", ["products-v1.json:review_signals"]);
  add("market_signal", Boolean(rawProduct?.market_signals), "legacy_market_runtime", ["products-v1.json:market_signals"]);
  add("hero_boost", true, "legacy_score_policy", ["skin-match-decision-engine:priority-slot-hero-boost"]);
  const redness = userConcernSet(answers).includes("redness");
  add("hard_penalty", redness && legacyDeepClean(rawProduct), "legacy_score_policy", ["skin-match-decision-engine:redness+deep-clean-hard-penalty"]);
  add("derived_metadata", Boolean(rawProduct?.cleansing_profile || rawProduct?.product_form || rawProduct?.finish || rawProduct?.texture), "legacy_derived_metadata", ["legacy product metadata"]);
  add("decision_axis", Boolean(axisRecord), "offline_v21_5_v21_6_axis_fixture", list(axisRecord?.axes).map((axis) => axis.mapper_input_digest));
  return pathways;
}

function buildDuplication({ rawProduct, axisRecord, answers }) {
  const pathways = signalPathways({ rawProduct, axisRecord, answers });
  const overlaps = [];
  if (legacyDeepClean(rawProduct) && hasDeepCleanAxisFact(axisRecord)) {
    overlaps.push({
      semantic_family: "deep_cleansing_semantics",
      source_pathways: ["legacy_cleansing_profile", "decision_axis_deep_cleansing_fact"],
      semantic_overlap_confirmed: true,
      evidence_identity_equivalence_claimed: false,
      potential_double_count: true,
      duplicate_numeric_units_added: 0,
      dedupe_decision: "decision_axis_numeric_contribution_held_uncalibrated",
    });
  }
  return { signal_families: pathways, overlaps };
}

function axisLineage(axis) {
  return {
    layer_path: ["scenario_user_context", "product_decision_axis", "product_fact_proposition", "evidence_provenance_reference"],
    axis_key: axis.axis_key,
    mapper_input_digest: axis.mapper_input_digest,
    facts: axis.fact_inputs.map((fact) => ({
      fact_key: fact.fact_key,
      semantic_status: fact.semantic_status,
      proposition_key: fact.proposition_key,
      fusion_input_digest: fact.fusion_input_digest,
      provenance: fact.provenance,
    })),
  };
}

export function evaluateShadowCandidate({ scenario, rawProduct, scoredProduct, legacyRank, topPickId, top3Ids, axisRecord }) {
  const answers = scenario.answers || {};
  const relevantKeys = relevantProductAxisKeys(answers);
  const axes = list(axisRecord?.axes);
  invariant(axes.every((axis) => axis.estimate === null), `uncalibrated axis unexpectedly numeric for ${rawProduct?.id}`);
  invariant(!axisRecord || axisRecord.fixture_only === true, "offline axis record must be fixture_only");
  invariant(!axisRecord || axisRecord.hosted_current === false, "offline axis record must not claim Hosted Current");

  const applicableAxes = axes.filter((axis) => relevantKeys.includes(axis.axis_key));
  let state;
  if (!axisRecord) state = "NO_APPROVED_AXIS_INPUT";
  else if (axisRecord.identity_status !== "resolved" || axes.some((axis) => axis.coverage === "identity_blocked")) state = "IDENTITY_BLOCKED";
  else if (applicableAxes.length === 0) state = "NOT_APPLICABLE";
  else if (applicableAxes.some((axis) => axis.coverage === "conflict_blocked")) state = "CONFLICT_BLOCKED";
  else if (applicableAxes.every((axis) => NON_ACTIONABLE_COVERAGE.has(axis.coverage))) state = "INSUFFICIENT_PRODUCT_FACT_COVERAGE";
  else state = "HELD_UNCALIBRATED";

  invariant(state !== "COMPUTED", "numeric shadow ranking is not authorized in V2.1-7");

  const constraint = state === "IDENTITY_BLOCKED"
    ? { evaluated: true, state: "BLOCKED", reason: "subject_identity_not_resolved", authority: "offline_decision_axis_contract" }
    : state === "CONFLICT_BLOCKED"
      ? { evaluated: true, state: "HELD", reason: "evidence_conflict_not_resolved_by_shadow", authority: "offline_decision_axis_contract" }
      : { evaluated: Boolean(axisRecord), state: axisRecord ? "PASS_SHADOW_ONLY" : "NOT_EVALUATED", reason: axisRecord ? "no_new_production_constraint_activated" : "no_approved_axis_input", authority: "offline_decision_axis_contract" };

  const utility = constraint.state === "BLOCKED"
    ? { evaluated: false, state: "BLOCKED_BY_CONSTRAINT", numeric_contribution: null, reason: "utility_cannot_override_constraint" }
    : state === "HELD_UNCALIBRATED"
      ? { evaluated: true, state: "HELD_UNCALIBRATED", numeric_contribution: null, reason: "axis_estimate_null_no_numeric_policy_authorized" }
      : { evaluated: false, state: "NOT_EVALUATED", numeric_contribution: null, reason: state.toLowerCase() };

  const eligibilityValue = typeof scoredProduct?.eligible === "boolean"
    ? scoredProduct.eligible
    : typeof scoredProduct?.decision_meta?.eligible === "boolean"
      ? scoredProduct.decision_meta.eligible
      : null;

  return {
    scenario_id: scenario.id,
    product_id: String(rawProduct?.id ?? scoredProduct?.id),
    legacy: {
      score: scoredProduct?.score ?? scoredProduct?.engine_score ?? null,
      engine_score: scoredProduct?.engine_score ?? null,
      rank: legacyRank,
      eligibility: eligibilityValue,
      top_pick: String(rawProduct?.id ?? scoredProduct?.id) === String(topPickId),
      top3: top3Ids.has(String(rawProduct?.id ?? scoredProduct?.id)),
    },
    user_context: {
      primary_concern: answers.mainConcern ?? null,
      concern_axes: userConcernSet(answers),
      relevant_product_axis_keys: relevantKeys,
      skin_type: answers.skinType ?? null,
      sensitivity: answers.sensitivity ?? null,
      conditions: {
        very_sensitive_period: answers.verySensitivePeriod === true,
        outdoor_exposure: answers.outdoorExposure === true,
        sunscreen_intent: answers.sunscreenIntent === true,
      },
    },
    product_axis_inputs: axes,
    applicable_product_axes: applicableAxes.map((axis) => axis.axis_key),
    catalog_adoption: axisRecord ? (axisRecord.catalog_adopted ? "ADOPTED" : "NOT_CATALOG_ADOPTED") : "NO_APPROVED_AXIS_INPUT",
    fixture_boundary: axisRecord ? { fixture_only: true, hosted_current: false } : null,
    constraints: constraint,
    utility,
    duplication: buildDuplication({ rawProduct, axisRecord, answers }),
    lineage: applicableAxes.map(axisLineage),
    shadow: {
      state,
      rank: null,
      score: null,
      numeric_policy_authorized: false,
      hold_reasons: state === "HELD_UNCALIBRATED" ? ["approved_axis_present_but_numeric_magnitude_uncalibrated"] : [state.toLowerCase()],
    },
  };
}

export function assertConstraintUtilitySeparation(evaluation) {
  if (evaluation.constraints.state === "BLOCKED") {
    invariant(evaluation.utility.state === "BLOCKED_BY_CONSTRAINT", "blocked constraint revived by utility");
    invariant(evaluation.shadow.score === null && evaluation.shadow.rank === null, "blocked candidate received shadow ranking");
  }
  invariant(evaluation.utility.numeric_contribution === null, "uncalibrated utility contribution must remain null");
  return true;
}
