const SIGNOUT_PATH = "/api/auth/signout";
const SIGNOUT_DEFAULT_REDIRECT_LOCATION = "/";
const SIGNOUT_ENGLISH_REDIRECT_LOCATION = "/en";
const SIGNOUT_ALLOWED_METHODS = "POST, OPTIONS";
const SIGNOUT_RETRY_AFTER_SECONDS = 60;
const MAX_ORIGIN_LENGTH = 2048;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const DNS_HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export const SIGNOUT_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
});

function hasOwnHeader(headers, name) {
  if (!headers) {
    return false;
  }

  if (typeof headers.has === "function") {
    return headers.has(name);
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

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

function isHostedProductionHostname(hostname) {
  return (
    DNS_HOSTNAME_PATTERN.test(hostname) &&
    !IPV4_PATTERN.test(hostname) &&
    hostname !== "localhost" &&
    !hostname.endsWith(".") &&
    !hostname.includes(":")
  );
}

export function parseCanonicalOrigin(value, { hostedProduction = false } = {}) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_ORIGIN_LENGTH ||
    value !== value.trim() ||
    value === "null" ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    /\s|,/.test(value)
  ) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.hostname.endsWith(".") ||
      url.origin !== value
    ) {
      return null;
    }

    if (
      hostedProduction &&
      (url.protocol !== "https:" || url.port || !isHostedProductionHostname(url.hostname))
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function parseRequestOrigin(requestUrl, { hostedProduction = false } = {}) {
  if (
    typeof requestUrl !== "string" ||
    requestUrl.length === 0 ||
    requestUrl.length > MAX_ORIGIN_LENGTH * 4 ||
    CONTROL_CHARACTER_PATTERN.test(requestUrl)
  ) {
    return null;
  }

  try {
    const url = new URL(requestUrl);

    if (url.username || url.password) {
      return null;
    }

    return parseCanonicalOrigin(url.origin, { hostedProduction });
  } catch {
    return null;
  }
}

export function getSignOutRedirectLocation(requestUrl) {
  if (typeof requestUrl !== "string" || requestUrl.length === 0) {
    return SIGNOUT_DEFAULT_REDIRECT_LOCATION;
  }

  try {
    const locale = new URL(requestUrl).searchParams.get("locale");
    return locale === "en"
      ? SIGNOUT_ENGLISH_REDIRECT_LOCATION
      : SIGNOUT_DEFAULT_REDIRECT_LOCATION;
  } catch {
    return SIGNOUT_DEFAULT_REDIRECT_LOCATION;
  }
}

export function evaluateSignOutRequest({
  requestUrl,
  requestHeaders,
  isHostedProduction = false,
  canonicalProductionOrigin = null
}) {
  const sourceOrigin = parseCanonicalOrigin(getHeader(requestHeaders, "origin"), {
    hostedProduction: isHostedProduction
  });
  const targetOrigin = parseRequestOrigin(requestUrl, {
    hostedProduction: isHostedProduction
  });

  if (!sourceOrigin || !targetOrigin) {
    return Object.freeze({ allowed: false, reason: "invalid_origin" });
  }

  if (isHostedProduction) {
    const canonicalOrigin = parseCanonicalOrigin(canonicalProductionOrigin, {
      hostedProduction: true
    });

    if (
      !canonicalOrigin ||
      canonicalOrigin !== targetOrigin ||
      canonicalOrigin !== sourceOrigin
    ) {
      return Object.freeze({ allowed: false, reason: "origin_mismatch" });
    }
  } else if (sourceOrigin !== targetOrigin) {
    return Object.freeze({ allowed: false, reason: "origin_mismatch" });
  }

  if (hasOwnHeader(requestHeaders, "sec-fetch-site")) {
    const fetchSite = getHeader(requestHeaders, "sec-fetch-site");

    if (fetchSite !== "same-origin") {
      return Object.freeze({ allowed: false, reason: "invalid_fetch_site" });
    }
  }

  return Object.freeze({ allowed: true, sourceOrigin, targetOrigin });
}

export function getSignOutRuntimeOriginContract({
  vercelEnvironment,
  configuredProductionOrigin,
  canonicalProductionOrigin
} = {}) {
  const isHostedProduction = vercelEnvironment === "production";

  if (!isHostedProduction) {
    return Object.freeze({
      isHostedProduction: false,
      canonicalProductionOrigin: null
    });
  }

  const configuredOrigin = parseCanonicalOrigin(configuredProductionOrigin, {
    hostedProduction: true
  });
  const canonicalOrigin = parseCanonicalOrigin(canonicalProductionOrigin, {
    hostedProduction: true
  });

  return Object.freeze({
    isHostedProduction: true,
    canonicalProductionOrigin:
      configuredOrigin && configuredOrigin === canonicalOrigin
        ? canonicalOrigin
        : null
  });
}

export function shouldBypassSupabaseSessionRefresh(pathname) {
  return pathname === "/auth/callback" || pathname === SIGNOUT_PATH;
}

function createHeaders(extraHeaders = {}) {
  return new Headers({
    ...SIGNOUT_NO_STORE_HEADERS,
    ...extraHeaders
  });
}

function createJsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: createHeaders({
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    })
  });
}

export function createMethodNotAllowedResponse({ head = false } = {}) {
  const headers = createHeaders({ Allow: SIGNOUT_ALLOWED_METHODS });

  if (head) {
    return new Response(null, { status: 405, headers });
  }

  return createJsonResponse(
    { error: "method_not_allowed" },
    405,
    { Allow: SIGNOUT_ALLOWED_METHODS }
  );
}

export function createOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: createHeaders({ Allow: SIGNOUT_ALLOWED_METHODS })
  });
}

export function createSignOutRouteHandlers({
  createSupabaseClient,
  getRuntimeOriginContract
}) {
  if (
    typeof createSupabaseClient !== "function" ||
    typeof getRuntimeOriginContract !== "function"
  ) {
    throw new TypeError("Signout route dependencies are required");
  }

  return Object.freeze({
    GET() {
      return createMethodNotAllowedResponse();
    },

    HEAD() {
      return createMethodNotAllowedResponse({ head: true });
    },

    OPTIONS() {
      return createOptionsResponse();
    },

    async POST(request) {
      let runtimeContract;

      try {
        runtimeContract = getRuntimeOriginContract();
      } catch {
        return createJsonResponse({ error: "invalid_request_origin" }, 403);
      }

      const decision = evaluateSignOutRequest({
        requestUrl: request?.url,
        requestHeaders: request?.headers,
        isHostedProduction: runtimeContract?.isHostedProduction === true,
        canonicalProductionOrigin:
          runtimeContract?.canonicalProductionOrigin || null
      });

      if (!decision.allowed) {
        return createJsonResponse({ error: "invalid_request_origin" }, 403);
      }

      try {
        const supabase = await createSupabaseClient();
        const result = await supabase.auth.signOut({ scope: "local" });

        if (result?.error) {
          return createJsonResponse(
            { error: "signout_unavailable" },
            503,
            { "Retry-After": String(SIGNOUT_RETRY_AFTER_SECONDS) }
          );
        }
      } catch {
        return createJsonResponse(
          { error: "signout_unavailable" },
          503,
          { "Retry-After": String(SIGNOUT_RETRY_AFTER_SECONDS) }
        );
      }

      return new Response(null, {
        status: 303,
        headers: createHeaders({ Location: getSignOutRedirectLocation(request?.url) })
      });
    }
  });
}

export function getSignOutPolicyContract() {
  return Object.freeze({
    path: SIGNOUT_PATH,
    redirectLocation: SIGNOUT_DEFAULT_REDIRECT_LOCATION,
    redirectLocations: Object.freeze([
      SIGNOUT_DEFAULT_REDIRECT_LOCATION,
      SIGNOUT_ENGLISH_REDIRECT_LOCATION
    ]),
    allowedMethods: SIGNOUT_ALLOWED_METHODS,
    retryAfterSeconds: SIGNOUT_RETRY_AFTER_SECONDS,
    noStoreHeaders: SIGNOUT_NO_STORE_HEADERS
  });
}
