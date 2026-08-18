#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
  resolveExfoliationNormativePolicyActivationControl,
  runExfoliationNormativePolicyRuntime
} from "../../lib/exfoliation-normative-policy-activation-runtime.js";
import {
  buildExfoliationNormativePolicyRuntimeTelemetry,
  validateExfoliationNormativePolicyRuntimeTelemetry
} from "../../lib/exfoliation-normative-policy-runtime-observability.js";
import {
  evaluateExfoliationNormativeProductionPolicyShadow
} from "../../lib/exfoliation-non-numeric-pda-normative-production-policy-shadow.js";
import {
  listExfoliationNormativePolicyGovernedRuntimeProductIds
} from "../../lib/exfoliation-normative-policy-governed-runtime-authority.js";
import {
  observeExfoliationNormativePolicyProductionShadow
} from "../../lib/exfoliation-normative-policy-production-shadow-observer.js";
import {
  buildExfoliationNormativePolicyRuntimeStateReadback
} from "../../lib/exfoliation-normative-policy-runtime-state-readback.js";

let assertions = 0;
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };

function env(overrides = {}) {
  return {
    EXFOLIATION_NORMATIVE_POLICY_ENABLED: "1",
    EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "0",
    EXFOLIATION_NORMATIVE_POLICY_MODE: "SHADOW",
    EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
    EXFOLIATION_NORMATIVE_POLICY_SCOPE:
      "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY",
    ...overrides
  };
}

const noConfig = resolveExfoliationNormativePolicyActivationControl({});
eq(noConfig.effectiveMode, "OFF", "no config defaults OFF");
ok(noConfig.runtimeAllowed === false, "no config runtime disabled");

const shadowControl = resolveExfoliationNormativePolicyActivationControl(env());
eq(shadowControl.effectiveMode, "SHADOW", "valid SHADOW config activates shadow only");
ok(shadowControl.runtimeAllowed === true && shadowControl.enforcementAllowed === false, "shadow runtime allowed and enforce forbidden");

const enforceControl = resolveExfoliationNormativePolicyActivationControl(env({ EXFOLIATION_NORMATIVE_POLICY_MODE: "ENFORCE" }));
eq(enforceControl.effectiveMode, "OFF", "ENFORCE request rejected to OFF");
ok(enforceControl.reasonCodes.includes("enforce_not_authorized_by_v21_9d"), "ENFORCE rejection reason");

const killControl = resolveExfoliationNormativePolicyActivationControl(env({ EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "1" }));
eq(killControl.effectiveMode, "OFF", "kill switch overrides SHADOW");
ok(killControl.reasonCodes.includes("kill_switch_override"), "kill switch reason");

for (const [key, value, reason] of [
  ["EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION", "wrong", "activation version"],
  ["EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION", "wrong", "contract version"],
  ["EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION", "wrong", "runtime version"]
]) {
  const control = resolveExfoliationNormativePolicyActivationControl(env({ [key]: value }));
  eq(control.effectiveMode, "OFF", `${reason} mismatch rejects to OFF`);
  ok(control.reasonCodes.includes("version_mismatch"), `${reason} mismatch reason`);
}

const wrongScope = resolveExfoliationNormativePolicyActivationControl(env({
  EXFOLIATION_NORMATIVE_POLICY_SCOPE: "WRONG_SCOPE"
}));
eq(wrongScope.effectiveMode, "OFF", "wrong scope rejects to OFF");
ok(wrongScope.reasonCodes.includes("unsupported_activation_scope"), "wrong scope reason");

eq(listExfoliationNormativePolicyGovernedRuntimeProductIds().length, 4, "four governed runtime products materialized");

const readbackOff = buildExfoliationNormativePolicyRuntimeStateReadback(env({
  EXFOLIATION_NORMATIVE_POLICY_ENABLED: "0",
  EXFOLIATION_NORMATIVE_POLICY_MODE: "OFF",
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  VERCEL_GIT_COMMIT_SHA: "exact-production-sha"
}));
eq(readbackOff.effectiveMode, "OFF", "production readback resolves OFF");
ok(readbackOff.runtimeActive === false && readbackOff.enforceActive === false, "OFF readback is inactive and never enforcing");
eq(readbackOff.deploymentSha, "exact-production-sha", "readback carries exact deployment SHA");
ok(readbackOff.versionCompatible === true && readbackOff.scopeValid === true, "OFF readback verifies exact version and scope pins");

const readbackShadow = buildExfoliationNormativePolicyRuntimeStateReadback(env({
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  VERCEL_GIT_COMMIT_SHA: "exact-production-sha"
}));
eq(readbackShadow.effectiveMode, "SHADOW", "production readback resolves SHADOW");
ok(readbackShadow.runtimeActive === true && readbackShadow.enforcementAllowed === false && readbackShadow.enforceActive === false, "SHADOW readback remains non-enforcing");

const readbackEnforceRequest = buildExfoliationNormativePolicyRuntimeStateReadback(env({
  EXFOLIATION_NORMATIVE_POLICY_MODE: "ENFORCE",
  VERCEL_ENV: "production"
}));
eq(readbackEnforceRequest.effectiveMode, "OFF", "readback proves ENFORCE request cannot become effective");
ok(readbackEnforceRequest.reasonCodes.includes("enforce_not_authorized_by_v21_9d"), "readback exposes ENFORCE rejection reason");
ok(!Object.keys(readbackShadow).some((key) => /(secret|token|cookie|authorization|api.?key)/i.test(key)), "readback exposes no secret-bearing fields");

const candidates = [
  {
    id: "non-governed-a",
    name: "Synthetic A",
    brand: "Synthetic",
    category: "treatment",
    engine_score: 91,
    score: 91
  },
  {
    id: "non-governed-b",
    name: "Synthetic B",
    brand: "Synthetic",
    category: "toner_essence",
    engine_score: 90,
    score: 90
  }
];
const beforeCandidates = JSON.stringify(candidates);
const emitted = [];
const offObservation = await observeExfoliationNormativePolicyProductionShadow({
  input: {
    EXFOLIATION_NORMATIVE_POLICY_ENABLED: "1",
    EXFOLIATION_NORMATIVE_POLICY_MODE: "SHADOW"
  },
  candidates,
  priorityAxis: "pores",
  scoreCard: {},
  currentProductsReport: null,
  envLike: {},
  telemetrySink: (...args) => emitted.push(args)
});
eq(offObservation.effectiveMode, "OFF", "request/browser-like input cannot activate runtime");
ok(offObservation.runtimeActive === false, "OFF observation inactive");
eq(offObservation.telemetry.candidateCountBefore, 2, "OFF candidate count observed");
eq(offObservation.telemetry.candidateCountAfter, 2, "OFF candidate count preserved");
ok(offObservation.telemetryEmitted === true, "OFF aggregate telemetry emitted");
eq(JSON.stringify(candidates), beforeCandidates, "OFF leaves canonical candidates byte-equivalent");

const shadowEmitted = [];
const shadowObservation = await observeExfoliationNormativePolicyProductionShadow({
  input: {},
  candidates,
  priorityAxis: "pores",
  scoreCard: {},
  currentProductsReport: null,
  envLike: env(),
  telemetrySink: (...args) => shadowEmitted.push(args)
});
eq(shadowObservation.effectiveMode, "SHADOW", "observer executes SHADOW");
ok(shadowObservation.runtimeActive === true, "SHADOW observer active");
eq(shadowObservation.telemetry.runtimeExecutionCount, 2, "SHADOW evaluates candidates");
eq(shadowObservation.telemetry.actionCounts.DEFER, 2, "ungoverned products defer without invented authority");
eq(shadowObservation.telemetry.actualNormativeExclusionCount, 0, "SHADOW performs zero actual normative exclusions");
eq(shadowObservation.restrictCanonicalExclusionCount, 0, "RESTRICT canonical exclusion count fixed zero");
ok(shadowObservation.canonicalMutationApplied === false && shadowObservation.legacyPathPreserved === true, "SHADOW preserves canonical legacy path");
eq(JSON.stringify(candidates), beforeCandidates, "SHADOW leaves canonical candidates byte-equivalent");
ok(shadowObservation.telemetry.stopRequired === false, "normal SHADOW telemetry has no stop condition");

const readyEnvelope = {
  neutral_gate: "READY_FOR_SEPARATE_POLICY_EVALUATION",
  signal_status: "GOVERNED_SIGNAL_ESTABLISHED",
  coverage_state: "active_identity_with_unscaled_context",
  version: "exfoliation-non-numeric-pda-production-consumption-shadow-v1"
};
const restrictRuntime = await runExfoliationNormativePolicyRuntime({
  control: shadowControl,
  upstreamVersions: EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
  evaluator: evaluateExfoliationNormativeProductionPolicyShadow,
  evaluationInput: {
    productionConsumptionEnvelope: readyEnvelope,
    externalPolicyContext: {
      recent_instability_guard_decision: "hard_block_candidate",
      routine_action: "keep",
      same_window_severity: "none",
      duplicate_exfoliation: false,
      sensitivity_context: true,
      recent_reaction_or_instability: true,
      preference_ranking_benefit: false
    },
    governedContext: {
      signal_status: "GOVERNED_SIGNAL_ESTABLISHED",
      coverage: "active_identity_with_unscaled_context",
      uncertainty: "LOW",
      concentration_state: "MISSING",
      multi_active_status: "SINGLE",
      legacy_strength_comparable: "NOT_RELEVANT"
    }
  },
  existingEligibility: true
});
eq(restrictRuntime.policyResult.policy_action, "RESTRICT", "bounded policy can observe hypothetical RESTRICT");
ok(restrictRuntime.policyDecision.effectiveEligibility === false, "dormant overlay models hypothetical exclusion");
ok(restrictRuntime.canonicalMutationApplied === false && restrictRuntime.legacyPathPreserved === true, "hypothetical RESTRICT is never canonically applied in SHADOW");

const evaluatorException = await runExfoliationNormativePolicyRuntime({
  control: shadowControl,
  upstreamVersions: EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
  evaluator: async () => { throw new Error("synthetic"); },
  existingEligibility: true
});
eq(evaluatorException.fallback.policy_action, "DEFER", "evaluator exception falls back to DEFER");
ok(evaluatorException.legacyPathPreserved === true && evaluatorException.canonicalMutationApplied === false, "exception preserves legacy path");

const malformed = await runExfoliationNormativePolicyRuntime({
  control: shadowControl,
  upstreamVersions: EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
  evaluator: async () => ({ policy_action: "RESTRICT" }),
  existingEligibility: true
});
ok(malformed.fallback.reason_codes.includes("invalid_policy_output"), "malformed output rejected");
ok(malformed.canonicalMutationApplied === false, "malformed output cannot mutate canonical path");

const missingPrerequisite = await runExfoliationNormativePolicyRuntime({
  control: shadowControl,
  upstreamVersions: {},
  evaluator: evaluateExfoliationNormativeProductionPolicyShadow,
  existingEligibility: true
});
ok(missingPrerequisite.fallback.reason_codes.includes("missing_runtime_prerequisite"), "missing prerequisite falls back");
ok(missingPrerequisite.legacyPathPreserved === true, "missing prerequisite preserves legacy path");

const validTelemetry = buildExfoliationNormativePolicyRuntimeTelemetry({
  control: shadowControl,
  runtimeEvents: [],
  comparison: {},
  versions: {
    policyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
    runtimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
    activationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION
  }
});
ok(validateExfoliationNormativePolicyRuntimeTelemetry(validTelemetry).valid, "aggregate telemetry valid");
ok(!validateExfoliationNormativePolicyRuntimeTelemetry({ ...validTelemetry, requestBody: { secret: true } }).valid, "forbidden telemetry rejected");

const rollback = resolveExfoliationNormativePolicyActivationControl(env({
  EXFOLIATION_NORMATIVE_POLICY_ENABLED: "0",
  EXFOLIATION_NORMATIVE_POLICY_MODE: "OFF"
}));
eq(rollback.effectiveMode, "OFF", "rollback returns OFF");
const restored = resolveExfoliationNormativePolicyActivationControl(env());
eq(restored.effectiveMode, "SHADOW", "restored valid config returns SHADOW");
ok(restored.enforcementAllowed === false, "restored SHADOW still cannot enforce");

const engineSource = fs.readFileSync("lib/skin-match-decision-engine.js", "utf8");
const exposureBoundary = engineSource.indexOf("let exposureProducts = scoredProducts;");
const observerHook = engineSource.indexOf("observeExfoliationNormativePolicyProductionShadow");
const topPickBoundary = engineSource.indexOf("const topPick =", observerHook);
ok(exposureBoundary >= 0 && observerHook > exposureBoundary && topPickBoundary > observerHook, "observer hook is post-score/post-sort and pre-result assembly");
const hookSlice = engineSource.slice(observerHook, topPickBoundary);
ok(!hookSlice.includes("exposureProducts ="), "observer hook cannot replace canonical exposureProducts");
ok(!hookSlice.includes("engine_score =") && !hookSlice.includes(".sort("), "observer hook cannot rescore or rerank");
eq((engineSource.match(/observeExfoliationNormativePolicyProductionShadow/g) || []).length, 1, "exactly one canonical observer hook");

const readbackRouteSource = fs.readFileSync(
  "app/api/internal/exfoliation-normative-policy-runtime-state/route.js",
  "utf8"
);
ok(readbackRouteSource.includes("export function GET()"), "runtime readback route accepts no request argument");
ok(!/(searchParams|request\.headers|request\.json|request\.url|cookies\()/i.test(readbackRouteSource), "runtime readback route has no client-controlled activation input");
ok(readbackRouteSource.includes('process.env.VERCEL_ENV !== "production"'), "runtime readback route is production-scoped");

process.stdout.write(JSON.stringify({
  stage: "V2.1-9E",
  version: "exfoliation-normative-policy-production-shadow-wiring-validation-v1",
  assertions,
  status: "PASS"
}) + "\n");
