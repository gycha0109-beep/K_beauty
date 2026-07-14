const MAX_MODEL_LENGTH = 80;

function safeString(value, fallback) {
  const normalized = typeof value === "string" ? value.trim() : "";

  return normalized && normalized.length <= MAX_MODEL_LENGTH ? normalized : fallback;
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
  const event = {
    stage: safeString(stage, "provider_request"),
    status: safeStatus(status),
    ok: ok === true,
    provider: safeString(provider, "provider"),
    model: safeString(model, "unknown"),
    durationMs: safeDuration(durationMs)
  };

  if (typeof errorCategory === "string" && errorCategory.trim()) {
    event.errorCategory = safeString(errorCategory, "provider_error");
  }

  return event;
}

export function logProviderRuntimeEvent(event, sink = console) {
  const payload = buildProviderRuntimeLogEvent(event);
  const logger = payload.ok ? sink.info : sink.warn;

  logger.call(sink, "[provider-runtime]", payload);
  return payload;
}
