#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const path = "evidence/data-offer12/torriden-136-product-binding-decision-v1.json";
const evidence = JSON.parse(fs.readFileSync(path, "utf8"));

assert.deepEqual(Object.keys(evidence).sort(), [
  "captured_identity_evidence",
  "decision",
  "next_authority_gate",
  "production_readback",
  "schema_version",
  "source_listing",
]);
assert.equal(evidence.schema_version, "torriden_product_binding_decision_v1");

assert.deepEqual(evidence.source_listing, {
  seller: "torriden_official",
  listing_id: "136",
  listing_url: "https://www.torriden.com/goods/goods_view.php?goodsNo=136",
});

const capture = evidence.captured_identity_evidence;
assert.equal(capture.provenance, "direct_review_of_data_offer11_merged_main_captured_source");
assert.equal(capture.merged_sha, "30500ec5ad4c0e1ccd939e1c78a918a0b7eb27fa");
assert.equal(capture.workflow_run_id, 34546730051);
assert.equal(capture.artifact_id, 10179284044);
assert.match(capture.payload_sha256, /^[0-9a-f]{64}$/);
assert.equal(capture.payload_sha256, "f56a3a4592c766f972da2cfcc1e529aca2eb68e657a22c82b244c2f8b727beb7");
assert.equal(capture.payload_bytes, 175733);
assert.equal(capture.reviewed_product_title, "다이브인 무기자차 마일드 선크림 60ml");
assert.ok(capture.reviewed_product_title_occurrences > 0);
assert.equal(capture.production_candidate_title_occurrences, 0);
assert.equal(capture.parser_title_authority, false);

const readback = evidence.production_readback;
assert.equal(readback.read_only, true);
assert.match(readback.snapshot_date, /^2026-09-11$/);
assert.equal(readback.seller_listing_observations_table_present, false);
assert.equal(readback.matching_source_binding_count, 0);
assert.equal(readback.torriden_sunscreen_candidates.length, 1);

const candidate = readback.torriden_sunscreen_candidates[0];
assert.deepEqual(candidate, {
  product_id: "57e4a5ec-115d-4322-85a1-7976db669700",
  brand: "토리든",
  name: "다이브인 워터리 모이스처 선크림",
  brand_en: "Torriden",
  name_en: "DIVE IN WATERY MOISTURE SUN CREAM",
  category: "sunscreen",
  external_source: null,
  external_type: null,
  external_id: null,
  source_binding_count: 0,
});
assert.notEqual(candidate.name, capture.reviewed_product_title);

const decision = evidence.decision;
assert.deepEqual(Object.keys(decision).sort(), [
  "binding_write_allowed",
  "blockers",
  "offer_materialization_allowed",
  "product_id",
  "recommendation_authority",
  "state",
]);
assert.equal(decision.state, "unresolved");
assert.equal(decision.product_id, null);
assert.equal(decision.binding_write_allowed, false);
assert.equal(decision.offer_materialization_allowed, false);
assert.equal(decision.recommendation_authority, false);
assert.deepEqual(decision.blockers, [
  "no_existing_source_binding",
  "captured_title_not_exact_catalog_candidate",
  "same_product_identity_unproven",
  "formulation_equivalence_unproven",
]);
assert.equal(
  evidence.next_authority_gate,
  "establish_exact_product_identity_or_admit_a_distinct_catalog_product_before_source_binding",
);

console.log("DATA-OFFER12 Torriden binding decision: PASS (unresolved, no write authority)");
