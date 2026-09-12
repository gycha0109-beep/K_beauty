#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidencePath = "evidence/data-offer15/torriden-136-catalog-source-offer-closure-v1.json";
const migrationPath = "supabase/migrations/20260913035725_seller_listing_observations_append_only_v1.sql";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const sql = fs.readFileSync(migrationPath, "utf8");
const compact = sql.replace(/\s+/g, " ");

assert.equal(evidence.schema_version, "data_offer15_catalog_source_offer_closure_v1");
assert.equal(evidence.snapshot_date, "2026-09-13");
assert.equal(evidence.source_main_sha, "96dd876465cb3bdbc477794c7235042865884a70");

const prod = evidence.production;
assert.equal(prod.project_id, "bygrczggxfuisupcevaz");
assert.equal(prod.seller_observation_migration.name, "seller_listing_observations_append_only_v1");
assert.equal(prod.seller_observation_migration.production_version, "20260913035725");
assert.equal(prod.seller_observation_migration.repository_path, migrationPath);
assert.equal(prod.seller_observation_migration.sql_semantics_changed_by_alignment, false);

assert.equal(prod.candidate.candidate_id, "ccf23119-b067-4076-bb9e-01a83cf88fa0");
assert.equal(prod.candidate.review_status, "promoted");
assert.equal(prod.candidate.identity_resolution_state, "resolved");
assert.equal(prod.candidate.canonical_name, "다이브인 무기자차 마일드 선크림");
assert.equal(prod.candidate.canonical_brand, "토리든");
assert.equal(prod.candidate.service_category, "sunscreen");
assert.equal(prod.candidate.product_form, null);
assert.equal(prod.candidate.matched_product_id, "08b85f37-b1fa-42d7-893a-0d4facb17878");
assert.equal(prod.candidate.duplicate_of_product_id, null);

assert.equal(prod.review.review_id, "8bbe543d-2aae-4e30-8227-997e6e835eb7");
assert.equal(prod.review.status, "approved");
assert.equal(prod.review.rule_version, "manual-catalog-identity-review-v1");
assert.equal(prod.review.approved_product_id, prod.product.product_id);

assert.equal(prod.product.product_id, "08b85f37-b1fa-42d7-893a-0d4facb17878");
assert.equal(prod.product.name, "다이브인 무기자차 마일드 선크림");
assert.equal(prod.product.brand, "토리든");
assert.equal(prod.product.category, "sunscreen");
assert.equal(prod.product.product_form, null);
assert.equal(prod.product.external_source, "hwahae");
assert.equal(prod.product.external_type, "products");
assert.equal(prod.product.external_id, "1986669");

assert.equal(prod.raw_seller_observation.seller, "torriden_official");
assert.equal(prod.raw_seller_observation.listing_id, "136");
assert.equal(prod.raw_seller_observation.price_amount, 17500);
assert.equal(prod.raw_seller_observation.price_currency, "KRW");
assert.equal(prod.raw_seller_observation.availability, "in_stock");
assert.equal(prod.raw_seller_observation.source_version, "torriden-public-product-html-v1");
assert.equal(prod.raw_seller_observation.capture_provenance.workflow_run_id, 34546730051);
assert.equal(prod.raw_seller_observation.capture_provenance.artifact_id, 10179284044);
assert.equal(
  prod.raw_seller_observation.capture_provenance.payload_sha256,
  "f56a3a4592c766f972da2cfcc1e529aca2eb68e657a22c82b244c2f8b727beb7"
);

assert.equal(prod.source_bindings.length, 2);
assert.deepEqual(
  prod.source_bindings.map((x) => [x.source_name, x.external_type, x.external_id]),
  [["hwahae", "products", "1986669"], ["torriden_official", "goods", "136"]]
);
for (const binding of prod.source_bindings) {
  assert.equal(binding.product_id, prod.product.product_id);
  assert.equal(binding.binding_state, "resolved");
  assert.equal(binding.binding_method, "manual_catalog_identity_convergence_v1");
  assert.equal(binding.product_scope_state, "product");
}

assert.equal(prod.offer.product_id, prod.product.product_id);
assert.equal(prod.offer.seller_key, "torriden_official");
assert.equal(prod.offer.listing_id, "136");
assert.equal(prod.offer.price_amount, 17500);
assert.equal(prod.offer.currency_code, "KRW");
assert.equal(prod.offer.availability_state, "in_stock");
assert.equal(prod.offer.offer_state, "current");
assert.equal(prod.offer.product_scope_state, "product");

assert.deepEqual(prod.counts, {
  products: 165,
  product_source_bindings: 113,
  product_offers: 6,
  seller_listing_observations: 1,
  product_fact_current_global: 54,
  recommendation_logs: 1296
});

assert.equal(prod.product_fact_scope.target_product_subject_count, 0);
assert.equal(prod.product_fact_scope.target_product_current_fact_count, 0);
assert.equal(prod.product_fact_scope.concurrent_trust_p21_product_id, "57e4a5ec-115d-4322-85a1-7976db669700");
assert.equal(prod.product_fact_scope.concurrent_trust_p21_current_fact_count, 2);
assert.equal(prod.product_fact_scope.cross_product_fact_transfer, false);
assert.equal(prod.product_fact_scope.product_fact_write_performed_by_data_offer15, false);

assert.equal(prod.offer_read_path.database_views_referencing_product_offers, 0);
assert.equal(prod.offer_read_path.database_functions_referencing_product_offers, 0);
assert.equal(prod.offer_read_path.materialization_state, "complete");
assert.equal(prod.offer_read_path.database_canonical_read_surface_state, "absent");
assert.equal(prod.offer_read_path.next_authority_frontier, "governed_offer_read_path_required");

assert.deepEqual(evidence.authorized_deltas, {
  products: 1,
  product_source_bindings: 2,
  product_offers: 1,
  seller_listing_observations: 1,
  target_product_fact_current: 0,
  recommendation_logs: 0
});

assert.equal(evidence.authority_boundary.catalog_admission_complete, true);
assert.equal(evidence.authority_boundary.product_creation_complete, true);
assert.equal(evidence.authority_boundary.source_binding_complete, true);
assert.equal(evidence.authority_boundary.official_offer_materialization_complete, true);
assert.equal(evidence.authority_boundary.raw_observation_provenance_persisted, true);
assert.equal(evidence.authority_boundary.product_fact_authority_granted, false);
assert.equal(evidence.authority_boundary.recommendation_semantic_authority_granted, false);
assert.equal(evidence.authority_boundary.offer_read_path_authority_complete, false);

assert.equal(evidence.decision.state, "catalog_admission_source_binding_offer_materialization_closed");
assert.equal(evidence.decision.offer_write_state, "closed");
assert.equal(evidence.decision.offer_read_path_state, "next_frontier");
assert.equal(evidence.decision.next_authority_gate, "governed_offer_read_path");

assert.match(compact, /create table if not exists public\.seller_listing_observations/);
assert.match(compact, /seller_listing_observations_append_only/);
assert.match(compact, /before update or delete on public\.seller_listing_observations/);
assert.match(compact, /grant select, insert on table public\.seller_listing_observations to service_role/);
assert.doesNotMatch(compact, /\bproduct_id\s+uuid\b/i);
assert.doesNotMatch(compact, /\boffer_id\s+uuid\b/i);
assert.doesNotMatch(compact, /grant\s+update\s+on table public\.seller_listing_observations/i);
assert.doesNotMatch(compact, /grant\s+delete\s+on table public\.seller_listing_observations/i);

console.log("DATA-OFFER15 catalog admission / source binding / offer materialization closure: PASS");
