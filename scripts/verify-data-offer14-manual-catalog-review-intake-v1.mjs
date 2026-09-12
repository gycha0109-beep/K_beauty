#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260913033707_data_offer14_manual_catalog_review_intake_v1.sql";
const evidencePath = "evidence/data-offer14/torriden-1986669-manual-catalog-review-intake-v1.json";
const sql = fs.readFileSync(migrationPath, "utf8");
const compact = sql.replace(/\s+/g, " ").replace(/\s*([=<>(),])\s*/g, "$1");
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const has = (needle, message = needle) => assert.ok(compact.includes(needle), message);

has("admin_enqueue_product_candidate_structural_review_v1(p_actor_user_id uuid,p_candidate_id uuid,p_request_id text,p_reason text,p_identity_evidence jsonb)");
has("language plpgsql security definer set search_path=public,pg_temp");
has("admin_require_product_review_actor(p_actor_user_id,'admin.products.review')");
has("record_admin_audit_event(");
has("manual-catalog-review-intake-v1");
has("manual-catalog-identity-review-v1");
has("manual-catalog-identity-evidence-v1");
for (const marker of [
  "manual_catalog_review_request_id_invalid",
  "manual_catalog_review_reason_invalid",
  "manual_catalog_review_request_conflict",
  "manual_catalog_review_terminal_review_protected",
  "manual_catalog_review_actionable_review_exists",
  "manual_catalog_review_candidate_state_not_intake_eligible",
  "manual_catalog_review_identity_evidence_null_forbidden",
  "manual_catalog_review_identity_evidence_semantic_authority_forbidden",
]) has(marker);
has("'queue_policy','manual_catalog_admission'");
has("'manual_queue_eligible',true");
has("'ranking_queue_authority',false");
has("'candidate_identity_resolution_write_allowed',false");
has("'product_source_binding_write_allowed',false");
has("'offer_materialization_allowed',false");
has("'product_fact_write_allowed',false");
has("'recommendation_semantic_write_allowed',false");
has("'action','replay'");
has("'idempotent',true");
has("octet_length(p_identity_evidence::text)>16384");
has("char_length(v_reason)not between 12 and 1000");
has("count(distinct nullif(btrim(x.value->>'provider'),'')");
has("v_candidate.review_status<>'new'");
has("v_candidate.identity_resolution_state<>'unresolved'");
has("v_candidate.duplicate_of_product_id is not null");
has("revoke all on function public.admin_enqueue_product_candidate_structural_review_v1(uuid,uuid,text,text,jsonb)from public,anon,authenticated");
has("grant execute on function public.admin_enqueue_product_candidate_structural_review_v1(uuid,uuid,text,text,jsonb)to service_role");

const ownershipGuards = compact.match(/and\s*(?:reviews\.)?rule_version=v_rule_version/g) ?? [];
assert.ok(ownershipGuards.length >= 2, "ranking refresh must own both update and defer mutations");

for (const forbidden of [
  /insert into public\.products\b/i,
  /update public\.products\b/i,
  /insert into public\.product_source_bindings\b/i,
  /update public\.product_source_bindings\b/i,
  /insert into public\.product_offers\b/i,
  /update public\.product_offers\b/i,
  /insert into public\.product_fact_/i,
  /update public\.product_fact_/i,
  /insert into public\.recommendation/i,
  /update public\.recommendation/i,
  /update public\.product_candidates\b/i,
  /insert into public\.product_candidates\b/i,
  /promote_product_candidate_structural_v1\(/i,
  /admin_confirm_product_candidate_structural_adoption_v1\(/i,
]) assert.doesNotMatch(compact, forbidden);

assert.equal(evidence.schema_version, "manual_catalog_review_intake_decision_v2");
assert.equal(evidence.snapshot_date, "2026-09-13");
assert.equal(evidence.candidate.candidate_id, "ccf23119-b067-4076-bb9e-01a83cf88fa0");
assert.equal(evidence.candidate.source_name, "hwahae");
assert.equal(evidence.candidate.external_id, "1986669");
assert.equal(evidence.candidate.category_path, "sunscreen");
assert.equal(evidence.candidate.review_status, "new");
assert.equal(evidence.candidate.identity_resolution_state, "unresolved");
assert.equal(evidence.candidate.identity_resolution_version, "crawler-identity-resolution-v1");
for (const key of ["canonical_name", "canonical_brand", "service_category", "product_form", "matched_product_id", "duplicate_of_product_id"]) assert.equal(evidence.candidate[key], null);

const identity = evidence.independent_identity_evidence;
assert.equal(identity.contract_version, "manual-catalog-identity-evidence-v1");
assert.equal(identity.providers.length, 2);
assert.deepEqual(identity.providers.map((x) => x.provider).sort(), ["hwahae", "torriden_official"]);
assert.ok(identity.convergence_dimensions.length >= 1);
for (const key of ["product_write_allowed", "candidate_identity_resolution_write_allowed", "product_source_binding_write_allowed", "offer_materialization_allowed", "recommendation_authority"]) assert.equal(identity.authority_boundary[key], false);

const prod = evidence.production_queue_readback;
assert.equal(prod.candidate_review_row_count, 0);
assert.equal(prod.equivalent_manual_ingress_function_count, 0);
assert.equal(prod.ranking_rule_version, "ranking-review-v2");
assert.equal(prod.popularity_observation_count, 6);
assert.equal(prod.popularity_best_rank, 2);
assert.equal(prod.popularity_latest_rank, 8);
assert.equal(prod.popularity_distinct_observed_dates, 3);
assert.equal(prod.candidate_concern_observation_count, 0);
assert.equal(prod.ranking_queue_eligible, false);

const ingress = evidence.manual_ingress_contract;
assert.equal(ingress.function, "admin_enqueue_product_candidate_structural_review_v1");
assert.deepEqual(ingress.inputs, ["actor_user_id", "candidate_id", "request_id", "reason", "identity_evidence"]);
assert.equal(ingress.rule_version, "manual-catalog-identity-review-v1");
assert.equal(ingress.queue_policy, "manual_catalog_admission");
assert.equal(ingress.new_candidate_status, "queued");
assert.equal(ingress.idempotent_exact_request_replay, true);
assert.equal(ingress.request_id_payload_conflict_fails_closed, true);
assert.deepEqual(ingress.existing_state_policy, { queued: "protected_no_mutation", reviewing: "protected_no_mutation", deferred: "new_request_may_requeue", approved: "terminal_protected", rejected: "terminal_protected" });
assert.equal(ingress.audit_required_on_write, true);
assert.equal(ingress.audit_repeated_on_exact_replay, false);
assert.equal(ingress.ranking_refresh_may_mutate_manual_rows, false);

const decision = evidence.decision;
assert.equal(decision.state, "governed_manual_catalog_admission_ingress_required");
assert.equal(decision.manual_queue_ingress_allowed, true);
for (const key of ["candidate_identity_resolution_write_allowed", "product_write_allowed", "product_source_binding_write_allowed", "offer_materialization_allowed", "product_fact_write_allowed", "recommendation_semantic_write_allowed", "production_write_performed_by_this_phase"]) assert.equal(decision[key], false);

console.log("DATA-OFFER14 governed manual catalog admission contract: PASS");
