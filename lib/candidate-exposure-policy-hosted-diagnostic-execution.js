import { createHash } from "node:crypto";
import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES
} from "./candidate-exposure-policy-contract.js";
import { evaluateCandidateExposurePolicy } from "./candidate-exposure-policy.js";
import {
  CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES,
  compareCandidateExposurePolicyWithLegacy
} from "./candidate-exposure-policy-observability.js";
import { resolveCandidateExposurePolicyShadowControl } from "./candidate-exposure-policy-shadow.js";
import { buildIsolatedCandidateProjection } from "./candidate-exposure-policy-isolated-projection.js";
import {
  HOSTED_DIAGNOSTIC_AGGREGATE_SCHEMA,
  HOSTED_DIAGNOSTIC_SCENARIOS,
  diagnosticSha256,
  stableDiagnosticStringify,
  validateHostedDiagnosticAggregate,
  zeroHostedDiagnosticCountMap
} from "./candidate-exposure-policy-hosted-diagnostic-contract.js";

export const HOSTED_DIAGNOSTIC_FIXTURE_SCHEMA =
  "candidate-exposure-policy-isolated-canary-fixture-manifest-v1";
export const PRODUCT_RUNTIME_AUTHORITY_SHA =
  "1bc119347a2f8d3387a935163e24849ceebe349d";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function normalizeCountMap(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value?.[key] || 0]));
}

function fixtureFingerprint(fixture) {
  return diagnosticSha256(stableDiagnosticStringify(fixture));
}

export function validateHostedDiagnosticFixtureManifest(manifest) {
  const errors = [];
  const exactRoot = manifest && typeof manifest === "object" && !Array.isArray(manifest) &&
    Object.keys(manifest).length === 4 && [
      "schemaVersion", "runtimeImplementationSha", "actualUserData", "scenarios"
    ].every((key) => Object.hasOwn(manifest, key));
  if (!exactRoot) errors.push("field_set");
  if (manifest?.schemaVersion !== HOSTED_DIAGNOSTIC_FIXTURE_SCHEMA) errors.push("schema");
  if (manifest?.runtimeImplementationSha !== PRODUCT_RUNTIME_AUTHORITY_SHA) errors.push("runtime_sha");
  if (manifest?.actualUserData !== false) errors.push("actual_user_data");
  if (!Array.isArray(manifest?.scenarios) || manifest.scenarios.length !== 4) errors.push("scenario_count");
  const names = Array.isArray(manifest?.scenarios)
    ? manifest.scenarios.map((entry) => entry?.scenario)
    : [];
  if (stableDiagnosticStringify(names) !== stableDiagnosticStringify(HOSTED_DIAGNOSTIC_SCENARIOS)) {
    errors.push("scenario_order");
  }
  const fingerprints = {};
  const seen = new Set();
  for (const fixture of Array.isArray(manifest?.scenarios) ? manifest.scenarios : []) {
    const exactFixture = fixture && typeof fixture === "object" && !Array.isArray(fixture) &&
      Object.keys(fixture).length === 5 && [
        "scenario", "semanticVersion", "expectedReasonCodes", "canonicalState", "candidates"
      ].every((key) => Object.hasOwn(fixture, key));
    if (!exactFixture) errors.push(`fixture_shape:${fixture?.scenario || "unknown"}`);
    if (!HOSTED_DIAGNOSTIC_SCENARIOS.includes(fixture?.scenario) || seen.has(fixture?.scenario)) {
      errors.push(`fixture_scenario:${fixture?.scenario || "unknown"}`);
    }
    seen.add(fixture?.scenario);
    if (typeof fixture?.semanticVersion !== "string" || !fixture.semanticVersion) {
      errors.push(`fixture_version:${fixture?.scenario || "unknown"}`);
    }
    if (!Array.isArray(fixture?.expectedReasonCodes) || fixture.expectedReasonCodes.length < 1 ||
        fixture.expectedReasonCodes.some((reason) => typeof reason !== "string" || !reason)) {
      errors.push(`fixture_reasons:${fixture?.scenario || "unknown"}`);
    }
    if (!fixture?.canonicalState || typeof fixture.canonicalState !== "object" ||
        !Array.isArray(fixture?.candidates) || fixture.candidates.length < 1) {
      errors.push(`fixture_payload:${fixture?.scenario || "unknown"}`);
    }
    if (fixture?.scenario) fingerprints[fixture.scenario] = fixtureFingerprint(fixture);
  }
  return deepFreeze({
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    fingerprints
  });
}

export function resolveHostedDiagnosticFixture(manifest, scenario, expectedFingerprint) {
  const review = validateHostedDiagnosticFixtureManifest(manifest);
  if (!review.valid) throw new Error("fixture_contract_invalid");
  const matches = manifest.scenarios.filter((fixture) => fixture.scenario === scenario);
  if (matches.length !== 1) throw new Error("fixture_contract_invalid");
  if (review.fingerprints[scenario] !== expectedFingerprint) {
    throw new Error("fixture_fingerprint_mismatch");
  }
  return deepFreeze(structuredClone(matches[0]));
}

function invalidContextCount(decisions) {
  const reasons = new Set([
    "invalid_context", "current_findings_missing", "current_findings_invalid"
  ]);
  return decisions.filter((decision) =>
    decision.reasonCodes?.some((reason) => reasons.has(reason))
  ).length;
}

function assertExpectedReasons(fixture, decisions) {
  const observed = new Set(decisions.flatMap((decision) => decision.reasonCodes || []));
  for (const reason of fixture.expectedReasonCodes) {
    if (!observed.has(reason)) throw new Error("policy_expected_reason_missing");
  }
}

function controlAggregate(requestRecord) {
  return {
    schemaVersion: HOSTED_DIAGNOSTIC_AGGREGATE_SCHEMA,
    fixtureScenario: requestRecord.scenario,
    fixtureSemanticFingerprint: requestRecord.fixtureSemanticFingerprint,
    locale: requestRecord.locale,
    mode: "control",
    executionStatus: "hosted_control_disabled",
    candidateCount: 0,
    exposureCounts: zeroHostedDiagnosticCountMap(CANDIDATE_EXPOSURES),
    laneEligibilityCounts: zeroHostedDiagnosticCountMap(CANDIDATE_EXPOSURE_LANES),
    divergenceCategoryCounts: zeroHostedDiagnosticCountMap(
      CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES
    ),
    responseFingerprintMatch: true,
    snapshotFingerprintMatch: true,
    candidateOrderMatch: true,
    projectionFingerprintPresent: false,
    unexpectedDivergenceCount: 0,
    unclassifiedDivergenceCount: 0,
    shadowExceptionCount: 0,
    fallbackCount: 0,
    invalidContextCount: 0
  };
}

export function executeHostedCandidatePolicyDiagnostic({
  requestRecord,
  fixtureManifest,
  env,
  evaluator = evaluateCandidateExposurePolicy,
  compare = compareCandidateExposurePolicyWithLegacy,
  projectionBuilder = buildIsolatedCandidateProjection
} = {}) {
  const control = resolveCandidateExposurePolicyShadowControl(env);
  if (control.killSwitchRequested) throw new Error("kill_switch_active");
  const fixture = resolveHostedDiagnosticFixture(
    fixtureManifest,
    requestRecord.scenario,
    requestRecord.fixtureSemanticFingerprint
  );

  if (requestRecord.expectedMode === "control") {
    if (control.enabled || control.optInRequested || control.mode !== "disabled" ||
        control.productionHardDisabled) {
      throw new Error("deployment_mode_mismatch");
    }
    const aggregate = controlAggregate(requestRecord);
    const review = validateHostedDiagnosticAggregate(aggregate);
    if (!review.valid) throw new Error("aggregate_validation_failed");
    return deepFreeze({
      shadowExecution: false,
      evaluatorCallCount: 0,
      projectionFingerprint: null,
      aggregate
    });
  }

  if (requestRecord.expectedMode !== "canary" || !control.enabled ||
      !control.optInRequested || control.mode !== "shadow_only" ||
      control.productionHardDisabled) {
    throw new Error("deployment_mode_mismatch");
  }

  const canonicalState = structuredClone(fixture.canonicalState);
  const candidates = structuredClone(fixture.candidates);
  const canonicalBefore = stableDiagnosticStringify(canonicalState);
  const candidatesBefore = stableDiagnosticStringify(candidates);
  const orderBefore = candidates.map((candidate) =>
    String(candidate.id || candidate.productId || candidate.product_id || "")
  );

  let policyResult;
  try {
    policyResult = evaluator({ canonicalState, candidates });
  } catch {
    throw new Error("policy_evaluation_failed");
  }
  if (policyResult?.status !== "evaluated" || !Array.isArray(policyResult?.decisions)) {
    throw new Error("policy_evaluation_failed");
  }
  assertExpectedReasons(fixture, policyResult.decisions);

  const descriptors = candidates.map((candidate, sourceIndex) => ({
    candidateRef: String(candidate.id || candidate.productId || candidate.product_id || ""),
    sourceIndex
  }));
  const projection = projectionBuilder({
    candidates: descriptors,
    decisions: policyResult.decisions
  });
  const comparison = compare({
    decisions: policyResult.decisions,
    legacyExecution: policyResult.evaluatorExecution
  });
  const responseFingerprintMatch = canonicalBefore === stableDiagnosticStringify(canonicalState);
  const snapshotFingerprintMatch = candidatesBefore === stableDiagnosticStringify(candidates);
  const candidateOrderMatch = stableDiagnosticStringify(orderBefore) ===
    stableDiagnosticStringify(projection.memoryOnly.orderedCandidateRefs);
  const invalidCount = invalidContextCount(policyResult.decisions);
  if (comparison.unexpectedDivergenceCount > 0) throw new Error("unexpected_divergence");
  if (comparison.unclassifiedDivergenceCount > 0) throw new Error("unclassified_divergence");
  if (invalidCount > 0) throw new Error("invalid_context");
  if (!responseFingerprintMatch || !snapshotFingerprintMatch || !candidateOrderMatch) {
    throw new Error("mutation_fingerprint_mismatch");
  }

  const aggregate = {
    schemaVersion: HOSTED_DIAGNOSTIC_AGGREGATE_SCHEMA,
    fixtureScenario: requestRecord.scenario,
    fixtureSemanticFingerprint: requestRecord.fixtureSemanticFingerprint,
    locale: requestRecord.locale,
    mode: "canary",
    executionStatus: "hosted_canary_executed",
    candidateCount: projection.aggregate.candidateCount,
    exposureCounts: normalizeCountMap(projection.aggregate.exposureCounts, CANDIDATE_EXPOSURES),
    laneEligibilityCounts: normalizeCountMap(
      projection.aggregate.laneEligibilityCounts,
      CANDIDATE_EXPOSURE_LANES
    ),
    divergenceCategoryCounts: normalizeCountMap(
      comparison.categoryCounts,
      CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES
    ),
    responseFingerprintMatch,
    snapshotFingerprintMatch,
    candidateOrderMatch,
    projectionFingerprintPresent:
      typeof projection.fingerprint === "string" && /^[0-9a-f]{64}$/.test(projection.fingerprint),
    unexpectedDivergenceCount: comparison.unexpectedDivergenceCount,
    unclassifiedDivergenceCount: comparison.unclassifiedDivergenceCount,
    shadowExceptionCount: 0,
    fallbackCount: 0,
    invalidContextCount: invalidCount
  };
  const review = validateHostedDiagnosticAggregate(aggregate);
  if (!review.valid) throw new Error("aggregate_validation_failed");

  return deepFreeze({
    shadowExecution: true,
    evaluatorCallCount: 1,
    projectionFingerprint: projection.fingerprint,
    aggregate
  });
}
