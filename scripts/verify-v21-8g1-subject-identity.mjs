#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const dossierPath = "evidence/product-fact-catalog-expansion-v1/v21-8g1-wave1-subject-identity-plan-v2.json";
const migrationPath = "supabase/migrations/20261002153238_v21_8g1_identity_authority_preservation_v1.sql";
const selectionPath = "evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v2.json";
const readbackPath = "evidence/product-fact-catalog-expansion-v1/v21-8g1-wave1-subject-identity-production-readback-v1.json";
const closeoutPath = "docs/evidence/v21-8g1-wave1-subject-identity-closeout-v1.md";

const dossier = JSON.parse(fs.readFileSync(dossierPath,"utf8"));
const migration = fs.readFileSync(migrationPath,"utf8");
const selection = JSON.parse(fs.readFileSync(selectionPath,"utf8"));
const readback = JSON.parse(fs.readFileSync(readbackPath,"utf8"));
const closeout = fs.readFileSync(closeoutPath,"utf8");

assert.equal(dossier.stage,"V2.1-8G1");
assert.equal(dossier.registry_version,"product-fact-registry-cross-category-v1");
assert.ok(dossier.digest_contract.includes("admin_product_review_sha256_json"));
assert.equal(dossier.ready_count,8);
assert.equal(dossier.hold_count,4);
assert.equal(dossier.ready_task_count,16);
assert.equal(dossier.hold_task_count,10);
assert.equal(dossier.ready.length,8);
assert.equal(dossier.hold.length,4);

const selected = new Set(selection.selected_product_ids);
assert.equal(selected.size,12);
const planned = new Set([...dossier.ready,...dossier.hold].map(x=>x.product_id));
assert.equal(planned.size,12);
assert.deepEqual([...planned].sort(),[...selected].sort());

const readyIds = new Set(dossier.ready.map(x=>x.product_id));
for (const x of dossier.hold) assert.ok(!readyIds.has(x.product_id));

for (const x of dossier.ready) {
  assert.equal(x.market,"KR");
  assert.match(x.source_locator,/^https:\/\//);
  assert.match(x.capture_digest,/^[0-9a-f]{64}$/);
  assert.equal(x.formulation_revision_key,`v21-8g1:${x.capture_digest}`);
  assert.match(x.subject_semantic_key,/^[0-9a-f]{64}$/);
  assert.ok(x.formulation_label.length > 8);
  assert.equal(x.canonical_capture.product_id,x.product_id);
  assert.equal(x.canonical_capture.market,x.market);
  assert.equal(x.canonical_capture.source_locator,x.source_locator);
  assert.equal(x.canonical_capture.captured_on,"2026-10-02");
  assert.ok(x.canonical_capture.publisher.length > 3);
}
assert.equal(new Set(dossier.ready.map(x=>x.capture_digest)).size,8);
assert.equal(new Set(dossier.ready.map(x=>x.subject_semantic_key)).size,8);

const holdCodes = new Set(dossier.hold.map(x=>x.reason_code));
for (const code of [
  "PRESENTATION_SCOPE_UNRESOLVED",
  "FIRST_PARTY_SKU_AUTHORITY_MISSING",
  "CURRENT_FORMULATION_AUTHORITY_MISSING",
  "CATALOG_PRESENTATION_CONFLICT",
]) assert.ok(holdCodes.has(code));

assert.equal(dossier.expected_poststate.selected_subjects,8);
assert.equal(dossier.expected_poststate.selected_null_market_intakes,4);
assert.equal(dossier.expected_poststate.selected_v1_tasks,26);
assert.equal(dossier.expected_poststate.selected_v2_tasks,0);
assert.equal(dossier.expected_poststate.ready_tasks_research_pending,16);
assert.equal(dossier.expected_poststate.hold_tasks_review_required,10);
assert.equal(dossier.expected_poststate.current_product_facts,95);

assert.equal(dossier.invariants.evidence_research_started,false);
assert.equal(dossier.invariants.product_fact_current_writes,0);
assert.equal(dossier.invariants.evidence_writes,0);
assert.equal(dossier.invariants.recommendation_changes,0);
assert.equal(dossier.invariants.public_activation,false);
assert.equal(dossier.invariants.missing_implies_false,false);

assert.ok(migration.includes("process_catalog_trust_product_v3"));
assert.ok(migration.includes("process_catalog_trust_product_v2"));
assert.ok(migration.includes("identity_authority"));
assert.ok(migration.includes("official_source_locator"));
assert.ok(migration.includes("source_content_digest"));
assert.ok(migration.includes("to service_role"));
assert.ok(!/insert\s+into\s+public\.product_fact_current/i.test(migration));
assert.ok(!/insert\s+into\s+public\.product_fact_instances/i.test(migration));
assert.ok(!/insert\s+into\s+public\.product_evidence_records/i.test(migration));
assert.ok(!/insert\s+into\s+public\.product_fact_subjects/i.test(migration));

assert.equal(readback.version,"v21-8g1-wave1-subject-identity-production-readback-v1");
assert.equal(readback.production_readback.selected_products,12);
assert.equal(readback.production_readback.ready_products,8);
assert.equal(readback.production_readback.hold_products,4);
assert.equal(readback.production_readback.selected_subjects,8);
assert.equal(readback.production_readback.ready_current_resolved_kr_product_scoped_subjects,8);
assert.equal(readback.production_readback.hold_subjects,0);
assert.equal(readback.production_readback.selected_null_market_intakes,4);
assert.equal(readback.production_readback.selected_v1_tasks,26);
assert.equal(readback.production_readback.selected_v2_tasks,0);
assert.equal(readback.production_readback.frozen_task_ids_matched,26);
assert.equal(readback.production_readback.frozen_task_ids_v1,26);
assert.equal(readback.production_readback.ready_research_pending_tasks,16);
assert.equal(readback.production_readback.hold_pristine_review_required_tasks,10);
assert.equal(readback.production_readback.ready_exact_subject_intakes,8);
assert.equal(readback.production_readback.hold_intakes_untouched,4);
assert.equal(readback.production_readback.product_fact_current_total,95);
assert.equal(readback.production_readback.selected_evidence_records,0);
assert.equal(readback.production_readback.selected_fact_instances,0);
assert.equal(readback.production_readback.selected_current_facts,0);
assert.equal(readback.ready_subjects.length,8);
assert.equal(new Set(readback.ready_subjects.map(x=>x.subject_id)).size,8);
assert.equal(readback.rollback_probe.forced_rollback,true);
assert.equal(readback.rollback_probe.post_probe_prestate_restored,true);
assert.equal(readback.authority_boundary.evidence_research_started,false);
assert.equal(readback.authority_boundary.evidence_writes,0);
assert.equal(readback.authority_boundary.fact_instance_writes,0);
assert.equal(readback.authority_boundary.product_fact_current_delta,0);
assert.equal(readback.authority_boundary.recommendation_changes,0);
assert.equal(readback.authority_boundary.public_activation,false);
assert.equal(readback.authority_boundary.missing_implies_false,false);
assert.equal(readback.decision,"V21_8G1_SUBJECT_IDENTITY_PRODUCTION_PASS_READY8_HOLD4");
assert.equal(readback.next_gate,"V2.1-8G2_REQUIRED_FACT_RESEARCH_READY8_ONLY");
assert.ok(closeout.includes("26/26"));
assert.ok(closeout.includes("Evidence research                = NOT STARTED"));
assert.ok(closeout.includes("8G2 has not started"));

console.log(JSON.stringify({
  status:"PASS",
  stage:"V2.1-8G1",
  ready:8,
  hold:4,
  readyTasks:16,
  holdTasks:10,
  productFactCurrentWrites:0,
  evidenceWrites:0,
  decision:"V21_8G1_SUBJECT_IDENTITY_PLAN_STATIC_PASS"
},null,2));
