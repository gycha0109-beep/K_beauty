#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20261002142000_v21_8g0_registry_pinned_reconciliation_v1.sql";
const prestatePath = "evidence/product-fact-catalog-expansion-v1/v21-8g0-registry-pinned-reconciliation-prestate-v1.json";
const selectionPath = "evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v2.json";

const migration = fs.readFileSync(migrationPath, "utf8");
const prestate = JSON.parse(fs.readFileSync(prestatePath, "utf8"));
const selection = JSON.parse(fs.readFileSync(selectionPath, "utf8"));

assert.equal(prestate.version, "v21-8g0-registry-pinned-reconciliation-prestate-v1");
assert.equal(prestate.snapshot.catalog_products, 175);
assert.equal(prestate.snapshot.adopted_products, 32);
assert.equal(prestate.snapshot.current_product_facts, 95);
assert.equal(prestate.snapshot.selected_products, 12);
assert.equal(prestate.snapshot.selected_subjects, 0);
assert.equal(prestate.snapshot.selected_intakes_with_null_market, 12);
assert.equal(prestate.snapshot.selected_required_tasks, 26);
assert.equal(prestate.snapshot.selected_v2_required_tasks, 0);

assert.equal(prestate.task_contract.task_ids.length, 26);
assert.equal(new Set(prestate.task_contract.task_ids).size, 26);
assert.equal(prestate.task_contract.registry_version, "product-fact-registry-cross-category-v1");
assert.equal(prestate.task_contract.state, "REVIEW_REQUIRED");
assert.equal(prestate.task_contract.blocker_code, "SUBJECT_CREATION_REQUIRED");
assert.equal(prestate.task_contract.attempt_count, 0);
assert.equal(prestate.task_contract.subject_id, null);

assert.equal(prestate.registry_write_policy.v1_existing, "ALLOWED_8_OF_8");
assert.equal(prestate.registry_write_policy.v1_new, "ALLOWED_8_OF_8");
assert.equal(prestate.registry_write_policy.v2_existing, "POLICY_MISSING_8_OF_8");
assert.equal(prestate.registry_write_policy.v2_new, "POLICY_MISSING_8_OF_8");
assert.equal(prestate.registry_write_policy.definition_checksum_equal_v1_v2, "0_OF_8");

assert.equal(selection.selected_product_ids.length, 12);
assert.equal(selection.next_gate, "V2.1-8G_RESEARCH_EXACT_SELECTED_12_ONLY");

assert.ok(migration.includes("admin_resolve_catalog_trust_intake_identity_v1"));
assert.ok(migration.includes("process_catalog_trust_product_v2"));
assert.ok(migration.includes("p_registry_version text"));
assert.ok(migration.includes("registry_selection', 'explicit'"));
assert.ok(migration.includes("product_fact_controlled_registry_write_admissibility_v2"));
assert.ok(migration.includes("catalog_trust_registry_write_policy_blocked"));
assert.ok(migration.includes("catalog_trust_registry_write_policy_blocked_after_resolution"));
assert.ok(migration.includes("catalog_trust_intake_identity_prestate_conflict"));
assert.ok(migration.includes("official_source_locator"));
assert.ok(migration.includes("source_content_digest"));
assert.ok(migration.includes("to service_role"));

const v2Start = migration.indexOf("create or replace function public.process_catalog_trust_product_v2");
const v2End = migration.indexOf("revoke all on function public.process_catalog_trust_product_v2", v2Start);
assert.ok(v2Start >= 0 && v2End > v2Start);
const v2Body = migration.slice(v2Start, v2End);
assert.ok(!v2Body.includes("order by effective_at desc"));
assert.ok(!v2Body.includes("limit 1;\n\n  if v_registry_version is null"));
assert.ok(v2Body.includes("where r.registry_version = v_registry_version"));
assert.ok(v2Body.indexOf("-- Full product preflight") < v2Body.indexOf("perform public.resolve_catalog_trust_subject_v1"));

assert.ok(!migration.includes("create or replace function public.process_catalog_trust_product_v1"));
assert.ok(!/insert\s+into\s+public\.product_fact_current/i.test(migration));
assert.ok(!/update\s+public\.product_fact_current/i.test(migration));
assert.ok(!/delete\s+from\s+public\.product_fact_current/i.test(migration));
assert.ok(!/insert\s+into\s+public\.product_fact_instances/i.test(migration));
assert.ok(!/insert\s+into\s+public\.product_fact_evidence/i.test(migration));

for (const productId of selection.selected_product_ids) {
  assert.ok(!migration.includes(productId), "migration must remain generic, not batch-ID hardcoded");
}

assert.equal(prestate.write_boundary.product_fact_current_writes, 0);
assert.equal(prestate.write_boundary.subject_writes, 0);
assert.equal(prestate.write_boundary.evidence_writes, 0);
assert.equal(prestate.write_boundary.selected_task_mutations, 0);
assert.equal(prestate.write_boundary.recommendation_changes, 0);
assert.equal(prestate.write_boundary.public_activation, false);

console.log(JSON.stringify({
  status: "PASS",
  stage: "V2.1-8G0",
  selectedProducts: 12,
  preservedTaskIds: 26,
  pinnedRegistryLineage: "product-fact-registry-cross-category-v1",
  v2PolicyState: "POLICY_MISSING_FAIL_CLOSED",
  productFactCurrentWrites: 0,
  subjectWrites: 0,
  evidenceWrites: 0,
  decision: "V21_8G0_REGISTRY_PINNED_RECONCILIATION_STATIC_PASS",
}, null, 2));
