import { randomUUID } from "node:crypto";
import { writeSafeLog } from "./security/error-redaction.js";

export const PREMIUM_SESSION_PIPELINE_DIAGNOSTIC_VERSION =
  "premium-session-runtime-boundary-v1";
export const PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER =
  "x-bejewely-premium-diagnostic-id";
export const PREMIUM_SESSION_DIAGNOSTIC_VERSION_HEADER =
  "x-bejewely-premium-diagnostic-version";
export const PREMIUM_SESSION_RUNTIME_COMMIT_HEADER =
  "x-bejewely-runtime-commit";
export const PREMIUM_SESSION_FINAL_STAGE_HEADER =
  "x-bejewely-premium-final-stage";

const DIAGNOSTIC_ID_PATTERN =
  /^premium-session-diagnostic-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const MAX_MEASUREMENT_DEPTH = 12;
const MAX_MEASUREMENT_ENTRIES = 2000;
const MAX_MEASUREMENT_BYTES = 256 * 1024;

export const PREMIUM_SESSION_DIAGNOSTIC_STAGES = Object.freeze([
  "S0_decision",
  "S1_original_premium_report",
  "S2_session_source",
  "S3_rebuilt_report",
  "S4_report_sanitized",
  "S5_purchase_sanitized",
  "S6_image_sanitized",
  "S7_session_input",
  "S8_session_result",
  "S9_cookie_emission"
]);

const STAGE_SET = new Set(PREMIUM_SESSION_DIAGNOSTIC_STAGES);
const VALIDATION_REASONS = new Set([
  "outer_payload_missing",
  "premium_report_missing",
  "premium_report_not_record",
  "premium_report_empty_record"
]);

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encodedBytes(value) {
  try {
    return new TextEncoder().encode(String(value ?? "")).byteLength;
  } catch {
    return 0;
  }
}

function measureStructure(value) {
  const state = {
    entries: 0,
    bytes: 0,
    truncated: false,
    seen: new WeakSet()
  };

  const visit = (current, depth) => {
    if (
      state.truncated ||
      depth > MAX_MEASUREMENT_DEPTH ||
      state.entries >= MAX_MEASUREMENT_ENTRIES ||
      state.bytes >= MAX_MEASUREMENT_BYTES
    ) {
      state.truncated = true;
      return;
    }

    if (current == null || typeof current !== "object") {
      state.entries += 1;
      state.bytes += Math.min(encodedBytes(current), MAX_MEASUREMENT_BYTES - state.bytes);
      if (state.bytes >= MAX_MEASUREMENT_BYTES) state.truncated = true;
      return;
    }

    if (state.seen.has(current)) {
      state.truncated = true;
      return;
    }

    state.seen.add(current);
    let entries;
    try {
      entries = Array.isArray(current)
        ? current.map((item, index) => [String(index), item])
        : Object.entries(current);
    } catch {
      state.truncated = true;
      state.seen.delete(current);
      return;
    }

    for (const [key, child] of entries) {
      if (
        state.entries >= MAX_MEASUREMENT_ENTRIES ||
        state.bytes >= MAX_MEASUREMENT_BYTES
      ) {
        state.truncated = true;
        break;
      }
      state.entries += 1;
      state.bytes += Math.min(encodedBytes(key), MAX_MEASUREMENT_BYTES - state.bytes);
      visit(child, depth + 1);
    }

    state.seen.delete(current);
  };

  visit(value, 0);
  return {
    boundedEntryCount: Math.min(state.entries, MAX_MEASUREMENT_ENTRIES),
    boundedJsonBytes: Math.min(state.bytes, MAX_MEASUREMENT_BYTES),
    truncatedMeasurement: state.truncated
  };
}

export function createPremiumSessionDiagnosticId() {
  return `premium-session-diagnostic-${randomUUID()}`;
}

export function isValidPremiumSessionDiagnosticId(value) {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    DIAGNOSTIC_ID_PATTERN.test(value)
  );
}

export function createPremiumSessionDiagnosticContext(request, env = process.env) {
  const diagnosticId = request?.headers?.get?.(
    PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER
  );
  const runtimeCommitSha = String(env?.VERCEL_GIT_COMMIT_SHA || "").trim();
  const active =
    env?.VERCEL_ENV === "preview" &&
    isValidPremiumSessionDiagnosticId(diagnosticId);

  return {
    active,
    diagnosticVersion: PREMIUM_SESSION_PIPELINE_DIAGNOSTIC_VERSION,
    diagnosticId: active ? diagnosticId : null,
    runtimeCommitSha: COMMIT_SHA_PATTERN.test(runtimeCommitSha)
      ? runtimeCommitSha.toLowerCase()
      : null,
    finalStage: null
  };
}

export function describePremiumSessionStructure(value, requiredKeys = []) {
  const present = value !== null && value !== undefined;
  const isRecord = isPlainRecord(value);
  const isArray = Array.isArray(value);
  let keys = [];
  try {
    keys = isRecord ? Object.keys(value) : [];
  } catch {
    keys = [];
  }
  const measurement = measureStructure(value);

  return {
    present,
    isRecord,
    isArray,
    topLevelKeyCount: keys.length,
    requiredKeysPresent:
      isRecord &&
      requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
    decisionBundlePresent:
      isRecord && isPlainRecord(value.decisionBundle),
    freeResultPresent:
      isRecord && isPlainRecord(value.freeResult),
    premiumReportWrapperPresent:
      isRecord && Object.prototype.hasOwnProperty.call(value, "premiumReport"),
    ...measurement
  };
}

function diagnosticIdentity(context) {
  return {
    diagnosticVersion: context.diagnosticVersion,
    diagnosticId: context.diagnosticId,
    runtimeCommitSha: context.runtimeCommitSha
  };
}

export function logPremiumSessionDiagnosticStage(
  context,
  stage,
  value,
  { requiredKeys = [], sink = console } = {}
) {
  if (!context?.active || !STAGE_SET.has(stage)) return null;
  context.finalStage = stage;
  return writeSafeLog(
    "info",
    {
      event: "analysis_diagnostic",
      category: "runtime_state",
      operation: "premium_session_payload",
      dependency: "application",
      ...diagnosticIdentity(context),
      stage,
      ...describePremiumSessionStructure(value, requiredKeys),
      ok: true
    },
    sink
  );
}

export function classifyPremiumSessionPayload(payload) {
  if (!isPlainRecord(payload)) return "outer_payload_missing";
  if (
    !Object.prototype.hasOwnProperty.call(payload, "premiumReport") ||
    payload.premiumReport == null
  ) {
    return "premium_report_missing";
  }
  if (!isPlainRecord(payload.premiumReport)) {
    return "premium_report_not_record";
  }
  if (Object.keys(payload.premiumReport).length === 0) {
    return "premium_report_empty_record";
  }
  return null;
}

export function logPremiumSessionValidationFailure(
  context,
  validationReason,
  sink = console
) {
  if (
    !context?.active ||
    !VALIDATION_REASONS.has(validationReason)
  ) {
    return null;
  }
  return writeSafeLog(
    "warn",
    {
      event: "premium_report_failed",
      category: "validation_rejected",
      operation: "premium_report_session",
      dependency: "application",
      ...diagnosticIdentity(context),
      validationReason,
      retryable: false,
      ok: false
    },
    sink
  );
}

export function applyPremiumSessionDiagnosticHeaders(response, context) {
  if (!context?.active || !response?.headers?.set) return response;
  response.headers.set(
    PREMIUM_SESSION_DIAGNOSTIC_VERSION_HEADER,
    context.diagnosticVersion
  );
  response.headers.set(
    PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER,
    context.diagnosticId
  );
  if (context.runtimeCommitSha) {
    response.headers.set(
      PREMIUM_SESSION_RUNTIME_COMMIT_HEADER,
      context.runtimeCommitSha
    );
  }
  if (context.finalStage && STAGE_SET.has(context.finalStage)) {
    response.headers.set(
      PREMIUM_SESSION_FINAL_STAGE_HEADER,
      context.finalStage
    );
  }
  return response;
}
