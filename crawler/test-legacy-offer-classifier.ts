#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyLegacyOffer,
  type OfferSourceRules,
} from "./lib/offers/legacy-offer-classifier.js";

const crawlerDirectory = path.dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(
  await readFile(path.join(crawlerDirectory, "config", "offer-source-rules.json"), "utf8"),
) as OfferSourceRules;

function classify(overrides: Partial<Parameters<typeof classifyLegacyOffer>[0]> = {}) {
  return classifyLegacyOffer(
    {
      productId: "00000000-0000-0000-0000-000000000001",
      brand: "테스트",
      name: "테스트 제품",
      buyLink: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001",
      priceMin: 18000,
      priceMax: 18000,
      sourceUrl: null,
      ...overrides,
    },
    rules,
  );
}

assert.equal(rules.version, "1.1");

const hwahae = classify({
  buyLink: "https://www.hwahae.co.kr/goods/62599",
  sourceUrl: "https://www.hwahae.co.kr/goods/62599",
});
assert.equal(hwahae.linkRole, "reference_page");
assert.equal(hwahae.linkState, "verified");
assert.equal(hwahae.sellerKey, null);
assert.equal(hwahae.listingId, null);
assert.equal(hwahae.canonicalListingUrl, null);
assert.equal(hwahae.priceState, "unknown");
assert.equal(hwahae.migrationDecision, "DO_NOT_MIGRATE");

const oliveYoung = classify();
assert.equal(oliveYoung.host, "oliveyoung.co.kr");
assert.equal(oliveYoung.linkRole, "seller_page");
assert.equal(oliveYoung.linkState, "verified");
assert.equal(oliveYoung.sellerKey, "oliveyoung");
assert.equal(oliveYoung.listingId, "A000000000001");
assert.equal(
  oliveYoung.canonicalListingUrl,
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001",
);
assert.equal(oliveYoung.priceState, "unknown");
assert.equal(oliveYoung.migrationDecision, "LINK_ONLY_READY");

const oliveYoungTrackingHeavy = classify({
  buyLink:
    "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001&dispCatNo=1000001&utm_source=google&gclid=test&t_page=search&trackingCd=Result_1",
});
assert.equal(oliveYoungTrackingHeavy.listingId, oliveYoung.listingId);
assert.equal(oliveYoungTrackingHeavy.canonicalListingUrl, oliveYoung.canonicalListingUrl);

const oliveYoungMissingIdentity = classify({
  buyLink: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do",
});
assert.equal(oliveYoungMissingIdentity.linkRole, "unknown");
assert.equal(oliveYoungMissingIdentity.migrationDecision, "REVIEW_REQUIRED");

const oliveYoungShortRoute = classify({
  buyLink: "https://www.oliveyoung.co.kr/store/G.do?goodsNo=A000000237493",
});
assert.equal(oliveYoungShortRoute.linkRole, "unknown");
assert.equal(oliveYoungShortRoute.linkState, "unknown");
assert.equal(oliveYoungShortRoute.sellerKey, "oliveyoung");
assert.equal(oliveYoungShortRoute.listingId, null);
assert.equal(oliveYoungShortRoute.migrationDecision, "REVIEW_REQUIRED");

const naverProduct = classify({
  buyLink: "https://brand.naver.com/rejuran/products/4493781055?NaPm=tracking",
});
assert.equal(naverProduct.linkRole, "seller_page");
assert.equal(naverProduct.sellerKey, "naver_brand_store");
assert.equal(naverProduct.listingId, "4493781055");
assert.equal(
  naverProduct.canonicalListingUrl,
  "https://brand.naver.com/rejuran/products/4493781055",
);
assert.equal(naverProduct.migrationDecision, "LINK_ONLY_READY");

const naverCategory = classify({
  buyLink: "https://brand.naver.com/mediheal/category/2b565f99d26d40ee9ca4f031cde5d2c3",
});
assert.equal(naverCategory.linkRole, "listing_page");
assert.equal(naverCategory.migrationDecision, "DO_NOT_MIGRATE");

const cafe24Path = classify({
  buyLink: "https://roundlab.co.kr/product/자작나무-수분-수딩젤-150ml/200/?srsltid=tracking",
});
assert.equal(cafe24Path.listingId, "200");
assert.equal(cafe24Path.canonicalListingUrl?.endsWith("/200/"), true);
assert.equal(cafe24Path.migrationDecision, "LINK_ONLY_READY");

const sourceUrlIsNotPriceProof = classify({
  sourceUrl: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001",
});
assert.equal(sourceUrlIsNotPriceProof.priceState, "unknown");
assert.ok(
  sourceUrlIsNotPriceProof.reasons.includes(
    "source_url_matches_buy_link_but_price_provenance_not_explicit",
  ),
);
assert.equal(sourceUrlIsNotPriceProof.migrationDecision, "LINK_ONLY_READY");

const explicitlySourcedPrice = classify({
  buyLink:
    "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001&t_page=search",
  explicitPriceSourceUrl:
    "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001",
});
assert.equal(explicitlySourcedPrice.priceState, "verified");
assert.equal(explicitlySourcedPrice.migrationDecision, "AUTO_READY");

const conflictedPrice = classify({ priceMin: 22000, priceMax: 18000 });
assert.equal(conflictedPrice.priceState, "conflict");
assert.equal(conflictedPrice.migrationDecision, "REVIEW_REQUIRED");

const unknownHost = classify({ buyLink: "https://unknown.example/product/123" });
assert.equal(unknownHost.linkRole, "unknown");
assert.equal(unknownHost.linkState, "unknown");
assert.equal(unknownHost.migrationDecision, "REVIEW_REQUIRED");

const malformed = classify({ buyLink: "not a url" });
assert.equal(malformed.linkRole, "unknown");
assert.equal(malformed.migrationDecision, "REVIEW_REQUIRED");

const rulesWithoutListingIdentity: OfferSourceRules = {
  version: "test",
  hosts: {
    "seller.example": {
      kind: "seller",
      seller_key: "seller",
      product_routes: [{ path_pattern: "^/product/\\d+$" }],
    },
  },
};
const missingStableIdentity = classifyLegacyOffer(
  {
    productId: "00000000-0000-0000-0000-000000000002",
    brand: "테스트",
    name: "테스트",
    buyLink: "https://seller.example/product/123",
    priceMin: 1000,
    priceMax: 1000,
  },
  rulesWithoutListingIdentity,
);
assert.equal(missingStableIdentity.linkRole, "seller_page");
assert.equal(missingStableIdentity.linkState, "unknown");
assert.equal(missingStableIdentity.listingId, null);
assert.equal(missingStableIdentity.migrationDecision, "REVIEW_REQUIRED");

const productionHosts = [
  "abib.com",
  "aromatica.co",
  "asceplushomecare.co.kr",
  "brand.naver.com",
  "dewytree.com",
  "isntree.com",
  "m.innisfree.com",
  "m.manyo.co.kr",
  "neopharmshop.co.kr",
  "ongredients.cafe24.com",
  "puresomme.com",
  "roundlab.co.kr",
  "ruuve.kr",
  "scinic.com",
  "skinwavey.co.kr",
  "snature.kr",
  "tonymoly.com",
  "11st.co.kr",
  "amoremall.com",
  "hwahae.co.kr",
  "larocheposay.co.kr",
  "oliveyoung.co.kr",
  "ssg.com",
  "torriden.com",
  "zeroid.co.kr",
  "ybk-cosmetics.com",
];
for (const host of productionHosts) {
  assert.ok(rules.hosts[host], `missing production host rule: ${host}`);
}

for (const [host, rule] of Object.entries(rules.hosts)) {
  if (rule.kind !== "seller") continue;
  for (const route of rule.product_routes ?? []) {
    assert.ok(route.listing_id_source, `missing stable listing identity rule: ${host}`);
  }
}

console.log("Legacy offer classifier verification PASS");
console.log(`- rules_version: ${rules.version}`);
console.log(`- production_hosts_covered: ${productionHosts.length}`);
console.log("- hwahae_reference_not_offer: PASS");
console.log("- stable_listing_identity_required: PASS");
console.log("- seller_origin_preserved: PASS");
console.log("- tracking_heavy_url_canonicalized: PASS");
console.log("- oliveyoung_short_route_review_required: PASS");
console.log("- source_url_not_price_proof: PASS");
console.log("- explicit_price_provenance_required_for_auto_ready: PASS");
console.log("- product_writes: 0");
console.log("- offer_writes: 0");
