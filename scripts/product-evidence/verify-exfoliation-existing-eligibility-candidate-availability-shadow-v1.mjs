#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAll,
  canonical,
  STAGE,
  TERMINAL,
} from "./build-exfoliation-existing-eligibility-candidate-availability-shadow-v1.mjs";

let assertions = 0;
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };

const built = await buildAll();
const { summary, audit, distribution, joined, restrict, impact, boundary, gaps, rows } = built;

eq(summary.stage, STAGE, "stage");
eq(summary.terminal, TERMINAL, "terminal");
eq(TERMINAL, "EXISTING_ELIGIBILITY_CANDIDATE_AVAILABILITY_SHADOW_EVIDENCE_VALIDATED", "terminal vocabulary");
eq(summary.authority.frozen_8x, "7dd6f3566ca3a680627eb64430ca8d34178b53bd", "8X authority");
eq(summary.authority.frozen_8y, "5ce7195670eab6f2e9a2aff7810d4f48c9b6f688", "8Y authority");
eq(summary.authority.frozen_8z, "57211ec9c2c99ea02da74c4f8d2c707ca89aa597", "8Z authority");
eq(summary.authority.frozen_9a, "1c65eced12e05ca4a81d74bbef167f367e170582", "9A authority");
eq(summary.authority.frozen_9a_terminal, "NORMATIVE_PRODUCTION_POLICY_ADDITIONAL_SHADOW_EVIDENCE_GAP_REMAINS", "9A terminal");

eq(audit.primary_root_cause, "COMPOSITE_ELIGIBILITY_NOT_MATERIALIZED", "9A unknown root cause");
eq(audit.manifestation, "COMPARATOR_SERIALIZATION_GAP", "9A comparator manifestation");
eq(audit.canonical_boolean_eligibility_field_exists, false, "no fabricated canonical boolean field");
eq(audit.candidate_availability_is_distinct_from_eligibility, true, "availability/eligibility distinction");
eq(audit.candidate_present_does_not_imply_eligibility_as_general_rule, true, "present != eligible");
eq(audit.ineligible_does_not_imply_absent_as_general_rule, true, "ineligible != absent");
eq(audit.observation_failure_contract, "SHADOW_MATERIALIZER_FAILURE_DOES_NOT_ENTER_CANONICAL_EXECUTION", "observer failure isolation");

eq(rows.length, 1968, "full bounded rows");
eq(distribution.evaluations, 1968, "distribution rows");
eq(distribution.scenarios, 12, "scenario count");
eq(distribution.catalog_products_per_scenario, 164, "catalog count");
eq(distribution.existing_eligibility.ELIGIBLE, 1968, "eligible count");
ok(!Object.prototype.hasOwnProperty.call(distribution.existing_eligibility, "UNKNOWN"), "no authoritative eligibility unknown should remain");
eq(distribution.candidate_availability.PRESENT_AT_ENFORCEMENT_BOUNDARY, 1968, "availability count");
eq(distribution.candidate_present.TRUE, 1968, "candidate present count");
eq(distribution.selected_top1_rows, 12, "Top1 rows");
ok(distribution.selected_top3_rows >= 36, "canonical selected Top3 coverage");
eq(distribution.score_order_top3_rows, 36, "score-order Top3 rows");

ok(rows.every((row) => row.candidate_present === true), "candidate presence materialization");
ok(rows.every((row) => row.candidate_availability_state === "PRESENT_AT_ENFORCEMENT_BOUNDARY"), "candidate availability materialization");
ok(rows.every((row) => row.existing_eligibility === "ELIGIBLE" && row.existing_eligibility_boolean === true), "existing eligibility materialization");
ok(rows.every((row) => row.production_semantics_changed === false), "snapshot changed production semantics");
ok(rows.every((row) => row.canonical_eligibility_mutated === false), "snapshot mutated eligibility");
ok(rows.every((row) => row.canonical_score_mutated === false && row.canonical_rank_mutated === false), "snapshot mutated score/rank");

eq(joined.source_9a_rows, 1968, "9A join source count");
eq(joined.canonical_snapshot_rows, 1968, "canonical join source count");
eq(joined.joined_rows, 1968, "joined count");
eq(joined.evidence_namespaces_separate, true, "canonical/hypothetical namespaces");
eq(joined.canonical_namespace, "CANONICAL_PRODUCTION_STATE", "canonical namespace");
eq(joined.hypothetical_namespace, "HYPOTHETICAL_ENFORCEMENT_ONLY", "hypothetical namespace");

eq(restrict.source_9a_restrict_total, 6, "9A RESTRICT total");
eq(restrict.classification.DEFINITE_NEW_EXCLUSION, 6, "definite new exclusions");
ok(!Object.prototype.hasOwnProperty.call(restrict.classification, "UNKNOWN"), "no unresolved RESTRICT");
ok(restrict.rows.every((row) => row.restrict_classification === "DEFINITE_NEW_EXCLUSION"), "RESTRICT classification");
ok(restrict.rows.every((row) => row.restrict_is_intrinsic_unsafe_fact === false), "RESTRICT promoted to unsafe fact");

eq(impact.restrict_total, 6, "impact RESTRICT total");
eq(impact.definite_new_exclusions, 6, "impact exclusions");
eq(impact.already_ineligible_restrict, 0, "already ineligible RESTRICT");
eq(impact.unavailable_restrict, 0, "unavailable RESTRICT");
eq(impact.unknown_restrict, 0, "unknown RESTRICT");
eq(impact.score_recomputed, false, "score recomputed");
eq(impact.rank_recomputed, false, "rank recomputed");
eq(impact.survivor_order_preserved, true, "refill reordered survivors");
ok(impact.scenario_impacts.every((row) => row.order_preserved_after_exclusion), "scenario order preservation");
ok(impact.scenario_impacts.every((row) => row.candidate_count_after === row.candidate_count_before - row.definite_new_exclusions), "candidate reduction accounting");
eq(impact.top_k_insufficient_scenarios, 0, "Top-K insufficiency");

eq(boundary.frozen_8z_boundary, "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY", "8Z boundary");
eq(boundary.result, "BOUNDARY_CONFIRMED", "boundary compatibility");
eq(boundary.semantic_refinement_required, false, "semantic boundary refinement");
eq(boundary.normative_overlay_implemented, false, "normative overlay implemented");
eq(boundary.production_activation_authorized, false, "activation authorized");
eq(gaps.current_result, "CLOSED_BY_CANONICAL_PRODUCTION_STATE_SNAPSHOT", "9A gap status");
eq(gaps.material_eligibility_availability_gap_remaining, false, "material eligibility gap");
eq(gaps.sufficient_for_separate_activation_readiness_reassessment, true, "readiness reassessment gate");
eq(gaps.production_activation_authorized, false, "gap reassessment activated production");

for (const [key, value] of Object.entries(summary.invariants)) {
  if (["NUMERIC_FITTING", "HOSTED_PRODUCT_FACT_WRITES", "REGISTRY_DEFINITION_DELTA", "MIGRATION_DELTA"].includes(key)) {
    eq(value, 0, key);
  } else if (key === "NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED") {
    eq(value, "YES", key);
  } else {
    eq(value, "NO", key);
  }
}

const productionFiles = [
  "lib/skin-match-decision-engine.js",
  "lib/candidate-exposure-policy.js",
  "lib/evaluator-boundary-policy-runtime.js",
  "lib/existing-recommendation-candidate-source.js",
];
for (const file of productionFiles) {
  const text = await readFile(file, "utf8");
  ok(!text.includes("build-exfoliation-existing-eligibility-candidate-availability-shadow-v1"), `${file} imports 9B builder`);
}

if (process.env.V21_9B_REQUIRE_CHECKED_IN === "1") {
  const root = "evidence/product-decision-axis-non-numeric-shadow-v1";
  const files = {
    summary: `${root}/exfoliation-existing-eligibility-candidate-availability-shadow-evidence-summary-v1.json`,
    audit: `${root}/exfoliation-existing-eligibility-candidate-availability-boundary-audit-v1.json`,
    distribution: `${root}/exfoliation-existing-eligibility-candidate-availability-distribution-v1.json`,
    joined: `${root}/exfoliation-existing-eligibility-candidate-availability-joined-9a-9b-shadow-v1.json`,
    restrict: `${root}/exfoliation-existing-eligibility-candidate-availability-restrict-classification-v1.json`,
    impact: `${root}/exfoliation-existing-eligibility-candidate-availability-hypothetical-refill-impact-v1.json`,
    boundary: `${root}/exfoliation-existing-eligibility-candidate-availability-enforcement-boundary-validation-v1.json`,
    gaps: `${root}/exfoliation-existing-eligibility-candidate-availability-gap-reassessment-v1.json`,
  };
  for (const [mode, file] of Object.entries(files)) {
    eq(await readFile(file, "utf8"), canonical(built[mode]), `checked-in bytes: ${mode}`);
  }
}

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  stage: STAGE,
  terminal: TERMINAL,
  assertions,
  evaluations: rows.length,
  eligibility: distribution.existing_eligibility,
  availability: distribution.candidate_availability,
  restrict: restrict.classification,
  impact: {
    definite_new_exclusions: impact.definite_new_exclusions,
    selected_top1_changed_scenarios: impact.selected_top1_changed_scenarios,
    selected_top3_changed_scenarios: impact.selected_top3_changed_scenarios,
    score_order_top1_changed_scenarios: impact.score_order_top1_changed_scenarios,
    score_order_top3_changed_scenarios: impact.score_order_top3_changed_scenarios,
    top_k_insufficient_scenarios: impact.top_k_insufficient_scenarios,
    refill_count: impact.refill_count,
  },
  boundary: boundary.result,
  checked_in_bytes: process.env.V21_9B_REQUIRE_CHECKED_IN === "1",
})}\n`);
