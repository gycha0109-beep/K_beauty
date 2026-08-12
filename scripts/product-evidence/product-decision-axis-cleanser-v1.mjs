import { sha256Json } from "./product-fact-current-resolver-v1.mjs";

export const VERSION = "product-decision-axis-cleanser-v1";
export const ARCHITECTURE_VERSION = "product-evidence-decision-axis-v1";
export const FACT_KEYS = Object.freeze(["low_ph", "deep_cleansing"]);
export const AXIS_KEYS = Object.freeze([
  "cleansing_burden",
  "hydration_preservation",
  "irritation_burden",
  "sebum_pore_control",
]);
export const ESTIMATE_BOUNDS = Object.freeze({ min: 0, max: 1 });
export const COVERAGE_VALUES = Object.freeze([
  "claim_only",
  "indirect_fact_only",
  "authority_limited",
  "explicit_negative_fact",
  "conflict_blocked",
  "insufficient_fact",
  "missing_fact",
  "no_relevant_fact",
  "direct_measurement",
  "corroborated_fact",
]);

const AUTHORITY_RANK = Object.freeze({
  none: 0,
  legacy_unreviewed: 1,
  ingredient_basis: 2,
  review_observation: 3,
  limited_non_product_specific: 4,
  product_specific_primary: 5,
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function factByKey(resolvedFacts, key) {
  return resolvedFacts.facts.find((item) => item.fact_key === key) ?? null;
}

function factInput(fact) {
  if (!fact) return null;
  return {
    fact_key: fact.fact_key,
    presence: fact.presence,
    semantic_status: fact.semantic_status,
    value_type: fact.value_type,
    typed_value: fact.typed_value,
    authority_ceiling: fact.authority_ceiling,
    fused_confidence: fact.fused_confidence,
    registry_version: fact.registry_version,
    fusion_policy_version: fact.fusion_policy_version,
    fusion_input_digest: fact.fusion_input_digest,
    provenance: fact.provenance,
  };
}

export function conservativeAuthority(facts) {
  const authorities = facts
    .filter(Boolean)
    .map((fact) => fact.authority_ceiling ?? "none");
  if (authorities.length === 0) return "none";
  return authorities.reduce((weakest, candidate) => {
    invariant(Object.hasOwn(AUTHORITY_RANK, candidate), `unknown authority ${candidate}`);
    return AUTHORITY_RANK[candidate] < AUTHORITY_RANK[weakest] ? candidate : weakest;
  }, authorities[0]);
}

export function validateBoundedEstimate(estimate) {
  if (estimate === null) return null;
  invariant(Number.isFinite(estimate), "axis estimate must be finite or null");
  invariant(estimate >= ESTIMATE_BOUNDS.min && estimate <= ESTIMATE_BOUNDS.max, "axis estimate out of bounds");
  return estimate;
}

export function makeAxisResult({ productId, axisKey, estimate = null, coverage, authorityCeiling, reasonCodes, facts = [] }) {
  invariant(AXIS_KEYS.includes(axisKey), `unknown axis ${axisKey}`);
  invariant(COVERAGE_VALUES.includes(coverage), `unknown coverage ${coverage}`);
  invariant(Object.hasOwn(AUTHORITY_RANK, authorityCeiling), `unknown axis authority ${authorityCeiling}`);
  invariant(Array.isArray(reasonCodes) && reasonCodes.length > 0, "axis reason_codes required");
  validateBoundedEstimate(estimate);
  invariant(estimate === null, "cleanser v1 numeric magnitude is not calibrated");
  const inputs = facts.filter(Boolean).map(factInput);
  const inputAuthority = conservativeAuthority(facts.filter(Boolean));
  invariant(AUTHORITY_RANK[authorityCeiling] <= AUTHORITY_RANK[inputAuthority] || inputAuthority === "none", "axis authority exceeds input Fact authority");
  if (inputAuthority === "none") invariant(authorityCeiling === "none", "axis without authoritative input must remain authority none");

  return {
    axis_key: axisKey,
    estimate,
    coverage,
    uncertainty: "high",
    authority_ceiling: authorityCeiling,
    mapper_version: VERSION,
    mapper_input_digest: sha256Json({ product_id: productId, axis_key: axisKey, fact_inputs: inputs }),
    reason_codes: [...reasonCodes],
    fact_inputs: inputs,
  };
}

function nonSupportedCoverage(fact) {
  if (!fact || fact.presence === "missing_current") return "missing_fact";
  if (fact.semantic_status === "evidence_conflict") return "conflict_blocked";
  return "insufficient_fact";
}

function nonSupportedReasons(fact) {
  if (!fact || fact.presence === "missing_current") return ["current_fact_missing_not_false"];
  if (fact.semantic_status === "evidence_conflict") return ["evidence_conflict_not_resolved_by_mapper"];
  if (fact.semantic_status === "reviewed_not_established") return ["reviewed_not_established_preserved_not_false"];
  if (fact.semantic_status === "evidence_insufficient") return ["evidence_insufficient_preserved"];
  if (fact.semantic_status === "not_reviewed") return ["not_reviewed_preserved"];
  return ["fact_not_usable_for_axis"];
}

function mapDeepClaimAxis(resolvedFacts, axisKey) {
  const deep = factByKey(resolvedFacts, "deep_cleansing");
  const common = {
    productId: resolvedFacts.product_id,
    axisKey,
    estimate: null,
    authorityCeiling: deep?.authority_ceiling ?? "none",
    facts: deep ? [deep] : [],
  };

  if (!deep || deep.presence === "missing_current" || deep.semantic_status !== "supported") {
    return makeAxisResult({
      ...common,
      coverage: nonSupportedCoverage(deep),
      reasonCodes: nonSupportedReasons(deep),
    });
  }

  if (deep.typed_value === false) {
    return makeAxisResult({
      ...common,
      coverage: "explicit_negative_fact",
      reasonCodes: [
        "supported_false_preserved_as_explicit_negative_fact",
        axisKey === "cleansing_burden"
          ? "deep_cleansing_false_does_not_calibrate_cleansing_burden"
          : "deep_cleansing_false_does_not_calibrate_sebum_pore_control",
      ],
    });
  }

  invariant(deep.typed_value === true, "deep_cleansing supported value must be Boolean");
  const limited = deep.authority_ceiling !== "product_specific_primary";
  return makeAxisResult({
    ...common,
    coverage: limited ? "authority_limited" : "claim_only",
    reasonCodes: [
      axisKey === "cleansing_burden"
        ? "deep_cleansing_claim_is_relevant_but_not_burden_magnitude"
        : "deep_cleansing_claim_is_relevant_but_not_sebum_pore_effect_magnitude",
      ...(limited ? ["axis_authority_limited_by_input_fact"] : []),
    ],
  });
}

function mapHydrationAxis(resolvedFacts) {
  const lowPh = factByKey(resolvedFacts, "low_ph");
  const common = {
    productId: resolvedFacts.product_id,
    axisKey: "hydration_preservation",
    estimate: null,
    authorityCeiling: lowPh?.authority_ceiling ?? "none",
    facts: lowPh ? [lowPh] : [],
  };

  if (!lowPh || lowPh.presence === "missing_current" || lowPh.semantic_status !== "supported") {
    return makeAxisResult({ ...common, coverage: nonSupportedCoverage(lowPh), reasonCodes: nonSupportedReasons(lowPh) });
  }

  if (lowPh.typed_value === false) {
    return makeAxisResult({
      ...common,
      coverage: "explicit_negative_fact",
      reasonCodes: ["supported_false_preserved_as_explicit_negative_fact", "low_ph_false_does_not_establish_hydration_loss_magnitude"],
    });
  }

  invariant(lowPh.typed_value === true, "low_ph supported value must be Boolean");
  const limited = lowPh.authority_ceiling !== "product_specific_primary";
  return makeAxisResult({
    ...common,
    coverage: limited ? "authority_limited" : "indirect_fact_only",
    reasonCodes: [
      "low_ph_is_indirect_relevance_not_hydration_preservation_magnitude",
      ...(limited ? ["axis_authority_limited_by_input_fact"] : []),
    ],
  });
}

function mapIrritationAxis(resolvedFacts) {
  return makeAxisResult({
    productId: resolvedFacts.product_id,
    axisKey: "irritation_burden",
    estimate: null,
    coverage: "no_relevant_fact",
    authorityCeiling: "none",
    reasonCodes: [
      "no_irritation_fact_in_cleanser_v1_registry",
      "low_ph_not_reinterpreted_as_low_irritation",
    ],
    facts: [],
  });
}

export function mapCleanserDecisionAxes(resolvedFacts) {
  invariant(resolvedFacts && typeof resolvedFacts === "object", "resolved Product Facts required");
  invariant(typeof resolvedFacts.product_id === "string" && resolvedFacts.product_id.length > 0, "resolved product_id required");
  invariant(Array.isArray(resolvedFacts.facts), "resolved facts array required");
  return AXIS_KEYS.map((axisKey) => {
    if (axisKey === "cleansing_burden") return mapDeepClaimAxis(resolvedFacts, axisKey);
    if (axisKey === "hydration_preservation") return mapHydrationAxis(resolvedFacts);
    if (axisKey === "irritation_burden") return mapIrritationAxis(resolvedFacts);
    if (axisKey === "sebum_pore_control") return mapDeepClaimAxis(resolvedFacts, axisKey);
    throw new Error(`unreachable axis ${axisKey}`);
  });
}
