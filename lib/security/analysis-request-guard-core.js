import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES,
  assignExfoliationNormativePolicyProductionProvenance
} from "../exfoliation-normative-policy-production-provenance.js";

export const ANALYSIS_GUARD_COOKIE_NAME = "visualry_analysis_anon";
export const ANALYSIS_GUARD_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const ANALYSIS_GUARD_SECRET_ENV = "ANALYSIS_REQUEST_GUARD_SECRET";
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export const ANALYSIS_GUARD_POLICIES = Object.freeze({
  analyze: Object.freeze({
    path: "/api/analyze",
    limits: Object.freeze({
      user: Object.freeze([
        Object.freeze({ name: "hour", windowMs: 60 * 60 * 1000, limit: 5 }),
        Object.freeze({ name: "day", windowMs: 24 * 60 * 60 * 1000, limit: 15 })
      ]),
      anonymous: Object.freeze([
        Object.freeze({ name: "hour", windowMs: 60 * 60 * 1000, limit: 2 }),
        Object.freeze({ name: "day", windowMs: 24 * 60 * 60 * 1000, limit: 4 })
      ]),
      ip: Object.freeze([
        Object.freeze({ name: "hour", windowMs: 60 * 60 * 1000, limit: 5 }),
        Object.freeze({ name: "day", windowMs: 24 * 60 * 60 * 1000, limit: 10 })
      ])
    })
  }),
  "face-reading": Object.freeze({
    path: "/api/face-reading",
    limits: Object.freeze({
      user: Object.freeze([
        Object.freeze({ name: "hour", windowMs: 60 * 60 * 1000, limit: 3 }),
        Object.freeze({ name: "day", windowMs: 24 * 60 * 60 * 1000, limit: 8 })
      ]),
      anonymous: Object.freeze([
        Object.freeze({ name: "hour", windowMs: 60 * 60 * 1000, limit: 1 }),
        Object.freeze({ name: "day", windowMs: 24 * 60 * 60 * 1000, limit: 2 })
      ]),
      ip: Object.freeze([
        Object.freeze({ name: "hour", windowMs: 60 * 60 * 1000, limit: 3 }),
        Object.freeze({ name: "day", windowMs: 24 * 60 * 60 * 1000, limit: 5 })
      ])
    })
  })
});

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

export function getAnalysisGuardPolicy(endpoint) {
  return ANALYSIS_GUARD_POLICIES[endpoint] || null;
}

export function createGuardHmac(secret, purpose, value) {
  return createHmac("sha256", secret)
    .update(`${purpose}\n${value}`)
    .digest("hex");
}

export function isGuardHash(value) {
  return typeof value === "string" && HEX_64_PATTERN.test(value);
}

export function createRandomAnonymousPayload() {
  return randomBytes(24).toString("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signAnonymousCookiePayload(payload, secret) {
  const signedValue = `v1.${payload}`;
  const signature = createGuardHmac(secret, "analysis-anonymous-cookie", signedValue);

  return `${signedValue}.${signature}`;
}

export function createSignedAnonymousCookie(secret) {
  return signAnonymousCookiePayload(createRandomAnonymousPayload(), secret);
}

export function verifySignedAnonymousCookie(cookieValue, secret) {
  if (typeof cookieValue !== "string") {
    return { ok: false, code: "missing" };
  }

  const parts = cookieValue.split(".");

  if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) {
    return { ok: false, code: "malformed" };
  }

  const signedValue = `${parts[0]}.${parts[1]}`;
  const expectedSignature = createGuardHmac(secret, "analysis-anonymous-cookie", signedValue);

  if (!safeEqual(parts[2], expectedSignature)) {
    return { ok: false, code: "invalid_signature" };
  }

  return { ok: true, payload: parts[1] };
}

export function validateIdempotencyKey(rawKey) {
  if (rawKey == null || rawKey === "") {
    return { ok: true, key: null, missing: true };
  }

  if (typeof rawKey !== "string") {
    return { ok: false, code: "invalid_type" };
  }

  const key = rawKey.trim();

  if (key !== rawKey || !IDEMPOTENCY_KEY_PATTERN.test(key) || key.includes(",")) {
    return { ok: false, code: "invalid_format" };
  }

  return { ok: true, key, missing: false };
}

function normalizeStableValue(value) {
  if (value == null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeStableValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((normalized, key) => {
        const normalizedValue = normalizeStableValue(value[key]);

        if (normalizedValue !== undefined) {
          normalized[key] = normalizedValue;
        }

        return normalized;
      }, {});
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value);
}

export function stableSerialize(value) {
  return JSON.stringify(normalizeStableValue(value));
}

export function createRequestFingerprintHash({ endpoint, input, secret }) {
  if (endpoint === "analyze" && input?.form && typeof input.form === "object") {
    assignExfoliationNormativePolicyProductionProvenance(
      input.form,
      EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION
    );
  }

  return createGuardHmac(secret, "analysis-request-fingerprint", stableSerialize({ endpoint, input }));
}

export function createPrincipalHash({ scope, value, secret }) {
  return createGuardHmac(secret, `analysis-principal:${scope}`, value);
}

export function createIdempotencyKeyHash({ key, secret }) {
  return createGuardHmac(secret, "analysis-idempotency-key", key);
}

export function getUploadFingerprintDescriptor(file) {
  if (!file) {
    return null;
  }

  return {
    type: typeof file.type === "string" ? file.type.toLowerCase() : "",
    size: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
    name: typeof file.name === "string" ? file.name : ""
  };
}

export function buildWindowKey(nowMs, windowName, windowMs) {
  const startedAtMs = Math.floor(nowMs / windowMs) * windowMs;
  const resetAtMs = startedAtMs + windowMs;

  return {
    windowKey: `${windowName}:${new Date(startedAtMs).toISOString()}`,
    windowStartedAt: new Date(startedAtMs).toISOString(),
    windowResetAt: new Date(resetAtMs).toISOString()
  };
}
