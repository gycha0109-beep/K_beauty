import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const USER_AGENT = "BEJEWELY-Commerce-LinkHealth/1.0 (+controlled-offer-checker)";

const SELLER_POLICIES = Object.freeze({
  oliveyoung: Object.freeze({
    sellerKey: "oliveyoung",
    hostnames: new Set([
      "oliveyoung.co.kr",
      "www.oliveyoung.co.kr",
      "m.oliveyoung.co.kr",
    ]),
    productPath: /^\/store\/goods\/getGoodsDetail(?:\.do)?\/?$/i,
    listingParam: "goodsNo",
  }),
});

function normalizeHostname(value) {
  return String(value || "").trim().toLowerCase().replace(/\.$/, "");
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function mappedIpv4FromIpv6(address) {
  const normalized = String(address || "").toLowerCase();
  const marker = "::ffff:";
  if (!normalized.startsWith(marker)) return null;
  const tail = normalized.slice(marker.length);
  return isIP(tail) === 4 ? tail : null;
}

function isPrivateIpv6(address) {
  const normalized = String(address || "").toLowerCase();
  const mapped = mappedIpv4FromIpv6(normalized);
  if (mapped) return isPrivateIpv4(mapped);

  return (
    normalized === "::" ||
    normalized === "::1" ||
    /^fe[89ab]/.test(normalized) ||
    /^f[cd]/.test(normalized) ||
    /^ff/.test(normalized)
  );
}

function isPrivateAddress(address) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function defaultResolveHost(hostname) {
  return lookup(hostname, { all: true, verbatim: true });
}

function getSellerPolicy(sellerKey) {
  const normalized = String(sellerKey || "").trim().toLowerCase();
  return SELLER_POLICIES[normalized] || null;
}

function parseListingIdentity(url, policy) {
  const listingId = url.searchParams.get(policy.listingParam);
  return typeof listingId === "string" ? listingId.trim() : "";
}

export async function assertSafeCommerceUrl(
  rawUrl,
  { sellerKey, expectedListingId = null, resolveHost = defaultResolveHost } = {},
) {
  const policy = getSellerPolicy(sellerKey);
  if (!policy) {
    throw new Error("COMMERCE_LINK_BLOCKED:seller_not_registered");
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("COMMERCE_LINK_BLOCKED:invalid_url");
  }

  const hostname = normalizeHostname(url.hostname);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("COMMERCE_LINK_BLOCKED:https_only");
  }

  if (!hostname || !policy.hostnames.has(hostname)) {
    throw new Error("COMMERCE_LINK_BLOCKED:hostname_not_allowed");
  }

  if (!policy.productPath.test(url.pathname)) {
    throw new Error("COMMERCE_LINK_BLOCKED:path_not_allowed");
  }

  const listingId = parseListingIdentity(url, policy);
  if (!listingId) {
    throw new Error("COMMERCE_LINK_BLOCKED:listing_id_missing");
  }

  if (expectedListingId && listingId !== String(expectedListingId).trim()) {
    throw new Error("COMMERCE_LINK_IDENTITY_DRIFT:listing_id_changed");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("COMMERCE_LINK_BLOCKED:private_ip");
    }
  } else {
    let answers;
    try {
      answers = await resolveHost(hostname);
    } catch (error) {
      const wrapped = new Error("COMMERCE_LINK_TRANSIENT:dns_failure");
      wrapped.cause = error;
      throw wrapped;
    }

    if (
      !Array.isArray(answers) ||
      !answers.length ||
      answers.some(({ address }) => isPrivateAddress(address))
    ) {
      throw new Error("COMMERCE_LINK_BLOCKED:private_dns_resolution");
    }
  }

  return Object.freeze({
    url,
    sellerKey: policy.sellerKey,
    listingId,
  });
}

async function readBoundedBytes(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("COMMERCE_LINK_BLOCKED:response_too_large");
  }

  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("COMMERCE_LINK_BLOCKED:response_too_large");
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, size);
}

function classifyRedirectTargetError(error) {
  const message = String(error?.message || error);
  if (message === "COMMERCE_LINK_IDENTITY_DRIFT:listing_id_changed") {
    return "identity_drift";
  }
  if (message.startsWith("COMMERCE_LINK_BLOCKED:")) {
    return "unsafe_redirect";
  }
  throw error;
}

export async function fetchCommerceListing(
  rawUrl,
  {
    sellerKey,
    expectedListingId,
    fetchImpl = fetch,
    resolveHost = defaultResolveHost,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
  } = {},
) {
  const initial = await assertSafeCommerceUrl(rawUrl, {
    sellerKey,
    expectedListingId,
    resolveHost,
  });

  let currentUrl = initial.url;
  const redirectChain = [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;

    try {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1",
        },
      });
    } catch (error) {
      clearTimeout(timer);
      const wrapped = new Error(
        error?.name === "AbortError"
          ? "COMMERCE_LINK_TRANSIENT:timeout"
          : "COMMERCE_LINK_TRANSIENT:fetch_error",
      );
      wrapped.cause = error;
      throw wrapped;
    }

    clearTimeout(timer);

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === maxRedirects) {
        throw new Error("COMMERCE_LINK_BLOCKED:redirect_limit");
      }

      const nextUrl = new URL(location, currentUrl).toString();
      try {
        await assertSafeCommerceUrl(nextUrl, {
          sellerKey,
          expectedListingId,
          resolveHost,
        });
      } catch (error) {
        return Object.freeze({
          requestedUrl: initial.url.toString(),
          finalUrl: currentUrl.toString(),
          status: response.status,
          contentType: "",
          bytes: Buffer.alloc(0),
          redirectChain: Object.freeze([
            ...redirectChain,
            Object.freeze({ status: response.status, location: nextUrl }),
          ]),
          terminalClass: classifyRedirectTargetError(error),
        });
      }

      redirectChain.push(
        Object.freeze({ status: response.status, location: nextUrl }),
      );
      currentUrl = new URL(nextUrl);
      continue;
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const bytes =
      response.status === 403 || response.status === 429 || response.status >= 500
        ? Buffer.alloc(0)
        : await readBoundedBytes(response, maxResponseBytes);

    return Object.freeze({
      requestedUrl: initial.url.toString(),
      finalUrl: currentUrl.toString(),
      status: response.status,
      contentType,
      bytes,
      redirectChain: Object.freeze([...redirectChain]),
      terminalClass: null,
    });
  }

  throw new Error("COMMERCE_LINK_BLOCKED:redirect_limit");
}

export const COMMERCE_LINK_FETCH_LIMITS = Object.freeze({
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
  maxRedirects: DEFAULT_MAX_REDIRECTS,
});

export const COMMERCE_LINK_SELLERS = Object.freeze(
  Object.keys(SELLER_POLICIES),
);
