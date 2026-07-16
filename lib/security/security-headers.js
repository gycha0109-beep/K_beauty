const CSP_HEADER_NAME = "Content-Security-Policy";
const NONCE_HEADER_NAME = "x-nonce";
const PRODUCT_IMAGE_ORIGIN = "https://img.hwahae.co.kr";
const NONCE_BYTE_LENGTH = 16;
const MAX_ORIGIN_LENGTH = 2048;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BLOCKED_PERMISSIONS = Object.freeze([
  "accelerometer",
  "bluetooth",
  "browsing-topics",
  "clipboard-read",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "magnetometer",
  "microphone",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "serial",
  "usb"
]);

const ALLOWED_PERMISSIONS = Object.freeze([
  Object.freeze(["camera", "self"]),
  Object.freeze(["clipboard-write", "self"])
]);

const PERMISSIONS_POLICY = Object.freeze([
  ...BLOCKED_PERMISSIONS.map((name) => `${name}=()`),
  ...ALLOWED_PERMISSIONS.map(([name, allowlist]) => `${name}=(${allowlist})`)
].sort()).join(", ");

const GLOBAL_SECURITY_HEADERS = Object.freeze([
  Object.freeze({ key: "Cross-Origin-Opener-Policy", value: "same-origin" }),
  Object.freeze({ key: "Origin-Agent-Cluster", value: "?1" }),
  Object.freeze({ key: "Permissions-Policy", value: PERMISSIONS_POLICY }),
  Object.freeze({ key: "Referrer-Policy", value: "same-origin" }),
  Object.freeze({ key: "X-Content-Type-Options", value: "nosniff" }),
  Object.freeze({ key: "X-DNS-Prefetch-Control", value: "off" }),
  Object.freeze({ key: "X-Frame-Options", value: "DENY" }),
  Object.freeze({ key: "X-Permitted-Cross-Domain-Policies", value: "none" })
]);

const DOCUMENT_EXCLUDED_PATH_PATTERN = /^(?:\/api(?:\/|$)|\/_next(?:\/|$))/;
const STATIC_FILE_PATH_PATTERN = /\.(?:avif|css|gif|ico|jpe?g|js|json|map|png|svg|txt|webmanifest|webp|woff2?)(?:$|\?)/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const DNS_HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1"]);

function getHeader(headers, name) {
  if (!headers) {
    return "";
  }

  if (typeof headers.get === "function") {
    return headers.get(name) || "";
  }

  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return entry ? String(entry[1] || "") : "";
}

function getRequestPathname(request) {
  if (typeof request?.nextUrl?.pathname === "string") {
    return request.nextUrl.pathname;
  }

  try {
    return new URL(request?.url || "http://invalid.local/").pathname;
  } catch {
    return "/";
  }
}

function encodeBase64(bytes) {
  let result = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1] : 0;
    const third = hasThird ? bytes[index + 2] : 0;
    const block = (first << 16) | (second << 8) | third;

    result += BASE64_ALPHABET[(block >> 18) & 63];
    result += BASE64_ALPHABET[(block >> 12) & 63];
    result += hasSecond ? BASE64_ALPHABET[(block >> 6) & 63] : "=";
    result += hasThird ? BASE64_ALPHABET[block & 63] : "=";
  }

  return result;
}

function createCspNonce(randomFill) {
  const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
  const fill = randomFill || globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);

  if (typeof fill !== "function") {
    throw new Error("secure_nonce_source_unavailable");
  }

  fill(bytes);
  return encodeBase64(bytes);
}

function isValidCspNonce(value) {
  return (
    typeof value === "string" &&
    value.length === 24 &&
    /^[A-Za-z0-9+/]{22}==$/.test(value)
  );
}

function isValidDnsHostname(hostname) {
  return (
    typeof hostname === "string" &&
    hostname.length <= 253 &&
    !hostname.endsWith(".") &&
    !IPV4_PATTERN.test(hostname) &&
    !hostname.includes(":") &&
    DNS_HOSTNAME_PATTERN.test(hostname)
  );
}

function parseSupabaseConnectOrigin(value, { isDevelopment = false } = {}) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_ORIGIN_LENGTH ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.origin === "null"
  ) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalDevelopmentOrigin =
    isDevelopment &&
    parsed.protocol === "http:" &&
    LOCAL_DEVELOPMENT_HOSTS.has(hostname) &&
    Boolean(parsed.port);

  if (isLocalDevelopmentOrigin) {
    return parsed.origin;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.port ||
    !isValidDnsHostname(hostname)
  ) {
    return null;
  }

  return parsed.origin;
}

function getDevelopmentWebSocketOrigin(requestUrl) {
  try {
    const parsed = new URL(requestUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (
      !LOCAL_DEVELOPMENT_HOSTS.has(hostname) ||
      !parsed.port ||
      (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    ) {
      return null;
    }

    return `${parsed.protocol === "https:" ? "wss:" : "ws:"}//${parsed.host}`;
  } catch {
    return null;
  }
}

function isDocumentRequest(request) {
  const method = String(request?.method || "GET").toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  const pathname = getRequestPathname(request);

  if (
    DOCUMENT_EXCLUDED_PATH_PATTERN.test(pathname) ||
    STATIC_FILE_PATH_PATTERN.test(pathname)
  ) {
    return false;
  }

  if (
    getHeader(request.headers, "rsc") === "1" ||
    getHeader(request.headers, "next-router-prefetch") ||
    getHeader(request.headers, "purpose").toLowerCase() === "prefetch" ||
    getHeader(request.headers, "sec-purpose").toLowerCase().includes("prefetch")
  ) {
    return false;
  }

  const destination = getHeader(request.headers, "sec-fetch-dest").toLowerCase();

  if (destination) {
    return destination === "document";
  }

  return getHeader(request.headers, "accept").toLowerCase().includes("text/html");
}

function normalizeDirectiveSources(values) {
  const sources = [];

  for (const value of values) {
    if (
      typeof value !== "string" ||
      !value ||
      CONTROL_CHARACTER_PATTERN.test(value)
    ) {
      throw new Error("invalid_csp_source");
    }

    if (!sources.includes(value)) {
      sources.push(value);
    }
  }

  return sources;
}

function buildContentSecurityPolicy({
  nonce,
  supabaseUrl,
  isDevelopment = false,
  requestUrl = ""
}) {
  if (!isValidCspNonce(nonce)) {
    throw new Error("invalid_csp_nonce");
  }

  const supabaseOrigin = parseSupabaseConnectOrigin(supabaseUrl, {
    isDevelopment
  });

  if (!supabaseOrigin) {
    throw new Error("invalid_supabase_connect_origin");
  }

  const connectSources = ["'self'", supabaseOrigin];
  const developmentWebSocketOrigin = isDevelopment
    ? getDevelopmentWebSocketOrigin(requestUrl)
    : null;

  if (developmentWebSocketOrigin) {
    connectSources.push(developmentWebSocketOrigin);
  }

  const directives = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
    [
      "script-src",
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        ...(isDevelopment ? ["'unsafe-eval'"] : [])
      ]
    ],
    ["script-src-attr", ["'none'"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", PRODUCT_IMAGE_ORIGIN]],
    ["font-src", ["'self'"]],
    ["connect-src", connectSources],
    ["frame-src", ["'none'"]],
    ["worker-src", ["'none'"]],
    ["media-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]]
  ];

  if (!isDevelopment) {
    directives.push(["upgrade-insecure-requests", []]);
  }

  const directiveNames = new Set();

  return directives
    .map(([name, rawSources]) => {
      if (directiveNames.has(name)) {
        throw new Error("duplicate_csp_directive");
      }

      directiveNames.add(name);
      const sources = normalizeDirectiveSources(rawSources);
      return sources.length ? `${name} ${sources.join(" ")}` : name;
    })
    .join("; ") + ";";
}

function createDocumentSecurityContext({
  requestHeaders,
  supabaseUrl,
  isDevelopment = false,
  requestUrl = "",
  randomFill
}) {
  const nonce = createCspNonce(randomFill);
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    supabaseUrl,
    isDevelopment,
    requestUrl
  });
  const forwardedHeaders = new Headers(requestHeaders);

  forwardedHeaders.set(NONCE_HEADER_NAME, nonce);
  forwardedHeaders.set(CSP_HEADER_NAME, contentSecurityPolicy);

  return Object.freeze({
    contentSecurityPolicy,
    nonce,
    requestHeaders: forwardedHeaders
  });
}

function mergeForwardedRequestHeaders(currentHeaders, forwardedHeaders) {
  const mergedHeaders = new Headers(forwardedHeaders);
  const currentCookieHeader = getHeader(currentHeaders, "cookie");

  if (currentCookieHeader) {
    mergedHeaders.set("cookie", currentCookieHeader);
  } else {
    mergedHeaders.delete("cookie");
  }

  return mergedHeaders;
}

function applyDocumentSecurityHeaders(response, contentSecurityPolicy) {
  if (!response?.headers || typeof response.headers.set !== "function") {
    throw new Error("invalid_security_header_response");
  }

  if (
    typeof contentSecurityPolicy !== "string" ||
    !contentSecurityPolicy ||
    CONTROL_CHARACTER_PATTERN.test(contentSecurityPolicy)
  ) {
    throw new Error("invalid_content_security_policy");
  }

  response.headers.set(CSP_HEADER_NAME, contentSecurityPolicy);
  response.headers.delete(NONCE_HEADER_NAME);
  return response;
}

module.exports = Object.freeze({
  CSP_HEADER_NAME,
  GLOBAL_SECURITY_HEADERS,
  NONCE_BYTE_LENGTH,
  NONCE_HEADER_NAME,
  PERMISSIONS_POLICY,
  PRODUCT_IMAGE_ORIGIN,
  applyDocumentSecurityHeaders,
  buildContentSecurityPolicy,
  createCspNonce,
  createDocumentSecurityContext,
  getDevelopmentWebSocketOrigin,
  isDocumentRequest,
  isValidCspNonce,
  mergeForwardedRequestHeaders,
  parseSupabaseConnectOrigin
});
