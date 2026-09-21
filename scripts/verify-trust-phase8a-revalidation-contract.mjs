#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const docPath = "docs/evidence/trust-phase8a-product-fact-revalidation-contract-v1.md";
const evidencePath = "evidence/product-fact-revalidation-v1/trust-phase8a-lifecycle-audit-v1.json";
const architecturePath = "docs/architecture/product-fact-storage-admin-review-v1.md";

const doc = fs.readFileSync(docPath, "utf8");
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const architecture = fs.readFileSync(architecturePath, "utf8");

const requiredDoc = [
  "source_changed != fact_changed",
  "source_unavailable != fact_false",
  "new_evidence != automatic_fact_replacement",
  "stale != semantic_status",
  "re_review_required != evidence_conflict",
  "confirmed",
  "→ stale",
  "→ re_review_required",
  "new_fact.supersedes_fact_instance_id = old_fact.fact_instance_id",
  "automatic confirmation = false",
  "TRUST_PHASE8B_SOURCE_VERIFICATION_LEDGER"
];
for (const token of requiredDoc) assert.ok(doc.includes(token), `missing Phase 8A contract token: ${token}`);

for (const token of [
  "→ stale / re_review_required",
  "→ superseded",
  "source/formulation changes can invalidate currentness without deleting history",
  "A source changing or disappearing should produce a verification event/re-review trigger; it must not mutate historical EvidenceRecords in place.",
  "immutable versioned Fact instance + explicit current pointer/projection"
]) {
  assert.ok(architecture.includes(token), `architecture authority missing: ${token}`);
}

assert.equal(evidence.schema_version, "trust-phase8a-lifecycle-audit-v1");
assert.equal(evidence.phase, "TRUST_PHASE8A");
assert.equal(evidence.status, "PASS");
assert.equal(evidence.audit_kind, "read_only_production_snapshot");
assert.equal(evidence.production.product_fact_current, 71);
assert.equal(evidence.production.product_fact_instances, 71);
assert.equal(evidence.production.product_fact_confirmations, 71);
assert.equal(evidence.production.product_evidence_records, 71);
assert.equal(evidence.production.product_evidence_sources, 38);
assert.equal(evidence.production.product_fact_review_assignments, 71);
assert.equal(evidence.production.assignment_states.confirmed, 71);
assert.equal(evidence.production.current_without_evidence_links, 0);
assert.equal(evidence.production.current_without_assignment, 0);
assert.equal(evidence.production.current_without_confirmed_assignment, 0);
assert.equal(evidence.production.evidence_without_source, 0);
assert.equal(evidence.production.evidence_without_binding, 0);
assert.equal(evidence.production.current_superseding_fact_instances, 0);
assert.equal(evidence.production.linked_sources_without_observed_at, 26);
assert.equal(evidence.production.current_facts_with_unobserved_source, 59);
assert.equal(evidence.lifecycle_gap.source_verification_ledger_present, false);
assert.equal(evidence.lifecycle_gap.supersession_runtime_evidence_present, false);

for (const [key, value] of Object.entries(evidence.frozen_boundaries)) {
  assert.equal(value, false, `forbidden Phase 8A authority enabled: ${key}`);
}

assert.ok(!/admin_confirm_product_fact_v1\s*\(/i.test(doc), "Phase 8A contract must not invoke final confirmation");
assert.ok(!/(insert\s+into|update|delete\s+from)\s+public\.(product_fact|product_evidence|recommendation)/i.test(doc), "Phase 8A contract must not contain governed Production DML");

console.log(JSON.stringify({
  status: "PASS",
  phase: "TRUST_PHASE8A_REVALIDATION_CONTRACT",
  current_facts: evidence.production.product_fact_current,
  confirmed_assignments: evidence.production.assignment_states.confirmed,
  superseding_current_facts: evidence.production.current_superseding_fact_instances,
  sources_without_observed_at: evidence.production.linked_sources_without_observed_at,
  current_facts_with_unobserved_source: evidence.production.current_facts_with_unobserved_source,
  production_fact_mutation: 0,
  recommendation_mutation: 0,
  next: evidence.next
}, null, 2));
