import { createHash } from "node:crypto";
import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES
} from "./candidate-exposure-policy-contract.js";
import {
  CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES
} from "./candidate-exposure-policy-observability.js";

export const HOSTED_DIAGNOSTIC_REQUEST_SCHEMA =
  "candidate-exposure-policy-hosted-diagnostic-request-v1";
export const HOSTED_DIAGNOSTIC_AGGREGATE_SCHEMA =
  "candidate-exposure-policy-hosted-diagnostic-aggregate-v1";
export const HOSTED_DIAGNOSTIC_ENVELOPE_SCHEMA =
  "candidate-exposure-policy-hosted-diagnostic-envelope-v1";
export const HOSTED_DIAGNOSTIC_PLAN_VERSION =
  "candidate-exposure-policy-hosted-diagnostic-plan-v2";

export const HOSTED_DIAGNOSTIC_LOCALES = Object.freeze(["ko", "en"]);
export const HOSTED_DIAGNOSTIC_SCENARIOS = Object.freeze([
  "standard_goal_alignment",
  "stabilization_active_block",
  "current_product_semantics",
  "metadata_incomplete"
]);
export const HOSTED_DIAGNOSTIC_MODES = Object.freeze(["control", "canary"]);
export const HOSTED_DIAGNOSTIC_EXECUTION_STATUSES = Object.freeze([
  "hosted_control_disabled",
  "hosted_canary_executed"
]);

const REQUEST_KEYS = Object.freeze([
  "schemaVersion",
  "executionGrantDigest",
  "approvalIdHash",
  "approvedSourceSha",
  "deploymentId",
  "sequence",
  "locale",
  "scenario",
  "expectedMode",
  "fixtureSemanticFingerprint"
]);
const AGGREGATE_KEYS = Object.freeze([
  "schemaVersion",
  "fixtureScenario",
  "fixtureSemanticFingerprint",
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
  "invalidContextCount"
]);
const ENVELOPE_KEYS = Object.freeze([
  "schemaVersion",
  "status",
  "sourceSha",
  "environmentClass",
  "deploymentIdHash",
  "executionGrantDigest",
  "sequence",
  "finalDiagnosticStage",
  "shadowExecution",
  "aggregate"
]);
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;
const FORBIDDEN_KEYS = new Set([
  "candidateref", "candidateid", "productid", "productname", "brand", "url",
  "reasoncodecounts", "orderedexposurevector", "orderedcandidatereferences",
  "canonicalstate", "candidates", "rawrequest", "rawresponse", "providercontent",
  "cookie", "sessionid", "reportid", "accountid", "secret", "token"
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

export function stableDiagnosticStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function diagnosticSha256(value) {
  return createHash("sha256").update(
    Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8")
  ).digest("hex");
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function normalizedKey(key) {
  return String(key || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function containsHostedDiagnosticForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_KEYS.has(normalizedKey(key)) || containsHostedDiagnosticForbiddenKey(nested)
  );
}

function parseJsonString(text, start) {
  let index = start + 1;
  let escaped = false;
  while (index < text.length) {
    const char = text[index];
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      const token = text.slice(start, index + 1);
      return { value: JSON.parse(token), next: index + 1 };
    }
    index += 1;
  }
  throw new Error("json_string_unterminated");
}

function skipWhitespace(text, index) {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

function parseFlatJsonScalar(text, start) {
  const index = skipWhitespace(text, start);
  if (text[index] === '"') return parseJsonString(text, index);
  if (text[index] === "{" || text[index] === "[") {
    throw new Error("json_nested_value_forbidden");
  }
  let end = index;
  while (end < text.length && !/[},]/.test(text[end])) end += 1;
  const token = text.slice(index, end).trim();
  if (!token) throw new Error("json_value_missing");
  const parsed = JSON.parse(token);
  if (parsed !== null && typeof parsed === "object") {
    throw new Error("json_nested_value_forbidden");
  }
  return { value: parsed, next: end };
}

export function parseStrictHostedDiagnosticRequest(text) {
  if (typeof text !== "string") throw new Error("request_body_not_string");
  let index = skipWhitespace(text, 0);
  if (text[index] !== "{") throw new Error("request_not_object");
  index += 1;
  const output = {};
  const seen = new Set();
  index = skipWhitespace(text, index);
  if (text[index] === "}") throw new Error("request_empty");
  while (index < text.length) {
    index = skipWhitespace(text, index);
    if (text[index] !== '"') throw new Error("request_key_invalid");
    const keyToken = parseJsonString(text, index);
    const key = keyToken.value;
    if (seen.has(key)) throw new Error("request_duplicate_key");
    seen.add(key);
    index = skipWhitespace(text, keyToken.next);
    if (text[index] !== ":") throw new Error("request_colon_missing");
    const scalar = parseFlatJsonScalar(text, index + 1);
    output[key] = scalar.value;
    index = skipWhitespace(text, scalar.next);
    if (text[index] === "}") {
      index += 1;
      break;
    }
    if (text[index] !== ",") throw new Error("request_separator_invalid");
    index += 1;
  }
  if (skipWhitespace(text, index) !== text.length) throw new Error("request_trailing_data");
  return Object.freeze(output);
}

export function buildHostedDiagnosticMatrix() {
  const entries = [];
  let sequence = 1;
  for (const locale of HOSTED_DIAGNOSTIC_LOCALES) {
    for (const scenario of HOSTED_DIAGNOSTIC_SCENARIOS) {
      for (const expectedMode of HOSTED_DIAGNOSTIC_MODES) {
        entries.push(Object.freeze({ sequence, locale, scenario, expectedMode }));
        sequence += 1;
      }
    }
  }
  return Object.freeze(entries);
}

export function expectedHostedDiagnosticMatrixEntry(sequence) {
  return buildHostedDiagnosticMatrix().find((entry) => entry.sequence === sequence) || null;
}

export function validateHostedDiagnosticRequest(value) {
  const errors = [];
  if (!exactKeys(value, REQUEST_KEYS)) errors.push("field_set");
  if (value?.schemaVersion !== HOSTED_DIAGNOSTIC_REQUEST_SCHEMA) errors.push("schema");
  if (!SHA256.test(String(value?.executionGrantDigest || ""))) errors.push("grant_digest");
  if (!SHA256.test(String(value?.approvalIdHash || ""))) errors.push("approval_hash");
  if (!SHA40.test(String(value?.approvedSourceSha || ""))) errors.push("source_sha");
  if (!DEPLOYMENT_ID.test(String(value?.deploymentId || ""))) errors.push("deployment_id");
  if (!Number.isInteger(value?.sequence) || value.sequence < 1 || value.sequence > 16) {
    errors.push("sequence");
  }
  if (!HOSTED_DIAGNOSTIC_LOCALES.includes(value?.locale)) errors.push("locale");
  if (!HOSTED_DIAGNOSTIC_SCENARIOS.includes(value?.scenario)) errors.push("scenario");
  if (!HOSTED_DIAGNOSTIC_MODES.includes(value?.expectedMode)) errors.push("mode");
  if (!SHA256.test(String(value?.fixtureSemanticFingerprint || ""))) errors.push("fixture_fingerprint");
  const matrix = expectedHostedDiagnosticMatrixEntry(value?.sequence);
  if (!matrix || matrix.locale !== value?.locale || matrix.scenario !== value?.scenario ||
      matrix.expectedMode !== value?.expectedMode) errors.push("matrix_sequence");
  if (containsHostedDiagnosticForbiddenKey(value)) errors.push("forbidden_key");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze([...new Set(errors)].sort()) });
}

function validCountMap(value, keys) {
  return exactKeys(value, keys) && Object.values(value).every((count) =>
    Number.isInteger(count) && count >= 0
  );
}

function sumCounts(value) {
  return Object.values(value || {}).reduce((sum, count) => sum + count, 0);
}

export function zeroHostedDiagnosticCountMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

export function validateHostedDiagnosticAggregate(value) {
  const errors = [];
  if (!exactKeys(value, AGGREGATE_KEYS)) errors.push("field_set");
  if (value?.schemaVersion !== HOSTED_DIAGNOSTIC_AGGREGATE_SCHEMA) errors.push("schema");
  if (!HOSTED_DIAGNOSTIC_SCENARIOS.includes(value?.fixtureScenario)) errors.push("scenario");
  if (!SHA256.test(String(value?.fixtureSemanticFingerprint || ""))) errors.push("fingerprint");
  if (!HOSTED_DIAGNOSTIC_LOCALES.includes(value?.locale)) errors.push("locale");
  if (!HOSTED_DIAGNOSTIC_MODES.includes(value?.mode)) errors.push("mode");
  if (!HOSTED_DIAGNOSTIC_EXECUTION_STATUSES.includes(value?.executionStatus)) errors.push("status");
  if (!Number.isInteger(value?.candidateCount) || value.candidateCount < 0) errors.push("candidate_count");
  if (!validCountMap(value?.exposureCounts, CANDIDATE_EXPOSURES)) errors.push("exposure_counts");
  if (!validCountMap(value?.laneEligibilityCounts, CANDIDATE_EXPOSURE_LANES)) errors.push("lane_counts");
  if (!validCountMap(value?.divergenceCategoryCounts, CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES)) {
    errors.push("divergence_counts");
  }
  for (const key of [
    "unexpectedDivergenceCount", "unclassifiedDivergenceCount", "shadowExceptionCount",
    "fallbackCount", "invalidContextCount"
  ]) {
    if (!Number.isInteger(value?.[key]) || value[key] < 0) errors.push(key);
  }
  for (const key of [
    "responseFingerprintMatch", "snapshotFingerprintMatch", "candidateOrderMatch",
    "projectionFingerprintPresent"
  ]) {
    if (typeof value?.[key] !== "boolean") errors.push(key);
  }
  if (Number.isInteger(value?.candidateCount)) {
    if (sumCounts(value?.exposureCounts) !== value.candidateCount) errors.push("exposure_total");
    if (sumCounts(value?.divergenceCategoryCounts) !== value.candidateCount) errors.push("divergence_total");
    if (Object.values(value?.laneEligibilityCounts || {}).some((count) => count > value.candidateCount)) {
      errors.push("lane_total");
    }
  }
  if (value?.unexpectedDivergenceCount !== (value?.divergenceCategoryCounts?.unexpected_divergence || 0)) {
    errors.push("unexpected_total");
  }
  if (value?.mode === "control") {
    if (value.executionStatus !== "hosted_control_disabled" || value.candidateCount !== 0 ||
        value.projectionFingerprintPresent !== false || value.unexpectedDivergenceCount !== 0 ||
        value.unclassifiedDivergenceCount !== 0 || value.shadowExceptionCount !== 0 ||
        value.fallbackCount !== 0 || value.invalidContextCount !== 0 ||
        !value.responseFingerprintMatch || !value.snapshotFingerprintMatch || !value.candidateOrderMatch) {
      errors.push("control_contract");
    }
  }
  if (value?.mode === "canary") {
    if (value.executionStatus !== "hosted_canary_executed" || value.candidateCount < 1 ||
        value.projectionFingerprintPresent !== true || value.unexpectedDivergenceCount !== 0 ||
        value.unclassifiedDivergenceCount !== 0 || value.shadowExceptionCount !== 0 ||
        value.fallbackCount !== 0 || value.invalidContextCount !== 0 ||
        !value.responseFingerprintMatch || !value.snapshotFingerprintMatch || !value.candidateOrderMatch) {
      errors.push("canary_contract");
    }
  }
  if (containsHostedDiagnosticForbiddenKey(value)) errors.push("forbidden_key");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze([...new Set(errors)].sort()) });
}

export function validateHostedDiagnosticEnvelope(value) {
  const errors = [];
  if (!exactKeys(value, ENVELOPE_KEYS)) errors.push("field_set");
  if (value?.schemaVersion !== HOSTED_DIAGNOSTIC_ENVELOPE_SCHEMA) errors.push("schema");
  if (value?.status !== "completed") errors.push("status");
  if (!SHA40.test(String(value?.sourceSha || ""))) errors.push("source_sha");
  if (value?.environmentClass !== "preview") errors.push("environment");
  if (!SHA256.test(String(value?.deploymentIdHash || ""))) errors.push("deployment_hash");
  if (!SHA256.test(String(value?.executionGrantDigest || ""))) errors.push("grant_digest");
  if (!Number.isInteger(value?.sequence) || value.sequence < 1 || value.sequence > 16) errors.push("sequence");
  if (value?.finalDiagnosticStage !== "candidate_policy_diagnostic_complete") errors.push("final_stage");
  if (typeof value?.shadowExecution !== "boolean") errors.push("shadow_execution");
  const aggregate = validateHostedDiagnosticAggregate(value?.aggregate);
  if (!aggregate.valid) errors.push(...aggregate.errors.map((error) => `aggregate:${error}`));
  if (value?.aggregate?.mode === "control" && value.shadowExecution !== false) errors.push("control_shadow");
  if (value?.aggregate?.mode === "canary" && value.shadowExecution !== true) errors.push("canary_shadow");
  if (containsHostedDiagnosticForbiddenKey(value)) errors.push("forbidden_key");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze([...new Set(errors)].sort()) });
}

export const HOSTED_DIAGNOSTIC_REQUEST_FIELDS = REQUEST_KEYS;
export const HOSTED_DIAGNOSTIC_AGGREGATE_FIELDS = AGGREGATE_KEYS;
export const HOSTED_DIAGNOSTIC_ENVELOPE_FIELDS = ENVELOPE_KEYS;
