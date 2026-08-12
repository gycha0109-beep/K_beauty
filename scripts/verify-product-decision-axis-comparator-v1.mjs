#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertConstraintUtilitySeparation,
  evaluateShadowCandidate,
} from "./product-evidence/product-decision-axis-shadow-recommendation-v1.mjs";
import { buildArtifact } from "./build-product-decision-axis-shadow-recommendation-v1.mjs";

let assertions = 0;
function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions += 1; }
function ok(value, message) { assert.ok(value, message); assertions += 1; }

const built = await buildArtifact();
const frozen = JSON.parse(await readFile("evidence/product-recommendation-shadow-v1/legacy-vs-decision-axis-shadow-v1.json", "utf8"));
eq(frozen, built, "frozen artifact differs from deterministic rebuild");

eq(built.authority.base_main_sha, "e2be97b9fcbf75ff43b6f7ecfe96a680aff4cb87");
eq(built.authority.cleanser_axis_sha256, "fbddc761328f2caa5025a5867061866d17f16d24cb6566fe82d0796c20a4a0b4");
eq(built.authority.cross_category_axis_sha256, "5dc5c7975be7474bf0767951ea63074ed60968faabee5fdb8734153ff698ab5e");
eq(built.authority.legacy_reference_sha, "783afb91a964f5d762f46846f9ef854902b48e95");
eq(built.authority.legacy_products_canonical_sha256, "e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856");
eq(built.authority.legacy_scenarios_canonical_sha256, "7aa02ed3f1a264a67aee3d97c916b4a955a713fdbb173844d1727e9cfb1c918e");
eq(built.summary.legacy_products, 164);
eq(built.summary.scenarios, 12);
eq(built.summary.candidate_evaluations, 164 * 12);

eq(built.shadow_contract.numeric_policy_authorized, false);
eq(built.shadow_contract.counterfactual_numeric_lane, "DISABLED");
eq(built.shadow_contract.direct_product_fact_to_score_edge, false);
eq(built.summary.numeric_shadow_contributions, 0);
eq(built.summary.computed, 0);
ok(built.candidate_evaluations.every((item) => item.shadow.score === null && item.shadow.rank === null), "shadow numeric result fabricated");
ok(built.candidate_evaluations.every((item) => item.utility.numeric_contribution === null), "utility numeric contribution fabricated");
ok(built.candidate_evaluations.every((item) => item.product_axis_inputs.every((axis) => axis.estimate === null)), "null axis contract violated");
ok(built.candidate_evaluations.filter((item) => item.product_axis_inputs.length).every((item) => item.fixture_boundary?.fixture_only === true && item.fixture_boundary?.hosted_current === false), "fixture presented as Hosted Current");
ok(built.candidate_evaluations.filter((item) => item.product_axis_inputs.length).every((item) => item.catalog_adoption === "NOT_CATALOG_ADOPTED"), "catalog adoption inferred from fixture");
ok(built.candidate_evaluations.filter((item) => item.shadow.state === "NO_APPROVED_AXIS_INPUT").every((item) => item.catalog_adoption === "NO_APPROVED_AXIS_INPUT"), "not-adopted/no-input collapsed into false");

const rneFacts = built.candidate_evaluations.flatMap((item) => item.product_axis_inputs.flatMap((axis) => axis.fact_inputs)).filter((fact) => fact.semantic_status === "reviewed_not_established");
ok(rneFacts.length > 0, "no reviewed_not_established acceptance fact found");
ok(rneFacts.every((fact) => fact.typed_value === null), "RNE converted to value");
const insufficient = built.candidate_evaluations.filter((item) => item.shadow.state === "INSUFFICIENT_PRODUCT_FACT_COVERAGE");
ok(insufficient.length > 0, "no insufficient coverage holds");
ok(insufficient.every((item) => item.shadow.score === null), "insufficient coverage scored");

const syntheticScenario = { id: "SYN", answers: { mainConcern: "uv", mainConcerns: ["uv"] } };
const syntheticConflict = evaluateShadowCandidate({
  scenario: syntheticScenario,
  rawProduct: { id: "synthetic-conflict" },
  scoredProduct: { id: "synthetic-conflict", score: 1 },
  legacyRank: 1,
  topPickId: "synthetic-conflict",
  top3Ids: new Set(["synthetic-conflict"]),
  axisRecord: {
    fixture_only: true,
    hosted_current: false,
    catalog_adopted: false,
    identity_status: "resolved",
    axes: [{ axis_key: "photo_protection", estimate: null, coverage: "conflict_blocked", uncertainty: "high", authority_ceiling: "none", mapper_version: "synthetic", mapper_input_digest: "a".repeat(64), reason_codes: ["synthetic_conflict"], signal_families: [], fact_inputs: [{ fact_key: "spf_value", semantic_status: "evidence_conflict", typed_value: null, authority_ceiling: "none", fused_confidence: "unknown", proposition_key: null, fusion_input_digest: "b".repeat(64), provenance: { source: "synthetic", fixture_only: true, hosted_current: false } }] }],
  },
});
eq(syntheticConflict.shadow.state, "CONFLICT_BLOCKED");
eq(syntheticConflict.shadow.score, null);
eq(syntheticConflict.utility.numeric_contribution, null);
const syntheticMissing = evaluateShadowCandidate({
  scenario: syntheticScenario,
  rawProduct: { id: "synthetic-missing" },
  scoredProduct: { id: "synthetic-missing", score: 1 },
  legacyRank: 2,
  topPickId: "synthetic-conflict",
  top3Ids: new Set(["synthetic-conflict", "synthetic-missing"]),
  axisRecord: null,
});
eq(syntheticMissing.shadow.state, "NO_APPROVED_AXIS_INPUT");
eq(syntheticMissing.shadow.score, null);

ok(built.summary.identity_blocked > 0, "NEEDLY identity-blocked case not preserved");
const identityBlocked = built.candidate_evaluations.filter((item) => item.shadow.state === "IDENTITY_BLOCKED");
ok(identityBlocked.every((item) => item.constraints.state === "BLOCKED"), "identity-blocked constraint not blocked");
ok(identityBlocked.every((item) => item.utility.state === "BLOCKED_BY_CONSTRAINT"), "utility revived identity-blocked candidate");
ok(identityBlocked.every(assertConstraintUtilitySeparation));

const sunscreen = built.candidate_evaluations.find((item) => item.product_axis_inputs.some((axis) => axis.axis_key === "photo_protection" && axis.reason_codes.includes("water_resistance_missing_does_not_negate_uv_protection")));
ok(sunscreen, "sunscreen missing-water acceptance absent");
eq(sunscreen.product_axis_inputs.find((axis) => axis.axis_key === "photo_protection").estimate, null);
const barrierClaim = built.candidate_evaluations.find((item) => item.product_axis_inputs.some((axis) => axis.axis_key === "barrier_support" && axis.reason_codes.includes("barrier_claim_is_relevant_but_not_measured_magnitude")));
ok(barrierClaim, "barrier claim acceptance absent");
eq(barrierClaim.product_axis_inputs.find((axis) => axis.axis_key === "barrier_support").estimate, null);
const activeIdentity = built.candidate_evaluations.find((item) => item.product_axis_inputs.some((axis) => axis.axis_key === "exfoliation_load" && axis.reason_codes.includes("active_identity_relevant_but_not_exfoliation_intensity")));
ok(activeIdentity, "active identity acceptance absent");
eq(activeIdentity.product_axis_inputs.find((axis) => axis.axis_key === "exfoliation_load").estimate, null);
const cleanserCoexistence = built.candidate_evaluations.find((item) => item.product_axis_inputs.some((axis) => axis.axis_key === "cleansing_burden" && axis.fact_inputs.some((fact) => fact.fact_key === "deep_cleansing" && fact.typed_value === true)) && item.product_axis_inputs.some((axis) => axis.axis_key === "hydration_preservation" && axis.fact_inputs.some((fact) => fact.fact_key === "low_ph" && fact.typed_value === true)));
ok(cleanserCoexistence, "cleanser low_ph + deep_cleansing coexistence absent");
eq(cleanserCoexistence.product_axis_inputs.find((axis) => axis.axis_key === "cleansing_burden").estimate, null);

ok(built.duplication_audit.real_current_path_overlap_cases.length >= 1, "real current-path overlap audit missing");
ok(built.duplication_audit.real_current_path_overlap_cases.every((item) => item.duplicate_numeric_units_added === 0), "semantic overlap stacked numerically");
eq(built.duplication_audit.medicube_p3.raw_fact_count, 2);
eq(built.duplication_audit.medicube_p3.contribution_units, 1);
eq(built.duplication_audit.medicube_p3.dedupe_result, "PASS_ONE_FAMILY_UNIT_NO_SHADOW_NUMERIC_STACKING");

eq(built.lineage_summary.direct_product_fact_to_score_edges, 0);
eq(built.lineage_summary.applicable_axis_evaluations_with_lineage, true);
ok(built.candidate_evaluations.filter((item) => item.applicable_product_axes.length > 0).every((item) => item.lineage.every((lineage) => lineage.layer_path.join("→") === "scenario_user_context→product_decision_axis→product_fact_proposition→evidence_provenance_reference")), "lineage layer violation");

for (const [key, value] of Object.entries(built.production_invariance)) {
  if (key === "legacy_replay") eq(value, "PASS", "legacy replay");
  else eq(value, 0, `${key} must remain zero`);
}
ok(built.scenario_results.every((scenario) => Object.values(scenario.production_delta).every((value) => value === 0)), "per-scenario Production delta detected");
for (const file of ["lib/skin-match-decision-engine.js", "lib/product-source.js", "lib/candidate-exposure-policy-shadow.js"]) {
  const text = await readFile(file, "utf8");
  ok(!text.includes("product-decision-axis-shadow-recommendation-v1"), `${file} imports shadow module`);
}

eq(built.lifecycle.PRODUCT_FACT_CATALOG_ADOPTED, false);
eq(built.lifecycle.CATALOG_ADOPTED, false);
eq(built.lifecycle.PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED, false);
eq(built.lifecycle.DECISION_AXIS_PRODUCTION_CONSUMPTION, false);
eq(built.lifecycle.RECOMMENDATION_SCORER_CHANGED, false);
eq(built.lifecycle.RECOMMENDATION_ACTIVATED, false);
eq(built.lifecycle.HOSTED_PRODUCT_FACT_WRITES_V21_7, 0);
eq(built.lifecycle.OFFLINE_SHADOW_CONSUMPTION, true);

console.log("PASS verify-product-decision-axis-shadow-recommendation-v1");
console.log(`assertions=${assertions}`);
console.log(`products=${built.summary.legacy_products} scenarios=${built.summary.scenarios} candidate_evaluations=${built.summary.candidate_evaluations}`);
console.log(`held_uncalibrated=${built.summary.held_uncalibrated} no_approved_axis_input=${built.summary.no_approved_axis_input} identity_blocked=${built.summary.identity_blocked} computed=${built.summary.computed}`);
console.log(`duplicate_signal_cases=${built.duplication_audit.real_current_path_overlap_cases.length} medicube_raw=${built.duplication_audit.medicube_p3.raw_fact_count} medicube_family_units=${built.duplication_audit.medicube_p3.contribution_units}`);
console.log("production_score_delta=0 production_ranking_delta=0 production_top1_delta=0 production_top3_delta=0 production_eligibility_delta=0");
console.log("public_response_delta=0 persistence_delta=0 candidate_policy_fingerprint_delta=0");
console.log("hosted_writes=0 recommendation_activation=NO production_consumption=NO offline_shadow_consumption=YES");
