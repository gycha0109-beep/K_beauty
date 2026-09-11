#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const path = "evidence/data-offer13/torriden-136-distinct-product-identity-candidate-v1.json";
const evidence = JSON.parse(fs.readFileSync(path, "utf8"));

assert.equal(evidence.schema_version, "torriden_distinct_product_identity_candidate_v1");
assert.equal(evidence.snapshot_date, "2026-09-11");

const seller = evidence.seller_listing;
assert.equal(seller.seller, "torriden_official");
assert.equal(seller.listing_id, "136");
assert.equal(seller.listing_url, "https://www.torriden.com/goods/goods_view.php?goodsNo=136");
assert.equal(seller.reviewed_title_ko, "다이브인 무기자차 마일드 선크림 60ml");
assert.equal(seller.size_ml, 60);
assert.equal(
  seller.data_offer11_payload_sha256,
  "f56a3a4592c766f972da2cfcc1e529aca2eb68e657a22c82b244c2f8b727beb7",
);

const identity = evidence.independent_identity_evidence;
assert.equal(identity.provider_count, 2);
assert.equal(identity.providers.length, 2);
assert.deepEqual(
  identity.providers.map((provider) => provider.provider).sort(),
  ["hwahae", "torriden_official"],
);
const torriden = identity.providers.find((provider) => provider.provider === "torriden_official");
const hwahae = identity.providers.find((provider) => provider.provider === "hwahae");
assert.ok(torriden);
assert.ok(hwahae);
assert.equal(torriden.title, seller.reviewed_title_ko);
assert.equal(torriden.size_ml, 60);
assert.equal(hwahae.title_ko, seller.reviewed_title_ko);
assert.equal(hwahae.title_en, "DIVE IN Mild Sun Cream [SPF50+/PA++++]");
assert.equal(hwahae.size_ml, seller.size_ml);
assert.equal(hwahae.external_id, "1986669");
assert.equal(
  hwahae.global_url,
  "https://www.hwahae.com/en/products/1986669",
);
assert.equal(
  hwahae.korean_url,
  "https://www.hwahae.co.kr/goods/56376",
);
assert.deepEqual(identity.convergence_dimensions, [
  "brand",
  "exact_korean_product_title",
  "mild_sun_cream_identity",
  "size_60ml",
]);
assert.equal(
  identity.identity_convergence_state,
  "established_for_manual_candidate_review",
);

const candidate = evidence.production_candidate_readback;
assert.equal(candidate.read_only, true);
assert.equal(candidate.candidate_id, "ccf23119-b067-4076-bb9e-01a83cf88fa0");
assert.equal(candidate.source_name, "hwahae");
assert.equal(candidate.external_type, "products");
assert.equal(candidate.external_id, hwahae.external_id);
assert.equal(candidate.source_url, hwahae.global_url);
assert.equal(candidate.product_name_raw, hwahae.title_en);
assert.equal(candidate.brand_name_raw, hwahae.brand_en);
assert.equal(candidate.review_status, "new");
assert.equal(candidate.matched_product_id, null);
assert.equal(candidate.identity_resolution_state, "unresolved");
assert.equal(candidate.identity_resolution_version, "crawler-identity-resolution-v1");
assert.ok(candidate.seen_count >= 1);

const boundary = evidence.existing_catalog_boundary;
assert.equal(boundary.torriden_sunscreen_product_count, 1);
assert.equal(boundary.existing_product_id, "57e4a5ec-115d-4322-85a1-7976db669700");
assert.equal(boundary.existing_product_name, "다이브인 워터리 모이스처 선크림");
assert.equal(boundary.exact_title_match, false);
assert.equal(boundary.safe_existing_product_match, false);
assert.equal(boundary.do_not_bind_to_existing_product, true);
assert.notEqual(boundary.existing_product_name, seller.reviewed_title_ko);

const decision = evidence.decision;
assert.equal(decision.identity_convergence_state, "established_for_manual_candidate_review");
assert.equal(decision.catalog_admission_state, "distinct_product_candidate_ready_for_manual_review");
assert.equal(decision.proposed_category, "sunscreen");
assert.equal(decision.proposed_brand_ko, "토리든");
assert.equal(decision.proposed_brand_en, "Torriden");
assert.equal(decision.proposed_name_ko, "다이브인 무기자차 마일드 선크림");
assert.equal(decision.proposed_name_en, "DIVE IN Mild Sun Cream");
assert.equal(decision.proposed_size_ml, 60);
assert.equal(decision.product_id, null);
assert.equal(decision.product_write_allowed, false);
assert.equal(decision.product_source_binding_write_allowed, false);
assert.equal(decision.offer_materialization_allowed, false);
assert.equal(decision.recommendation_authority, false);
assert.equal(decision.manual_review_required, true);
assert.equal(
  evidence.next_authority_gate,
  "governed_manual_catalog_admission_then_separate_product_source_binding_review",
);

console.log("DATA-OFFER13 Torriden identity convergence: PASS (manual candidate review only)");
