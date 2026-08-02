import {
  createHash,
  createHmac,
  timingSafeEqual
} from "node:crypto";

export const HOSTED_DIAGNOSTIC_PATH =
  "/api/internal/candidate-exposure-policy-diagnostic";
export const HOSTED_DIAGNOSTIC_CONTENT_TYPE = "application/json";
export const HOSTED_DIAGNOSTIC_AUTH_HEADERS = Object.freeze({
  timestamp: "x-bejewely-diagnostic-timestamp",
  nonce: "x-bejewely-diagnostic-nonce",
  signature: "x-bejewely-diagnostic-signature"
});

const HEX64 = /^[0-9a-f]{64}$/;
const IMMUTABLE_VERCEL_HOST =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.vercel\.app$/;
const NONCE = /^[A-Za-z0-9_-]{43}$/;

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeDiagnosticHost(value) {
  const host = String(value || "").trim().toLowerCase();
  return IMMUTABLE_VERCEL_HOST.test(host) ? host : null;
}

export function validateDiagnosticNonce(value) {
  const nonce = String(value || "");
  if (!NONCE.test(nonce)) return false;
  try {
    return Buffer.from(nonce, "base64url").length === 32;
  } catch {
    return false;
  }
}

export function buildDiagnosticCanonicalBytes({
  method = "POST",
  path = HOSTED_DIAGNOSTIC_PATH,
  host,
  contentType = HOSTED_DIAGNOSTIC_CONTENT_TYPE,
  timestamp,
  nonce,
  bodyBytes
} = {}) {
  const normalizedHost = normalizeDiagnosticHost(host);
  if (method !== "POST" || path !== HOSTED_DIAGNOSTIC_PATH) {
    throw new Error("diagnostic_auth_target_invalid");
  }
  if (!normalizedHost || contentType !== HOSTED_DIAGNOSTIC_CONTENT_TYPE) {
    throw new Error("diagnostic_auth_transport_invalid");
  }
  if (!/^\d{13}$/.test(String(timestamp || ""))) {
    throw new Error("diagnostic_auth_timestamp_invalid");
  }
  if (!validateDiagnosticNonce(nonce)) {
    throw new Error("diagnostic_auth_nonce_invalid");
  }
  const bytes = Buffer.isBuffer(bodyBytes) ? bodyBytes : Buffer.from(bodyBytes || "");
  return Buffer.from([
    method,
    path,
    normalizedHost,
    contentType,
    String(timestamp),
    String(nonce),
    sha256Hex(bytes)
  ].join("\n"), "utf8");
}

export function signDiagnosticCanonicalBytes(canonicalBytes, secret) {
  if (!Buffer.isBuffer(canonicalBytes) || canonicalBytes.length < 1) {
    throw new Error("diagnostic_auth_canonical_invalid");
  }
  if (typeof secret !== "string" || secret.length < 8 || secret.length > 4096) {
    throw new Error("diagnostic_auth_secret_invalid");
  }
  return createHmac("sha256", secret).update(canonicalBytes).digest("hex");
}

export function verifyDiagnosticAuthentication({
  method,
  path,
  host,
  contentType,
  timestamp,
  nonce,
  signature,
  bodyBytes,
  secret,
  nowMs = Date.now()
} = {}) {
  const errors = [];
  const parsedTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(parsedTimestamp)) errors.push("timestamp");
  if (Number.isSafeInteger(parsedTimestamp)) {
    const skew = parsedTimestamp - nowMs;
    if (skew < -60_000) errors.push("timestamp_stale");
    if (skew > 15_000) errors.push("timestamp_future");
  }
  if (!validateDiagnosticNonce(nonce)) errors.push("nonce");
  if (!HEX64.test(String(signature || ""))) errors.push("signature");
  if (typeof secret !== "string" || secret.length < 8 || secret.length > 4096) {
    errors.push("secret");
  }
  let canonicalBytes = null;
  let expected = null;
  try {
    canonicalBytes = buildDiagnosticCanonicalBytes({
      method,
      path,
      host,
      contentType,
      timestamp,
      nonce,
      bodyBytes
    });
    expected = signDiagnosticCanonicalBytes(canonicalBytes, secret);
  } catch {
    errors.push("canonical");
  }
  let signatureMatch = false;
  if (expected && HEX64.test(String(signature || ""))) {
    const left = Buffer.from(expected, "hex");
    const right = Buffer.from(signature, "hex");
    signatureMatch = left.length === right.length && timingSafeEqual(left, right);
    if (!signatureMatch) errors.push("signature_mismatch");
  }
  return Object.freeze({
    valid: errors.length === 0 && signatureMatch,
    errors: Object.freeze([...new Set(errors)].sort()),
    signatureMatch,
    canonicalDigest: canonicalBytes ? sha256Hex(canonicalBytes) : null
  });
}
