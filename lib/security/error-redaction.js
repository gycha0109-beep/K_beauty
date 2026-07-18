const MAX_LOG_TEXT_LENGTH = 96;
const MAX_LOG_PAYLOAD_BYTES = 1024;

const ANSI_ESCAPE_PATTERN = /(?:\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const CREDENTIAL_PATTERN = /(?:bearer\s+[a-z0-9._~+\/-]+=*|(?:authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|api[_-]?key|service[_-]?role|signing[_-]?secret|password|pkce|code[_-]?verifier)\s*[:=]\s*[^\s,;]+|sk-[a-z0-9_-]{8,}|eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,})/gi;
const USER_CONTENT_PATTERN = /(?:data:image\/[^;,]+;base64,[a-z0-9+/=]+|[a-z0-9+/]{120,}={0,2})/gi;
const EMAIL_PATTERN = /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
export const SAFE_PROVIDER_MODELS = Object.freeze([
  "gpt-4o",
  "gpt-4o-mini"
]);

export const PUBLIC_ERROR_CODES = Object.freeze([
  "analysis_unavailable",
  "checkin_save_failed",
  "forbidden",
  "invalid_json",
  "invalid_payload",
  "invalid_request",
  "invalid_request_origin",
  "method_not_allowed",
  "not_found",
  "rate_limited",
  "save_report_unavailable",
  "service_unavailable",
  "signout_unavailable",
  "tracking_unavailable",
  "unauthorized"
]);

const PUBLIC_ERROR_CODE_SET = new Set(PUBLIC_ERROR_CODES);
const PUBLIC_ERROR_MESSAGES = Object.freeze({
  analysis_unavailable: "The analysis is temporarily unavailable.",
  checkin_save_failed: "The check-in could not be saved.",
  forbidden: "This request is not allowed.",
  invalid_json: "The request body is invalid.",
  invalid_payload: "The request payload is invalid.",
  invalid_request: "The request is invalid.",
  invalid_request_origin: "The request origin is invalid.",
  method_not_allowed: "This request method is not allowed.",
  not_found: "The requested resource was not found.",
  rate_limited: "Too many requests. Please try again later.",
  save_report_unavailable: "The report cannot be saved right now.",
  service_unavailable: "The service is temporarily unavailable.",
  signout_unavailable: "Sign out is temporarily unavailable.",
  tracking_unavailable: "The tracking event cannot be stored right now.",
  unauthorized: "Authentication is required."
});

export const SAFE_LOG_EVENTS = Object.freeze([
  "analysis_failed",
  "analysis_diagnostic",
  "auth_callback_failed",
  "auth_callback_profile_sync_failed",
  "check_in_failed",
  "client_operation_failed",
  "dashboard_failed",
  "database_operation_failed",
  "face_reading_failed",
  "full_report_failed",
  "premium_report_failed",
  "product_source_failed",
  "profile_sync_failed",
  "provider_runtime",
  "results_save_failed",
  "save_report_failed",
  "session_operation_failed",
  "supabase_auth_failed",
  "tracking_failed"
]);

export const SAFE_LOG_CATEGORIES = Object.freeze([
  "browser_api_unavailable",
  "configuration_state",
  "configuration_unavailable",
  "database_unavailable",
  "forbidden",
  "internal_error",
  "network_unavailable",
  "provider_unavailable",
  "response_shape_invalid",
  "runtime_state",
  "schema_unavailable",
  "session_unavailable",
  "storage_unavailable",
  "unauthorized",
  "validation_rejected"
]);

const SAFE_LOG_EVENT_SET = new Set(SAFE_LOG_EVENTS);
const SAFE_LOG_CATEGORY_SET = new Set(SAFE_LOG_CATEGORIES);
const SAFE_PROVIDER_MODEL_SET = new Set(SAFE_PROVIDER_MODELS);
const SAFE_LOG_LEVEL_SET = new Set(["debug", "error", "info", "warn"]);
const SAFE_OPERATION_SET = new Set([
  "analysis",
  "auth_callback",
  "check_in",
  "client",
  "dashboard",
  "face_reading",
  "full_report",
  "premium_report_session",
  "product_source",
  "profile_sync",
  "provider_request",
  "results",
  "save_report",
  "supabase_auth",
  "track"
]);
const SAFE_DEPENDENCY_SET = new Set(["application", "browser", "provider", "supabase"]);
const SAFE_ENVIRONMENT_SET = new Set(["development", "preview", "production", "test", "unknown"]);
const SAFE_PROVIDER_SET = new Set(["openai", "openrouter", "provider"]);

export const ANALYZE_LOG_STAGE_POLICIES = Object.freeze([
  Object.freeze({
    stage: "functional-shadow-capture:skipped",
    event: "analysis_diagnostic",
    category: "runtime_state",
    severity: "info",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "functional-shadow-capture:failed",
    event: "analysis_diagnostic",
    category: "runtime_state",
    severity: "warn",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "shadow-boundary-dry-run:non-blocking-failure",
    event: "analysis_diagnostic",
    category: "runtime_state",
    severity: "warn",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "local-shadow-recommendation-evidence:skipped",
    event: "analysis_diagnostic",
    category: "runtime_state",
    severity: "info",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "local-shadow-recommendation-evidence:non-blocking-failure",
    event: "analysis_diagnostic",
    category: "runtime_state",
    severity: "warn",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "local-actual-runtime-evidence:non-blocking-failure",
    event: "analysis_diagnostic",
    category: "runtime_state",
    severity: "warn",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "analysis-guard:fail-failed",
    event: "analysis_failed",
    category: "internal_error",
    severity: "error",
    dependency: "application",
    retryable: true
  }),
  Object.freeze({
    stage: "openai-env:diagnostic",
    event: "analysis_diagnostic",
    category: "configuration_state",
    severity: "info",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "photo-evidence:fallback",
    event: "analysis_failed",
    category: "provider_unavailable",
    severity: "warn",
    dependency: "provider",
    retryable: true
  }),
  Object.freeze({
    stage: "product-explanations:fallback",
    event: "analysis_failed",
    category: "provider_unavailable",
    severity: "warn",
    dependency: "provider",
    retryable: true
  }),
  Object.freeze({
    stage: "response:shape-warning",
    event: "analysis_diagnostic",
    category: "response_shape_invalid",
    severity: "warn",
    dependency: "application",
    retryable: false
  }),
  Object.freeze({
    stage: "analysis-guard:complete-failed",
    event: "analysis_failed",
    category: "internal_error",
    severity: "error",
    dependency: "application",
    retryable: true
  }),
  Object.freeze({
    stage: "product-source:unavailable",
    event: "product_source_failed",
    category: "database_unavailable",
    severity: "error",
    dependency: "supabase",
    retryable: true
  }),
  Object.freeze({
    stage: "request:error",
    event: "analysis_failed",
    category: "internal_error",
    severity: "error",
    dependency: "application",
    retryable: true
  })
]);

const UNKNOWN_ANALYZE_LOG_POLICY = Object.freeze({
  event: "analysis_failed",
  category: "internal_error",
  severity: "error",
  dependency: "application",
  retryable: false
});

export const SENSITIVE_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
});

function readValue(input, key) {
  if ((typeof input !== "object" && typeof input !== "function") || input === null) {
    return undefined;
  }

  try {
    return input[key];
  } catch {
    return undefined;
  }
}

function allowlistedValue(value, allowed, fallback = null) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function safeStatus(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function safeNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

export function sanitizeLogText(value, fallback = "redacted") {
  if (typeof value !== "string") {
    return fallback;
  }

  let normalized = value
    .replace(ANSI_ESCAPE_PATTERN, " ")
    .replace(CONTROL_CHARACTER_PATTERN, " ")
    .replace(CREDENTIAL_PATTERN, "[redacted]")
    .replace(USER_CONTENT_PATTERN, "[redacted]")
    .replace(EMAIL_PATTERN, "[redacted]")
    .replace(IPV4_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return fallback;
  }

  if (/\bhttps?:\/\//i.test(normalized) || normalized.includes("?")) {
    return fallback;
  }

  if (normalized.length > MAX_LOG_TEXT_LENGTH) {
    normalized = normalized.slice(0, MAX_LOG_TEXT_LENGTH);
  }

  return normalized || fallback;
}

export function classifyUnknownError(error, fallbackCategory = "internal_error") {
  void error;
  return allowlistedValue(fallbackCategory, SAFE_LOG_CATEGORY_SET, "internal_error");
}

export function isAllowedPublicErrorCode(code) {
  return typeof code === "string" && PUBLIC_ERROR_CODE_SET.has(code);
}

export function createPublicError(code, options = {}) {
  const fallbackCode = allowlistedValue(
    readValue(options, "fallbackCode"),
    PUBLIC_ERROR_CODE_SET,
    "service_unavailable"
  );
  const safeCode = isAllowedPublicErrorCode(code) ? code : fallbackCode;
  const includeMessage = readValue(options, "includeMessage") === true;
  const payload = { error: safeCode };

  if (includeMessage) {
    payload.message = PUBLIC_ERROR_MESSAGES[safeCode];
  }

  return Object.freeze(payload);
}

export function getSafePublicErrorMessage(code, fallbackCode = "service_unavailable") {
  const safeCode = isAllowedPublicErrorCode(code)
    ? code
    : isAllowedPublicErrorCode(fallbackCode)
      ? fallbackCode
      : "service_unavailable";

  return PUBLIC_ERROR_MESSAGES[safeCode];
}

export function createNoStoreHeaders(existingHeaders = undefined) {
  let headers;

  try {
    headers = new Headers(existingHeaders);
  } catch {
    headers = new Headers();
  }

  Object.entries(SENSITIVE_NO_STORE_HEADERS).forEach(([name, value]) => {
    headers.set(name, value);
  });

  return headers;
}

export function createSafeLogEvent(input = {}) {
  const event = allowlistedValue(readValue(input, "event"), SAFE_LOG_EVENT_SET, "client_operation_failed");
  const category = allowlistedValue(
    readValue(input, "category"),
    SAFE_LOG_CATEGORY_SET,
    "internal_error"
  );
  const severity = allowlistedValue(readValue(input, "severity"), SAFE_LOG_LEVEL_SET, "error");
  const payload = { event, category, severity };
  const operation = allowlistedValue(readValue(input, "operation"), SAFE_OPERATION_SET);
  const dependency = allowlistedValue(readValue(input, "dependency"), SAFE_DEPENDENCY_SET);
  const environment = allowlistedValue(readValue(input, "environment"), SAFE_ENVIRONMENT_SET);
  const provider = allowlistedValue(readValue(input, "provider"), SAFE_PROVIDER_SET);
  const status = safeStatus(readValue(input, "status"));
  const durationMs = safeNonNegativeNumber(readValue(input, "durationMs"));
  const count = safeNonNegativeNumber(readValue(input, "count"));
  const retryable = readValue(input, "retryable");
  const ok = readValue(input, "ok");
  const modelValue = readValue(input, "model");

  if (operation) payload.operation = operation;
  if (dependency) payload.dependency = dependency;
  if (environment) payload.environment = environment;
  if (provider) payload.provider = provider;
  if (status !== null) payload.status = status;
  if (durationMs !== null) payload.durationMs = durationMs;
  if (count !== null && count <= 1000000) payload.count = count;
  if (typeof retryable === "boolean") payload.retryable = retryable;
  if (typeof ok === "boolean") payload.ok = ok;
  if (typeof modelValue === "string" && SAFE_PROVIDER_MODEL_SET.has(modelValue)) {
    payload.model = modelValue;
  }

  try {
    if (new TextEncoder().encode(JSON.stringify(payload)).byteLength <= MAX_LOG_PAYLOAD_BYTES) {
      return Object.freeze(payload);
    }
  } catch {
    // The fallback below contains only fixed primitives.
  }

  return Object.freeze({ event, category, severity });
}

export function createAnalyzeLogEvent(stage) {
  const policy = ANALYZE_LOG_STAGE_POLICIES.find((candidate) => candidate.stage === stage)
    || UNKNOWN_ANALYZE_LOG_POLICY;

  return createSafeLogEvent({
    event: policy.event,
    category: policy.category,
    severity: policy.severity,
    operation: "analysis",
    dependency: policy.dependency,
    retryable: policy.retryable
  });
}

export function writeSafeLog(level, input, sink = console) {
  const payload = createSafeLogEvent({
    event: readValue(input, "event"),
    category: readValue(input, "category"),
    severity: allowlistedValue(level, SAFE_LOG_LEVEL_SET, "error"),
    operation: readValue(input, "operation"),
    dependency: readValue(input, "dependency"),
    environment: readValue(input, "environment"),
    provider: readValue(input, "provider"),
    model: readValue(input, "model"),
    status: readValue(input, "status"),
    durationMs: readValue(input, "durationMs"),
    count: readValue(input, "count"),
    retryable: readValue(input, "retryable"),
    ok: readValue(input, "ok")
  });

  try {
    const logger = readValue(sink, payload.severity);

    if (typeof logger === "function") {
      logger.call(sink, "[security-event]", payload);
    }
  } catch {
    // Observability must never alter the application response path.
  }

  return payload;
}

export function getErrorRedactionContract() {
  return Object.freeze({
    maxLogPayloadBytes: MAX_LOG_PAYLOAD_BYTES,
    maxLogTextLength: MAX_LOG_TEXT_LENGTH,
    publicErrorCodes: PUBLIC_ERROR_CODES,
    safeProviderModels: SAFE_PROVIDER_MODELS,
    safeLogEvents: SAFE_LOG_EVENTS,
    safeLogCategories: SAFE_LOG_CATEGORIES,
    noStoreHeaders: SENSITIVE_NO_STORE_HEADERS
  });
}
