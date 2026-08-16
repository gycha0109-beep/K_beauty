#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  STAGE,
  TERMINAL,
  POLICY_CONTRACT_VERSION,
  SHADOW_RUNTIME_VERSION,
  ENFORCEMENT_CONTRACT_VERSION,
  ACTIVATION_GATE_VERSION,
  FALLBACK_MODE,
  buildActivationReadinessContract,
  buildEnforcementBoundaryContract,
  buildActionEffectMatrix,
  buildFailureFallbackMatrix,
  buildObservabilityRequirements,
  buildRollbackRequirements,
  buildActivationGateContract,
  buildReadinessEvidenceAssessment,
  buildHypotheticalEnforcementSimulation
} from "./build-exfoliation-non-numeric-pda-normative-production-policy-activation-readiness-v1.mjs";

const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const FILES = {
  readiness: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-activation-readiness-contract-v1.json`,
  enforcement: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-enforcement-boundary-contract-v1.json`,
  effects: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-canonical-effect-matrix-v1.json`,
  failure: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-failure-fallback-matrix-v1.json`,
  observability: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-observability-requirements-v1.json`,
  rollback: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-rollback-requirements-v1.json`,
  gate: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-activation-gate-v1.json`,
  evidence: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-readiness-evidence-assessment-v1.json`,
  simulation: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-hypothetical-enforcement-simulation-v1.json`
};
const FROZEN_8X_CONTRACT = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1.json`;
const FROZEN_8Y_GOVERNED = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-governed-runtime-replay-v1.json`;
const FROZEN_8Y_DUAL = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-dual-run-comparison-v1.json`;

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const read = (p) => fs.readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const built = {
  readiness: buildActivationReadinessContract(),
  enforcement: buildEnforcementBoundaryContract(),
  effects: buildActionEffectMatrix(),
  failure: buildFailureFallbackMatrix(),
  observability: buildObservabilityRequirements(),
  rollback: buildRollbackRequirements(),
  gate: buildActivationGateContract(),
  evidence: buildReadinessEvidenceAssessment(),
  simulation: buildHypotheticalEnforcementSimulation()
};
for (const [key, path] of Object.entries(FILES)) {
  eq(json(path), built[key], `${key}: checked-in artifact equals deterministic builder`);
}

const readiness = json(FILES.readiness);
const enforcement = json(FILES.enforcement);
const effects = json(FILES.effects);
const failure = json(FILES.failure);
const observability = json(FILES.observability);
const rollback = json(FILES.rollback);
const gate = json(FILES.gate);
const evidence = json(FILES.evidence);
const simulation = json(FILES.simulation);
const frozen8x = json(FROZEN_8X_CONTRACT);
const frozen8yGoverned = json(FROZEN_8Y_GOVERNED);
const frozen8yDual = json(FROZEN_8Y_DUAL);

eq(readiness.stage, STAGE, "exact stage");
eq(readiness.primary_terminal_outcome, TERMINAL, "exact terminal B");
eq(readiness.authority.policy_contract_version, POLICY_CONTRACT_VERSION, "8X policy version");
eq(readiness.authority.shadow_runtime_version, SHADOW_RUNTIME_VERSION, "8Y runtime version");
eq(frozen8x.primary_terminal_outcome, "NORMATIVE_PRODUCTION_POLICY_DECISION_CONTRACT_FROZEN", "8X terminal frozen");
eq(frozen8yGoverned.terminal, "NORMATIVE_PRODUCTION_POLICY_SHADOW_RUNTIME_VALIDATED", "8Y terminal frozen");
eq(frozen8yGoverned.product_count, 4, "8Y governed cohort size");
eq(frozen8yGoverned.products.map((row) => row.normative_policy_shadow.policy_action), ["ALLOW", "DEFER", "DEFER", "ALLOW"], "8Y governed actions exact");
eq(frozen8yDual.result.divergence_distribution, { AUTHORITY_COVERAGE_GAP: 2, LEGACY_MORE_CAUTIOUS: 2 }, "8Y divergence distribution exact");
eq(frozen8yDual.result.production_activation, false, "8Y activation remains false");
eq(frozen8yDual.result.restrict_enforcement_implemented, false, "8Y restrict enforcement remains absent");

const dimensions = Object.fromEntries(readiness.readiness_dimensions.map((row) => [row.dimension, row.status]));
eq(dimensions.SEMANTIC_READINESS, "READY_FOR_FUTURE_ENFORCEMENT_CONTRACT", "semantic readiness");
eq(dimensions.RUNTIME_READINESS, "READY_FOR_FUTURE_CANONICAL_CONSUMER_CONTRACT", "runtime readiness");
eq(dimensions.COVERAGE_READINESS, "ADDITIONAL_SHADOW_EVIDENCE_REQUIRED", "coverage requires evidence");
ok(dimensions.DIVERGENCE_READINESS.includes("ADDITIONAL"), "divergence needs enforcement-relevant evidence");
ok(readiness.readiness_result.enforcement_semantics_fully_defined, "enforcement semantics defined");
eq(readiness.readiness_result.current_evidence_sufficient_for_activation_authorization, false, "not activation-ready by evidence");
eq(readiness.readiness_result.semantic_blocker_present, false, "no enforcement semantic blocker");

eq(enforcement.version, ENFORCEMENT_CONTRACT_VERSION, "enforcement contract version");
eq(enforcement.future_integration_boundary.preferred_boundary, "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY", "preferred boundary");
eq(enforcement.future_integration_boundary.final_eligibility_formula, "existing_eligibility AND normative_policy_eligibility", "eligibility intersection only");
eq(enforcement.restrict_enforcement_contract.mutates_score_value, false, "restrict no score mutation");
eq(enforcement.restrict_enforcement_contract.mutates_rank_score_formula, false, "restrict no rank mutation");
eq(enforcement.restrict_enforcement_contract.can_change_top_k_indirectly, true, "restrict top-k indirect only");
eq(enforcement.implementation_state.restrict_enforcement_implemented, false, "restrict not implemented");
eq(enforcement.implementation_state.production_activation_authorized, false, "activation not authorized");

const byAction = Object.fromEntries(effects.actions.map((row) => [row.policy_action, row]));
eq(Object.keys(byAction).sort(), ["ALLOW", "CAUTION", "DEFER", "NOT_APPLICABLE", "RESTRICT"].sort(), "all five actions");
eq(byAction.ALLOW.existing_eligibility_effect, "PRESERVE_EXISTING_ELIGIBILITY", "ALLOW preserves eligibility");
eq(byAction.ALLOW.future_consumer_invariant, "MUST_NOT_APPROVE_OR_FORCE_ELIGIBLE", "ALLOW non-approval");
eq(byAction.CAUTION.explanation_effect, "WARNING_REQUIRED", "CAUTION warning");
eq(byAction.CAUTION.score_effect, "NO_DIRECT_SCORE_MUTATION", "CAUTION no numeric penalty");
eq(byAction.RESTRICT.policy_eligibility_effect, "EXCLUDE_WHEN_POLICY_ENFORCED", "RESTRICT future exclusion");
eq(byAction.DEFER.future_consumer_invariant, "MUST_NOT_COERCE_TO_ALLOW", "DEFER not permissive");
eq(byAction.NOT_APPLICABLE.future_consumer_invariant, "NOT_A_NEGATIVE_PRODUCT_JUDGMENT", "N/A neutral");
eq(effects.invariants.allow_is_approval, false, "ALLOW not approval invariant");
eq(effects.invariants.defer_is_permissive_default, false, "DEFER not allow invariant");

eq(failure.fallback_mode, FALLBACK_MODE, "fallback mode exact");
ok(failure.failures.length >= 8, "all required failure classes covered");
for (const row of failure.failures) {
  eq(row.fallback_policy_action, "DEFER", `${row.failure_class}: fail to DEFER`);
  eq(row.default_to_allow, false, `${row.failure_class}: never default ALLOW`);
  eq(row.apply_policy_exclusion, false, `${row.failure_class}: failure no policy exclusion`);
  eq(row.canonical_fallback, "PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH", `${row.failure_class}: preserve legacy path`);
}

const requiredMetrics = new Set([
  "evaluations_total", "allow_count", "allow_rate", "caution_count", "caution_rate",
  "restrict_count", "restrict_rate", "defer_count", "defer_rate", "not_applicable_count",
  "not_applicable_rate", "evaluation_error_count", "fallback_count",
  "policy_legacy_divergence_count", "policy_legacy_divergence_rate",
  "divergence_taxonomy_distribution", "reason_code_distribution", "provenance_missing_count",
  "candidate_exclusion_count", "candidate_count_before_enforcement", "candidate_count_after_enforcement",
  "top_k_changed_count", "rollback_event_count", "policy_contract_version", "runtime_version",
  "activation_version"
]);
for (const metric of requiredMetrics) ok(observability.required_metrics.includes(metric), `observability: ${metric}`);
eq(observability.telemetry_state, "CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED", "telemetry contract only");
eq(observability.privacy_boundary.raw_user_input_forbidden, true, "raw user data excluded");

eq(rollback.requirements.one_step_disable, true, "one-step disable");
eq(rollback.requirements.restore_target, "LEGACY_ONLY", "legacy rollback target");
eq(rollback.requirements.database_rollback_required, false, "no DB rollback");
eq(rollback.requirements.product_fact_rollback_required, false, "no Product Fact rollback");
eq(rollback.requirements.registry_rollback_required, false, "no Registry rollback");
eq(rollback.requirements.irreversible_policy_decision_persistence_allowed, false, "no irreversible policy persistence");

eq(gate.version, ACTIVATION_GATE_VERSION, "activation gate version");
eq(gate.modes, ["OFF", "SHADOW", "ENFORCE"], "versioned modes");
eq(gate.default_mode, "OFF", "default off");
eq(gate.current_state.canonical_gate_implemented, false, "canonical gate not implemented");
eq(gate.current_state.selected_canonical_mode, "OFF", "canonical mode remains off");
eq(gate.current_state.enforce_authorized, false, "ENFORCE unauthorized");
eq(gate.gate_semantics.kill_switch, "DISABLE_OVERRIDES_ENABLE_AND_MODE", "kill switch precedence");
eq(gate.fallback_mode, FALLBACK_MODE, "gate fallback exact");

const realCoverage = evidence.evidence_classes.real_governed_product_coverage;
eq(realCoverage.product_count, 4, "real governed count");
eq(realCoverage.observed_action_distribution, { ALLOW: 2, CAUTION: 0, RESTRICT: 0, DEFER: 2, NOT_APPLICABLE: 0 }, "real action distribution");
eq(realCoverage.real_restrict_observed, false, "no real RESTRICT");
eq(realCoverage.real_caution_observed, false, "no real CAUTION");
eq(evidence.evidence_classes.synthetic_contract_coverage.all_five_policy_actions_covered, true, "synthetic covers all actions");
eq(evidence.evidence_classes.production_distribution_coverage.full_distribution_normative_shadow_observed, false, "no production distribution normative shadow");
eq(evidence.quantitative_sample_threshold, "NOT_ARBITRARILY_DEFINED", "no arbitrary numeric threshold");
ok(evidence.unmet_activation_evidence_requirements.length >= 8, "activation evidence gaps explicit");

eq(simulation.mode, "HYPOTHETICAL_ENFORCEMENT_ONLY", "simulation label");
eq(simulation.scenario_count, 19, "required 19 scenarios");
eq(simulation.invariants.canonical_production_mutated, false, "simulation no production mutation");
eq(simulation.invariants.restrict_enforcement_active, false, "simulation restrict not active");
const scenarios = Object.fromEntries(simulation.scenarios.map((row) => [row.id, row.result]));
eq(scenarios.S01_ALLOW_CANDIDATE.excluded_candidate_ids, [], "ALLOW not excluded");
eq(scenarios.S02_CAUTION_CANDIDATE.excluded_candidate_ids, [], "CAUTION not excluded");
eq(scenarios.S03_RESTRICT_CANDIDATE.excluded_candidate_ids, ["restrict_inside_topk"], "RESTRICT hypothetical exclusion only");
eq(scenarios.S04_DEFER_CANDIDATE.excluded_candidate_ids, [], "DEFER not excluded");
eq(scenarios.S05_NOT_APPLICABLE_CANDIDATE.excluded_candidate_ids, [], "N/A not excluded");
eq(scenarios.S06_RESTRICT_INSIDE_TOP_K.top_k_changed_indirectly, true, "restrict inside Top-K causes indirect delta");
eq(scenarios.S07_RESTRICT_OUTSIDE_TOP_K.top_k_changed_indirectly, false, "restrict outside Top-K no top3 delta");
eq(scenarios.S08_MULTIPLE_RESTRICT.excluded_candidate_ids.length, 2, "multiple restrict candidates excluded hypothetically");
eq(scenarios.S09_DEFER_STRONG_LEGACY_RANKING.top3_after[0], "defer_strong_legacy", "DEFER preserves strong legacy rank");
eq(scenarios.S10_CAUTION_STRONG_PREFERENCE_SCORE.top3_after[0], "caution_strong_preference", "CAUTION preserves preference score order");
eq(scenarios.S11_EVALUATOR_FAILURE.effective_policy_action, "DEFER", "failure -> DEFER");
eq(scenarios.S11_EVALUATOR_FAILURE.default_to_allow, false, "failure never ALLOW");
eq(scenarios.S12_INVALID_CONTRACT_VERSION.effective_policy_action, "DEFER", "version mismatch -> DEFER");
eq(scenarios.S13_MISSING_PROVENANCE.effective_policy_action, "DEFER", "missing provenance -> DEFER");
eq(scenarios.S14_POLICY_LEGACY_DISAGREEMENT.divergence_kind, "ENFORCEMENT_RELEVANT_DIVERGENCE", "enforcement divergence explicit");
eq(scenarios.S15_NO_GOVERNED_PDA_AUTHORITY.effective_policy_action, "DEFER", "no authority -> DEFER");
eq(scenarios.S16_ROLLBACK_TO_LEGACY_ONLY.rollback_target, "LEGACY_ONLY", "rollback simulation");
eq(scenarios.S17_ACTIVATION_GATE_OFF.mode, "OFF", "OFF mode");
eq(scenarios.S18_ACTIVATION_GATE_SHADOW.mode, "SHADOW", "SHADOW mode");
eq(scenarios.S18_ACTIVATION_GATE_SHADOW.after_candidate_ids, scenarios.S18_ACTIVATION_GATE_SHADOW.before_candidate_ids, "SHADOW canonical set unchanged");
eq(scenarios.S19_HYPOTHETICAL_ENFORCE.mode, "ENFORCE", "hypothetical ENFORCE mode");

for (const key of [
  "DECISION_AXIS_PRODUCTION_CONSUMPTION",
  "NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED",
  "NORMATIVE_POLICY_RUNTIME_ACTIVE",
  "PRODUCTION_POLICY_ACTIVATED",
  "PRODUCTION_ACTIVATION_AUTHORIZED",
  "ACTIVATION_EXECUTED",
  "RESTRICT_ENFORCEMENT_IMPLEMENTED",
  "RESTRICT_CANONICAL_EXCLUSION_ACTIVE",
  "ALLOW_PROMOTED_TO_CANONICAL_APPROVAL",
  "DEFER_PROMOTED_TO_ALLOW",
  "RECOMMENDATION_SCORER_CHANGED",
  "RECOMMENDATION_RANKER_CHANGED",
  "RECOMMENDATION_ACTIVATED",
  "CANDIDATE_POLICY_PRODUCTION_CHANGED",
  "LEGACY_HEURISTIC_REPLACED",
  "POTENCY_ORDERING_CREATED"
]) eq(readiness.invariants[key], "NO", `explicit NO ${key}`);
eq(readiness.invariants.NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED, "YES", "8Y shadow remains implemented");
eq(readiness.invariants.NUMERIC_FITTING, 0, "numeric fitting zero");
eq(readiness.invariants.HOSTED_PRODUCT_FACT_WRITES, 0, "Hosted PF writes zero");
eq(readiness.invariants.REGISTRY_DEFINITION_DELTA, 0, "Registry delta zero");
eq(readiness.invariants.MIGRATION_DELTA, 0, "migration delta zero");

for (const path of [
  "lib/skin-match-decision-engine.js",
  "lib/candidate-exposure-policy.js",
  "lib/functional-ranking-contract.js",
  "lib/product-functional-profile.js"
]) {
  const source = read(path);
  ok(!source.includes(ACTIVATION_GATE_VERSION), `${path}: no 8Z activation gate wiring`);
  ok(!source.includes(ENFORCEMENT_CONTRACT_VERSION), `${path}: no 8Z enforcement wiring`);
}

const result = {
  stage: STAGE,
  terminal: TERMINAL,
  assertions,
  artifact_sha256: Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, sha(path)])),
  semantic_blocker_present: false,
  additional_shadow_evidence_required: true,
  production_activation_authorized: false,
  activation_executed: false,
  restrict_enforcement_implemented: false
};
process.stdout.write(`${JSON.stringify(result)}\n`);
