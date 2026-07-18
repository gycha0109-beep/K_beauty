import {
  closeSync,
  constants as fsConstants,
  existsSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

export const TRANSPORT_STATUSES = Object.freeze([
  "success",
  "rate_limited",
  "client_error",
  "server_error",
  "timeout",
  "network_error",
  "not_attempted"
]);

const RETRYABLE_5XX = new Set([502, 503, 504]);
const NON_RETRYABLE_CLIENT = new Set([400, 401, 403, 404, 413, 415, 422]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const IMAGE_SIGNATURES = Object.freeze({
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (bytes) => bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseSafeInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value === "boolean" || value === null || value === undefined || value === "") {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

export function sanitizeCaseId(value, { maxLength = 96 } = {}) {
  return String(value ?? "unknown")
    .replace(/[\u0000-\u001f\u007f]/g, "?")
    .replace(/[\\/]/g, "-")
    .slice(0, maxLength) || "unknown";
}

export function resolveFaceLabEvaluationEndpoint(value = "http://localhost:3001") {
  const parsed = new URL(String(value));
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "http:" || !LOCAL_HOSTS.has(hostname)) {
    throw new Error("--base-url must use HTTP on localhost, 127.0.0.1, or ::1");
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("--base-url must contain only the local origin");
  }
  return {
    baseUrl: parsed.origin,
    endpoint: new URL("/api/face-reading", parsed.origin).toString(),
    origin: parsed.origin
  };
}

function parseRetryAfterNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const text = String(raw).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const seconds = Number(text);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.ceil(seconds * 1000);
}

export function parseRetryAfterHeader(value, { nowMs = Date.now() } = {}) {
  const numeric = parseRetryAfterNumber(value);
  if (numeric !== null) return numeric;
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, timestamp - nowMs);
}

export function parseRetryAfterBodyHint(payload) {
  if (!isObject(payload)) return null;
  return parseRetryAfterNumber(payload.retryAfterSeconds);
}

export function selectRetryAfterMs({ headerValue, payload, nowMs = Date.now() } = {}) {
  const candidates = [
    parseRetryAfterHeader(headerValue, { nowMs }),
    parseRetryAfterBodyHint(payload)
  ].filter((value) => Number.isSafeInteger(value) && value >= 0);
  return candidates.length ? Math.max(...candidates) : null;
}

export function classifyHttpStatus(httpStatus) {
  if (!Number.isInteger(httpStatus)) return "network_error";
  if (httpStatus >= 200 && httpStatus < 300) return "success";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus >= 400 && httpStatus < 500) return "client_error";
  if (httpStatus >= 500 && httpStatus < 600) return "server_error";
  return "client_error";
}

export function decideRetry({
  status,
  httpStatus,
  retryCount,
  maxRetriesPerCase,
  retryAfterMs,
  maxRetryWaitMs,
  retry429WithoutHint = false,
  retryAmbiguousFailures = false
}) {
  if (!Number.isSafeInteger(retryCount) || !Number.isSafeInteger(maxRetriesPerCase)) {
    return { retry: false, reasonCode: "retry_policy_invalid", waitMs: null };
  }
  if (retryCount >= maxRetriesPerCase) {
    return { retry: false, reasonCode: "retry_limit_reached", waitMs: retryAfterMs ?? null };
  }
  if (status === "rate_limited") {
    if (retryAfterMs === null) {
      return retry429WithoutHint
        ? { retry: true, reasonCode: "rate_limit_retry_without_hint", waitMs: 0 }
        : { retry: false, reasonCode: "rate_limit_hint_missing", waitMs: null };
    }
    if (retryAfterMs > maxRetryWaitMs) {
      return { retry: false, reasonCode: "retry_wait_exceeds_limit", waitMs: retryAfterMs };
    }
    return { retry: true, reasonCode: "rate_limit_retry", waitMs: retryAfterMs };
  }
  if (status === "server_error") {
    if (RETRYABLE_5XX.has(httpStatus)) {
      return { retry: true, reasonCode: "retryable_server_error", waitMs: 0 };
    }
    return { retry: false, reasonCode: httpStatus === 500 ? "server_error_500_non_retryable" : "server_error_non_retryable", waitMs: null };
  }
  if (status === "timeout" || status === "network_error") {
    return retryAmbiguousFailures
      ? { retry: true, reasonCode: "ambiguous_failure_retry_enabled", waitMs: 0 }
      : { retry: false, reasonCode: "ambiguous_failure_retry_disabled", waitMs: null };
  }
  if (status === "client_error" && NON_RETRYABLE_CLIENT.has(httpStatus)) {
    return { retry: false, reasonCode: "client_error_non_retryable", waitMs: null };
  }
  return { retry: false, reasonCode: "transport_non_retryable", waitMs: null };
}

async function readBoundedResponseBody(response, maxResponseBytes) {
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength !== null && contentLength !== undefined && contentLength !== "") {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > maxResponseBytes) {
      throw Object.assign(new Error("response_too_large"), { code: "response_too_large" });
    }
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxResponseBytes) {
      throw Object.assign(new Error("response_too_large"), { code: "response_too_large" });
    }
    return buffer.toString("utf8");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maxResponseBytes) {
      try { await reader.cancel(); } catch {}
      throw Object.assign(new Error("response_too_large"), { code: "response_too_large" });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function safeParseJson(text) {
  if (!text) return { payload: null, parseFailed: false };
  try {
    return { payload: JSON.parse(text), parseFailed: false };
  } catch {
    return { payload: null, parseFailed: true };
  }
}

function classifyCaughtError(error, timeoutSignal) {
  if (timeoutSignal?.aborted || error?.name === "TimeoutError" || error?.name === "AbortError") {
    return { status: "timeout", reasonCode: "request_timeout" };
  }
  if (error?.code === "response_too_large") {
    return { status: "client_error", reasonCode: "response_size_exceeded" };
  }
  return { status: "network_error", reasonCode: "network_failure" };
}

export async function executeFaceLabEvaluationRequest({
  endpoint,
  expectedOrigin,
  formDataFactory,
  fetchImpl = fetch,
  timeoutMs = 120000,
  maxResponseBytes = 2 * 1024 * 1024,
  maxAttemptsRemaining = 1,
  maxRetriesPerCase = 1,
  maxRetryWaitMs = 120000,
  retry429WithoutHint = false,
  retryAmbiguousFailures = false,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now()
}) {
  let attemptCount = 0;
  let retryCount = 0;
  let lastRetryAfterMs = null;
  const startedAt = now();
  while (attemptCount < maxAttemptsRemaining) {
    attemptCount += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let payload = null;
    let parseFailed = false;
    let status;
    let httpStatus = null;
    let reasonCode = null;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        body: await formDataFactory(),
        signal: controller.signal,
        redirect: "error"
      });
      httpStatus = Number.isInteger(response.status) ? response.status : null;
      const responseUrl = response.url ? new URL(response.url) : new URL(endpoint);
      if (responseUrl.origin !== expectedOrigin) {
        status = "network_error";
        reasonCode = "response_origin_changed";
      } else {
        status = classifyHttpStatus(httpStatus);
        const text = await readBoundedResponseBody(response, maxResponseBytes);
        const parsed = safeParseJson(text);
        payload = parsed.payload;
        parseFailed = parsed.parseFailed;
        if (parseFailed && status === "success") {
          reasonCode = "response_json_invalid";
        }
      }
    } catch (error) {
      const classified = classifyCaughtError(error, controller.signal);
      status = classified.status;
      reasonCode = classified.reasonCode;
    } finally {
      clearTimeout(timeout);
    }

    const retryAfterMs = status === "rate_limited"
      ? selectRetryAfterMs({
          headerValue: response?.headers?.get?.("retry-after") ?? null,
          payload,
          nowMs: now()
        })
      : null;
    lastRetryAfterMs = retryAfterMs;
    const retryDecision = decideRetry({
      status,
      httpStatus,
      retryCount,
      maxRetriesPerCase,
      retryAfterMs,
      maxRetryWaitMs,
      retry429WithoutHint,
      retryAmbiguousFailures
    });
    const attemptsRemain = attemptCount < maxAttemptsRemaining;
    if (retryDecision.retry && attemptsRemain) {
      retryCount += 1;
      if (retryDecision.waitMs) await sleep(retryDecision.waitMs);
      continue;
    }
    if (retryDecision.retry && !attemptsRemain) {
      reasonCode = "max_attempts_reached";
    } else if (!reasonCode) {
      reasonCode = status === "success"
        ? (parseFailed ? "response_json_invalid" : null)
        : retryDecision.reasonCode;
    }
    return {
      payload,
      transport: {
        status,
        httpStatus,
        attemptCount,
        retryCount,
        retryExhausted: Boolean(
          retryDecision.retry && !attemptsRemain ||
          (["rate_limited", "server_error", "timeout", "network_error"].includes(status) &&
            maxRetriesPerCase > 0 && retryCount >= maxRetriesPerCase)
        ),
        retryAfterMs: lastRetryAfterMs,
        durationMs: Math.max(0, Math.round(now() - startedAt)),
        reasonCode
      }
    };
  }
  return {
    payload: null,
    transport: {
      status: "not_attempted",
      httpStatus: null,
      attemptCount: 0,
      retryCount: 0,
      retryExhausted: false,
      retryAfterMs: null,
      durationMs: null,
      reasonCode: "max_attempts_reached"
    }
  };
}

export function detectImageMime(bytes) {
  for (const [mimeType, matches] of Object.entries(IMAGE_SIGNATURES)) {
    if (matches(bytes)) return mimeType;
  }
  return null;
}

export function mimeFromExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return null;
}

export function readValidatedImageFile(filePath, {
  declaredMime = null,
  maxImageBytes = 15 * 1024 * 1024
} = {}) {
  const stat = statSync(filePath);
  if (!stat.isFile()) throw new Error("fixture image must be a regular file");
  if (stat.size > maxImageBytes) throw new Error("fixture image exceeds max-image-bytes");
  const bytes = readFileSync(filePath);
  const detectedMime = detectImageMime(bytes);
  const extensionMime = mimeFromExtension(filePath);
  if (!detectedMime || !extensionMime || detectedMime !== extensionMime) {
    throw new Error("fixture image extension and magic bytes do not match");
  }
  if (declaredMime && declaredMime !== detectedMime) {
    throw new Error("fixture image declared MIME does not match magic bytes");
  }
  return { bytes, mimeType: detectedMime, sizeBytes: bytes.length };
}

export function acquireRunLock(runDir, { recoverStaleLock = false } = {}) {
  const lockPath = path.join(runDir, ".lock");
  if (recoverStaleLock && existsSync(lockPath)) {
    unlinkSync(lockPath);
  }
  let fd;
  try {
    fd = openSync(lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
    writeFileSync(fd, `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`, "utf8");
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("run lock already exists; use --recover-stale-lock only after verifying no process is active");
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return {
    lockPath,
    release() {
      if (existsSync(lockPath)) unlinkSync(lockPath);
    }
  };
}
