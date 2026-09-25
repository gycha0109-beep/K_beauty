import { fetchCommerceListing } from "./safe-commerce-fetch.mjs";

const HTML_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
];

const SOFT_NOT_FOUND_MARKERS = [
  "상품을 찾을 수 없습니다",
  "존재하지 않는 상품",
  "판매 종료된 상품",
  "판매종료된 상품",
  "판매가 종료된 상품",
  "요청하신 상품",
];

function normalizeContentType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function baseResult({
  resultClass,
  healthState,
  requestedUrl,
  finalUrl = null,
  httpStatus = null,
  redirectCount = 0,
  contentType = null,
  reason,
  bodyBytes = 0,
}) {
  return Object.freeze({
    checkerVersion: "commerce-link-health-checker-v1",
    sellerKey: "oliveyoung",
    resultClass,
    healthState,
    requestedUrl,
    finalUrl,
    httpStatus,
    redirectCount,
    contentType,
    reason,
    bodyBytes,
  });
}

function classifyThrownError(error, requestedUrl) {
  const message = String(error?.message || error);

  if (message === "COMMERCE_LINK_TRANSIENT:timeout") {
    return baseResult({
      resultClass: "network_error",
      healthState: "unknown",
      requestedUrl,
      reason: "TIMEOUT",
    });
  }

  if (message === "COMMERCE_LINK_TRANSIENT:dns_failure") {
    return baseResult({
      resultClass: "network_error",
      healthState: "unknown",
      requestedUrl,
      reason: "DNS_FAILURE",
    });
  }

  if (message === "COMMERCE_LINK_TRANSIENT:fetch_error") {
    return baseResult({
      resultClass: "network_error",
      healthState: "unknown",
      requestedUrl,
      reason: "FETCH_ERROR",
    });
  }

  if (message === "COMMERCE_LINK_BLOCKED:response_too_large") {
    return baseResult({
      resultClass: "unsupported_response",
      healthState: "unknown",
      requestedUrl,
      reason: "RESPONSE_TOO_LARGE",
    });
  }

  if (message.startsWith("COMMERCE_LINK_BLOCKED:")) {
    return baseResult({
      resultClass: "unsafe_url",
      healthState: "suspect",
      requestedUrl,
      reason: message.slice("COMMERCE_LINK_BLOCKED:".length).toUpperCase(),
    });
  }

  if (message.startsWith("COMMERCE_LINK_IDENTITY_DRIFT:")) {
    return baseResult({
      resultClass: "identity_drift",
      healthState: "suspect",
      requestedUrl,
      reason: "LISTING_ID_CHANGED",
    });
  }

  throw error;
}

function classifyFetchedResponse(fetched, expectedListingId) {
  const requestedUrl = fetched.requestedUrl;
  const finalUrl = fetched.finalUrl;
  const redirectCount = fetched.redirectChain.length;
  const httpStatus = fetched.status;
  const contentType = normalizeContentType(fetched.contentType);

  if (fetched.terminalClass === "identity_drift") {
    return baseResult({
      resultClass: "identity_drift",
      healthState: "suspect",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: "REDIRECT_LISTING_ID_CHANGED",
    });
  }

  if (fetched.terminalClass === "unsafe_redirect") {
    return baseResult({
      resultClass: "unsafe_redirect",
      healthState: "suspect",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: "REDIRECT_TARGET_NOT_ALLOWED",
    });
  }

  if (httpStatus === 403) {
    return baseResult({
      resultClass: "forbidden",
      healthState: "unknown",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: "HTTP_403",
    });
  }

  if (httpStatus === 429) {
    return baseResult({
      resultClass: "rate_limited",
      healthState: "unknown",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: "HTTP_429",
    });
  }

  if (httpStatus === 404 || httpStatus === 410) {
    return baseResult({
      resultClass: "hard_not_found",
      healthState: "suspect",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: `HTTP_${httpStatus}`,
      bodyBytes: fetched.bytes.byteLength,
    });
  }

  if (httpStatus >= 500) {
    return baseResult({
      resultClass: "network_error",
      healthState: "unknown",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: `HTTP_${httpStatus}`,
    });
  }

  if (httpStatus !== 200) {
    return baseResult({
      resultClass: "unexpected_http",
      healthState: "unknown",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: `HTTP_${httpStatus}`,
      bodyBytes: fetched.bytes.byteLength,
    });
  }

  if (!HTML_CONTENT_TYPES.includes(contentType)) {
    return baseResult({
      resultClass: "unsupported_content",
      healthState: "unknown",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: "NON_HTML_CONTENT",
      bodyBytes: fetched.bytes.byteLength,
    });
  }

  const text = Buffer.from(fetched.bytes).toString("utf8");
  const listingPresent = text.includes(expectedListingId);
  const softNotFoundMarker = SOFT_NOT_FOUND_MARKERS.find((marker) => text.includes(marker));

  if (!listingPresent && softNotFoundMarker) {
    return baseResult({
      resultClass: "soft_not_found",
      healthState: "suspect",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: "SOFT_NOT_FOUND_MARKER",
      bodyBytes: fetched.bytes.byteLength,
    });
  }

  if (!listingPresent) {
    return baseResult({
      resultClass: "ambiguous_200",
      healthState: "unknown",
      requestedUrl,
      finalUrl,
      httpStatus,
      redirectCount,
      contentType,
      reason: "LISTING_ID_NOT_OBSERVED",
      bodyBytes: fetched.bytes.byteLength,
    });
  }

  return baseResult({
    resultClass: redirectCount > 0 ? "redirected_same_listing" : "healthy",
    healthState: "healthy",
    requestedUrl,
    finalUrl,
    httpStatus,
    redirectCount,
    contentType,
    reason: redirectCount > 0 ? "SAME_LISTING_REDIRECT" : "LISTING_ID_OBSERVED",
    bodyBytes: fetched.bytes.byteLength,
  });
}

export async function checkOliveYoungLink(
  { listingUrl, listingId },
  dependencies = {},
) {
  const requestedUrl = String(listingUrl || "");
  const expectedListingId = String(listingId || "").trim();

  if (!requestedUrl || !expectedListingId) {
    return baseResult({
      resultClass: "unsafe_url",
      healthState: "suspect",
      requestedUrl,
      reason: "LISTING_INPUT_REQUIRED",
    });
  }

  try {
    const fetched = await fetchCommerceListing(requestedUrl, {
      sellerKey: "oliveyoung",
      expectedListingId,
      ...dependencies,
    });
    return classifyFetchedResponse(fetched, expectedListingId);
  } catch (error) {
    return classifyThrownError(error, requestedUrl);
  }
}

export const OLIVEYOUNG_LINK_HEALTH_CONTRACT = Object.freeze({
  checkerVersion: "commerce-link-health-checker-v1",
  sellerKey: "oliveyoung",
  hardFailureClasses: Object.freeze([
    "hard_not_found",
    "soft_not_found",
    "identity_drift",
    "unsafe_redirect",
  ]),
  transientClasses: Object.freeze([
    "forbidden",
    "rate_limited",
    "network_error",
    "unexpected_http",
    "unsupported_content",
    "unsupported_response",
    "ambiguous_200",
  ]),
});
