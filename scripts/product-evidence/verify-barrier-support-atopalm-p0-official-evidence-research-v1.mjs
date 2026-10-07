#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const evidencePath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-official-evidence-research-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-controlled-subject-registration-closeout-v1.json";
const registryPath =
  "evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])])
    );
  }
  return value;
};

const sha256 = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

const PRODUCT_ID = "418e2bc1-7d6c-4334-9058-7af7ce159c6c";
const SUBJECT_ID = "c7e19978-5678-466b-ba69-f5936aeca5cc";

assert.equal(evidence.stage, "V2.1-8H-R13C");
assert.equal(
  evidence.terminal,
  "BARRIER_SUPPORT_ATOPALM_P0_OFFICIAL_EVIDENCE_RESEARCH_DIRECT2"
);
assert.equal(evidence.parent_authority.r13b_stage, "V2.1-8H-R13B");
assert.equal(
  parent.primary_terminal_outcome,
  "BARRIER_SUPPORT_ATOPALM_P0_CONTROLLED_SUBJECT_REGISTRATION_PASS"
);
assert.equal(parent.target.product_id, PRODUCT_ID);
assert.equal(parent.target.subject_id, SUBJECT_ID);
assert.equal(evidence.parent_authority.target_product_id, PRODUCT_ID);
assert.equal(evidence.parent_authority.target_subject_id, SUBJECT_ID);

assert.equal(
  evidence.registry.version,
  "product-fact-registry-cross-category-v1"
);
assert.equal(
  evidence.registry.registry_checksum,
  "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575"
);

for (const [key, expected] of Object.entries({
  evidence_is_not_fact: true,
  insufficiency_does_not_imply_false: true,
  official_claim_is_not_measured_efficacy: true,
  primary_use_role_is_context_only: true,
  cross_market_evidence_transfer_forbidden: true,
  sibling_or_line_claim_transfer_forbidden: true,
  exact_bundle_unit_relation_required: true,
  image_only_detail_not_promoted_without_reviewable_fact_bearing_capture: true
})) {
  assert.equal(evidence.research_rules[key], expected, key);
}

assert.equal(evidence.source_captures.length, 1);
const source = evidence.source_captures[0];
assert.equal(source.source_id, "atopalm_bundle_kr");
assert.equal(source.product_id, PRODUCT_ID);
assert.equal(source.subject_id, SUBJECT_ID);
assert.equal(source.market, "KR");
assert.equal(source.authority_kind, "official_kr_product_bundle_page");
assert.match(source.source_locator, /product_no=3324/);
assert.equal(source.observed_presentation, "100ml ×2");
const sourceMaterial = { ...source };
delete sourceMaterial.canonical_capture_digest;
assert.equal(
  sha256(sourceMaterial),
  "4dca54c0900e568bea4e856b1ad7be75f1cf07907406246b91f6d536b06c7c5b"
);
assert.equal(source.canonical_capture_digest, sha256(sourceMaterial));

const factDefs = new Map(registry.facts.map((item) => [item.fact_key, item]));
const barrier = factDefs.get("barrier_support_claim");
const role = factDefs.get("primary_use_role");
assert.ok(barrier);
assert.ok(role);
assert.deepEqual(
  new Set(barrier.permitted_evidence_classes),
  new Set(["product_claim", "measurement"])
);
assert.deepEqual(
  role.allowed_values,
  ["full_face", "local_area", "spot_use", "multi_area", "body_possible"]
);
assert.deepEqual(
  new Set(role.permitted_evidence_classes),
  new Set(["role_declaration", "usage_instruction"])
);

assert.equal(evidence.task_results.length, 2);
const tasks = new Map(evidence.task_results.map((task) => [task.fact_key, task]));

const barrierTask = tasks.get("barrier_support_claim");
assert.ok(barrierTask);
assert.equal(barrierTask.task_id, "b1430a7d-79bb-43a5-bfea-a19599441811");
assert.equal(barrierTask.product_id, PRODUCT_ID);
assert.equal(barrierTask.subject_id, SUBJECT_ID);
assert.equal(barrierTask.definition_checksum, "108ad711469c9018bc06560fce20257f05d32d3a4ed57571a4df5f653abc850d");
assert.equal(barrierTask.outcome, "DIRECT_EVIDENCE_FOUND");
assert.equal(barrierTask.proposed_value, true);
assert.equal(barrierTask.evidence_class, "product_claim");
assert.equal(barrierTask.corroborating_evidence_class, "measurement");
assert.deepEqual(barrierTask.source_ids, ["atopalm_bundle_kr"]);
assert.equal(barrierTask.identity_match, true);
assert.equal(barrierTask.market_match, true);
assert.equal(barrierTask.formulation_match, true);

const roleTask = tasks.get("primary_use_role");
assert.ok(roleTask);
assert.equal(roleTask.task_id, "cbdad075-35a1-476e-b3ac-6279b676e73e");
assert.equal(roleTask.product_id, PRODUCT_ID);
assert.equal(roleTask.subject_id, SUBJECT_ID);
assert.equal(roleTask.definition_checksum, "7e12fb3509c5978f01ab1e7d53ec8a86311de4fa6ead83f0391237abe0044dca");
assert.equal(roleTask.outcome, "DIRECT_EVIDENCE_FOUND");
assert.equal(roleTask.proposed_value, "multi_area");
assert.equal(roleTask.evidence_class, "usage_instruction");
assert.deepEqual(roleTask.source_ids, ["atopalm_bundle_kr"]);
assert.equal(roleTask.identity_match, true);
assert.equal(roleTask.market_match, true);
assert.equal(roleTask.formulation_match, true);

assert.deepEqual(evidence.summary, {
  direct_evidence_found: 2,
  evidence_insufficient: 0,
  identity_or_scope_blocked: 0,
  evidence_db_writes: 0,
  fact_instance_writes: 0,
  confirmation_writes: 0,
  recommendation_writes: 0,
  product_fact_subject_total_expected: 51,
  product_fact_current_expected: 105,
  fact_instances_expected: 106,
  confirmations_expected: 106,
  evidence_records_expected: 108
});

assert.equal(evidence.production_prestate.target_tasks.length, 2);
for (const task of evidence.production_prestate.target_tasks) {
  assert.equal(task.state, "RESEARCH_PENDING");
  assert.equal(task.blocker_code, null);
  assert.equal(task.attempt_count, 0);
  assert.equal(task.evidence_id, null);
  assert.equal(task.evidence_candidate_id, null);
}
assert.equal(evidence.production_prestate.target_subject_count, 1);
assert.equal(evidence.production_prestate.target_current_facts, 0);
assert.equal(evidence.production_prestate.target_fact_instances, 0);
assert.equal(evidence.production_prestate.target_evidence_records, 0);

assert.deepEqual(evidence.authority_boundary, {
  evidence_ingest_authorized: false,
  product_fact_confirmation_authorized: false,
  recommendation_admission_authorized: false,
  recommendation_activation_authorized: false,
  public_activation: false,
  production_cutover_authorized: false
});

assert.equal(
  evidence.next_gate.stage,
  "V2.1-8H-R13D_ATOPALM_DIRECT_EVIDENCE_INGEST_PREFLIGHT"
);
assert.equal(evidence.next_gate.status, "NOT_EXECUTED");
assert.equal(evidence.next_gate.unresolved_task_count, 0);
assert.equal(evidence.next_gate.direct_evidence_task_count, 2);
assert.equal(evidence.next_gate.evidence_ingest_authorized, false);

console.log(JSON.stringify({
  status: "PASS",
  stage: evidence.stage,
  terminal: evidence.terminal,
  direct: evidence.summary.direct_evidence_found,
  insufficient: evidence.summary.evidence_insufficient,
  barrier: barrierTask.proposed_value,
  role: roleTask.proposed_value
}));
