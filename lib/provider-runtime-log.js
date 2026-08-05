import {
  createSafeLogEvent,
  sanitizeLogText,
  writeSafeLog
} from "./security/error-redaction.js";

const SAFE_PROVIDER_STAGES = new Set([
  "face-reading",
  "photo-evidence",
  "product-explanations",
  "vision-observation",
  "provider_request"
]);
const SAFE_PROVIDER_ERROR_CATEGORIES = new Set([
  "contract_invalid",
  "empty_response",
  "http_error",
  "invalid_response",
  "provider_error",
  "redirect_rejected",
  "request_failed",
  "response_too_large",
  "timeout"
]);

function safeStage(value) {
  const normalized = sanitizeLogText(value, "");

  return SAFE_PROVIDER_STAGES.has(normalized) ? normalized : "provider_request";
}

function safeStatus(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function safeDuration(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

export function buildProviderRuntimeLogEvent({
  stage,
  status,
  ok,
  provider = "openai",
  model,
  durationMs,
  errorCategory = null
} = {}) {
  const safeEvent = createSafeLogEvent({
    event: "provider_runtime",
    category: ok === true ? "internal_error" : "provider_unavailable",
    severity: ok === true ? "info" : "warn",
    operation: "provider_request",
    dependency: "provider",
    provider,
    model,
    status,
    durationMs,
    ok
  });
  const event = {
    stage: safeStage(stage),
    status: safeEvent.status ?? safeStatus(status),
    ok: safeEvent.ok === true,
    provider: safeEvent.provider || "provider",
    model: safeEvent.model || "unknown",
    durationMs: safeEvent.durationMs ?? safeDuration(durationMs)
  };

  if (typeof errorCategory === "string" && SAFE_PROVIDER_ERROR_CATEGORIES.has(errorCategory)) {
    event.errorCategory = errorCategory;
  }

  return event;
}

export function logProviderRuntimeEvent(event, sink = console) {
  const payload = buildProviderRuntimeLogEvent(event);
  writeSafeLog(payload.ok ? "info" : "warn", {
    event: "provider_runtime",
    category: payload.ok ? "internal_error" : "provider_unavailable",
    operation: "provider_request",
    dependency: "provider",
    provider: payload.provider,
    model: payload.model,
    status: payload.status,
    durationMs: payload.durationMs,
    ok: payload.ok
  }, sink);
  return payload;
}
