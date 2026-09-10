import assert from "node:assert/strict";
import { register } from "node:module";

register("./node-next-alias-loader.mjs", import.meta.url);

const {
  PRODUCT_OFFER_READ_PATH_VERSION,
  applyProductOfferReadPath,
  collectRecommendationProductIds,
  projectProductWithOfferAuthority,
  projectRecommendationDecisionWithOffers,
  selectCurrentProductOffer
} = await import("../lib/product-offer-read-path.js");
const { projectProductPurchaseLink } = await import("../lib/product-purchase-link.js");

const LEGACY_LINK_A =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000100001";
const LEGACY_LINK_B =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000100002";
const OFFER_LINK_A =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001";
const OFFER_LINK_B =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200002";

function product(overrides = {}) {
  return {
    id: "product-a",
    brand: "Test Brand",
    name: "Test Product",
    category: "toner_essence",
    buy_link: LEGACY_LINK_A,
    price_min: 27000,
    price_max: 27000,
    price_range: "$$",
    engine_score: 91.5,
    ...overrides
  };
}

function offer(overrides = {}) {
  return {
    offer_id: "offer-a",
    product_id: "product-a",
    seller_key: "oliveyoung",
    seller_name: "Olive Young",
    source_name: "legacy_product_buy_link_v1",
    listing_id: "A000000200001",
    listing_url: OFFER_LINK_A,
    price_amount: null,
    currency_code: "KRW",
    availability_state: "unknown",
    market_code: "KR",
    locale: "ko-KR",
    offer_state: "current",
    product_scope_state: "product_subject_unresolved",
    first_observed_at: null,
    last_observed_at: null,
    created_at: "2026-09-10T08:00:00.000Z",
    ...overrides
  };
}

function assertNaverFallback(projected) {
  const sanitized = projectProductPurchaseLink(projected);
  const url = new URL(sanitized.buy_link);

  assert.equal(url.origin, "https://search.shopping.naver.com");
  assert.equal(url.pathname, "/search/all");
  assert.equal(url.searchParams.get("query"), `${projected.brand} ${projected.name}`);
}

assert.equal(PRODUCT_OFFER_READ_PATH_VERSION, "product-offer-read-v2");

{
  const source = product();
  const currentLegacyOffer = offer({
    availability_state: "in_stock",
    price_amount: 18900,
    last_observed_at: "2026-09-10T09:00:00.000Z"
  });
  const projected = projectProductWithOfferAuthority(source, [currentLegacyOffer]);

  assert.equal(projected.buy_link, OFFER_LINK_A);
  assert.equal(projected.price_min, source.price_min);
  assert.equal(projected.price_max, source.price_max);
  assert.equal(projected.price_range, source.price_range);
}

{
  const source = product();
  const circularlyPromotedLegacyOffer = offer({
    availability_state: "in_stock",
    product_scope_state: "product",
    price_amount: 18900,
    last_observed_at: "2026-09-10T09:00:00.000Z"
  });
  const projected = projectProductWithOfferAuthority(source, [circularlyPromotedLegacyOffer]);

  assert.equal(projected.buy_link, "");
  assert.equal(projected.price_min, source.price_min);
  assert.equal(projected.price_max, source.price_max);
  assertNaverFallback(projected);
}

{
  const source = product();
  assert.deepEqual(projectProductWithOfferAuthority(source, []), source);
}

{
  const source = product();
  const projected = projectProductWithOfferAuthority(source, [offer({ offer_state: "retired" })]);

  assert.equal(projected.buy_link, "");
  assert.equal(projected.price_min, source.price_min);
  assert.equal(projected.price_max, source.price_max);
  assertNaverFallback(projected);
}

{
  const projected = projectProductWithOfferAuthority(product(), [
    offer({ availability_state: "out_of_stock" })
  ]);

  assert.equal(projected.buy_link, "");
  assertNaverFallback(projected);
}

{
  const projected = projectProductWithOfferAuthority(product(), [
    offer({ market_code: "US" })
  ]);

  assert.equal(projected.buy_link, "");
  assertNaverFallback(projected);
}

{
  const projected = projectProductWithOfferAuthority(product(), [
    offer({ listing_url: "https://evil.example/store/goods/getGoodsDetail.do?goodsNo=A000000200001" })
  ]);

  assert.equal(projected.buy_link, "");
  assertNaverFallback(projected);
}

{
  const productScopedNewer = offer({
    offer_id: "offer-product-scope-newer",
    listing_url: OFFER_LINK_A,
    availability_state: "in_stock",
    product_scope_state: "product",
    last_observed_at: "2026-09-10T10:00:00.000Z"
  });
  const unresolvedOlder = offer({
    offer_id: "offer-unresolved-older",
    listing_id: "A000000200002",
    listing_url: OFFER_LINK_B,
    availability_state: "unknown",
    product_scope_state: "product_subject_unresolved",
    last_observed_at: "2026-09-09T10:00:00.000Z"
  });

  const selectedA = selectCurrentProductOffer(product(), [productScopedNewer, unresolvedOlder]);
  const selectedB = selectCurrentProductOffer(product(), [unresolvedOlder, productScopedNewer]);

  assert.equal(selectedA.offer.offer_id, "offer-unresolved-older");
  assert.equal(selectedB.offer.offer_id, "offer-unresolved-older");
}

{
  const source = product();
  const projected = projectProductWithOfferAuthority(source, [
    offer({ product_id: "product-b", listing_url: OFFER_LINK_B })
  ]);

  assert.equal(projected.buy_link, source.buy_link);
  assert.equal(projected.price_min, source.price_min);
}

{
  const source = product();
  const projected = projectProductWithOfferAuthority(source, [
    offer({
      availability_state: "unknown",
      price_amount: 9900,
      last_observed_at: "2026-09-10T09:00:00.000Z"
    })
  ]);

  assert.equal(projected.buy_link, OFFER_LINK_A);
  assert.equal(projected.price_min, source.price_min);
  assert.equal(projected.price_max, source.price_max);
  assert.equal(projected.price_range, source.price_range);
}

{
  const source = product();
  const projected = projectProductWithOfferAuthority(source, [
    offer({
      source_name: "unregistered_offer_observation_v1",
      availability_state: "in_stock",
      price_amount: 9900,
      last_observed_at: "2026-09-10T09:00:00.000Z"
    })
  ]);

  assert.equal(projected.buy_link, "");
  assert.equal(projected.price_min, source.price_min);
  assertNaverFallback(projected);
}

{
  const productA = product();
  const productB = product({
    id: "product-b",
    name: "Second Product",
    buy_link: LEGACY_LINK_B,
    price_min: 39000,
    price_max: 39000,
    price_range: "$$",
    engine_score: 88.25
  });
  const decision = {
    topPick: productA,
    alternative: productB,
    products: [productA, productB],
    diagnostics: {
      candidateSource: {
        products: [product({ id: "diagnostic-only", name: "Diagnostic Product" })]
      }
    }
  };
  const offers = [
    offer({
      availability_state: "in_stock",
      price_amount: 18900,
      last_observed_at: "2026-09-10T09:00:00.000Z"
    }),
    offer({
      offer_id: "offer-b",
      product_id: "product-b",
      listing_id: "A000000200002",
      listing_url: OFFER_LINK_B,
      availability_state: "in_stock",
      price_amount: 44000,
      last_observed_at: "2026-09-10T09:00:00.000Z"
    })
  ];

  assert.deepEqual(collectRecommendationProductIds(decision), ["product-a", "product-b"]);

  const projected = projectRecommendationDecisionWithOffers(decision, offers);
  assert.deepEqual(projected.products.map((item) => item.id), decision.products.map((item) => item.id));
  assert.deepEqual(
    projected.products.map((item) => item.engine_score),
    decision.products.map((item) => item.engine_score)
  );
  assert.deepEqual(
    projected.products.map((item) => item.price_min),
    decision.products.map((item) => item.price_min)
  );
  assert.equal(projected.diagnostics, decision.diagnostics);
}

{
  const decision = {
    topPick: product(),
    products: [product()]
  };
  const projected = await applyProductOfferReadPath(decision, async () => {
    throw new Error("database unavailable");
  });

  assert.equal(projected, decision);
}

console.log("DATA-OFFER2 legacy offer provenance guard verifier: PASS");
