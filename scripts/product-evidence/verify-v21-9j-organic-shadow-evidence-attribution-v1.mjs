#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  createRequestFingerprintHash
} from "../../lib/security/analysis-request-guard-core.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES,
  assignExfoliationNormativePolicyProductionProvenance,
  resolveExfoliationNormativePolicyProductionSource
} from "../../lib/exfoliation-normative-policy-production-provenance.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
  resolveExfoliationNormativePolicyActivationControl
} from "../../lib/exfoliation-normative-policy-activation-runtime.js";
import {
  buildExfoliationNormativePolicyRuntimeTelemetry,
  validateExfoliationNormativePolicyRuntimeTelemetry
} from "../../lib/exfoliation-normative-policy-runtime-observability.js";
import {
  observeExfoliationNormativePolicyProductionShadow
} from "../../lib/exfoliation-normative-policy-production-shadow-observer.js";
import {
  V21_9J_CONTROLLED_PROBE_AUDIENCE,
  V21_9J_CONTROLLED_PROBE_REPOSITORY,
  V21_9J_CONTROLLED_PROBE_REPOSITORY_ID,
  V21_9J_CONTROLLED_PROBE_REF,
  V21_9J_CONTROLLED_PROBE_WORKFLOW_REF,
  verifyV21_9JGitHubActionsOidcToken
} from "../../lib/exfoliation-normative-policy-controlled-probe-oidc.js";

let assertions = 0;
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };

function shadowEnv(overrides = {}) {
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

function syntheticCandidates() {
  return [
    { id: "v21-9j-synthetic-a", name: "Synthetic A", brand: "Synthetic", category: "treatment", engine_score: 91, score: 91 },
    { id: "v21-9j-synthetic-b", name: "Synthetic B", brand: "Synthetic", category: "toner_essence", engine_score: 90, score: 90 }
  ];
}

function runtimeEvent(overrides = {}) {
  return {
    runtimeExecuted: true,
    runtimeError: false,
    invalidPolicyOutput: false,
    fallback: false,
    legacyPathPreserved: true,
    policyAction: "DEFER",
    existingEligibility: true,
    actualNormativeExclusion: false,
    candidateCountBefore: 1,
    candidateCountAfter: 1,
    topKChanged: false,
    latencyMs: 1,
    reasonCodes: [],
    ...overrides
  };
}

function buildTelemetry(source, events) {
  return buildExfoliationNormativePolicyRuntimeTelemetry({
    control: resolveExfoliationNormativePolicyActivationControl(shadowEnv()),
    productionSource: source,
    runtimeEvents: events,
    comparison: {},
    versions: {
      policyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
      runtimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
      activationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION
    }
  });
}

const publicInput = {
  skinType: "oily",
  sensitivity: "low",
  mainConcern: "pores",
  mainConcerns: ["pores"],
  provenance: "CONTROLLED_PRODUCTION_PROBE",
  isControlledProbe: true,
  executionSource: "CONTROLLED_PRODUCTION_PROBE"
};
createRequestFingerprintHash({
  endpoint: "analyze",
  input: { form: publicInput },
  secret: "v21-9j-focused-verifier-secret"
});
eq(
  resolveExfoliationNormativePolicyProductionSource(publicInput),
  EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION,
  "T1 public analyze boundary assigns ORGANIC_PRODUCTION"
);

const publicCandidates = syntheticCandidates();
const publicBefore = JSON.stringify(publicCandidates);
const publicObservation = await observeExfoliationNormativePolicyProductionShadow({
  input: publicInput,
  candidates: publicCandidates,
  priorityAxis: "pores",
  scoreCard: {},
  envLike: shadowEnv(),
  telemetrySink: () => {}
});
eq(publicObservation.productionSource, "ORGANIC_PRODUCTION", "T1 observer retains organic provenance");
eq(publicObservation.telemetry.organicRecommendationExecutionCount, 1, "T1 organic execution independently counted");
eq(publicObservation.telemetry.controlledProductionProbeExecutionCount, 0, "T4 organic execution does not increment controlled");
eq(publicObservation.telemetry.organicActionCounts.DEFER, 2, "T1 organic action counts partitioned");
eq(JSON.stringify(publicCandidates), publicBefore, "T11-T13 public candidates remain byte-equivalent");
ok(publicObservation.canonicalComparison.scoreDelta === false, "T11 score delta zero");
ok(publicObservation.canonicalComparison.rankingDelta === false, "T12 ranking delta zero");
ok(publicObservation.canonicalComparison.canonicalEligibilityDelta === false, "T13 eligibility delta zero");
eq(publicObservation.telemetry.actualNormativeExclusionCount, 0, "T14 SHADOW actual normative exclusion zero");

const controlledInput = { skinType: "oily", sensitivity: "low", mainConcern: "pores" };
let capturedObservation = null;
assignExfoliationNormativePolicyProductionProvenance(
  controlledInput,
  EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE,
  { captureObservation: (value) => { capturedObservation = value; } }
);
const controlledObservation = await observeExfoliationNormativePolicyProductionShadow({
  input: controlledInput,
  candidates: syntheticCandidates(),
  priorityAxis: "pores",
  scoreCard: {},
  envLike: shadowEnv(),
  telemetrySink: () => {}
});
eq(controlledObservation.productionSource, "CONTROLLED_PRODUCTION_PROBE", "T2 trusted controlled capability retained");
ok(capturedObservation === controlledObservation, "T2 trusted controlled observation captured without public response mutation");
eq(controlledObservation.telemetry.controlledProductionProbeExecutionCount, 1, "T2 controlled execution independently counted");
eq(controlledObservation.telemetry.organicRecommendationExecutionCount, 0, "T3 controlled execution organic delta zero");
eq(controlledObservation.telemetry.controlledActionCounts.DEFER, 2, "T2 controlled action counts partitioned");
eq(controlledObservation.telemetry.actualNormativeExclusionCount, 0, "T14 controlled SHADOW actual exclusion zero");

const spoofControlledInput = {
  provenance: "CONTROLLED_PRODUCTION_PROBE",
  isControlledProbe: true,
  executionSource: "CONTROLLED_PRODUCTION_PROBE"
};
createRequestFingerprintHash({
  endpoint: "analyze",
  input: { form: spoofControlledInput },
  secret: "v21-9j-focused-verifier-secret"
});
eq(resolveExfoliationNormativePolicyProductionSource(spoofControlledInput), "ORGANIC_PRODUCTION", "T5 public controlled spoof cannot change server classification");

const selfAssertOrganicInput = {
  provenance: "ORGANIC_PRODUCTION",
  executionSource: "ORGANIC_PRODUCTION",
  evidenceType: "organic"
};
eq(resolveExfoliationNormativePolicyProductionSource(selfAssertOrganicInput), "UNKNOWN_PRODUCTION_SOURCE", "T6 client organic self-assertion has no authority");

eq(resolveExfoliationNormativePolicyProductionSource({}), "UNKNOWN_PRODUCTION_SOURCE", "T7 missing provenance resolves UNKNOWN");
const malformedInput = {};
eq(
  assignExfoliationNormativePolicyProductionProvenance(malformedInput, "MALFORMED_SOURCE"),
  "UNKNOWN_PRODUCTION_SOURCE",
  "T8 malformed trusted source normalizes UNKNOWN"
);
eq(resolveExfoliationNormativePolicyProductionSource(malformedInput), "UNKNOWN_PRODUCTION_SOURCE", "T8 malformed source remains UNKNOWN");

const fallbackTelemetry = buildTelemetry(
  "CONTROLLED_PRODUCTION_PROBE",
  [runtimeEvent({ runtimeExecuted: false, fallback: true, policyAction: "DEFER", reasonCodes: ["missing_runtime_prerequisite"] })]
);
eq(fallbackTelemetry.productionSource, "CONTROLLED_PRODUCTION_PROBE", "T9 fallback preserves controlled source");
eq(fallbackTelemetry.controlledFallbackCount, 1, "T9 fallback counted only in controlled partition");
eq(fallbackTelemetry.organicFallbackCount, 0, "T9 fallback cannot contaminate organic partition");

const errorTelemetry = buildTelemetry(
  "ORGANIC_PRODUCTION",
  [runtimeEvent({ runtimeError: true, fallback: true, policyAction: "DEFER", reasonCodes: ["evaluator_exception"] })]
);
eq(errorTelemetry.productionSource, "ORGANIC_PRODUCTION", "T10 runtime error preserves organic source");
eq(errorTelemetry.organicRuntimeErrorCount, 1, "T10 runtime error retained in organic partition");
eq(errorTelemetry.controlledRuntimeErrorCount, 0, "T10 runtime error does not contaminate controlled partition");

const validTelemetry = buildTelemetry("ORGANIC_PRODUCTION", []);
ok(validateExfoliationNormativePolicyRuntimeTelemetry(validTelemetry).valid, "additive v1 telemetry remains valid");
eq(validTelemetry.schemaVersion, "exfoliation-normative-production-policy-runtime-telemetry-v1", "telemetry schema version remains v1");
for (const forbiddenField of [
  "sessionToken",
  "session_token",
  "SESSION-TOKEN",
  "authToken",
  "auth_token",
  "AUTH-TOKEN",
  "accessToken",
  "raw_ip",
  "email",
  "rawQuestionnaire",
  "freeFormText"
]) {
  const invalid = validateExfoliationNormativePolicyRuntimeTelemetry({
    ...validTelemetry,
    [forbiddenField]: "sensitive"
  });
  ok(!invalid.valid && invalid.errors.includes("forbidden_telemetry_field"), `privacy verifier rejects ${forbiddenField}`);
}
const nestedForbidden = validateExfoliationNormativePolicyRuntimeTelemetry({
  ...validTelemetry,
  reasonCodeDistribution: { safe_reason: 1, nested: { authToken: "sensitive" } }
});
ok(!nestedForbidden.valid && nestedForbidden.errors.includes("forbidden_telemetry_field"), "privacy verifier recursively rejects normalized auth token fields");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });
const kid = "v21-9j-test-key";
const nowMs = Date.now();
const nowSeconds = Math.floor(nowMs / 1000);
const deploymentSha = "0123456789abcdef0123456789abcdef01234567";
function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function createOidcToken(overrides = {}, signingKey = privateKey) {
  const header = encodeJson({ alg: "RS256", typ: "JWT", kid });
  const payload = encodeJson({
    iss: "https://token.actions.githubusercontent.com",
    aud: V21_9J_CONTROLLED_PROBE_AUDIENCE,
    sub: `repo:${V21_9J_CONTROLLED_PROBE_REPOSITORY}:ref:${V21_9J_CONTROLLED_PROBE_REF}`,
    repository: V21_9J_CONTROLLED_PROBE_REPOSITORY,
    repository_id: V21_9J_CONTROLLED_PROBE_REPOSITORY_ID,
    ref: V21_9J_CONTROLLED_PROBE_REF,
    ref_type: "branch",
    event_name: "workflow_dispatch",
    workflow_ref: V21_9J_CONTROLLED_PROBE_WORKFLOW_REF,
    workflow_sha: deploymentSha,
    sha: deploymentSha,
    run_id: "987654321",
    run_attempt: "1",
    runner_environment: "github-hosted",
    iat: nowSeconds,
    nbf: nowSeconds - 1,
    exp: nowSeconds + 300,
    ...overrides
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput, "utf8"), signingKey).toString("base64url");
  return `${signingInput}.${signature}`;
}
const mockFetch = async (url) => {
  if (String(url).includes("openid-configuration")) {
    return {
      ok: true,
      json: async () => ({
        issuer: "https://token.actions.githubusercontent.com",
        jwks_uri: "https://token.actions.githubusercontent.com/.well-known/jwks"
      })
    };
  }
  return {
    ok: true,
    json: async () => ({
      keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }]
    })
  };
};
const validOidc = await verifyV21_9JGitHubActionsOidcToken(createOidcToken(), {
  expectedDeploymentSha: deploymentSha,
  fetchImpl: mockFetch,
  nowMs
});
ok(validOidc.ok, "OIDC token signature and bounded claims accepted");
eq(validOidc.claims.eventName, "workflow_dispatch", "OIDC contract binds workflow_dispatch");
eq(validOidc.claims.workflowRef, V21_9J_CONTROLLED_PROBE_WORKFLOW_REF, "OIDC contract binds exact workflow ref");
const wrongEvent = await verifyV21_9JGitHubActionsOidcToken(createOidcToken({ event_name: "push" }), {
  expectedDeploymentSha: deploymentSha,
  fetchImpl: mockFetch,
  nowMs
});
eq(wrongEvent.code, "invalid_event_name", "OIDC push token rejected");
const wrongAudience = await verifyV21_9JGitHubActionsOidcToken(createOidcToken({ aud: "wrong-audience" }), {
  expectedDeploymentSha: deploymentSha,
  fetchImpl: mockFetch,
  nowMs
});
eq(wrongAudience.code, "invalid_audience", "OIDC wrong audience rejected");
const wrongSha = await verifyV21_9JGitHubActionsOidcToken(createOidcToken({ sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }), {
  expectedDeploymentSha: deploymentSha,
  fetchImpl: mockFetch,
  nowMs
});
eq(wrongSha.code, "deployment_sha_mismatch", "OIDC token must bind exact production deployment SHA");
const { privateKey: otherPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const badSignature = await verifyV21_9JGitHubActionsOidcToken(createOidcToken({}, otherPrivateKey), {
  expectedDeploymentSha: deploymentSha,
  fetchImpl: mockFetch,
  nowMs
});
eq(badSignature.code, "invalid_signature", "OIDC signature is cryptographically verified");
const missingOidc = await verifyV21_9JGitHubActionsOidcToken(null, {
  expectedDeploymentSha: deploymentSha,
  fetchImpl: mockFetch,
  nowMs
});
eq(missingOidc.code, "missing_bearer_token", "ordinary unauthenticated access rejected");

const analyzeRouteSource = fs.readFileSync("app/api/analyze/route.js", "utf8");
const guardCoreSource = fs.readFileSync("lib/security/analysis-request-guard-core.js", "utf8");
const controlledRouteSource = fs.readFileSync(
  "app/api/internal/exfoliation-normative-policy-controlled-production-probe/route.js",
  "utf8"
);
const controlledWorkflowSource = fs.readFileSync(
  ".github/workflows/v21-9j-controlled-production-probe.yml",
  "utf8"
);
ok(analyzeRouteSource.includes("endpoint: \"analyze\"") && analyzeRouteSource.includes("form: formInput"), "public /api/analyze passes the exact form object through trusted guard boundary");
ok(guardCoreSource.includes("ORGANIC_PRODUCTION") && guardCoreSource.includes("endpoint === \"analyze\""), "public boundary performs server-owned organic assignment");
ok(!controlledRouteSource.includes("request.json(") && !controlledRouteSource.includes("request.formData("), "controlled route accepts no arbitrary caller payload");
ok(controlledRouteSource.includes("CONTROLLED_PRODUCTION_PROBE"), "controlled route assigns controlled source server-side");
ok(/^on:\n  workflow_dispatch:\s*$/m.test(controlledWorkflowSource), "controlled workflow has workflow_dispatch trigger");
ok(!/^\s{2}(push|pull_request|schedule):/m.test(controlledWorkflowSource), "controlled workflow has no automatic production-probe trigger");
ok(controlledWorkflowSource.includes("id-token: write"), "controlled workflow requests GitHub OIDC id-token permission");
ok(controlledWorkflowSource.includes(V21_9J_CONTROLLED_PROBE_AUDIENCE), "controlled workflow requests exact custom audience");

console.log(JSON.stringify({
  stage: "V2.1-9J",
  terminal: "FOCUSED_PROVENANCE_ATTRIBUTION_VERIFIER_PASSED",
  assertions,
  tests: {
    T1: "PASS",
    T2: "PASS",
    T3: "PASS",
    T4: "PASS",
    T5: "PASS",
    T6: "PASS",
    T7: "PASS",
    T8: "PASS",
    T9: "PASS",
    T10: "PASS",
    T11: "PASS",
    T12: "PASS",
    T13: "PASS",
    T14: "PASS"
  },
  privacy: "PASS",
  oidc: "PASS",
  enforceAuthorized: false
}, null, 2));
