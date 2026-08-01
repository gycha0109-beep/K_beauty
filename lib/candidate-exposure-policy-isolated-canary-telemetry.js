import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES
} from "./candidate-exposure-policy-contract.js";
import { CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES } from "./candidate-exposure-policy-observability.js";
import {
  CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_LOCALES,
  CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_MODES,
  CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_SCENARIOS
} from "./candidate-exposure-policy-isolated-preview-canary-harness-design.js";
import { ISOLATED_CANARY_STOP_CONDITIONS } from "./candidate-exposure-policy-isolated-canary-control.js";

export const ISOLATED_CANARY_TELEMETRY_SCHEMA_VERSION =
  "candidate-exposure-policy-isolated-canary-aggregate-v1";

export const ISOLATED_CANARY_TELEMETRY_EXECUTION_STATUSES = Object.freeze([
  "validate_only_control_disabled",
  "validate_only_simulation",
  "stopped",
  "invalid_configuration"
]);

export const ISOLATED_CANARY_TELEMETRY_ALLOWED_FIELDS = Object.freeze([
  "schemaVersion",
  "planVersion",
  "runtimeImplementationShaMatch",
  "fixtureScenario",
  "locale",
  "mode",
  "executionStatus",
  "candidateCount",
  "exposureCounts",
  "laneEligibilityCounts",
  "divergenceCategoryCounts",
  "responseFingerprintMatch",
  "snapshotFingerprintMatch",
  "candidateOrderMatch",
  "projectionFingerprintPresent",
  "unexpectedDivergenceCount",
  "unclassifiedDivergenceCount",
  "shadowExceptionCount",
  "fallbackCount",
  "invalidContextCount",
  "stopCondition"
]);

export const ISOLATED_CANARY_TELEMETRY_FORBIDDEN_FIELDS = Object.freeze([
  "candidateRef",
  "candidateId",
  "productId",
  "productName",
  "brand",
  "productUrl",
  "userId",
  "accountId",
  "email",
  "sessionId",
  "reportId",
  "cookie",
  "token",
  "secret",
  "rawRequest",
  "rawResponse",
  "providerPrompt",
  "providerOutput",
  "orderedCandidateRefs",
  "orderedExposures",
  "orderedLaneEligibilityBits",
  "reasonCodeCounts"
]);

function normalizedKey(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FORBIDDEN_NORMALIZED = new Set(
  ISOLATED_CANARY_TELEMETRY_FORBIDDEN_FIELDS.map(normalizedKey)
);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

function exactKeySet(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    new Set(actual).size === actual.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function validCountMap(value, keys) {
  return exactKeySet(value, keys) &&
    Object.values(value).every((count) => Number.isInteger(count) && count >= 0);
}

function sumCounts(value) {
  return Object.values(value || {}).reduce((sum, count) => sum + count, 0);
}

function containsForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_NORMALIZED.has(normalizedKey(key)) || containsForbiddenKey(nested)
  );
}

function zeroCountMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

export function buildIsolatedCanaryTelemetry(input = {}) {
  return {
    schemaVersion: ISOLATED_CANARY_TELEMETRY_SCHEMA_VERSION,
    planVersion: String(input.planVersion || "candidate-exposure-policy-limited-preview-canary-plan-v1"),
    runtimeImplementationShaMatch: input.runtimeImplementationShaMatch === true,
    fixtureScenario: input.fixtureScenario,
    locale: input.locale,
    mode: input.mode,
    executionStatus: input.executionStatus,
    candidateCount: Number.isInteger(input.candidateCount) ? input.candidateCount : 0,
    exposureCounts: input.exposureCounts || zeroCountMap(CANDIDATE_EXPOSURES),
    laneEligibilityCounts: input.laneEligibilityCounts || zeroCountMap(CANDIDATE_EXPOSURE_LANES),
    divergenceCategoryCounts: input.divergenceCategoryCounts || zeroCountMap(CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES),
    responseFingerprintMatch: input.responseFingerprintMatch === true,
    snapshotFingerprintMatch: input.snapshotFingerprintMatch === true,
    candidateOrderMatch: input.candidateOrderMatch === true,
    projectionFingerprintPresent: input.projectionFingerprintPresent === true,
    unexpectedDivergenceCount: Number.isInteger(input.unexpectedDivergenceCount)
      ? input.unexpectedDivergenceCount
      : 0,
    unclassifiedDivergenceCount: Number.isInteger(input.unclassifiedDivergenceCount)
      ? input.unclassifiedDivergenceCount
      : 0,
    shadowExceptionCount: Number.isInteger(input.shadowExceptionCount) ? input.shadowExceptionCount : 0,
    fallbackCount: Number.isInteger(input.fallbackCount) ? input.fallbackCount : 0,
    invalidContextCount: Number.isInteger(input.invalidContextCount) ? input.invalidContextCount : 0,
    stopCondition: input.stopCondition ?? null
  };
}

export function validateIsolatedCanaryTelemetry(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { valid: false, errors: ["telemetry_not_object"] };
  }
  if (!exactKeySet(record, ISOLATED_CANARY_TELEMETRY_ALLOWED_FIELDS)) {
    errors.push("telemetry_field_set_invalid");
  }
  if (containsForbiddenKey(record)) errors.push("telemetry_forbidden_field");
  if (record.schemaVersion !== ISOLATED_CANARY_TELEMETRY_SCHEMA_VERSION) {
    errors.push("telemetry_schema_version_invalid");
  }
  if (typeof record.planVersion !== "string" || !record.planVersion) {
    errors.push("telemetry_plan_version_invalid");
  }
  if (!CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_SCENARIOS.includes(record.fixtureScenario)) {
    errors.push("telemetry_scenario_invalid");
  }
  if (!CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_LOCALES.includes(record.locale)) {
    errors.push("telemetry_locale_invalid");
  }
  if (!CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_MODES.includes(record.mode)) {
    errors.push("telemetry_mode_invalid");
  }
  if (!ISOLATED_CANARY_TELEMETRY_EXECUTION_STATUSES.includes(record.executionStatus)) {
    errors.push("telemetry_execution_status_invalid");
  }
  if (typeof record.runtimeImplementationShaMatch !== "boolean") {
    errors.push("telemetry_runtime_match_invalid");
  }
  if (!Number.isInteger(record.candidateCount) || record.candidateCount < 0) {
    errors.push("telemetry_candidate_count_invalid");
  }
  if (!validCountMap(record.exposureCounts, CANDIDATE_EXPOSURES)) {
    errors.push("telemetry_exposure_counts_invalid");
  }
  if (!validCountMap(record.laneEligibilityCounts, CANDIDATE_EXPOSURE_LANES)) {
    errors.push("telemetry_lane_counts_invalid");
  }
  if (!validCountMap(record.divergenceCategoryCounts, CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES)) {
    errors.push("telemetry_divergence_counts_invalid");
  }
  for (const key of [
    "unexpectedDivergenceCount",
    "unclassifiedDivergenceCount",
    "shadowExceptionCount",
    "fallbackCount",
    "invalidContextCount"
  ]) {
    if (!Number.isInteger(record[key]) || record[key] < 0) errors.push(`telemetry_${key}_invalid`);
  }
  for (const key of [
    "responseFingerprintMatch",
    "snapshotFingerprintMatch",
    "candidateOrderMatch",
    "projectionFingerprintPresent"
  ]) {
    if (typeof record[key] !== "boolean") errors.push(`telemetry_${key}_invalid`);
  }
  if (record.stopCondition !== null && !ISOLATED_CANARY_STOP_CONDITIONS.includes(record.stopCondition)) {
    errors.push("telemetry_stop_condition_invalid");
  }

  if (Number.isInteger(record.candidateCount)) {
    if (sumCounts(record.exposureCounts) !== record.candidateCount) {
      errors.push("telemetry_exposure_total_mismatch");
    }
    if (sumCounts(record.divergenceCategoryCounts) !== record.candidateCount) {
      errors.push("telemetry_divergence_total_mismatch");
    }
    if (Object.values(record.laneEligibilityCounts).some((count) => count > record.candidateCount)) {
      errors.push("telemetry_lane_count_exceeds_candidates");
    }
  }
  if (
    record.unexpectedDivergenceCount !==
    (record.divergenceCategoryCounts?.unexpected_divergence || 0)
  ) errors.push("telemetry_unexpected_divergence_mismatch");
  if (record.unclassifiedDivergenceCount !== 0) {
    errors.push("telemetry_unclassified_divergence_nonzero");
  }

  if (record.executionStatus === "validate_only_control_disabled") {
    if (record.mode !== "control") errors.push("telemetry_control_mode_mismatch");
    if (record.candidateCount !== 0) errors.push("telemetry_control_candidate_count_nonzero");
    if (record.projectionFingerprintPresent) errors.push("telemetry_control_projection_present");
    if (record.stopCondition !== null) errors.push("telemetry_control_stop_condition_present");
  }
  if (record.executionStatus === "validate_only_simulation") {
    if (record.mode !== "canary") errors.push("telemetry_canary_mode_mismatch");
    if (!record.runtimeImplementationShaMatch) errors.push("telemetry_canary_runtime_mismatch");
    if (!record.projectionFingerprintPresent) errors.push("telemetry_canary_projection_missing");
    if (!record.responseFingerprintMatch || !record.snapshotFingerprintMatch || !record.candidateOrderMatch) {
      errors.push("telemetry_canary_mutation_check_failed");
    }
    if (
      record.shadowExceptionCount !== 0 ||
      record.fallbackCount !== 0 ||
      record.invalidContextCount !== 0 ||
      record.stopCondition !== null
    ) errors.push("telemetry_canary_failure_state");
  }
  if (record.executionStatus === "stopped" && record.stopCondition === null) {
    errors.push("telemetry_stopped_without_condition");
  }
  if (record.executionStatus === "invalid_configuration" && record.stopCondition !== null) {
    errors.push("telemetry_invalid_configuration_with_stop");
  }

  return { valid: errors.length === 0, errors: Array.from(new Set(errors)).sort() };
}

export function serializeIsolatedCanaryTelemetry(record) {
  const validation = validateIsolatedCanaryTelemetry(record);
  if (!validation.valid) {
    throw new Error(`isolated_canary_telemetry_invalid:${validation.errors.join(",")}`);
  }
  return JSON.stringify(stableValue(record));
}
