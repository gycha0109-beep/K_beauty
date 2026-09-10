import assert from "node:assert/strict";
import {
  OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO,
  OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES,
  OLIVEYOUNG_PUBLIC_CAPTURE_POLICY,
  OLIVEYOUNG_PUBLIC_CAPTURE_TARGET,
  OLIVEYOUNG_PUBLIC_CAPTURE_VERSION,
  OliveYoungPublicListingCaptureError,
  captureOliveYoungPublicListingV1,
  classifyOliveYoungPublicCaptureFailureV1,
} from "../lib/server/oliveyoung-public-listing-capture-v1.js";
import {
  decodeAdmittedSellerListingParserFixturePayloadV1,
} from "../lib/server/seller-listing-parser-fixture-v1.js";

const NOW = "2026-09-11T05:55:00+09:00";
const BODY = Buffer.from(
  `<html><head><title>Olive Young fixture</title></head><body>${OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO}</body></html>`,
  "utf8",
);

function headers(values = {}) {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );
  return {
    get(name) {
      return normalized[String(name).toLowerCase()] ?? null;
    },
  };
}

function response({
  status = 200,
  body = BODY,
  contentType = "text/html; charset=utf-8",
  contentLength = null,
  location = null,
} = {}) {
  const headerValues = {};
  if (contentType !== null) headerValues["content-type"] = contentType;
  if (contentLength !== null) headerValues["content-length"] = contentLength;
  if (location !== null) headerValues.location = location;
  return {
    status,
    headers: headers(headerValues),
    async arrayBuffer() {
      return Buffer.from(body);
    },
  };
}

async function expectCode(fn, code) {
  await assert.rejects(
    fn,
    (error) =>
      error instanceof OliveYoungPublicListingCaptureError && error.code === code,
  );
}

assert.equal(
  OLIVEYOUNG_PUBLIC_CAPTURE_TARGET,
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000149135",
);
assert.equal(OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO, "A000000149135");
assert.equal(OLIVEYOUNG_PUBLIC_CAPTURE_VERSION, "oliveyoung-public-product-html-v1");
assert.deepEqual(OLIVEYOUNG_PUBLIC_CAPTURE_POLICY, {
  authentication: "none",
  cookies: "none",
  method: "GET",
  max_bytes: OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES,
  max_redirects: 3,
});
assert.equal(Object.isFrozen(OLIVEYOUNG_PUBLIC_CAPTURE_POLICY), true);

{
  const calls = [];
  const report = await captureOliveYoungPublicListingV1({
    now: () => NOW,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ contentLength: BODY.byteLength });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, OLIVEYOUNG_PUBLIC_CAPTURE_TARGET);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal("authorization" in calls[0].options.headers, false);
  assert.equal("cookie" in calls[0].options.headers, false);
  assert.match(calls[0].options.headers["user-agent"], /^BEJEWELY-Source-Evidence\//);

  assert.equal(report.schema_version, "oliveyoung_public_listing_capture_report_v1");
  assert.deepEqual(report.capture_policy, OLIVEYOUNG_PUBLIC_CAPTURE_POLICY);
  assert.equal(report.response.status, 200);
  assert.equal(report.response.requested_url, OLIVEYOUNG_PUBLIC_CAPTURE_TARGET);
  assert.equal(report.response.final_url, OLIVEYOUNG_PUBLIC_CAPTURE_TARGET);
  assert.equal(report.response.byte_length, BODY.byteLength);
  assert.equal(report.response.redirect_count, 0);
  assert.equal(report.fixture.provenance_class, "captured_source");
  assert.equal(report.fixture.evidence.seller, "oliveyoung");
  assert.equal(report.fixture.evidence.listing_url, OLIVEYOUNG_PUBLIC_CAPTURE_TARGET);
  assert.equal(report.fixture.evidence.source_version, OLIVEYOUNG_PUBLIC_CAPTURE_VERSION);
  assert.equal(report.fixture.evidence.observed_at, NOW);
  assert.equal(report.fixture.evidence.content_type, "text/html; charset=utf-8");
  assert.deepEqual(decodeAdmittedSellerListingParserFixturePayloadV1(report.fixture), BODY);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.fixture), true);
}

{
  const calls = [];
  const redirected = `${OLIVEYOUNG_PUBLIC_CAPTURE_TARGET}&chlNo=6`;
  const report = await captureOliveYoungPublicListingV1({
    now: () => NOW,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) {
        return response({ status: 302, contentType: null, location: redirected });
      }
      return response();
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(report.response.final_url, redirected);
  assert.equal(report.response.redirect_count, 1);
  assert.equal(report.fixture.evidence.listing_url, OLIVEYOUNG_PUBLIC_CAPTURE_TARGET);
}

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () =>
        response({
          status: 302,
          contentType: null,
          location: "https://example.com/blocked",
        }),
    }),
  "oliveyoung_public_capture_url_outside_allowlist",
);

{
  const error = new OliveYoungPublicListingCaptureError(
    "oliveyoung_public_capture_http_status:403",
  );
  assert.deepEqual(classifyOliveYoungPublicCaptureFailureV1(error), {
    outcome: "source_access_blocked",
    capture_admitted: false,
    error_code: "oliveyoung_public_capture_http_status:403",
  });
  assert.equal(
    Object.isFrozen(classifyOliveYoungPublicCaptureFailureV1(error)),
    true,
  );
  assert.equal(
    classifyOliveYoungPublicCaptureFailureV1(
      new OliveYoungPublicListingCaptureError(
        "oliveyoung_public_capture_transport_failed",
      ),
    ),
    null,
  );
  assert.equal(classifyOliveYoungPublicCaptureFailureV1(new Error("403")), null);
}

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () => response({ status: 403 }),
    }),
  "oliveyoung_public_capture_http_status:403",
);

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () => response({ contentType: "application/json" }),
    }),
  "oliveyoung_public_capture_unexpected_content_type",
);

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () => response({ contentType: null }),
    }),
  "oliveyoung_public_capture_missing_content_type",
);

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () =>
        response({ contentLength: OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES + 1 }),
    }),
  "oliveyoung_public_capture_content_length_exceeds_limit",
);

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () =>
        response({ body: Buffer.alloc(OLIVEYOUNG_PUBLIC_CAPTURE_MAX_BYTES + 1) }),
    }),
  "oliveyoung_public_capture_body_exceeds_limit",
);

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () => response({ body: Buffer.alloc(0) }),
    }),
  "oliveyoung_public_capture_empty_body",
);

await expectCode(
  () =>
    captureOliveYoungPublicListingV1({
      now: () => NOW,
      fetchImpl: async () => {
        throw new Error("network down");
      },
    }),
  "oliveyoung_public_capture_transport_failed",
);

console.log("oliveyoung_public_listing_capture_v1: PASS");
