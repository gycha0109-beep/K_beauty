#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  evaluateExfoliationNormativeProductionPolicyShadow
} from "../../lib/exfoliation-non-numeric-pda-normative-production-policy-shadow.js";
import {
  materializeExfoliationProductionConsumptionEnvelope
} from "../../lib/exfoliation-non-numeric-pda-production-consumption-shadow.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_BOUNDARY,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
  EXFOLIATION_NORMATIVE_POLICY_FALLBACK,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
  resolveExfoliationNormativePolicyActivationControl,
  runExfoliationNormativePolicyRuntime
} from "../../lib/exfoliation-normative-policy-activation-runtime.js";
import {
  buildExfoliationNormativePolicyRuntimeTelemetry,
  validateExfoliationNormativePolicyRuntimeTelemetry
} from "../../lib/exfoliation-normative-policy-runtime-observability.js";

export const STAGE = "V2.1-9I";
export const VERSION = "v21-9i-prelaunch-robustness-remediation-v1";
export const STARTING_MAIN = "a93a997d26dd01cd708fb4319c3fe953aa99cc4f";
export const TERMINAL_CANDIDATE = "PRE_LAUNCH_ROBUSTNESS_AND_SYNTHETIC_CONTEXT_VALIDATION_PASSED";
export const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
export const ARTIFACT_FILE = "v21-9i-prelaunch-robustness-remediation-v1.json";
export const MANIFEST_FILE = "v21-9i-prelaunch-robustness-remediation-manifest-v1.json";
const CONTRACT_FILE = "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1.json";
const HISTORICAL_SOURCE_FILE = "exfoliation-non-numeric-pda-normative-production-policy-canonical-examples-v1.json";
const CURRENT_INPUT_FILE = "exfoliation-non-numeric-pda-current-input-v1.json";
const SYNTHETIC_FIXTURE_FILE = "v21-9i-remediated-synthetic-contexts-v1.json";
const REFERENCE_SHA = "783afb91a964f5d762f46846f9ef854902b48e95";

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
export const canonical = (value) => `${JSON.stringify(stable(value))}\n`;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (name) => JSON.parse(readFileSync(path.join(ROOT, name), "utf8"));
const countActions = (actions) => Object.fromEntries(
  Object.entries(actions.reduce((acc, action) => {
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b, "en"))
);

function runNode(script, args = [], env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`command failed: ${script}\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout;
}

function parseJsonObject(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("JSON summary not found");
  return JSON.parse(stdout.slice(start, end + 1));
}

function validActivationEnv(overrides = {}) {
  return {
    EXFOLIATION_NORMATIVE_POLICY_ENABLED: "1",
    EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "0",
    EXFOLIATION_NORMATIVE_POLICY_MODE: "SHADOW",
    EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_SCOPE: EXFOLIATION_NORMATIVE_POLICY_BOUNDARY,
    ...overrides
  };
}

function basePolicyInput() {
  return {
    productionConsumptionEnvelope: {
      version: "exfoliation-non-numeric-pda-production-consumption-shadow-v1",
      neutral_gate: "READY_FOR_SEPARATE_POLICY_EVALUATION",
      production_authority: false,
      production_decision: "UNSPECIFIED",
      provenance: { source: "V2.1-9I_FULL_REMEDIATION_TEST_HARNESS" }
    },
    externalPolicyContext: {
      recent_instability_guard_decision: "no_guard",
      routine_action: "keep",
      same_window_severity: "none",
      duplicate_exfoliation: false,
      sensitivity_context: false,
      recent_reaction_or_instability: false,
      governed_identity_overlap: false,
      preference_ranking_benefit: false
    },
    governedContext: {
      signal_status: "ACTIVE_PRESENT",
      coverage: "ADEQUATE",
      multi_active_status: "SINGLE",
      concentration_state: "AVAILABLE_OR_NOT_REQUIRED",
      uncertainty: "LOW",
      governed_identity_overlap: false
    },
    provenance: {
      stage: STAGE,
      evidence_classification: "DETERMINISTIC_VALIDATION"
    }
  };
}

async function buildSynthetic() {
  const refRoot = path.resolve(process.env.V21_9I_REFERENCE_ROOT || "_reference/recommendation");
  const stdout = runNode(
    "scripts/product-evidence/verify-v21-9i-score-scale-semantic-remediation-v1.mjs",
    [],
    { V21_9I_REFERENCE_ROOT: refRoot }
  );
  const summary = parseJsonObject(stdout);
  assert.equal(summary.context_count, 28);
  assert.equal(summary.product_count, 164);
  assert.equal(summary.replay_case_count, 4592);
  assert.equal(summary.runtime_execution_count, 4592);
  assert.deepEqual(summary.action_counts, {
    ALLOW: 28,
    CAUTION: 2,
    RESTRICT: 20,
    DEFER: 4542,
    NOT_APPLICABLE: 0
  });
  assert.equal(summary.semantic_mismatch_count, 0);
  assert.equal(summary.fallback_count, 0);
  assert.equal(summary.actual_normative_exclusion_count, 0);
  const fixture = readJson(SYNTHETIC_FIXTURE_FILE);
  assert.equal(fixture.contexts.length, 28);
  assert.equal(fixture.fixture_lineage, "REMEDIATED_FIXTURE_VERSION");
  assert.equal(fixture.original_worker_fixture_recovered, false);
  return {
    fixture_file: SYNTHETIC_FIXTURE_FILE,
    fixture_lineage: fixture.fixture_lineage,
    original_worker_fixture_recovered: false,
    privacy_classification: fixture.privacy_classification,
    contexts: summary.context_count,
    products: summary.product_count,
    replay_cases: summary.replay_case_count,
    runtime_executions: summary.runtime_execution_count,
    action_distribution: summary.action_counts,
    semantic_mismatch_count: summary.semantic_mismatch_count,
    fallback_count: summary.fallback_count,
    actual_normative_exclusion_count: summary.actual_normative_exclusion_count,
    blocker_contexts_passed: summary.blocker_contexts_passed,
    boundary_17_18_19: summary.boundary_17_18_19,
    exact_module_execution: true
  };
}

function mappingContribution(contract, source, state) {
  const row = contract.external_context_mapping.find((item) => {
    if (item.source !== source) return false;
    const states = String(item.state || "").split("/").map((value) => value.trim());
    return states.includes(state);
  });
  return row?.contribution || "NONE";
}

async function buildPrecedence() {
  const contract = readJson(CONTRACT_FILE);
  const priority = contract.multi_external_conflict_resolution?.contribution_priority;
  assert.deepEqual(priority, ["RESTRICT", "DEFER", "CAUTION", "NONE"]);
  const safetyStates = ["no_guard", "allow_with_context", "insufficient_data", "hard_block_candidate"];
  const routineStates = ["keep", "reduce", "check_needed", "hold"];
  const windowStates = ["none", "warning", "blocked"];
  const cases = [];
  let index = 0;

  for (const safety of safetyStates) {
    for (const routine of routineStates) {
      for (const window of windowStates) {
        index += 1;
        const contributions = [
          mappingContribution(contract, "RecentInstabilityGuardPolicy", safety),
          mappingContribution(contract, "RoutinePolicy.productAction", routine),
          mappingContribution(contract, "RoutinePolicy.prohibitedSameWindow", window)
        ];
        const controlling = priority.find((value) => contributions.includes(value)) || "NONE";
        const expectedAction = controlling === "NONE" ? "ALLOW" : controlling;
        const input = basePolicyInput();
        input.externalPolicyContext.recent_instability_guard_decision = safety;
        input.externalPolicyContext.routine_action = routine;
        input.externalPolicyContext.same_window_severity = window;
        const actual = evaluateExfoliationNormativeProductionPolicyShadow(input);
        cases.push({
          case_id: `P${String(index).padStart(2, "0")}`,
          safety_input: safety,
          routine_input: routine,
          same_window_input: window,
          expected_controlling_precedence: controlling,
          actual_output: actual.policy_action,
          pass: actual.policy_action === expectedAction
        });
      }
    }
  }
  assert.equal(cases.length, 48);
  assert.ok(cases.every((item) => item.pass));
  return {
    contract_source: CONTRACT_FILE,
    cartesian: { safety: 4, routine: 4, same_window: 3 },
    total: 48,
    pass_count: 48,
    failure_count: 0,
    production_mapper_direct_execution: true,
    cases
  };
}

function buildNotApplicable(synthetic) {
  const envelope = materializeExfoliationProductionConsumptionEnvelope({
    input: {
      signal_status: "NOT_APPLICABLE",
      active_identities: [],
      current_identity_sets: [],
      missing_context_keys: [],
      coverage_state: "not_applicable",
      external_context_completeness: "not_applicable",
      blocked: false,
      semantic_conflict: false
    },
    productId: null,
    intrinsicProvenance: { source: "V2.1-9I_REACHABILITY_PROBE" },
    externalProvenance: { source: "V2.1-9I_REACHABILITY_PROBE" }
  });
  const input = basePolicyInput();
  input.productionConsumptionEnvelope = envelope;
  input.governedContext = {
    signal_status: "NOT_APPLICABLE",
    coverage: "NOT_APPLICABLE",
    multi_active_status: "SINGLE",
    concentration_state: "AVAILABLE_OR_NOT_REQUIRED",
    uncertainty: "LOW",
    governed_identity_overlap: false
  };
  const actual = evaluateExfoliationNormativeProductionPolicyShadow(input);
  assert.equal(envelope.neutral_gate, "NOT_APPLICABLE");
  assert.equal(actual.policy_action, "NOT_APPLICABLE");
  assert.equal(synthetic.action_distribution.NOT_APPLICABLE, 0);
  return {
    classification: "REACHABLE_BY_CURRENT_CONTRACT_NOT_OBSERVED_IN_REMEDIATED_28_CONTEXT_REPLAY",
    production_consumption_gate: envelope.neutral_gate,
    production_mapper_action: actual.policy_action,
    remediated_28_context_observed_count: 0,
    forced_for_coverage: false,
    direct_module_execution: true
  };
}

async function buildFallbackAudit() {
  const shadow = resolveExfoliationNormativePolicyActivationControl(validActivationEnv());
  const upstream = { ...EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS };
  const exactEvaluator = (input) => evaluateExfoliationNormativeProductionPolicyShadow(input);
  const input = basePolicyInput();
  const cases = [];

  const push = (id, expected, observed, pass) => {
    cases.push({ case_id: id, expected_behavior: expected, observed: stable(observed), pass: Boolean(pass) });
  };

  const disabled = resolveExfoliationNormativePolicyActivationControl(validActivationEnv({
    EXFOLIATION_NORMATIVE_POLICY_ENABLED: "0"
  }));
  push("F01_ACTIVATION_DISABLED", "OFF_PRESERVE_LEGACY", {
    effectiveMode: disabled.effectiveMode, runtimeAllowed: disabled.runtimeAllowed, reasonCodes: disabled.reasonCodes
  }, disabled.effectiveMode === "OFF" && !disabled.runtimeAllowed);

  const kill = resolveExfoliationNormativePolicyActivationControl(validActivationEnv({
    EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "1"
  }));
  push("F02_KILL_SWITCH", "OFF_PRESERVE_LEGACY", {
    effectiveMode: kill.effectiveMode, runtimeAllowed: kill.runtimeAllowed, reasonCodes: kill.reasonCodes
  }, kill.effectiveMode === "OFF" && kill.reasonCodes.includes("kill_switch_override"));

  const invalidMode = resolveExfoliationNormativePolicyActivationControl(validActivationEnv({
    EXFOLIATION_NORMATIVE_POLICY_MODE: "BOGUS"
  }));
  push("F03_INVALID_ACTIVATION_MODE", "OFF_INVALID_MODE", {
    effectiveMode: invalidMode.effectiveMode, modeValid: invalidMode.modeValid, reasonCodes: invalidMode.reasonCodes
  }, invalidMode.effectiveMode === "OFF" && invalidMode.reasonCodes.includes("invalid_activation_mode"));

  const versionMismatch = resolveExfoliationNormativePolicyActivationControl(validActivationEnv({
    EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION: "wrong"
  }));
  push("F04_VERSION_MISMATCH", "OFF_VERSION_MISMATCH", {
    effectiveMode: versionMismatch.effectiveMode, versionCompatible: versionMismatch.versionCompatible, reasonCodes: versionMismatch.reasonCodes
  }, versionMismatch.effectiveMode === "OFF" && versionMismatch.reasonCodes.includes("version_mismatch"));

  const badScope = resolveExfoliationNormativePolicyActivationControl(validActivationEnv({
    EXFOLIATION_NORMATIVE_POLICY_SCOPE: "wrong"
  }));
  push("F05_UNSUPPORTED_SCOPE", "OFF_UNSUPPORTED_SCOPE", {
    effectiveMode: badScope.effectiveMode, scopeValid: badScope.scopeValid, reasonCodes: badScope.reasonCodes
  }, badScope.effectiveMode === "OFF" && badScope.reasonCodes.includes("unsupported_activation_scope"));

  const enforce = resolveExfoliationNormativePolicyActivationControl(validActivationEnv({
    EXFOLIATION_NORMATIVE_POLICY_MODE: "ENFORCE"
  }));
  push("F06_UNAUTHORIZED_ENFORCE", "OFF_ENFORCE_UNAUTHORIZED", {
    effectiveMode: enforce.effectiveMode, enforcementAllowed: enforce.enforcementAllowed, reasonCodes: enforce.reasonCodes
  }, enforce.effectiveMode === "OFF" && !enforce.enforcementAllowed && enforce.reasonCodes.includes("enforce_not_authorized_by_v21_9d"));

  const missingEvaluator = await runExfoliationNormativePolicyRuntime({
    control: shadow, upstreamVersions: upstream, evaluator: null, evaluationInput: input
  });
  push("F07_EVALUATOR_MISSING", EXFOLIATION_NORMATIVE_POLICY_FALLBACK, {
    runtimeExecuted: missingEvaluator.runtimeExecuted,
    fallback: missingEvaluator.fallback,
    legacyPathPreserved: missingEvaluator.legacyPathPreserved
  }, missingEvaluator.fallback?.policy_action === "DEFER" && missingEvaluator.fallback?.reason_codes?.includes("evaluator_missing") && missingEvaluator.legacyPathPreserved);

  const exception = await runExfoliationNormativePolicyRuntime({
    control: shadow, upstreamVersions: upstream, evaluator: () => { throw new Error("fixture"); }, evaluationInput: input
  });
  push("F08_EVALUATOR_EXCEPTION", EXFOLIATION_NORMATIVE_POLICY_FALLBACK, {
    runtimeExecuted: exception.runtimeExecuted,
    fallback: exception.fallback,
    legacyPathPreserved: exception.legacyPathPreserved
  }, exception.fallback?.policy_action === "DEFER" && exception.fallback?.reason_codes?.includes("evaluator_exception") && exception.legacyPathPreserved);

  const invalidOutput = await runExfoliationNormativePolicyRuntime({
    control: shadow, upstreamVersions: upstream, evaluator: () => ({}), evaluationInput: input
  });
  push("F09_INVALID_POLICY_OUTPUT", EXFOLIATION_NORMATIVE_POLICY_FALLBACK, {
    runtimeExecuted: invalidOutput.runtimeExecuted,
    fallback: invalidOutput.fallback,
    legacyPathPreserved: invalidOutput.legacyPathPreserved
  }, invalidOutput.fallback?.policy_action === "DEFER" && invalidOutput.fallback?.reason_codes?.includes("invalid_policy_output") && invalidOutput.legacyPathPreserved);

  const malformedEligibility = await runExfoliationNormativePolicyRuntime({
    control: shadow, upstreamVersions: upstream, evaluator: exactEvaluator, evaluationInput: input, existingEligibility: null
  });
  push("F10_MALFORMED_ELIGIBILITY_INTERMEDIATE", EXFOLIATION_NORMATIVE_POLICY_FALLBACK, {
    runtimeExecuted: malformedEligibility.runtimeExecuted,
    fallback: malformedEligibility.fallback,
    legacyPathPreserved: malformedEligibility.legacyPathPreserved
  }, malformedEligibility.fallback?.policy_action === "DEFER" && malformedEligibility.fallback?.reason_codes?.includes("eligibility_materialization_failure") && malformedEligibility.legacyPathPreserved);

  const prereqMismatch = await runExfoliationNormativePolicyRuntime({
    control: shadow, upstreamVersions: {}, evaluator: exactEvaluator, evaluationInput: input
  });
  push("F11_UPSTREAM_PREREQUISITE_VERSION_MISMATCH", EXFOLIATION_NORMATIVE_POLICY_FALLBACK, {
    runtimeExecuted: prereqMismatch.runtimeExecuted,
    fallback: prereqMismatch.fallback,
    legacyPathPreserved: prereqMismatch.legacyPathPreserved
  }, prereqMismatch.fallback?.policy_action === "DEFER" && prereqMismatch.fallback?.reason_codes?.includes("missing_runtime_prerequisite") && prereqMismatch.legacyPathPreserved);

  const missingAuthorityInput = basePolicyInput();
  missingAuthorityInput.productionConsumptionEnvelope = {
    ...missingAuthorityInput.productionConsumptionEnvelope,
    neutral_gate: "DEFER_INSUFFICIENT_AUTHORITY"
  };
  missingAuthorityInput.governedContext = {
    signal_status: "UNKNOWN",
    coverage: "UNKNOWN",
    multi_active_status: "SINGLE",
    concentration_state: "MISSING",
    uncertainty: "HIGH",
    governed_identity_overlap: false
  };
  const missingAuthority = await runExfoliationNormativePolicyRuntime({
    control: shadow, upstreamVersions: upstream, evaluator: exactEvaluator,
    evaluationInput: missingAuthorityInput, existingEligibility: true
  });
  push("F12_MISSING_GOVERNED_AUTHORITY", "POLICY_DEFER_PRESERVE_LEGACY", {
    runtimeExecuted: missingAuthority.runtimeExecuted,
    policyAction: missingAuthority.policyResult?.policy_action,
    fallback: missingAuthority.fallback,
    canonicalMutationApplied: missingAuthority.canonicalMutationApplied,
    legacyPathPreserved: missingAuthority.legacyPathPreserved
  }, missingAuthority.policyResult?.policy_action === "DEFER" && missingAuthority.fallback === null && !missingAuthority.canonicalMutationApplied && missingAuthority.legacyPathPreserved);

  const telemetry = buildExfoliationNormativePolicyRuntimeTelemetry({
    control: shadow,
    runtimeEvents: [],
    comparison: {},
    versions: {
      policyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
      runtimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
      activationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION
    }
  });
  const telemetryFailure = validateExfoliationNormativePolicyRuntimeTelemetry({ ...telemetry, productId: "forbidden" });
  push("F13_TELEMETRY_VALIDATION_FAILURE_DETECTION", "REJECT_FORBIDDEN_TELEMETRY_FIELD", {
    valid: telemetryFailure.valid,
    errors: telemetryFailure.errors
  }, !telemetryFailure.valid && telemetryFailure.errors.includes("forbidden_telemetry_field"));

  assert.equal(cases.length, 13);
  assert.ok(cases.every((item) => item.pass));
  return {
    fallback_principle: EXFOLIATION_NORMATIVE_POLICY_FALLBACK,
    total: 13,
    pass_count: 13,
    failure_count: 0,
    actual_runtime_contract_direct_execution: true,
    cases
  };
}

function historicalCaseProjectionSource() {
  const canonicalExamples = readJson(HISTORICAL_SOURCE_FILE);
  const sourceCases = [...canonicalExamples.cases]
    .filter((item) => item?.neutral_envelope && item?.external_context && item?.governed_pda_state)
    .sort((a, b) => String(a.case_id).localeCompare(String(b.case_id), "en"));
  assert.ok(sourceCases.length >= 10, "insufficient historical canonical cases");

  const projected = [];
  const seen = new Set();
  for (const governedSource of sourceCases) {
    for (const externalSource of sourceCases) {
      const input = {
        productionConsumptionEnvelope: governedSource.neutral_envelope,
        externalPolicyContext: externalSource.external_context,
        governedContext: governedSource.governed_pda_state,
        provenance: {
          stage: STAGE,
          evidence_classification: "PRIVACY_SAFE_REPOSITORY_HISTORICAL_EVIDENCE_PROJECTION"
        }
      };
      const key = sha256(canonical({
        envelope: input.productionConsumptionEnvelope,
        external: input.externalPolicyContext,
        governed: input.governedContext
      }));
      if (seen.has(key)) continue;
      seen.add(key);
      projected.push({
        context_id: `HCTX-${String(projected.length + 1).padStart(3, "0")}`,
        governed_source_case_id: governedSource.case_id,
        external_source_case_id: externalSource.case_id,
        input,
        projection_sha256: key
      });
      if (projected.length === 40) return projected;
    }
  }
  throw new Error(`historical projection insufficient: ${projected.length}`);
}

function assertPrivacySafe(value) {
  const forbiddenKeys = new Set([
    "user_id", "userid", "session_id", "sessionid", "email", "name",
    "token", "secret", "raw_image", "image_url", "raw_survey", "free_text"
  ]);
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (forbiddenKeys.has(String(key).toLowerCase())) throw new Error(`privacy forbidden key: ${key}`);
      visit(child);
    }
  };
  visit(value);
}

function buildHistorical() {
  const currentInput = readJson(CURRENT_INPUT_FILE);
  const productIds = currentInput.catalog.map((row) => String(row[0])).sort((a, b) => a.localeCompare(b, "en"));
  assert.equal(productIds.length, 164);
  assert.equal(new Set(productIds).size, 164);

  const contexts = historicalCaseProjectionSource();
  const actions = [];
  const manifest = [];
  let executions = 0;
  for (const context of contexts) {
    let contextAction = null;
    for (const productId of productIds) {
      const result = evaluateExfoliationNormativeProductionPolicyShadow({
        ...context.input,
        provenance: {
          ...context.input.provenance,
          historical_context_id: context.context_id,
          catalog_product_reference: productId
        }
      });
      actions.push(result.policy_action);
      contextAction ??= result.policy_action;
      executions += 1;
    }
    manifest.push({
      context_id: context.context_id,
      governed_source_case_id: context.governed_source_case_id,
      external_source_case_id: context.external_source_case_id,
      neutral_gate: context.input.productionConsumptionEnvelope.neutral_gate,
      projected_input_sha256: context.projection_sha256,
      representative_action: contextAction
    });
  }
  assert.equal(contexts.length, 40);
  assert.equal(executions, 6560);
  const historical = {
    lineage: "PRIVACY_SAFE_REPOSITORY_HISTORICAL_EVIDENCE_PROJECTION",
    source_artifact: HISTORICAL_SOURCE_FILE,
    original_worker_corpus_recovered: false,
    initial_worker_reference_counts_are_authoritative: false,
    privacy_classification: "PRIVACY_SAFE_HISTORICAL_REPLAY",
    organic_evidence: false,
    live_user_evidence: false,
    raw_personal_data_committed: false,
    contexts: 40,
    products: 164,
    replay_cases: 6560,
    runtime_executions: executions,
    action_distribution: countActions(actions),
    exact_module_execution: true,
    context_manifest: manifest
  };
  assertPrivacySafe(historical);
  return historical;
}

function runCanonicalInvariance() {
  const refRoot = path.resolve(process.env.V21_9I_REFERENCE_ROOT || "_reference/recommendation");
  const common = {
    RECOMMENDATION_REFERENCE_ROOT: refRoot,
    V21_7_BASE_MAIN_SHA: "e2be97b9fcbf75ff43b6f7ecfe96a680aff4cb87",
    EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_SCOPE: EXFOLIATION_NORMATIVE_POLICY_BOUNDARY
  };
  const modes = {
    OFF: {
      EXFOLIATION_NORMATIVE_POLICY_ENABLED: "0",
      EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "0",
      EXFOLIATION_NORMATIVE_POLICY_MODE: "OFF"
    },
    SHADOW: {
      EXFOLIATION_NORMATIVE_POLICY_ENABLED: "1",
      EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "0",
      EXFOLIATION_NORMATIVE_POLICY_MODE: "SHADOW"
    }
  };
  for (const values of Object.values(modes)) {
    const env = { ...common, ...values };
    runNode("scripts/verify-product-decision-axis-comparator-v1.mjs", [], env);
    runNode("scripts/verify-skin-decision-recommendation-invariance.mjs", [], env);
  }
  const zero = {
    eligibility_delta: 0,
    score_delta: 0,
    ranking_delta: 0,
    candidate_set_delta: 0,
    top1_delta: 0,
    top3_delta: 0,
    public_response_delta: 0,
    persistence_delta: 0,
    actual_normative_exclusion_count: 0,
    legacy_path_preserved: true
  };
  return {
    OFF: { ...zero, status: "PASS" },
    SHADOW: { ...zero, status: "PASS" },
    exact_verifiers: [
      "scripts/verify-product-decision-axis-comparator-v1.mjs",
      "scripts/verify-skin-decision-recommendation-invariance.mjs"
    ]
  };
}

function runHistoricalRegressions() {
  const refRoot = path.resolve(process.env.V21_9I_REFERENCE_ROOT || "_reference/recommendation");
  runNode("scripts/product-evidence/verify-exfoliation-normative-policy-production-shadow-wiring-v1.mjs");
  runNode("scripts/product-evidence/verify-exfoliation-normative-policy-activation-authorization-runtime-safety-v1.mjs", [], {
    V21_9D_REQUIRE_CHECKED_IN: "1",
    RECOMMENDATION_REFERENCE_ROOT: refRoot
  });
  runNode("scripts/product-evidence/verify-v21-9i-routine-source-scale-contract-v1.mjs");
  return {
    historical_9e_wiring: "PASS",
    historical_9d_activation_safety: "PASS",
    v21_9i_sr_source_contract: "PASS"
  };
}

export async function buildAll() {
  const synthetic = await buildSynthetic();
  const notApplicable = buildNotApplicable(synthetic);
  const precedence = await buildPrecedence();
  const fallback = await buildFallbackAudit();
  const historical = buildHistorical();
  const invariance = runCanonicalInvariance();
  const regressions = runHistoricalRegressions();

  const artifact = {
    version: VERSION,
    stage: STAGE,
    closeout_scope: "PRE_LAUNCH_ROBUSTNESS_AND_SYNTHETIC_CONTEXT_VALIDATION",
    lifecycle_terminal_candidate: TERMINAL_CANDIDATE,
    authority: {
      repository: "gycha0109-beep/K_beauty",
      starting_main: STARTING_MAIN,
      reference_product_fixture_sha: REFERENCE_SHA,
      production_semantic_source_change_authorized: false
    },
    synthetic_replay: synthetic,
    not_applicable_reachability: notApplicable,
    precedence_audit: precedence,
    failure_fallback_audit: fallback,
    canonical_invariance: invariance,
    historical_replay: historical,
    regressions,
    determinism_contract: {
      canonical_serialization: "RECURSIVE_LEXICOGRAPHIC_KEY_ORDER",
      array_ordering: "EXPLICIT_DETERMINISTIC_SOURCE_OR_CASE_ORDER",
      encoding: "UTF-8",
      newline: "LF_FINAL_NEWLINE",
      timestamps_in_canonical_artifacts: false,
      random_ids_in_canonical_artifacts: false,
      environment_specific_paths_in_canonical_artifacts: false,
      execution_durations_in_canonical_artifacts: false,
      required_independent_builds: 2,
      fresh_bytes_must_equal_checked_in_bytes: true
    },
    semantic_invariants: {
      enforce_authorized: false,
      enforce_active: false,
      restrict_canonical_exclusion_active: false,
      scorer_mutation: false,
      ranker_mutation: false,
      product_fact_write: 0,
      registry_delta: 0,
      fixture_lineage_preserved: synthetic.fixture_lineage === "REMEDIATED_FIXTURE_VERSION",
      organic_evidence_claimed: false
    }
  };
  assertPrivacySafe(artifact);
  return artifact;
}

export function buildManifest(artifactBytes) {
  return {
    version: "v21-9i-prelaunch-robustness-remediation-manifest-v1",
    stage: STAGE,
    artifact_file: ARTIFACT_FILE,
    artifact_sha256: sha256(artifactBytes),
    canonical_serialization: "RECURSIVE_LEXICOGRAPHIC_KEY_ORDER_UTF8_LF",
    build_a_build_b_required: true,
    checked_in_byte_equality_required: true,
    timestamps_included: false,
    execution_durations_included: false,
    random_ids_included: false
  };
}

if (process.argv[1]?.endsWith("build-v21-9i-prelaunch-robustness-remediation-v1.mjs")) {
  const artifact = await buildAll();
  const artifactBytes = canonical(artifact);
  const manifest = buildManifest(artifactBytes);
  const manifestBytes = canonical(manifest);
  if (process.argv.includes("--emit-base64")) {
    process.stdout.write(`V21_9I_ARTIFACT_BASE64=${Buffer.from(artifactBytes, "utf8").toString("base64")}\n`);
    process.stdout.write(`V21_9I_MANIFEST_BASE64=${Buffer.from(manifestBytes, "utf8").toString("base64")}\n`);
  } else {
    process.stdout.write(JSON.stringify({
      stage: STAGE,
      version: VERSION,
      artifact_sha256: manifest.artifact_sha256,
      historical_actions: artifact.historical_replay.action_distribution,
      status: "PASS"
    }) + "\n");
  }
}
