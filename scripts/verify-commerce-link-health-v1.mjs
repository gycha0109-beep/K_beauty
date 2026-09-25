import assert from "node:assert/strict";
import {
  assertSafeCommerceUrl,
  COMMERCE_LINK_FETCH_LIMITS,
  COMMERCE_LINK_SELLERS,
} from "../lib/commerce/safe-commerce-fetch.mjs";
import {
  checkOliveYoungLink,
  OLIVEYOUNG_LINK_HEALTH_CONTRACT,
} from "../lib/commerce/oliveyoung-link-health.mjs";

const LISTING_ID = "A000000189181";
const URL = `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${LISTING_ID}`;
const MOBILE_URL = `https://m.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${LISTING_ID}`;
const PUBLIC_DNS = async () => [{ address: "1.1.1.1", family: 4 }];

function response(body = "", { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

async function run(fetchImpl, overrides = {}) {
  return checkOliveYoungLink(
    { listingUrl: URL, listingId: LISTING_ID },
    { fetchImpl, resolveHost: PUBLIC_DNS, ...overrides },
  );
}

assert.deepEqual(COMMERCE_LINK_SELLERS, ["oliveyoung"]);
assert.equal(OLIVEYOUNG_LINK_HEALTH_CONTRACT.checkerVersion, "commerce-link-health-checker-v1");
assert.equal(COMMERCE_LINK_FETCH_LIMITS.maxRedirects, 3);

{
  const safe = await assertSafeCommerceUrl(URL, {
    sellerKey: "oliveyoung",
    expectedListingId: LISTING_ID,
    resolveHost: PUBLIC_DNS,
  });
  assert.equal(safe.listingId, LISTING_ID);
}

await assert.rejects(
  () =>
    assertSafeCommerceUrl(
      "https://evil.example/store/goods/getGoodsDetail.do?goodsNo=" + LISTING_ID,
      {
        sellerKey: "oliveyoung",
        expectedListingId: LISTING_ID,
        resolveHost: PUBLIC_DNS,
      },
    ),
  /hostname_not_allowed/,
);

await assert.rejects(
  () =>
    assertSafeCommerceUrl(URL, {
      sellerKey: "oliveyoung",
      expectedListingId: LISTING_ID,
      resolveHost: async () => [{ address: "127.0.0.1", family: 4 }],
    }),
  /private_dns_resolution/,
);

{
  const result = await run(async () =>
    response(`<html><body data-goods-no="${LISTING_ID}">상품</body></html>`, {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
  assert.equal(result.resultClass, "healthy");
  assert.equal(result.healthState, "healthy");
  assert.equal(result.httpStatus, 200);
}

{
  const result = await run(async () =>
    response("<html><body>요청하신 상품을 찾을 수 없습니다</body></html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
  assert.equal(result.resultClass, "soft_not_found");
  assert.equal(result.healthState, "suspect");
}

{
  let call = 0;
  const result = await run(async () => {
    call += 1;
    if (call === 1) {
      return response("", {
        status: 302,
        headers: { location: MOBILE_URL },
      });
    }
    return response(`<html>${LISTING_ID}</html>`, {
      headers: { "content-type": "text/html" },
    });
  });
  assert.equal(result.resultClass, "redirected_same_listing");
  assert.equal(result.healthState, "healthy");
  assert.equal(result.redirectCount, 1);
}

{
  const result = await run(async () =>
    response("", {
      status: 302,
      headers: {
        location:
          "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000999999",
      },
    }),
  );
  assert.equal(result.resultClass, "identity_drift");
  assert.equal(result.healthState, "suspect");
}

{
  const result = await run(async () =>
    response("", {
      status: 302,
      headers: { location: "https://example.com/product" },
    }),
  );
  assert.equal(result.resultClass, "unsafe_redirect");
  assert.equal(result.healthState, "suspect");
}

for (const status of [404, 410]) {
  const result = await run(async () =>
    response("missing", {
      status,
      headers: { "content-type": "text/html" },
    }),
  );
  assert.equal(result.resultClass, "hard_not_found");
  assert.equal(result.healthState, "suspect");
}

{
  const result = await run(async () => response("", { status: 403 }));
  assert.equal(result.resultClass, "forbidden");
  assert.equal(result.healthState, "unknown");
}

{
  const result = await run(async () => response("", { status: 429 }));
  assert.equal(result.resultClass, "rate_limited");
  assert.equal(result.healthState, "unknown");
}

{
  const result = await run(async () => response("", { status: 503 }));
  assert.equal(result.resultClass, "network_error");
  assert.equal(result.healthState, "unknown");
}

{
  const result = await run(async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  });
  assert.equal(result.resultClass, "network_error");
  assert.equal(result.reason, "TIMEOUT");
}

{
  const result = await checkOliveYoungLink(
    { listingUrl: URL, listingId: LISTING_ID },
    {
      fetchImpl: async () => response(`<html>${LISTING_ID}</html>`),
      resolveHost: async () => {
        throw new Error("dns unavailable");
      },
    },
  );
  assert.equal(result.resultClass, "network_error");
  assert.equal(result.reason, "DNS_FAILURE");
}

{
  const result = await run(async () =>
    response("", {
      status: 302,
      headers: {
        location:
          "https://127.0.0.1/store/goods/getGoodsDetail.do?goodsNo=" + LISTING_ID,
      },
    }),
  );
  assert.equal(result.resultClass, "unsafe_redirect");
}

{
  const result = await run(async () =>
    response("", {
      status: 302,
      headers: { location: URL },
    }),
  );
  assert.equal(result.resultClass, "unsafe_url");
  assert.equal(result.reason, "REDIRECT_LIMIT");
}

{
  const result = await run(async () =>
    response("", {
      headers: {
        "content-type": "text/html",
        "content-length": String(COMMERCE_LINK_FETCH_LIMITS.maxResponseBytes + 1),
      },
    }),
  );
  assert.equal(result.resultClass, "unsupported_response");
  assert.equal(result.healthState, "unknown");
}

{
  const result = await run(async () =>
    response("binary", {
      headers: { "content-type": "application/octet-stream" },
    }),
  );
  assert.equal(result.resultClass, "unsupported_content");
  assert.equal(result.healthState, "unknown");
}

{
  const result = await run(async () =>
    response("<html><body>generic shell</body></html>", {
      headers: { "content-type": "text/html" },
    }),
  );
  assert.equal(result.resultClass, "ambiguous_200");
  assert.equal(result.healthState, "unknown");
}

console.log("COMMERCE_LINK_HEALTH_V1_CONTRACT: PASS");
