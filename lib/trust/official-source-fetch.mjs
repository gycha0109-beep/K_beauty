import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "BEJEWELY-Trust-Research/1.0 (+official-source-evidence-worker)";
const TRANSIENT_HTTP = new Set([408, 425, 429]);

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeHostname(hostname) {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224;
}

function isPrivateIpv6(ip) {
  const value = ip.toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fe8") || value.startsWith("fe9") ||
    value.startsWith("fea") || value.startsWith("feb") || value.startsWith("fc") || value.startsWith("fd") ||
    value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.");
}

function isPrivateAddress(address) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeOfficialUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SOURCE_BLOCKED:invalid_url");
  }
  const hostname = normalizeHostname(url.hostname);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("SOURCE_BLOCKED:https_only");
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("SOURCE_BLOCKED:private_hostname");
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("SOURCE_BLOCKED:private_ip");
    return url;
  }
  const answers = await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("SOURCE_BLOCKED:private_dns_resolution");
  }
  return url;
}

async function readBoundedBytes(response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("SOURCE_BLOCKED:response_too_large");
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("SOURCE_BLOCKED:response_too_large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

export async function fetchOfficialBytes(rawUrl, fetchImpl = fetch) {
  let url = await assertSafeOfficialUrl(rawUrl);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1" },
      });
    } catch (error) {
      clearTimeout(timer);
      const wrapped = new Error("TRANSIENT_FAILURE:fetch_error");
      wrapped.cause = error;
      throw wrapped;
    }
    clearTimeout(timer);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error("SOURCE_BLOCKED:redirect_limit");
      url = await assertSafeOfficialUrl(new URL(location, url).toString());
      continue;
    }
    if (TRANSIENT_HTTP.has(response.status) || response.status >= 500) {
      const error = new Error(`TRANSIENT_FAILURE:http_${response.status}`);
      error.retryAfterSeconds = response.status === 429 ? 900 : 300;
      throw error;
    }
    if (!response.ok) throw new Error(`SOURCE_BLOCKED:http_${response.status}`);

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("SOURCE_BLOCKED:unsupported_content_type");
    }
    const bytes = await readBoundedBytes(response);
    return { bytes, finalUrl: url.toString(), contentType };
  }
  throw new Error("SOURCE_BLOCKED:redirect_limit");
}
