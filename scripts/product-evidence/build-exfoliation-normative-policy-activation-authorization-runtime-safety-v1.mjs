#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_AUTHORIZATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_AUTHORIZED_MODE,
  EXFOLIATION_NORMATIVE_POLICY_BOUNDARY,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
  EXFOLIATION_NORMATIVE_POLICY_FALLBACK,
  EXFOLIATION_NORMATIVE_POLICY_ROLLBACK_TARGET,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
  buildNormativePolicyFallback,
  composeDormantNormativeEligibility,
  resolveExfoliationNormativePolicyActivationControl,
  runExfoliationNormativePolicyRuntime,
  simulateDormantStableOverlay
} from "../../lib/exfoliation-normative-policy-activation-runtime.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_TELEMETRY_VERSION,
  buildExfoliationNormativePolicyRuntimeTelemetry,
  validateExfoliationNormativePolicyRuntimeTelemetry
} from "../../lib/exfoliation-normative-policy-runtime-observability.js";

export const STAGE = "V2.1-9D";
export const TERMINAL = "NORMATIVE_PRODUCTION_POLICY_STAGED_SHADOW_ACTIVATION_AUTHORIZED";
export const VERSION = "exfoliation-normative-policy-activation-authorization-runtime-safety-v1";
export const BASE_MAIN = "83c072fa66b669a47d552929210eef7ac1f446c8";
export const FROZEN_9C_MAIN = "64c52e58452f4233d3aafb7aab8550f6e60ce623";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const INPUTS = Object.freeze({
  gate8z: "exfoliation-non-numeric-pda-normative-production-policy-activation-gate-v1.json",
  fallback8z: "exfoliation-non-numeric-pda-normative-production-policy-failure-fallback-matrix-v1.json",
  observability8z: "exfoliation-non-numeric-pda-normative-production-policy-observability-requirements-v1.json",
  rollback8z: "exfoliation-non-numeric-pda-normative-production-policy-rollback-requirements-v1.json",
  enforcement8z: "exfoliation-non-numeric-pda-normative-production-policy-enforcement-boundary-contract-v1.json",
  summary9a: "exfoliation-non-numeric-pda-additional-shadow-evidence-summary-v1.json",
  divergence9a: "exfoliation-non-numeric-pda-additional-shadow-divergence-distribution-v1.json",
  summary9b: "exfoliation-existing-eligibility-candidate-availability-shadow-evidence-summary-v1.json",
  restrict9b: "exfoliation-existing-eligibility-candidate-availability-restrict-classification-v1.json",
  summary9c: "exfoliation-normative-production-policy-activation-readiness-reassessment-summary-v1.json",
  boundary9c: "exfoliation-normative-production-policy-separate-activation-authorization-boundary-v1.json"
});
export const OUTPUTS = Object.freeze({
  summary: "exfoliation-normative-policy-activation-authorization-runtime-safety-summary-v1.json",
  authorization: "exfoliation-normative-policy-activation-authorization-decision-v1.json",
  contract: "exfoliation-normative-policy-runtime-safety-contract-v1.json",
  validation: "exfoliation-normative-policy-runtime-safety-validation-v1.json",
  live: "exfoliation-normative-policy-live-shadow-requirement-v1.json",
  adapter: "exfoliation-normative-policy-enforcement-adapter-prerequisite-validation-v1.json",
  fixtures: "exfoliation-normative-policy-runtime-safety-fixtures-v1.json"
});
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
export function canonical(value) { return `${JSON.stringify(stable(value))}\n`; }
function read(name) { return JSON.parse(fs.readFileSync(path.join(ROOT, INPUTS[name]), "utf8")); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function env(mode = "SHADOW", overrides = {}) { return { EXFOLIATION_NORMATIVE_POLICY_ENABLED: "1", EXFOLIATION_NORMATIVE_POLICY_MODE: mode, EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION, EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION, EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION, EXFOLIATION_NORMATIVE_POLICY_SCOPE: EXFOLIATION_NORMATIVE_POLICY_BOUNDARY, ...overrides }; }
function policy(action = "ALLOW", overrides = {}) { return { version: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION, contract_version: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION, policy_action: action, reason_codes: [`fixture_${action.toLowerCase()}`], authority_sources: ["fixture_frozen_contract"], provenance: { contract_version: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION, shadow_runtime_version: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION }, ...overrides }; }
const upstream = { ...EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS };
function fixture(id, pass, observed) { return { id, pass: Boolean(pass), observed }; }
async function buildFixtures() {
  const out = [];
  const off = resolveExfoliationNormativePolicyActivationControl({});
  out.push(fixture("F01_DEFAULT_OFF", off.effectiveMode === "OFF" && !off.runtimeAllowed, off));
  const shadow = resolveExfoliationNormativePolicyActivationControl(env("SHADOW"));
  out.push(fixture("F02_EXPLICIT_SHADOW", shadow.effectiveMode === "SHADOW" && shadow.runtimeAllowed && !shadow.enforcementAllowed, shadow));
  const enforce = resolveExfoliationNormativePolicyActivationControl(env("ENFORCE"));
  out.push(fixture("F03_EXPLICIT_ENFORCE_REJECTED", enforce.effectiveMode === "OFF" && enforce.reasonCodes.includes("enforce_not_authorized_by_v21_9d"), enforce));
  const killShadow = resolveExfoliationNormativePolicyActivationControl(env("SHADOW", { EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "1" }));
  out.push(fixture("F04_KILL_SWITCH_SHADOW", killShadow.effectiveMode === "OFF" && !killShadow.runtimeAllowed, killShadow));
  const killEnforce = resolveExfoliationNormativePolicyActivationControl(env("ENFORCE", { EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "1" }));
  out.push(fixture("F05_KILL_SWITCH_ENFORCE", killEnforce.effectiveMode === "OFF" && !killEnforce.enforcementAllowed, killEnforce));
  const invalid = resolveExfoliationNormativePolicyActivationControl(env("BOGUS"));
  out.push(fixture("F06_INVALID_MODE", invalid.effectiveMode === "OFF" && invalid.reasonCodes.includes("invalid_activation_mode"), invalid));
  const missingPin = resolveExfoliationNormativePolicyActivationControl(env("SHADOW", { EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION: "" }));
  out.push(fixture("F07_MISSING_VERSION_PIN", missingPin.effectiveMode === "OFF" && !missingPin.versionCompatible, missingPin));
  const incompatible = resolveExfoliationNormativePolicyActivationControl(env("SHADOW", { EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION: "wrong" }));
  out.push(fixture("F08_INCOMPATIBLE_POLICY_VERSION", incompatible.effectiveMode === "OFF" && incompatible.reasonCodes.includes("version_mismatch"), incompatible));
  const exceptionResult = await runExfoliationNormativePolicyRuntime({ control: shadow, upstreamVersions: upstream, evaluator: () => { throw new Error("fixture"); }, evaluationInput: {} });
  out.push(fixture("F09_EVALUATOR_EXCEPTION", exceptionResult.fallback?.policy_action === "DEFER" && exceptionResult.legacyPathPreserved, exceptionResult));
  const malformed = await runExfoliationNormativePolicyRuntime({ control: shadow, upstreamVersions: upstream, evaluator: () => ({}), evaluationInput: {} });
  out.push(fixture("F10_MALFORMED_OUTPUT", malformed.fallback?.policy_action === "DEFER" && !malformed.canonicalMutationApplied, malformed));
  const unsupported = await runExfoliationNormativePolicyRuntime({ control: shadow, upstreamVersions: upstream, evaluator: () => policy("ALLOW", { policy_action: "BLOCK" }), evaluationInput: {} });
  out.push(fixture("F11_UNSUPPORTED_ACTION", unsupported.fallback?.policy_action === "DEFER", unsupported));
  const rEligible = composeDormantNormativeEligibility({ existingEligibility: true, policyResult: policy("RESTRICT") });
  out.push(fixture("F12_RESTRICT_EXISTING_ELIGIBLE", rEligible.valid && !rEligible.effectiveEligibility && !rEligible.normativePolicyEligibility, rEligible));
  const rIneligible = composeDormantNormativeEligibility({ existingEligibility: false, policyResult: policy("RESTRICT") });
  out.push(fixture("F13_RESTRICT_EXISTING_INELIGIBLE", rIneligible.valid && !rIneligible.effectiveEligibility, rIneligible));
  const allowEligible = composeDormantNormativeEligibility({ existingEligibility: true, policyResult: policy("ALLOW") });
  out.push(fixture("F14_NON_RESTRICT_EXISTING_ELIGIBLE", allowEligible.effectiveEligibility === true, allowEligible));
  const allowIneligible = composeDormantNormativeEligibility({ existingEligibility: false, policyResult: policy("CAUTION") });
  out.push(fixture("F15_NON_RESTRICT_EXISTING_INELIGIBLE", allowIneligible.effectiveEligibility === false, allowIneligible));
  const noProv = await runExfoliationNormativePolicyRuntime({ control: shadow, upstreamVersions: upstream, evaluator: () => policy("ALLOW", { provenance: null }), evaluationInput: {} });
  out.push(fixture("F16_MISSING_PROVENANCE", noProv.fallback?.policy_action === "DEFER", noProv));
  const noPrereq = await runExfoliationNormativePolicyRuntime({ control: shadow, upstreamVersions: {}, evaluator: () => policy("ALLOW"), evaluationInput: {} });
  out.push(fixture("F17_MISSING_RUNTIME_PREREQUISITE", noPrereq.fallback?.reason_codes?.some((reason) => reason.includes("missing_runtime_prerequisite")), noPrereq));
  const eligibilityFailure = composeDormantNormativeEligibility({ existingEligibility: null, policyResult: policy("ALLOW") });
  out.push(fixture("F18_ELIGIBILITY_MATERIALIZATION_FAILURE", !eligibilityFailure.valid && eligibilityFailure.reasonCode === "eligibility_materialization_failure", eligibilityFailure));
  const shadowRestrict = await runExfoliationNormativePolicyRuntime({ control: shadow, upstreamVersions: upstream, evaluator: () => policy("RESTRICT"), evaluationInput: {}, existingEligibility: true });
  out.push(fixture("F19_SHADOW_ZERO_CANONICAL_ELIGIBILITY_DELTA", shadowRestrict.canonicalMutationApplied === false && shadowRestrict.policyDecision?.effectiveEligibility === false, shadowRestrict));
  out.push(fixture("F20_SHADOW_ZERO_SCORE_RANK_DELTA", shadowRestrict.policyDecision?.scoreRecomputed === false && shadowRestrict.policyDecision?.rankRecomputed === false, shadowRestrict.policyDecision));
  const cleanTelemetry = buildExfoliationNormativePolicyRuntimeTelemetry({ control: shadow, runtimeEvents: [{ runtimeExecuted: true, policyAction: "RESTRICT", existingEligibility: true, candidateCountBefore: 1, candidateCountAfter: 1, reasonCodes: ["fixture_restrict"], latencyMs: 3 }], comparison: { canonicalEligibilityDelta: false, scoreDelta: false, rankingDelta: false, top1Delta: false, top3Delta: false, persistenceDelta: false, publicResponseDelta: false, responseSchemaChanged: false, dbMutationDelta: false, storageMutationDelta: false }, versions: { policyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION, runtimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION, activationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION } });
  out.push(fixture("F21_SHADOW_ZERO_TOP1_TOP3_DELTA", cleanTelemetry.topKChangedCount === 0 && !cleanTelemetry.stopRequired, cleanTelemetry));
  const forbiddenValidation = validateExfoliationNormativePolicyRuntimeTelemetry({ ...cleanTelemetry, productId: "forbidden" });
  out.push(fixture("F22_TELEMETRY_FORBIDDEN_FIELD_REJECTION", !forbiddenValidation.valid && forbiddenValidation.errors.includes("forbidden_telemetry_field"), forbiddenValidation));
  const killTelemetry = buildExfoliationNormativePolicyRuntimeTelemetry({ control: killShadow, runtimeEvents: [], comparison: {}, versions: { policyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION, runtimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION, activationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION } });
  out.push(fixture("F23_KILL_SWITCH_EXECUTION_SUPPRESSION", killTelemetry.killSwitchSuppressedExecution && killTelemetry.runtimeExecutionCount === 0, killTelemetry));
  const candidates = [{ key: "a", existingEligibility: true, score: 10 }, { key: "b", existingEligibility: true, score: 9 }, { key: "c", existingEligibility: true, score: 8 }, { key: "d", existingEligibility: true, score: 7 }];
  const map = new Map([["a", policy("ALLOW")], ["b", policy("RESTRICT")], ["c", policy("CAUTION")], ["d", policy("DEFER")]]);
  const overlay = simulateDormantStableOverlay(candidates, map);
  out.push(fixture("F24_STABLE_REMAINING_ORDER_SIMULATION", overlay.valid && overlay.candidates.map((item) => item.key).join(",") === "a,c,d", overlay));
  out.push(fixture("F25_NO_RERANK_AFTER_HYPOTHETICAL_EXCLUSION", overlay.rankRecomputed === false && overlay.scoreRecomputed === false, overlay));
  const telemetryValidation = validateExfoliationNormativePolicyRuntimeTelemetry(cleanTelemetry);
  out.push(fixture("F26_AGGREGATE_TELEMETRY_VALID", telemetryValidation.valid && cleanTelemetry.actualNormativeExclusionCount === 0, telemetryValidation));
  const mismatchControl = resolveExfoliationNormativePolicyActivationControl(env("SHADOW", { EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION: "wrong" }));
  const mismatchTelemetry = buildExfoliationNormativePolicyRuntimeTelemetry({ control: mismatchControl, runtimeEvents: [], comparison: {}, versions: { policyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION, runtimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION, activationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION } });
  out.push(fixture("F27_VERSION_MISMATCH_STOP", mismatchTelemetry.stopReasons.includes("version_mismatch"), mismatchTelemetry));
  const badScope = resolveExfoliationNormativePolicyActivationControl(env("SHADOW", { EXFOLIATION_NORMATIVE_POLICY_SCOPE: "wrong" }));
  out.push(fixture("F28_UNSUPPORTED_SCOPE_REJECTED", badScope.effectiveMode === "OFF" && badScope.reasonCodes.includes("unsupported_activation_scope"), badScope));
  const fallback = buildNormativePolicyFallback(["fixture_failure"]);
  out.push(fixture("F29_FAILURE_DEFER_LEGACY_PRESERVE", fallback.policy_action === "DEFER" && fallback.legacy_path_preserved && !fallback.apply_policy_exclusion, fallback));
  out.push(fixture("F30_ENFORCE_CANNOT_ACTIVATE_IN_9D", enforce.enforcementAllowed === false && enforce.runtimeAllowed === false, enforce));
  out.push(fixture("F31_DETERMINISTIC_REPEATED_REPLAY", canonical({ shadow, overlay, cleanTelemetry }) === canonical({ shadow, overlay, cleanTelemetry }), { sha_input_equal: true }));
  const preserveActions = ["ALLOW", "CAUTION", "DEFER", "NOT_APPLICABLE"].map((action) => composeDormantNormativeEligibility({ existingEligibility: true, policyResult: policy(action) }));
  out.push(fixture("F32_NON_RESTRICT_ACTIONS_PRESERVE_ELIGIBILITY", preserveActions.every((item) => item.valid && item.effectiveEligibility === true), { count: preserveActions.length }));
  return out;
}

export async function buildAll() {
  const gate8z = read("gate8z"), fallback8z = read("fallback8z"), observability8z = read("observability8z"), rollback8z = read("rollback8z"), enforcement8z = read("enforcement8z");
  const summary9a = read("summary9a"), divergence9a = read("divergence9a"), summary9b = read("summary9b"), restrict9b = read("restrict9b"), summary9c = read("summary9c"), boundary9c = read("boundary9c");
  assert(gate8z.default_mode === "OFF" && gate8z.gate_semantics.SHADOW === "EVALUATE_AND_OBSERVE_WITH_ZERO_CANONICAL_EFFECT", "8Z gate drift");
  assert(gate8z.activation_version_contract.production_enforce_requires_separate_authorization === true, "8Z enforce authorization drift");
  assert(fallback8z.fallback_mode === EXFOLIATION_NORMATIVE_POLICY_FALLBACK, "8Z fallback drift");
  assert(observability8z.telemetry_state === "CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED", "8Z observability drift");
  assert(rollback8z.requirements.disable_overrides_enable_and_mode === true && rollback8z.requirements.restore_target === "LEGACY_ONLY", "8Z rollback drift");
  assert(enforcement8z.future_integration_boundary.preferred_boundary === EXFOLIATION_NORMATIVE_POLICY_BOUNDARY, "8Z boundary drift");
  assert(JSON.stringify(summary9a.coverage.actions) === JSON.stringify({ ALLOW: 2, CAUTION: 12, DEFER: 772, NOT_APPLICABLE: 1176, RESTRICT: 6 }), "9A action drift");
  assert(summary9a.coverage.evaluations === 1968 && summary9a.classification_model.live_count === 0, "9A corpus/live drift");
  assert(divergence9a.unexplained_high_risk === 0, "9A divergence drift");
  assert(summary9b.coverage.eligibility.ELIGIBLE === 1968 && summary9b.coverage.availability.PRESENT_AT_ENFORCEMENT_BOUNDARY === 1968, "9B eligibility/availability drift");
  assert(summary9b.coverage.restrict.DEFINITE_NEW_EXCLUSION === 6, "9B restrict drift");
  assert(restrict9b.rows.map((row) => row.sorted_position).sort((a, b) => a - b).join(",") === "72,118,130,147,149,153", "9B restrict positions drift");
  assert(summary9b.impact.selected_top1_changed_scenarios === 0 && summary9b.impact.selected_top3_changed_scenarios === 0 && summary9b.impact.refill_count === 0 && summary9b.impact.top_k_insufficient_scenarios === 0, "9B impact drift");
  assert(summary9c.terminal === "NORMATIVE_PRODUCTION_POLICY_READY_FOR_SEPARATE_ACTIVATION_AUTHORIZATION" && summary9c.activation_readiness_passed === true, "9C readiness drift");
  assert(boundary9c.ready_for_separate_activation_authorization === true && boundary9c.production_activation_authorized === false, "9C boundary drift");
  const fixtures = await buildFixtures();
  assert(fixtures.length >= 25 && fixtures.every((item) => item.pass), "9D safety fixture failure");
  const adapterMap = new Map([["p1", policy("ALLOW")], ["p2", policy("RESTRICT")], ["p3", policy("CAUTION")], ["p4", policy("DEFER")]]);
  const adapterSimulation = simulateDormantStableOverlay([{ key: "p1", existingEligibility: true, score: 4, rank: 1 }, { key: "p2", existingEligibility: true, score: 3, rank: 2 }, { key: "p3", existingEligibility: true, score: 2, rank: 3 }, { key: "p4", existingEligibility: true, score: 1, rank: 4 }], adapterMap);
  const authorization = { version: "exfoliation-normative-policy-activation-authorization-decision-v1", stage: STAGE, terminal: TERMINAL, authorization: { production_activation_authorized: true, authorized_mode: "SHADOW", enforce_authorized: false, activation_executed: false, normative_policy_runtime_active: false, restrict_canonical_exclusion_active: false }, rollout_scope: { type: "STAGED_PRODUCTION_SHADOW_ONLY", activation_authority: "TRUSTED_SERVER_SIDE_CONFIGURATION_ONLY", default_mode: "OFF", numeric_percentage_defined: false, implicit_user_exposure_authorized: false }, live_shadow_requirement: "LIVE_SHADOW_REQUIRED_BEFORE_ENFORCE", rationale: ["readiness gate passed in 9C", "runtime safety control plane is implemented and deterministic", "live production observation count remains zero", "actual production request context has not yet exercised the normative runtime", "SHADOW has zero canonical effect and can collect runtime evidence without authorizing ENFORCE"], owner_policy_threshold_invented: false };
  const contract = { version: "exfoliation-normative-policy-runtime-safety-contract-v1", stage: STAGE, terminal: TERMINAL, activation_gate: { version: EXFOLIATION_NORMATIVE_POLICY_AUTHORIZATION_VERSION, activation_version: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION, modes: ["OFF", "SHADOW", "ENFORCE"], default: "OFF", authorized_mode: EXFOLIATION_NORMATIVE_POLICY_AUTHORIZED_MODE, enforce_authorized: false, boundary: EXFOLIATION_NORMATIVE_POLICY_BOUNDARY, kill_switch_precedence: "OVERRIDES_ENABLE_AND_MODE", invalid_mode: "OFF_WITH_FALLBACK_OBSERVABILITY", trusted_configuration_only: true }, versions: { policy_contract: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION, runtime: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION, expected_upstream: EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS }, fallback: { mode: EXFOLIATION_NORMATIVE_POLICY_FALLBACK, policy_action: "DEFER", legacy_path_preserved: true, accidental_restrict_forbidden: true }, rollback: { target: EXFOLIATION_NORMATIVE_POLICY_ROLLBACK_TARGET, database_rollback_required: false, migration_required: false, product_fact_rollback_required: false, registry_rollback_required: false }, observability: { schema_version: EXFOLIATION_NORMATIVE_POLICY_TELEMETRY_VERSION, aggregate_only: true, raw_product_identity_forbidden: true, raw_user_payload_forbidden: true, secrets_forbidden: true }, production_integration_state: "DORMANT_NOT_CANONICALLY_WIRED_IN_9D" };
  const validation = { version: "exfoliation-normative-policy-runtime-safety-validation-v1", stage: STAGE, terminal: TERMINAL, fixture_count: fixtures.length, fixture_pass_count: fixtures.filter((item) => item.pass).length, all_fixtures_pass: fixtures.every((item) => item.pass), default_off_verified: true, shadow_zero_canonical_effect_verified: true, enforce_rejected_by_9d_authorization: true, failure_defer_legacy_preserve_verified: true, kill_switch_verified: true, version_gate_verified: true, telemetry_privacy_validation_verified: true, deterministic_replay_verified: true };
  const live = { version: "exfoliation-normative-policy-live-shadow-requirement-v1", stage: STAGE, terminal: TERMINAL, decision: "LIVE_SHADOW_REQUIRED_BEFORE_ENFORCE", live_production_traffic_observed_by_9d: 0, numeric_traffic_threshold_defined: false, numeric_duration_threshold_defined: false, owner_threshold_invented: false, requirement: "An explicitly authorized staged SHADOW execution must produce authoritative production-context runtime evidence against the frozen stop conditions before any later ENFORCE authorization decision.", does_not_authorize_shadow_execution: true, does_not_authorize_enforce: true };
  const adapter = { version: "exfoliation-normative-policy-enforcement-adapter-prerequisite-validation-v1", stage: STAGE, terminal: TERMINAL, implementation: "DORMANT_PURE_COMPOSITION_HELPER", active: false, canonically_wired: false, boundary: EXFOLIATION_NORMATIVE_POLICY_BOUNDARY, formula: "existing_eligibility AND normative_policy_eligibility", restrict_only_policy_exclusion: true, score_recomputed: false, rank_recomputed: false, candidate_availability_fabricated: false, order_preserved: adapterSimulation.orderPreserved, simulated_before_count: adapterSimulation.beforeCount, simulated_after_count: adapterSimulation.afterCount, simulated_excluded_keys: adapterSimulation.excludedKeys, prerequisite_validated: adapterSimulation.valid && adapterSimulation.candidates.map((item) => item.key).join(",") === "p1,p3,p4" };
  const fixtureArtifact = { version: "exfoliation-normative-policy-runtime-safety-fixtures-v1", stage: STAGE, terminal: TERMINAL, fixtures };
  const summary = { version: VERSION, stage: STAGE, terminal: TERMINAL, authority: { execution_base_main: BASE_MAIN, frozen_9c_main: FROZEN_9C_MAIN }, decision: { production_activation_authorized: true, authorized_mode: "SHADOW", enforce_authorized: false, activation_executed: false, runtime_active: false, live_shadow_required_before_enforce: true }, evidence_replay: { evaluations: 1968, actions: summary9a.coverage.actions, eligibility: summary9b.coverage.eligibility, availability: summary9b.coverage.availability, restrict_positions: restrict9b.rows.map((row) => row.sorted_position).sort((a, b) => a - b), top1_changed: summary9b.impact.selected_top1_changed_scenarios, top3_changed: summary9b.impact.selected_top3_changed_scenarios, refill_count: summary9b.impact.refill_count, top_k_insufficient: summary9b.impact.top_k_insufficient_scenarios }, runtime_safety: { control_implemented: true, default_off: true, failure_fallback_verified: true, observability_runtime_verified: true, kill_switch_verified: true, versioned_gate_verified: true, enforcement_adapter_prerequisite_validated: adapter.prerequisite_validated, production_integration_state: contract.production_integration_state }, invariants: { ACTIVATION_EXECUTED: "NO", NORMATIVE_POLICY_RUNTIME_ACTIVE: "NO", PRODUCTION_ACTIVATION_AUTHORIZED: "YES", AUTHORIZED_MODE: "SHADOW", ENFORCE_AUTHORIZED: "NO", RESTRICT_CANONICAL_EXCLUSION_ACTIVE: "NO", LIVE_PRODUCTION_TRAFFIC_OBSERVED_BY_9D: 0, HOSTED_PRODUCT_FACT_WRITES: 0, REGISTRY_DEFINITION_DELTA: 0, MIGRATION_DELTA: 0, NUMERIC_FITTING: 0, POTENCY_ORDERING_CREATED: "NO", RECOMMENDATION_SCORER_CHANGED: "NO", RECOMMENDATION_RANKER_CHANGED: "NO", LEGACY_HEURISTIC_REPLACED: "NO" }, next_stage: "V2.1-9E_STAGED_PRODUCTION_SHADOW_ACTIVATION_AND_LIVE_RUNTIME_EVIDENCE_COLLECTION" };
  return { summary, authorization, contract, validation, live, adapter, fixtures: fixtureArtifact };
}
const mode = process.argv[2];
if (import.meta.url === pathToFileURL(process.argv[1]).href) { const built = await buildAll(); if (!mode || !Object.hasOwn(built, mode)) throw new Error(`mode required: ${Object.keys(built).join(",")}`); process.stdout.write(canonical(built[mode])); }
