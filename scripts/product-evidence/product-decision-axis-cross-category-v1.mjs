import { sha256Json } from "./product-fact-current-resolver-v1.mjs";

export const VERSION = "product-decision-axis-cross-category-v1";
export const AXIS_KEYS = Object.freeze(["photo_protection", "barrier_support", "exfoliation_load"]);
export const ESTIMATE_BOUNDS = Object.freeze({ min: 0, max: 1 });
export const COVERAGE_VALUES = Object.freeze([
  "corroborated_fact",
  "partial_fact_coverage",
  "claim_only",
  "active_identity_with_unscaled_context",
  "active_identity_only",
  "authority_limited",
  "no_relevant_fact",
  "missing_fact",
  "insufficient_fact",
  "conflict_blocked",
  "identity_blocked",
]);

const AUTHORITY_RANK = Object.freeze({ none: 0, legacy_unreviewed: 1, ingredient_basis: 2, review_observation: 3, limited_non_product_specific: 4, product_specific_primary: 5 });
const EXFOLIATING_ACTIVES = new Set(["mandelic_acid", "lactic_acid", "salicylic_acid"]);

function invariant(condition, message) { if (!condition) throw new Error(message); }
function group(resolved, factKey) { return resolved.groups.find((item) => item.fact_key === factKey) ?? null; }
function facts(resolved, factKey) { return group(resolved, factKey)?.facts ?? []; }
function supported(resolved, factKey) { return facts(resolved, factKey).filter((fact) => fact.semantic_status === "supported"); }
function statuses(resolved, factKey) { return facts(resolved, factKey).map((fact) => fact.semantic_status); }
function weakestAuthority(inputFacts) {
  if (!inputFacts.length) return "none";
  return inputFacts.reduce((weakest, fact) => AUTHORITY_RANK[fact.authority_ceiling] < AUTHORITY_RANK[weakest] ? fact.authority_ceiling : weakest, inputFacts[0].authority_ceiling);
}
function compactFact(fact) {
  return {
    fact_key: fact.fact_key,
    semantic_status: fact.semantic_status,
    typed_value: fact.typed_value,
    authority_ceiling: fact.authority_ceiling,
    fused_confidence: fact.fused_confidence,
    proposition_key: fact.proposition_key,
    scope: fact.scope,
    qualifier: fact.qualifier,
    parent_proposition_key: fact.parent_proposition_key,
    parent_fact_instance_id: fact.parent_fact_instance_id,
    provenance: fact.provenance,
  };
}
function family(name, inputFacts) {
  const refs = [...new Set(inputFacts.map((fact) => fact.proposition_key))].sort();
  return { signal_family: name, raw_fact_count: inputFacts.length, unique_lineage_count: refs.length, contribution_units: inputFacts.length ? 1 : 0, proposition_keys: refs };
}
function makeAxis({ resolved, axisKey, coverage, reasonCodes, inputFacts = [], families = [] }) {
  invariant(AXIS_KEYS.includes(axisKey), `unknown axis ${axisKey}`);
  invariant(COVERAGE_VALUES.includes(coverage), `unknown coverage ${coverage}`);
  const authority = weakestAuthority(inputFacts);
  const factInputs = inputFacts.map(compactFact);
  const scopeSet = [...new Set(inputFacts.map((fact) => JSON.stringify(fact.scope)))].map((value) => JSON.parse(value));
  return {
    axis_key: axisKey,
    estimate: null,
    coverage,
    uncertainty: "high",
    authority_ceiling: authority,
    mapper_version: VERSION,
    mapper_input_digest: sha256Json({ product_id: resolved.product_id, axis_key: axisKey, fact_inputs: factInputs, signal_families: families }),
    reason_codes: reasonCodes,
    fact_inputs: factInputs,
    signal_families: families,
    scope_set: scopeSet,
  };
}
function blockedAxis(resolved, axisKey) {
  return makeAxis({ resolved, axisKey, coverage: "identity_blocked", reasonCodes: ["subject_identity_not_resolved_no_current_projection"] });
}
function nonSupportedCoverage(resolved, keys) {
  const allStatuses = keys.flatMap((key) => statuses(resolved, key));
  if (allStatuses.includes("evidence_conflict")) return "conflict_blocked";
  if (allStatuses.length) return "insufficient_fact";
  return "missing_fact";
}

function mapPhotoProtection(resolved) {
  if (resolved.identity_blocked) return blockedAxis(resolved, "photo_protection");
  const spf = supported(resolved, "spf_value");
  const uva = supported(resolved, "uva_label");
  const filter = supported(resolved, "uv_filter_type");
  const water = supported(resolved, "water_resistance_duration");
  const inputs = [...spf, ...uva, ...filter, ...water];
  if (!inputs.length) return makeAxis({ resolved, axisKey: "photo_protection", coverage: nonSupportedCoverage(resolved, ["spf_value", "uva_label", "uv_filter_type", "water_resistance_duration"]), reasonCodes: ["no_supported_protection_fact_missing_not_false"] });
  const coverage = spf.length && uva.length ? "corroborated_fact" : "partial_fact_coverage";
  return makeAxis({
    resolved,
    axisKey: "photo_protection",
    coverage,
    inputFacts: inputs,
    families: [family("labelled_uv_protection", [...spf, ...uva]), ...(filter.length ? [family("uv_filter_identity", filter)] : []), ...(water.length ? [family("water_resistance", water)] : [])],
    reasonCodes: [
      "protection_labels_preserved_without_uncalibrated_numeric_axis",
      "market_variant_scope_preserved_per_fact",
      ...(water.length ? [] : ["water_resistance_missing_does_not_negate_uv_protection"]),
    ],
  });
}

function mapBarrierSupport(resolved) {
  if (resolved.identity_blocked) return blockedAxis(resolved, "barrier_support");
  const claims = supported(resolved, "barrier_support_claim");
  const roles = supported(resolved, "primary_use_role");
  if (!claims.length) {
    const context = resolved.review_context?.barrier_support_claim;
    return makeAxis({ resolved, axisKey: "barrier_support", coverage: nonSupportedCoverage(resolved, ["barrier_support_claim"]), reasonCodes: [context?.outcome === "source_blocked" ? "source_blocked_preserved_as_missing_fact_not_false" : "barrier_support_not_established", ...(roles.length ? ["usage_role_not_reinterpreted_as_efficacy"] : [])], inputFacts: [] });
  }
  return makeAxis({
    resolved,
    axisKey: "barrier_support",
    coverage: claims[0].authority_ceiling === "product_specific_primary" ? "claim_only" : "authority_limited",
    inputFacts: claims,
    families: [family("barrier_support_claim", claims)],
    reasonCodes: ["barrier_claim_is_relevant_but_not_measured_magnitude", ...(roles.length ? ["usage_role_context_excluded_from_efficacy_contribution"] : [])],
  });
}

function mapExfoliationLoad(resolved) {
  if (resolved.identity_blocked) return blockedAxis(resolved, "exfoliation_load");
  const activeFacts = supported(resolved, "contains_active");
  const relevant = activeFacts.filter((fact) => EXFOLIATING_ACTIVES.has(fact.typed_value));
  if (!relevant.length) {
    const containsGroup = group(resolved, "contains_active");
    const context = resolved.review_context?.contains_active;
    const coverage = containsGroup?.presence === "missing_current" ? "missing_fact" : "no_relevant_fact";
    return makeAxis({ resolved, axisKey: "exfoliation_load", coverage, reasonCodes: [context?.outcome === "source_blocked" ? "source_blocked_preserved_as_missing_fact_not_false" : "no_exfoliating_active_identity_fact", "non_exfoliating_active_or_concentration_not_generic_load"] });
  }
  const concentrationFacts = supported(resolved, "active_concentration").filter((concentration) => relevant.some((active) => concentration.parent_fact_instance_id === active.provenance?.frozen_fact_instance_id || concentration.parent_proposition_key === active.proposition_key));
  const useFacts = supported(resolved, "recommended_use_frequency");
  const context = [...concentrationFacts, ...useFacts];
  return makeAxis({
    resolved,
    axisKey: "exfoliation_load",
    coverage: context.length ? "active_identity_with_unscaled_context" : "active_identity_only",
    inputFacts: [...relevant, ...context],
    families: [family("exfoliating_active_identity", relevant), ...(concentrationFacts.length ? [family("active_concentration_context", concentrationFacts)] : []), ...(useFacts.length ? [family("usage_frequency_context", useFacts)] : [])],
    reasonCodes: ["active_identity_relevant_but_not_exfoliation_intensity", ...(concentrationFacts.length ? ["concentration_preserved_as_context_not_generic_effect_magnitude"] : ["active_concentration_not_established_not_zero"]), ...(useFacts.length ? ["usage_instruction_preserved_not_efficacy"] : []), ...(supported(resolved, "product_format").length || supported(resolved, "wipe_off_use").length || supported(resolved, "pad_surface_texture").length ? ["format_usage_surface_not_reinterpreted_as_skin_effect_magnitude"] : [])],
  });
}

export function mapCrossCategoryDecisionAxis(resolved) {
  invariant(resolved && typeof resolved === "object", "resolved fixture required");
  if (resolved.domain === "sunscreen") return mapPhotoProtection(resolved);
  if (resolved.domain?.startsWith("moisturizer")) return mapBarrierSupport(resolved);
  if (resolved.domain === "treatment" || resolved.domain === "toner_pad" || resolved.domain === "toner_essence") return mapExfoliationLoad(resolved);
  throw new Error(`unsupported V2.1-6 domain ${resolved.domain}`);
}
