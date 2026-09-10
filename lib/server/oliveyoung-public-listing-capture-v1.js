import {
  createSellerListingCaptureEvidenceV1,
} from "./seller-listing-capture-evidence-v1.js";
import {
  SELLER_LISTING_PARSER_FIXTURE_VERSION,
  admitSellerListingParserFixtureV1,
} from "./seller-listing-parser-fixture-v1.js";

export const OLIVEYOUNG_PUBLIC_CAPTURE_VERSION =
  "oliveyoung-public-product-html-v1";
export const OLIVEYOUNG_PUBLIC_CAPTURE_TARGET =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000149135";
export const OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO = "A000000149135";
export const OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_HOSTNAME = "www.oliveyoung.co.kr";
const ALLOWED_PATHNAME = "/store/goods/getGoodsDetail.do";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

export const OLIVEYOUNG_PUBLIC_CAPTURE_POLICY = Object.freeze({
  authentication: "none",
  cookies: "none",
  method: "GET",
  max_bytes: OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES,
  max_redirects: MAX_REDIRECTS,
});

export class OliveYoungPublicListingCaptureError extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name = "OliveYoungPublicListingCaptureError";
    this.code = code;
  }
}

function fail(code, cause) {
  throw new OliveYoungPublicListingCaptureError(code, cause ? { cause } : undefined);
}

export function classifyOliveYoungPublicCaptureFailureV1(error) {
  if (
    error instanceof OliveYoungPublicListingCaptureError &&
    error.code === "oliveyoung_public_capture_http_status:403"
  ) {
    return Object.freeze({
      outcome: "source_access_blocked",
      capture_admitted: false,
      error_code: error.code,
    });
  }
  return null;
}

function assertAllowedUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    fail("oliveyoung_public_capture_invalid_url", error);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== ALLOWED_HOSTNAME ||
    parsed.pathname !== ALLOWED_PATHNAME ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.searchParams.get("goodsNo") !== OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO
  ) {
    fail("oliveyoung_public_capture_url_outside_allowlist");
  }

  return parsed.toString();
}

function parseContentLength(response) {
  const raw = response.headers?.get?.("content-length");
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    fail("oliveyoung_public_capture_invalid_content_length");
  }
  return parsed;
}

function normalizeContentType(response) {
  const raw = response.headers?.get?.("content-type");
  if (typeof raw !== "string" || !raw.trim()) {
    fail("oliveyoung_public_capture_missing_content_type");
  }
  const value = raw.trim();
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
    fail("oliveyoung_public_capture_unexpected_content_type");
  }
  return value;
}

function buildRequestHeaders() {
  return Object.freeze({
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    "accept-language": "ko-KR,ko;q=0.9",
    "user-agent":
      "BEJEWELY-Source-Evidence/1.0 (+https://github.com/gycha0109-beep/K_beauty)",
  });
}

async function fetchBoundedSource({ fetchImpl, signal }) {
  let currentUrl = assertAllowedUrl(OLIVEYOUNG_PUBLIC_CAPTURE_TARGET);
  let redirects = 0;
  const headers = buildRequestHeaders();

  while (true) {
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers,
        signal,
      });
    } catch (error) {
      fail("oliveyoung_public_capture_transport_failed", error);
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      if (redirects >= MAX_REDIRECTS) {
        fail("oliveyoung_public_capture_too_many_redirects");
      }
      const location = response.headers?.get?.("location");
      if (typeof location !== "string" || !location.trim()) {
        fail("oliveyoung_public_capture_redirect_missing_location");
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch (error) {
        fail("oliveyoung_public_capture_invalid_redirect", error);
      }
      currentUrl = assertAllowedUrl(nextUrl);
      redirects += 1;
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      fail(`oliveyoung_public_capture_http_status:${response.status}`);
    }

    const contentType = normalizeContentType(response);
    const contentLength = parseContentLength(response);
    if (
      contentLength !== null &&
      contentLength > OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES
    ) {
      fail("oliveyoung_public_capture_content_length_exceeds_limit");
    }

    let bytes;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      fail("oliveyoung_public_capture_body_read_failed", error);
    }

    if (bytes.byteLength === 0) {
      fail("oliveyoung_public_capture_empty_body");
    }
    if (bytes.byteLength > OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES) {
      fail("oliveyoung_public_capture_body_exceeds_limit");
    }

    return Object.freeze({
      requested_url: OLIVEYOUNG_PUBLIC_CAPTURE_TARGET,
      final_url: currentUrl,
      status: response.status,
      content_type: contentType,
      byte_length: bytes.byteLength,
      redirect_count: redirects,
      payload_bytes: bytes,
      request_headers: headers,
    });
  }
}

export async function captureOliveYoungPublicListingV1(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date().toISOString());
  const signal = options.signal ?? AbortSignal.timeout(20_000);

  if (typeof fetchImpl !== "function") {
    fail("oliveyoung_public_capture_fetch_not_function");
  }
  if (typeof now !== "function") {
    fail("oliveyoung_public_capture_clock_not_function");
  }

  const transport = await fetchBoundedSource({ fetchImpl, signal });

  let observedAt;
  try {
    observedAt = now();
  } catch (error) {
    fail("oliveyoung_public_capture_clock_failed", error);
  }

  const evidence = createSellerListingCaptureEvidenceV1({
    seller: "oliveyoung",
    listing_url: OLIVEYOUNG_PUBLIC_CAPTURE_TARGET,
    source_version: OLIVEYOUNG_PUBLIC_CAPTURE_VERSION,
    observed_at: observedAt,
    content_type: transport.content_type,
    payload_bytes: transport.payload_bytes,
  });

  const fixture = admitSellerListingParserFixtureV1({
    schema_version: SELLER_LISTING_PARSER_FIXTURE_VERSION,
    provenance_class: "captured_source",
    evidence,
  });

  return Object.freeze({
    schema_version: "oliveyoung_public_listing_capture_report_v1",
    capture_policy: OLIVEYOUNG_PUBLIC_CAPTURE_POLICY,
    response: Object.freeze({
      requested_url: transport.requested_url,
      final_url: transport.final_url,
      status: transport.status,
      content_type: transport.content_type,
      byte_length: transport.byte_length,
      redirect_count: transport.redirect_count,
    }),
    fixture,
  });
}
