import { isIP } from "node:net";
import { buildWindowKey, createGuardHmac, isGuardHash } from "./analysis-request-guard-core.js";

export const PUBLIC_RESULT_READ_ENDPOINT = "result-read";
export const PUBLIC_RESULT_READ_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
});

export const PUBLIC_RESULT_READ_POLICIES = Object.freeze({
  user: Object.freeze([
    Object.freeze({ name: "principal-burst", windowMs: 60 * 1000, limit: 30 }),
    Object.freeze({ name: "principal-sustained", windowMs: 24 * 60 * 60 * 1000, limit: 600 })
  ]),
  anonymous: Object.freeze([
    Object.freeze({ name: "principal-burst", windowMs: 60 * 1000, limit: 20 }),
    Object.freeze({ name: "principal-sustained", windowMs: 24 * 60 * 60 * 1000, limit: 200 })
  ]),
  ip: Object.freeze([
    Object.freeze({ name: "ip-burst", windowMs: 60 * 1000, limit: 60 }),
    Object.freeze({ name: "ip-sustained", windowMs: 24 * 60 * 60 * 1000, limit: 1000 })
  ]),
  repeat: Object.freeze({ name: "repeat-burst", windowMs: 60 * 1000, limit: 12 })
});

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

export function parsePublicResultShareId(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length > 22 || CONTROL_PATTERN.test(rawValue)) {
    return Object.freeze({ kind: "invalid", canonical: null });
  }

  const expectedBytes = rawValue.length === 8 ? 6 : rawValue.length === 22 ? 16 : 0;

  if (!expectedBytes || !BASE64URL_PATTERN.test(rawValue) || rawValue.includes("=")) {
    return Object.freeze({ kind: "invalid", canonical: null });
  }

  try {
    const decoded = Buffer.from(rawValue, "base64url");
    if (decoded.length !== expectedBytes || decoded.toString("base64url") !== rawValue) {
      return Object.freeze({ kind: "invalid", canonical: null });
    }

    return Object.freeze({
      kind: expectedBytes === 6 ? "legacy" : "current",
      canonical: rawValue
    });
  } catch {
    return Object.freeze({ kind: "invalid", canonical: null });
  }
}

export function parsePublicResultShareIdFromUrl(rawValue, requestUrl) {
  const parsed = parsePublicResultShareId(rawValue);
  if (parsed.kind === "invalid" || typeof requestUrl !== "string") {
    return parsed;
  }

  try {
    const pathname = new URL(requestUrl).pathname;
    const rawSegment = pathname.split("/").filter(Boolean).at(-1) || "";
    if (rawSegment !== rawValue || decodeURIComponent(rawSegment) !== rawValue) {
      return Object.freeze({ kind: "invalid", canonical: null });
    }
  } catch {
    return Object.freeze({ kind: "invalid", canonical: null });
  }

  return parsed;
}

function parseStrictIpv4(value) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return null;
  }

  const octets = value.split(".");
  if (octets.some((part) => (part.length > 1 && part.startsWith("0")) || Number(part) > 255)) {
    return null;
  }

  return octets.map((part) => String(Number(part))).join(".");
}

function expandIpv6(value) {
  let normalized = value.toLowerCase();
  const dottedIndex = normalized.lastIndexOf(":");
  if (normalized.includes(".")) {
    const ipv4 = parseStrictIpv4(normalized.slice(dottedIndex + 1));
    if (!ipv4) return null;
    const octets = ipv4.split(".").map(Number);
    normalized = `${normalized.slice(0, dottedIndex)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function compressIpv6(groups) {
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < groups.length && groups[end] === 0) end += 1;
    const length = end - index;
    if (length > bestLength && length >= 2) {
      bestStart = index;
      bestLength = length;
    }
    index = end;
  }

  const parts = groups.map((group) => group.toString(16));
  if (bestStart < 0) return parts.join(":");
  const left = parts.slice(0, bestStart).join(":");
  const right = parts.slice(bestStart + bestLength).join(":");
  return `${left}::${right}`;
}

export function normalizeClientAddress(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0 || rawValue.length > 128) return null;
  if (rawValue !== rawValue.trim() || CONTROL_PATTERN.test(rawValue) || rawValue.includes(",") || rawValue.includes("%")) return null;

  if (isIP(rawValue) === 4) return parseStrictIpv4(rawValue);
  if (isIP(rawValue) !== 6) return null;

  const groups = expandIpv6(rawValue);
  if (!groups) return null;
  const ipv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (ipv4Mapped) {
    return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  }
  return compressIpv6(groups);
}

export function resolveTrustedClientAddressCore({ headers, env = {}, syntheticClientAddress = null } = {}) {
  const hosted = env.VERCEL === "1" || env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
  if (hosted) {
    return normalizeClientAddress(headers?.get?.("x-vercel-forwarded-for"));
  }
  if (env.NODE_ENV === "production") return null;
  return normalizeClientAddress(syntheticClientAddress);
}

export function createResultReadSubjectHash(secret, namespace, value) {
  if (typeof secret !== "string" || !secret || typeof value !== "string" || !value) return null;
  const allowed = new Set(["user", "anonymous", "ip", "repeat"]);
  return allowed.has(namespace) ? createGuardHmac(secret, `result-read:${namespace}`, value) : null;
}

function createRateItem(scope, subjectHash, policy, nowMs) {
  const window = buildWindowKey(nowMs, policy.name, policy.windowMs);
  return Object.freeze({
    scope,
    subject_hash: subjectHash,
    endpoint: PUBLIC_RESULT_READ_ENDPOINT,
    window_key: window.windowKey,
    window_started_at: window.windowStartedAt,
    window_reset_at: window.windowResetAt,
    request_limit: policy.limit
  });
}

export function buildPublicResultReadRatePlan({ principalScope, principalHash, ipHash, shareId = null, secret, nowMs = Date.now() }) {
  if (!PUBLIC_RESULT_READ_POLICIES[principalScope] || !isGuardHash(principalHash) || !isGuardHash(ipHash)) return null;
  const items = [
    ...PUBLIC_RESULT_READ_POLICIES[principalScope].map((policy) => createRateItem(principalScope, principalHash, policy, nowMs)),
    ...PUBLIC_RESULT_READ_POLICIES.ip.map((policy) => createRateItem("ip", ipHash, policy, nowMs))
  ];

  if (shareId) {
    const parsed = parsePublicResultShareId(shareId);
    const repeatHash = parsed.kind === "invalid" ? null : createResultReadSubjectHash(secret, "repeat", `${principalHash}:${parsed.canonical}`);
    if (!repeatHash) return null;
    items.push(createRateItem(principalScope, repeatHash, PUBLIC_RESULT_READ_POLICIES.repeat, nowMs));
  }

  return Object.freeze(items);
}

export function interpretPublicResultReadQuota(data, error = null) {
  if (error) return Object.freeze({ ok: false, code: "unavailable", retryAfterSeconds: 60 });
  let value = data;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return Object.freeze({ ok: false, code: "unavailable", retryAfterSeconds: 60 }); }
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.allowed !== "boolean") {
    return Object.freeze({ ok: false, code: "unavailable", retryAfterSeconds: 60 });
  }
  if (value.allowed === false) {
    const retry = Number.isInteger(value.retry_after_seconds) && value.retry_after_seconds > 0 ? value.retry_after_seconds : 60;
    return Object.freeze({ ok: false, code: "rate_limited", retryAfterSeconds: retry });
  }
  return Object.freeze({ ok: true, code: "allowed", retryAfterSeconds: 0 });
}

export function createPublicResultReadDescriptor(code, result = null, retryAfterSeconds = null) {
  const descriptors = {
    not_found: { status: 404, body: { success: false, error: "Result not found." } },
    rate_limited: { status: 429, body: { success: false, error: "result_read_rate_limited" } },
    unavailable: { status: 503, body: { success: false, error: "result_read_guard_unavailable" } },
    server_error: { status: 500, body: { success: false, error: "Failed to load result." } },
    success: { status: 200, body: { success: true, result } }
  };
  const descriptor = descriptors[code] || descriptors.server_error;
  return Object.freeze({
    ...descriptor,
    headers: Object.freeze({
      ...PUBLIC_RESULT_READ_HEADERS,
      ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {})
    })
  });
}

export async function executePublicResultReadGuardCore({
  rawShareId,
  requestUrl,
  principalScope,
  principalHash,
  accountUserId = null,
  ipHash,
  secret,
  nowMs = Date.now(),
  consume
} = {}) {
  if (typeof consume !== "function") {
    return Object.freeze({ ok: false, code: "unavailable", retryAfterSeconds: 60 });
  }

  const parsedShareId = parsePublicResultShareIdFromUrl(rawShareId, requestUrl);
  const ratePlan = buildPublicResultReadRatePlan({
    principalScope,
    principalHash,
    ipHash,
    shareId: parsedShareId.canonical,
    secret,
    nowMs
  });
  if (!ratePlan) {
    return Object.freeze({ ok: false, code: "unavailable", retryAfterSeconds: 60 });
  }

  let response;
  try {
    response = await consume(ratePlan);
  } catch {
    return Object.freeze({ ok: false, code: "unavailable", retryAfterSeconds: 60 });
  }
  const quota = interpretPublicResultReadQuota(response?.data, response?.error);
  if (!quota.ok) return quota;
  if (parsedShareId.kind === "invalid") {
    return Object.freeze({ ok: false, code: "not_found", retryAfterSeconds: null, ratePlan });
  }

  return Object.freeze({
    ok: true,
    code: "allowed",
    shareId: parsedShareId.canonical,
    shareIdKind: parsedShareId.kind,
    viewerUserId: accountUserId,
    ratePlan
  });
}

export async function executePublicResultReadAccessCore({ guardResult, read } = {}) {
  if (!guardResult?.ok) {
    return createPublicResultReadDescriptor(guardResult?.code || "unavailable", null, guardResult?.retryAfterSeconds || null);
  }
  if (typeof read !== "function") return createPublicResultReadDescriptor("server_error");
  try {
    const outcome = await read({ shareId: guardResult.shareId, viewerUserId: guardResult.viewerUserId });
    if (!outcome?.ok) return createPublicResultReadDescriptor("server_error");
    return outcome.result
      ? createPublicResultReadDescriptor("success", outcome.result)
      : createPublicResultReadDescriptor("not_found");
  } catch {
    return createPublicResultReadDescriptor("server_error");
  }
}

export async function executeOwnerUnpublishCore({ parsedShareId, userId, update } = {}) {
  if (parsedShareId?.kind === "invalid" || typeof userId !== "string" || !userId) {
    return Object.freeze({ ok: true, state: "not_found" });
  }
  if (typeof update !== "function") return Object.freeze({ ok: false, state: "unavailable" });
  try {
    const outcome = await update({ shareId: parsedShareId.canonical, userId });
    return outcome?.ok === true && ["unpublished", "not_found"].includes(outcome.state)
      ? Object.freeze({ ok: true, state: outcome.state })
      : Object.freeze({ ok: false, state: "unavailable" });
  } catch {
    return Object.freeze({ ok: false, state: "unavailable" });
  }
}
