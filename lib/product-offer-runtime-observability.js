export const PRODUCT_OFFER_RUNTIME_TELEMETRY_SCHEMA_VERSION =
  "product-offer-runtime-observability-v1";
export const PRODUCT_OFFER_RUNTIME_TELEMETRY_EVENT =
  "product_offer_authority_runtime";

const ALLOWED_STATUSES = new Set(["success", "failure"]);

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function buildProductOfferRuntimeTelemetry(input = {}) {
  const status = String(input.status || "").trim();
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error("product_offer_runtime_telemetry_status_invalid");
  }

  return Object.freeze({
    event: PRODUCT_OFFER_RUNTIME_TELEMETRY_EVENT,
    schemaVersion: PRODUCT_OFFER_RUNTIME_TELEMETRY_SCHEMA_VERSION,
    status,
    requestedProductCount: normalizeCount(input.requestedProductCount),
    returnedOfferCount:
      status === "success" ? normalizeCount(input.returnedOfferCount) : 0,
  });
}

export function emitProductOfferRuntimeTelemetry(input = {}, logger = console) {
  const payload = buildProductOfferRuntimeTelemetry(input);
  const level = payload.status === "failure" ? "warn" : "info";
  const sink = logger?.[level];

  if (typeof sink === "function") {
    sink.call(logger, "[product-offer-authority-runtime]", payload);
  }

  return payload;
}
