import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const contractPath = path.resolve(process.env.EVAL_P9_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p9-real-aggregate-calibration-contract-v1.json");
const assessmentPath = path.resolve(process.env.EVAL_P9_ASSESSMENT_PATH || "fixtures/persona-evaluation/eval-p9-real-aggregate-source-assessment-v1.json");
const p4Path = path.resolve(process.env.EVAL_P9_P4_MANIFEST_PATH || "fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json");
const p6Path = path.resolve(process.env.EVAL_P9_P6_COHORT_PATH || "fixtures/persona-evaluation/eval-p6-locked-regression-cohort-v1.json");
const p8ContractPath = path.resolve(process.env.EVAL_P9_P8_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p8-llm-judge-contract-v1.json");
const p8ObservationPath = path.resolve(process.env.EVAL_P9_P8_OBSERVATION_PATH || "fixtures/persona-evaluation/eval-p8-llm-judge-observations-v1.json");
const artifactRoot = path.resolve(process.env.EVAL_P9_ARTIFACT_ROOT || "artifacts/eval-p9/contract");
const implementationSha = process.env.EVAL_P9_IMPLEMENTATION_SHA || "UNSPECIFIED_IMPLEMENTATION_SHA";

const [contract, assessment, p4, p6, p8Contract, p8Observation] = await Promise.all([
  readFile(contractPath, "utf8").then(JSON.parse),
  readFile(assessmentPath, "utf8").then(JSON.parse),
  readFile(p4Path, "utf8").then(JSON.parse),
  readFile(p6Path, "utf8").then(JSON.parse),
  readFile(p8ContractPath, "utf8").then(JSON.parse),
  readFile(p8ObservationPath, "utf8").then(JSON.parse)
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function collectKeys(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      output.push(key);
      collectKeys(item, output);
    }
  }
  return output;
}

assert.equal(contract.stage, "EVAL-P9");
assert.equal(contract.stage_name, "Real Aggregate Calibration Contract");
assert.equal(contract.authority.row_level_real_user_data_allowed, false);
assert.equal(contract.authority.individual_persona_reconstruction_allowed, false);
assert.equal(contract.authority.real_user_truth, false);
assert.equal(contract.authority.satisfaction_or_conversion_truth, false);
assert.equal(contract.authority.market_prevalence_truth, false);
assert.equal(contract.authority.enforce_authority, false);
assert.equal(contract.source_gate.row_level_export_forbidden, true);
assert.equal(contract.privacy_gate.aggregate_only, true);
assert.equal(contract.privacy_gate.low_count_segment_policy_required, true);
assert.equal(contract.privacy_gate.existing_privacy_policy_required, true);
assert.equal(contract.privacy_gate.minimum_cell_rule_reference_required, true);
assert.equal(contract.privacy_gate.persona_track_may_invent_k, false);
assert.equal(contract.privacy_gate.if_policy_absent, "CALIBRATION_HOLD_REQUIRE_SEPARATE_PRIVACY_GOVERNANCE");
assert.deepEqual(
  contract.calibration_targets.map((item) => item.target),
  [
    "POPULATION_PRIOR_CALIBRATION",
    "DOMAIN_STATE_DISTRIBUTION_CALIBRATION",
    "DECISION_PREFERENCE_CALIBRATION",
    "INTERACTION_BEHAVIOR_CALIBRATION"
  ]
);
assert.equal(contract.cross_layer_rules.one_signal_may_automatically_calibrate_another_layer, false);
assert.equal(contract.cross_layer_rules.click_or_purchase_may_infer_skin_state_prevalence, false);
assert.equal(contract.comparability_gate.cross_cohort_raw_rate_comparison, "FORBIDDEN");
assert.equal(contract.comparability_gate.weighted_and_unweighted_metrics_may_be_mixed, false);
assert.equal(contract.comparability_gate.numerator_and_denominator_required_for_every_rate, true);
assert.equal(contract.reweighting_governance.locked_cohort_mutation_in_place, "FORBIDDEN");
assert.equal(contract.reweighting_governance.reweighting_requires_new_version, true);
assert.equal(contract.p8_boundary.llm_judge_diagnostic_counts_may_be_used_as_population_calibration_target, false);
assert.equal(contract.execution_policy.partial_gate_satisfaction_may_trigger_reweighting, false);

assert.equal(assessment.stage, "EVAL-P9");
assert.equal(assessment.assessment_basis.row_level_records_retrieved, false);
assert.equal(assessment.assessment_basis.person_identifiers_retrieved, false);
assert.equal(assessment.production_aggregate_source_assessment.status, "NOT_ESTABLISHED");
assert.equal(assessment.production_aggregate_source_assessment.connected_analytics_candidate.events_observed_in_recent_window, 0);
assert.equal(assessment.production_aggregate_source_assessment.connected_analytics_candidate.reference_schema_entries_are_not_treated_as_collected_data, true);
assert.equal(assessment.production_aggregate_source_assessment.connected_analytics_candidate.aggregate_snapshot_reference, null);
assert.equal(assessment.production_aggregate_source_assessment.connected_analytics_candidate.aggregate_snapshot_hash, null);
assert.equal(assessment.production_aggregate_source_assessment.warehouse_source_assessment.absence_claim_allowed, false);
assert.equal(assessment.privacy_governance_assessment.status, "NOT_ESTABLISHED");
assert.equal(assessment.privacy_governance_assessment.predefined_suppression_policy_found, false);
assert.equal(assessment.privacy_governance_assessment.authorized_minimum_cell_rule_found, false);
assert.equal(assessment.privacy_governance_assessment.authorized_k_value, null);
assert.equal(assessment.privacy_governance_assessment.persona_track_may_invent_k, false);
assert.equal(assessment.calibration_execution.executed, false);
assert.equal(assessment.calibration_execution.aggregate_distribution_comparison_executed, false);
assert.equal(assessment.calibration_execution.weights_estimated, false);
assert.equal(assessment.calibration_execution.weights_applied, false);
assert.equal(assessment.calibration_execution.p4_locked_cohort_changed, false);
assert.equal(assessment.calibration_execution.p6_locked_regression_cohort_changed, false);
assert.equal(assessment.calibration_execution.successor_population_or_domain_cohort_created, false);
assert.equal(assessment.terminal_outcome, "CALIBRATION_HOLD_SOURCE_AND_PRIVACY_AUTHORITY_NOT_ESTABLISHED");
assert.equal(assessment.stage_semantic_result, "CONTRACT_ESTABLISHED_CALIBRATION_HELD");

assert.equal(p6.cohort.lifecycle, "LOCKED");
assert.equal(p6.cohort.persona_count, 37);
assert.equal(p6.cohort.cohort_hash, "c774fc52ae1494c5a4fc39d11d2e7564a196460db391bb94f41d0510b7ae59f8");
assert.equal(p6.cohort.mutation_policy, "NEW_VERSION_REQUIRED");
const p4Coverage = p4.locked_cohorts.find((item) => item.cohort_type === "COVERAGE_COHORT");
const p4Adversarial = p4.locked_cohorts.find((item) => item.cohort_type === "ADVERSARIAL_COHORT");
assert(p4Coverage);
assert(p4Adversarial);
assert.equal(p4Coverage.lifecycle, "LOCKED");
assert.equal(p4Coverage.persona_count, 29);
assert.equal(p4Coverage.cohort_hash, "ffcd3341fbf408116399ab39cfaa250468baab01e7d5eae3295193996ce0530a");
assert.equal(p4Adversarial.lifecycle, "LOCKED");
assert.equal(p4Adversarial.persona_count, 8);
assert.equal(p4Adversarial.cohort_hash, "957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7");
assert.equal(p4.population_prior.lifecycle, "DEFERRED_NOT_LOCKED");
assert.equal(p4.population_prior.persona_count, 0);

assert.equal(p8Contract.authority.judge_authority, "DIAGNOSTIC_ONLY");
assert.equal(p8Contract.authority.release_blocker_authority, false);
assert.equal(p8Contract.validation_policy.repeatability_authority, "NOT_ESTABLISHED");
assert.equal(p8Observation.authority.judge_authority, "DIAGNOSTIC_ONLY");
assert.equal(p8Observation.execution_lineage.blindness_integrity, "PARTIAL");
assert.equal(p8Observation.execution_lineage.brand_blindness_claim_allowed, false);

const forbiddenRawIdentityKeys = new Set([
  "distinct_id",
  "person_id",
  "user_id",
  "email",
  "session_id",
  "raw_questionnaire_response",
  "raw_questionnaire_rows"
]);
for (const key of collectKeys({ contract, assessment })) {
  assert(!forbiddenRawIdentityKeys.has(String(key).toLowerCase()), `P9 fixture contains forbidden row-level identity key: ${key}`);
}

const contractSemanticHash = semanticHash(contract);
const assessmentSemanticHash = semanticHash(assessment);
const semanticEvidence = {
  stage: "EVAL-P9",
  contract_semantic_hash: contractSemanticHash,
  source_assessment_semantic_hash: assessmentSemanticHash,
  source_authority_status: assessment.production_aggregate_source_assessment.status,
  privacy_governance_status: assessment.privacy_governance_assessment.status,
  calibration_executed: assessment.calibration_execution.executed,
  weights_applied: assessment.calibration_execution.weights_applied,
  p4_coverage_cohort_hash: p4Coverage.cohort_hash,
  p4_adversarial_cohort_hash: p4Adversarial.cohort_hash,
  p6_locked_regression_cohort_hash: p6.cohort.cohort_hash,
  p6_persona_count: p6.cohort.persona_count,
  p8_llm_judge_authority: p8Contract.authority.judge_authority,
  terminal_outcome: assessment.terminal_outcome,
  stage_semantic_result: assessment.stage_semantic_result
};
const semanticEvidenceHash = semanticHash(semanticEvidence);
const output = {
  schema_version: "eval-p9-real-aggregate-calibration-evidence-v1",
  implementation_sha: implementationSha,
  semantic_evidence_hash: semanticEvidenceHash,
  ...semanticEvidence,
  authority_ceiling: assessment.authority_ceiling
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(path.join(artifactRoot, "real-aggregate-calibration-evidence-v1.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log("EVAL-P9 Real Aggregate Calibration Contract verifier: PASS");
console.log(`contract_semantic_hash=${contractSemanticHash}`);
console.log(`source_assessment_semantic_hash=${assessmentSemanticHash}`);
console.log(`semantic_evidence_hash=${semanticEvidenceHash}`);
console.log(`terminal_outcome=${assessment.terminal_outcome}`);
