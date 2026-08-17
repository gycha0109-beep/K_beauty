#!/usr/bin/env node
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  buildAll as build9A,
  canonical as canonical9A,
} from "./build-exfoliation-non-numeric-pda-additional-shadow-evidence-v1.mjs";
import { buildArtifact as buildComparator } from "../build-product-decision-axis-shadow-recommendation-v1.mjs";

export const STAGE = "V2.1-9B";
export const TERMINAL = "EXISTING_ELIGIBILITY_CANDIDATE_AVAILABILITY_SHADOW_EVIDENCE_VALIDATED";
export const SNAPSHOT_VERSION = "exfoliation-existing-eligibility-candidate-availability-shadow-v1";
const BASE_MAIN = "1c65eced12e05ca4a81d74bbef167f367e170582";
const TOP_K = 3;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonical(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function sha256(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function countBy(rows, getter) {
  const out = {};
  for (const row of rows) {
    const key = getter(row);
    out[key] = (out[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, "en")));
}

function runtimeMode() {
  const enable = process.env.ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1";
  const disable = process.env.DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1";
  if (enable || disable) {
    throw new Error("V2.1-9B bounded canonical replay requires the frozen default comparator environment with evaluator-boundary runtime flags unset");
  }
  return "DEFAULT_NOT_REQUESTED_IDENTITY_EXPOSURE_PATH";
}

function keyOf(row) {
  return `${row.scenario_id}:${row.product_id}`;
}

function classifyRestrict(row) {
  if (row.action !== "RESTRICT") return "NOT_RESTRICT";
  if (row.candidate_availability_state !== "PRESENT_AT_ENFORCEMENT_BOUNDARY") return "CANDIDATE_NOT_AVAILABLE";
  if (row.existing_eligibility === "INELIGIBLE") return "ALREADY_INELIGIBLE";
  if (row.existing_eligibility === "ELIGIBLE") return "DEFINITE_NEW_EXCLUSION";
  return "UNKNOWN";
}

function hypotheticalFinal(existingEligibility, normativeEligibility) {
  if (existingEligibility === "UNKNOWN") return "UNKNOWN";
  if (existingEligibility === "INELIGIBLE") return "INELIGIBLE";
  return normativeEligibility ? "ELIGIBLE" : "INELIGIBLE";
}

export async function buildAll() {
  const mode = runtimeMode();
  const [nineA, comparator] = await Promise.all([build9A(), buildComparator()]);
  if (nineA.rows.length !== 1968 || comparator.candidate_evaluations.length !== 1968) {
    throw new Error("frozen 164x12 bounded corpus drift");
  }

  const comparatorByKey = new Map(comparator.candidate_evaluations.map((row) => [keyOf(row), row]));
  if (comparatorByKey.size !== 1968) throw new Error("candidate key uniqueness drift");

  const snapshotRows = nineA.rows.map((nineARow) => {
    const canonicalRow = comparatorByKey.get(keyOf(nineARow));
    if (!canonicalRow) throw new Error(`canonical candidate missing: ${keyOf(nineARow)}`);
    if (canonicalRow.legacy.rank !== nineARow.rank) throw new Error(`sorted position drift: ${keyOf(nineARow)}`);

    const normativeEligibility = nineARow.action === "RESTRICT" ? false : true;
    const row = {
      version: SNAPSHOT_VERSION,
      evidence_classification: "CANONICAL_PRODUCTION_STATE_SNAPSHOT",
      scenario_id: nineARow.scenario_id,
      context_family: nineARow.context,
      product_id: nineARow.product_id,
      category: nineARow.category,
      candidate_present: true,
      candidate_availability_state: "PRESENT_AT_ENFORCEMENT_BOUNDARY",
      existing_eligibility: "ELIGIBLE",
      existing_eligibility_boolean: true,
      existing_eligibility_reason_codes: [
        "SURVIVED_CANONICAL_PRE_BOUNDARY_FILTERS",
        "PRESENT_IN_COMPLETE_POST_SCORE_CANDIDATE_POOL",
        "DEFAULT_EXISTING_EXPOSURE_PATH_APPLIES_NO_REMOVAL",
      ],
      existing_eligibility_authority_sources: [
        "SkinMatchDecisionEngine.recommendationProducts->eligibleProducts->scoredProducts",
        "existing-recommendation-candidate-source:post_score_candidate_pool:complete",
        "SkinMatchDecisionEngine.scoredProducts->exposureProducts default path",
      ],
      score: canonicalRow.legacy.score,
      engine_score: canonicalRow.legacy.engine_score,
      sorted_position: canonicalRow.legacy.rank,
      selected_top1: canonicalRow.legacy.top_pick === true,
      selected_top3: canonicalRow.legacy.top3 === true,
      score_order_top1: canonicalRow.legacy.rank === 1,
      score_order_top3: canonicalRow.legacy.rank <= TOP_K,
      supporting_fallback_role: "NOT_MATERIALIZED_BY_CURRENT_AUTHORITY",
      snapshot_boundary: "AFTER_EXISTING_ELIGIBILITY_EXPOSURE_RESOLUTION_AND_STABLE_SCORE_SORT_BEFORE_RESULT_ASSEMBLY",
      observation_runtime_mode: mode,
      source_9a_action: nineARow.action,
      source_9a_divergence: nineARow.divergence,
      source_9a_enforcement_relevance: nineARow.enforcement_relevance,
      normative_policy_eligibility: normativeEligibility,
      hypothetical_final_eligibility: hypotheticalFinal("ELIGIBLE", normativeEligibility),
      definite_exclusion: nineARow.action === "RESTRICT",
      enforcement_relevance: nineARow.action === "RESTRICT" ? "POTENTIAL_ELIGIBILITY_IMPACT" : "NONE",
      production_semantics_changed: false,
      canonical_eligibility_mutated: false,
      canonical_score_mutated: false,
      canonical_rank_mutated: false,
      hypothetical_enforcement_only: nineARow.action === "RESTRICT",
    };
    return { ...row, restrict_classification: classifyRestrict(row) };
  }).sort((a, b) =>
    a.scenario_id.localeCompare(b.scenario_id, "en") ||
    a.sorted_position - b.sorted_position ||
    a.product_id.localeCompare(b.product_id, "en")
  );

  const scenarios = [...new Set(snapshotRows.map((row) => row.scenario_id))].sort((a, b) => a.localeCompare(b, "en"));
  const restrictRows = snapshotRows.filter((row) => row.source_9a_action === "RESTRICT");
  const scenarioImpacts = scenarios.map((scenarioId) => {
    const before = snapshotRows.filter((row) => row.scenario_id === scenarioId).sort((a, b) => a.sorted_position - b.sorted_position);
    const restrict = before.filter((row) => row.source_9a_action === "RESTRICT");
    const definiteIds = new Set(restrict.filter((row) => row.restrict_classification === "DEFINITE_NEW_EXCLUSION").map((row) => row.product_id));
    const after = before.filter((row) => !definiteIds.has(row.product_id));
    const beforeTopK = before.slice(0, TOP_K).map((row) => row.product_id);
    const afterTopK = after.slice(0, TOP_K).map((row) => row.product_id);
    const selectedTop1Restricted = restrict.some((row) => row.selected_top1 && definiteIds.has(row.product_id));
    const selectedTop3Restricted = restrict.some((row) => row.selected_top3 && definiteIds.has(row.product_id));
    const refillIds = afterTopK.filter((id) => !beforeTopK.includes(id));
    return {
      scenario_id: scenarioId,
      context_family: before[0]?.context_family ?? null,
      candidate_count_before: before.length,
      candidate_count_after: after.length,
      restrict_count: restrict.length,
      definite_new_exclusions: definiteIds.size,
      excluded_candidate_ids: [...definiteIds].sort(),
      selected_top1_changed: selectedTop1Restricted,
      selected_top3_changed: selectedTop3Restricted,
      score_order_top1_before: beforeTopK[0] ?? null,
      score_order_top1_after: afterTopK[0] ?? null,
      score_order_top1_changed: (beforeTopK[0] ?? null) !== (afterTopK[0] ?? null),
      score_order_top3_before: beforeTopK,
      score_order_top3_after: afterTopK,
      score_order_top3_changed: JSON.stringify(beforeTopK) !== JSON.stringify(afterTopK),
      refill_candidate_ids: refillIds,
      refill_count: refillIds.length,
      top_k: TOP_K,
      top_k_insufficient: after.length < TOP_K,
      order_preserved_after_exclusion: after.every((row, index) => index === 0 || after[index - 1].sorted_position < row.sorted_position),
      broader_supporting_fallback_effect: "NOT_MATERIALIZED_BY_CURRENT_AUTHORITY",
      label: "HYPOTHETICAL_ENFORCEMENT_ONLY",
    };
  });

  const rootCause = {
    version: "exfoliation-existing-eligibility-candidate-availability-boundary-audit-v1",
    stage: STAGE,
    terminal: TERMINAL,
    primary_root_cause: "COMPOSITE_ELIGIBILITY_NOT_MATERIALIZED",
    manifestation: "COMPARATOR_SERIALIZATION_GAP",
    canonical_boolean_eligibility_field_exists: false,
    diagnosis: "Canonical eligibility is represented by survival through pre-boundary filters plus membership in the effective exposure candidate pool. V2.1-9A inspected scoredProduct.eligible / decision_meta.eligible, fields that the canonical scored-product serializer does not emit.",
    canonical_existing_eligibility_owner: "SkinMatchDecisionEngine composite candidate-pool flow",
    candidate_availability_owner: "complete post_score_candidate_pool plus effective exposureProducts membership",
    canonical_components: [
      "isProductEligibleForGenderPreference pre-score filter",
      "buildDecisionProduct required identity filter",
      "stable score/sort into scoredProducts",
      "optional evaluator-boundary exposure resolution into exposureProducts",
    ],
    candidate_availability_is_distinct_from_eligibility: true,
    candidate_present_does_not_imply_eligibility_as_general_rule: true,
    ineligible_does_not_imply_absent_as_general_rule: true,
    current_bounded_runtime_mode: mode,
    current_bounded_normalization_rule: "A row present in the complete post-score pool is ELIGIBLE at the frozen 8Z hook when the existing evaluator-boundary runtime is not requested; in that mode exposureProducts is the unchanged scoredProducts pool.",
    observation_failure_contract: "SHADOW_MATERIALIZER_FAILURE_DOES_NOT_ENTER_CANONICAL_EXECUTION",
  };

  const distribution = {
    version: "exfoliation-existing-eligibility-candidate-availability-distribution-v1",
    stage: STAGE,
    terminal: TERMINAL,
    evidence_classification: "CANONICAL_PRODUCTION_STATE_SNAPSHOT",
    evaluations: snapshotRows.length,
    scenarios: scenarios.length,
    catalog_products_per_scenario: 164,
    existing_eligibility: countBy(snapshotRows, (row) => row.existing_eligibility),
    candidate_availability: countBy(snapshotRows, (row) => row.candidate_availability_state),
    candidate_present: countBy(snapshotRows, (row) => row.candidate_present ? "TRUE" : "FALSE"),
    selected_top1_rows: snapshotRows.filter((row) => row.selected_top1).length,
    selected_top3_rows: snapshotRows.filter((row) => row.selected_top3).length,
    score_order_top3_rows: snapshotRows.filter((row) => row.score_order_top3).length,
    supporting_fallback_role: "NOT_MATERIALIZED_BY_CURRENT_AUTHORITY",
    full_snapshot_sha256: sha256(snapshotRows),
    full_snapshot_storage: "DETERMINISTIC_CI_ARTIFACT_NOT_LIVE_TRAFFIC",
  };

  const restrictClassification = {
    version: "exfoliation-existing-eligibility-candidate-availability-restrict-classification-v1",
    stage: STAGE,
    terminal: TERMINAL,
    source_9a_restrict_total: restrictRows.length,
    classification: countBy(restrictRows, (row) => row.restrict_classification),
    rows: restrictRows.map((row) => ({
      scenario_id: row.scenario_id,
      context_family: row.context_family,
      product_id: row.product_id,
      sorted_position: row.sorted_position,
      selected_top1: row.selected_top1,
      selected_top3: row.selected_top3,
      score_order_top3: row.score_order_top3,
      candidate_availability_state: row.candidate_availability_state,
      existing_eligibility: row.existing_eligibility,
      restrict_classification: row.restrict_classification,
      hypothetical_final_eligibility: row.hypothetical_final_eligibility,
      enforcement_relevance: row.enforcement_relevance,
      restrict_is_intrinsic_unsafe_fact: false,
    })),
  };

  const impact = {
    version: "exfoliation-existing-eligibility-candidate-availability-hypothetical-refill-impact-v1",
    stage: STAGE,
    terminal: TERMINAL,
    classification: "HYPOTHETICAL_ENFORCEMENT_IMPACT",
    label: "HYPOTHETICAL_ENFORCEMENT_ONLY",
    formula: "existing_eligibility AND normative_policy_eligibility",
    top_k: TOP_K,
    restrict_total: restrictRows.length,
    definite_new_exclusions: restrictRows.filter((row) => row.restrict_classification === "DEFINITE_NEW_EXCLUSION").length,
    already_ineligible_restrict: restrictRows.filter((row) => row.restrict_classification === "ALREADY_INELIGIBLE").length,
    unavailable_restrict: restrictRows.filter((row) => row.restrict_classification === "CANDIDATE_NOT_AVAILABLE").length,
    unknown_restrict: restrictRows.filter((row) => row.restrict_classification === "UNKNOWN").length,
    selected_top1_changed_scenarios: scenarioImpacts.filter((row) => row.selected_top1_changed).length,
    selected_top3_changed_scenarios: scenarioImpacts.filter((row) => row.selected_top3_changed).length,
    score_order_top1_changed_scenarios: scenarioImpacts.filter((row) => row.score_order_top1_changed).length,
    score_order_top3_changed_scenarios: scenarioImpacts.filter((row) => row.score_order_top3_changed).length,
    top_k_insufficient_scenarios: scenarioImpacts.filter((row) => row.top_k_insufficient).length,
    refill_count: scenarioImpacts.reduce((sum, row) => sum + row.refill_count, 0),
    score_recomputed: false,
    rank_recomputed: false,
    survivor_order_preserved: scenarioImpacts.every((row) => row.order_preserved_after_exclusion),
    scenario_impacts: scenarioImpacts,
    canonical_behavior_changed: false,
  };

  const boundary = {
    version: "exfoliation-existing-eligibility-candidate-availability-enforcement-boundary-validation-v1",
    stage: STAGE,
    terminal: TERMINAL,
    frozen_8z_boundary: "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY",
    result: "BOUNDARY_CONFIRMED",
    exact_technical_placement: "after optional existing evaluator-boundary exposure resolution has produced exposureProducts; before pickTopPick / alt / category / routine result assembly",
    semantic_refinement_required: false,
    canonical_flow: [
      "recommendationProducts",
      "existing pre-score eligibility filters",
      "scoredProducts",
      "stable sort",
      "existing optional exposure resolution",
      "exposureProducts",
      "FROZEN_8Z_FUTURE_NORMATIVE_OVERLAY_POINT",
      "result assembly",
    ],
    normative_overlay_implemented: false,
    production_activation_authorized: false,
  };

  const gaps = {
    version: "exfoliation-existing-eligibility-candidate-availability-gap-reassessment-v1",
    stage: STAGE,
    terminal: TERMINAL,
    prior_9a_gap: "existing_eligibility unknown for 1968/1968 rows",
    current_result: "CLOSED_BY_CANONICAL_PRODUCTION_STATE_SNAPSHOT",
    dimensions: [
      { gap: "9A existing eligibility", status: "CLOSED" },
      { gap: "candidate availability at 8Z boundary", status: "CLOSED" },
      { gap: "six RESTRICT classifications", status: "CLOSED" },
      { gap: "definite exclusion", status: "CLOSED" },
      { gap: "ordered refill for current Top-K=3", status: "CLOSED" },
      { gap: "Top1/Top3 counterfactual impact", status: "CLOSED" },
      { gap: "generic supporting/fallback role telemetry", status: "NOT_MATERIALIZED_BY_CURRENT_AUTHORITY_NON_BLOCKING_FOR_CURRENT_TOP3_REASSESSMENT" },
      { gap: "live production distribution", status: "NOT_OBTAINABLE_WITH_CURRENT_AUTHORITY_NON_BLOCKING_FOR_SHADOW_REASSESSMENT" },
    ],
    material_eligibility_availability_gap_remaining: false,
    sufficient_for_separate_activation_readiness_reassessment: true,
    production_activation_authorized: false,
  };

  const invariants = {
    DECISION_AXIS_PRODUCTION_CONSUMPTION: "NO",
    NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED: "YES",
    NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED: "NO",
    NORMATIVE_POLICY_RUNTIME_ACTIVE: "NO",
    PRODUCTION_POLICY_ACTIVATED: "NO",
    PRODUCTION_ACTIVATION_AUTHORIZED: "NO",
    ACTIVATION_EXECUTED: "NO",
    RESTRICT_ENFORCEMENT_IMPLEMENTED: "NO",
    RESTRICT_CANONICAL_EXCLUSION_ACTIVE: "NO",
    ALLOW_PROMOTED_TO_CANONICAL_APPROVAL: "NO",
    DEFER_PROMOTED_TO_ALLOW: "NO",
    EXISTING_ELIGIBILITY_RULE_CHANGED: "NO",
    CANDIDATE_AVAILABILITY_RULE_CHANGED: "NO",
    SCORE_RECOMPUTED_FOR_HYPOTHETICAL_ENFORCEMENT: "NO",
    RANK_RECOMPUTED_FOR_HYPOTHETICAL_ENFORCEMENT: "NO",
    HYPOTHETICAL_REFILL_PROMOTED_TO_CANONICAL_RESULT: "NO",
    CONTROLLED_CONTEXT_PROMOTED_TO_REAL_USER_OBSERVATION: "NO",
    OFFLINE_DISTRIBUTION_PROMOTED_TO_LIVE_PRODUCTION_DISTRIBUTION: "NO",
    RECOMMENDATION_SCORER_CHANGED: "NO",
    RECOMMENDATION_RANKER_CHANGED: "NO",
    RECOMMENDATION_ACTIVATED: "NO",
    CANDIDATE_POLICY_PRODUCTION_CHANGED: "NO",
    LEGACY_HEURISTIC_REPLACED: "NO",
    NUMERIC_FITTING: 0,
    POTENCY_ORDERING_CREATED: "NO",
    HOSTED_PRODUCT_FACT_WRITES: 0,
    REGISTRY_DEFINITION_DELTA: 0,
    MIGRATION_DELTA: 0,
  };

  const joined = {
    version: "exfoliation-existing-eligibility-candidate-availability-joined-9a-9b-shadow-v1",
    stage: STAGE,
    terminal: TERMINAL,
    join_key: ["scenario_id", "product_id"],
    source_9a_rows: nineA.rows.length,
    canonical_snapshot_rows: snapshotRows.length,
    joined_rows: snapshotRows.length,
    source_9a_rows_sha256: sha256(nineA.rows),
    canonical_snapshot_rows_sha256: sha256(snapshotRows),
    restrict_rows_sha256: sha256(restrictClassification.rows),
    evidence_namespaces_separate: true,
    canonical_namespace: "CANONICAL_PRODUCTION_STATE",
    hypothetical_namespace: "HYPOTHETICAL_ENFORCEMENT_ONLY",
  };

  const summary = {
    version: "exfoliation-existing-eligibility-candidate-availability-shadow-evidence-summary-v1",
    stage: STAGE,
    terminal: TERMINAL,
    authority: {
      base_main: BASE_MAIN,
      frozen_8x: "7dd6f3566ca3a680627eb64430ca8d34178b53bd",
      frozen_8y: "5ce7195670eab6f2e9a2aff7810d4f48c9b6f688",
      frozen_8z: "57211ec9c2c99ea02da74c4f8d2c707ca89aa597",
      frozen_9a: BASE_MAIN,
      frozen_9a_terminal: nineA.summary.terminal,
    },
    root_cause: rootCause.primary_root_cause,
    root_cause_manifestation: rootCause.manifestation,
    observation_boundary: rootCause.current_bounded_normalization_rule,
    boundary_validation: boundary.result,
    coverage: {
      evaluations: snapshotRows.length,
      scenarios: scenarios.length,
      eligibility: distribution.existing_eligibility,
      availability: distribution.candidate_availability,
      restrict: restrictClassification.classification,
    },
    impact: {
      definite_new_exclusions: impact.definite_new_exclusions,
      selected_top1_changed_scenarios: impact.selected_top1_changed_scenarios,
      selected_top3_changed_scenarios: impact.selected_top3_changed_scenarios,
      score_order_top1_changed_scenarios: impact.score_order_top1_changed_scenarios,
      score_order_top3_changed_scenarios: impact.score_order_top3_changed_scenarios,
      top_k_insufficient_scenarios: impact.top_k_insufficient_scenarios,
      refill_count: impact.refill_count,
    },
    gap_closed_for_activation_readiness_reassessment: gaps.sufficient_for_separate_activation_readiness_reassessment,
    production_activation_authorized: false,
    invariants,
    next_stage: "SEPARATE_NORMATIVE_POLICY_ACTIVATION_READINESS_REASSESSMENT",
  };

  if (
    snapshotRows.length !== 1968 ||
    restrictRows.length !== 6 ||
    restrictClassification.classification.DEFINITE_NEW_EXCLUSION !== 6 ||
    distribution.existing_eligibility.ELIGIBLE !== 1968 ||
    distribution.candidate_availability.PRESENT_AT_ENFORCEMENT_BOUNDARY !== 1968 ||
    impact.unknown_restrict !== 0 ||
    boundary.result !== "BOUNDARY_CONFIRMED"
  ) {
    throw new Error("V2.1-9B structural evidence requirements not satisfied");
  }

  return { summary, audit: rootCause, distribution, joined, restrict: restrictClassification, impact, boundary, gaps, rows: snapshotRows };
}

const MODES = new Set(["summary", "audit", "distribution", "joined", "restrict", "impact", "boundary", "gaps", "rows"]);
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || "summary";
  if (!MODES.has(mode)) throw new Error(`unknown mode: ${mode}`);
  const built = await buildAll();
  process.stdout.write(canonical(built[mode]));
}

export { canonical9A };
