import assert from "node:assert/strict";
import {
  createSellerListingCaptureEvidenceV1,
} from "../lib/server/seller-listing-capture-evidence-v1.js";
import {
  SELLER_LISTING_PARSER_FIXTURE_VERSION,
} from "../lib/server/seller-listing-parser-fixture-v1.js";
import {
  TORRIDEN_PUBLIC_CAPTURE_TARGET,
  TORRIDEN_PUBLIC_CAPTURE_VERSION,
} from "../lib/server/torriden-public-listing-capture-v1.js";
import {
  TORRIDEN_PUBLIC_LISTING_PARSER_VERSION,
  TorridenPublicListingParserError,
  parseTorridenCapturedListingFixtureV1,
} from "../lib/server/torriden-public-listing-parser-v1.js";

const OBSERVED_AT = "2026-09-11T08:45:00+09:00";

function html(overrides = {}) {
  const values = {
    globalGoodsNo: "136",
    controllerGoodsNo: "136",
    controllerPrice: "17500.00",
    hiddenPrice: "17500",
    currencyCode: "KRW",
    baseCurrency: "KRW",
    stockFl: "n",
    stockCnt: "∞",
    hiddenStock: "∞",
    naverPayEnabled: "Y",
    buyButton: true,
    cartButton: true,
    ...overrides,
  };

  return `<!doctype html><html><body>
<script>
var gdCurrencyCode = '${values.currencyCode}';
fx.base = "${values.baseCurrency}";
var goodsNo = '${values.globalGoodsNo}';
var parameters = {
  'setStockFl' : '${values.stockFl}',
  'setGoodsPrice' : '${values.controllerPrice}',
  'setGoodsNo' : '${values.controllerGoodsNo}',
  'setStockCnt' : '${values.stockCnt}'
};
</script>
<form id="frmView">
<input type="hidden" name="set_goods_price" value="${values.hiddenPrice}" />
<input type="hidden" name="set_goods_stock" value="${values.hiddenStock}" />
${values.buyButton ? '<button type="button" class="btn_add_order">바로 구매</button>' : ""}
${values.cartButton ? '<button id="cartBtn" type="button" class="btn_add_cart">장바구니 담기</button>' : ""}
</form>
<script>
naver.NaverPayButton.apply({ ENABLE: "${values.naverPayEnabled}" });
</script>
</body></html>`;
}

function fixture(payload, overrides = {}) {
  const evidence = createSellerListingCaptureEvidenceV1({
    seller: overrides.seller ?? "torriden_official",
    listing_url: overrides.listing_url ?? TORRIDEN_PUBLIC_CAPTURE_TARGET,
    source_version: overrides.source_version ?? TORRIDEN_PUBLIC_CAPTURE_VERSION,
    observed_at: OBSERVED_AT,
    content_type: overrides.content_type ?? "text/html; charset=utf-8",
    payload_bytes: Buffer.from(payload, "utf8"),
  });

  return {
    schema_version: SELLER_LISTING_PARSER_FIXTURE_VERSION,
    provenance_class: overrides.provenance_class ?? "captured_source",
    evidence,
  };
}

function expectCode(input, code) {
  assert.throws(
    () => parseTorridenCapturedListingFixtureV1(input),
    (error) => error instanceof TorridenPublicListingParserError && error.code === code,
  );
}

assert.equal(
  TORRIDEN_PUBLIC_LISTING_PARSER_VERSION,
  "torriden-public-product-html-parser-v1",
);

{
  const parsed = parseTorridenCapturedListingFixtureV1(fixture(html()));
  assert.deepEqual(parsed, {
    listing_id: "136",
    price: { amount: 17500, currency: "KRW" },
    availability: "in_stock",
  });
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.price), true);
  assert.deepEqual(Object.keys(parsed).sort(), ["availability", "listing_id", "price"]);
}

{
  const repeated = html().replace(
    "var goodsNo = '136';",
    "var goodsNo = '136';\nvar goodsNo = '136';",
  );
  const parsed = parseTorridenCapturedListingFixtureV1(fixture(repeated));
  assert.equal(parsed.listing_id, "136");
}

expectCode(
  fixture(
    html().replace(
      "var goodsNo = '136';",
      "var goodsNo = '136';\nvar goodsNo = '999';",
    ),
  ),
  "torriden_public_parser_goods_no_global_conflict",
);
expectCode(
  fixture(html({ controllerGoodsNo: "137" })),
  "torriden_public_parser_goods_no_conflict",
);
expectCode(
  fixture(html().replace("var goodsNo = '136';", "")),
  "torriden_public_parser_goods_no_global_missing",
);
expectCode(
  fixture(html({ globalGoodsNo: "137", controllerGoodsNo: "137" })),
  "torriden_public_parser_goods_no_target_mismatch",
);
expectCode(
  fixture(html({ hiddenPrice: "17600" })),
  "torriden_public_parser_price_conflict",
);
expectCode(
  fixture(html({ baseCurrency: "USD" })),
  "torriden_public_parser_currency_conflict",
);
expectCode(
  fixture(html({ currencyCode: "USD", baseCurrency: "USD" })),
  "torriden_public_parser_currency_not_krw",
);

for (const mutation of [
  { buyButton: false },
  { cartButton: false },
  { naverPayEnabled: "N" },
  { stockFl: "y" },
  { stockCnt: "0" },
  { hiddenStock: "0" },
]) {
  const parsed = parseTorridenCapturedListingFixtureV1(fixture(html(mutation)));
  assert.equal(parsed.availability, "unknown");
  assert.deepEqual(parsed.price, { amount: 17500, currency: "KRW" });
}

expectCode(
  fixture(html(), { seller: "other_seller" }),
  "torriden_public_parser_seller_mismatch",
);
expectCode(
  fixture(html(), { listing_url: "https://www.torriden.com/goods/goods_view.php?goodsNo=999" }),
  "torriden_public_parser_listing_url_mismatch",
);
expectCode(
  fixture(html(), { source_version: "other-version" }),
  "torriden_public_parser_source_version_mismatch",
);
expectCode(
  fixture(html(), { content_type: "application/json" }),
  "torriden_public_parser_content_type_mismatch",
);

assert.throws(
  () =>
    parseTorridenCapturedListingFixtureV1(
      fixture(html(), { provenance_class: "synthetic_test" }),
    ),
  (error) => error?.code === "seller_listing_parser_fixture_not_captured_source",
);

console.log("torriden_public_listing_parser_v1: PASS");
