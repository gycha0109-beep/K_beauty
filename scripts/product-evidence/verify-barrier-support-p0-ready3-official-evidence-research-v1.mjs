#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const evidencePath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-official-evidence-research-v1.json";
const registryPath =
  "evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
};

const sha256 = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

assert.equal(evidence.stage, "V2.1-8H-R12");
assert.equal(
  evidence.terminal,
  "BARRIER_SUPPORT_P0_READY3_OFFICIAL_EVIDENCE_RESEARCH_DIRECT1_INSUFFICIENT5"
);
assert.equal(
  evidence.registry.version,
  "product-fact-registry-cross-category-v1"
);
assert.equal(
  evidence.registry.registry_checksum,
  "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575"
);

assert.deepEqual(evidence.summary, {
  direct_evidence_found: 1,
  evidence_insufficient: 5,
  identity_or_scope_blocked: 0,
  evidence_db_writes: 0,
  fact_instance_writes: 0,
  confirmation_writes: 0,
  recommendation_writes: 0,
  product_fact_subject_total_expected: 50,
  product_fact_current_expected: 101,
  fact_instances_expected: 102,
  confirmations_expected: 102
});

for (const [key, expected] of Object.entries({
  evidence_is_not_fact: true,
  insufficiency_does_not_imply_false: true,
  official_claim_is_not_measured_efficacy: true,
  primary_use_role_is_context_only: true,
  cross_market_evidence_transfer_forbidden: true,
  sibling_or_line_claim_transfer_forbidden: true,
  image_only_detail_not_promoted_without_reviewable_fact_bearing_capture: true
})) {
  assert.equal(evidence.research_rules[key], expected, key);
}

const factDefs = new Map(
  registry.facts.map((item) => [item.fact_key, item])
);

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

const expectedSources = new Map([
  ["theharnay_product_kr", "569f401596f2cc3f13c7612ae4c4f5c7a782e3bf1eb530eeb54dba2548338ab8"],
  ["theharnay_line_kr", "ef9cb167a7deaab3540a1d56f511a8f6aeb06ce7c19c7eb40a75a3602cdf7ded"],
  ["etude_product_kr", "6c050961d9d65178b5446d42a12483491f0a6b1e02c886c8319ee70bcc52c6a6"],
  ["etude_bundle_kr", "af02b9ed1e1a7b3e6ebce07e8dbf972ad70b7244628372a980e480b1888955a8"],
  ["manyo_product_kr", "70d49afd94fd8046bc4e1a60b4988de688093687a2b61a27abb50d97d8162d14"],
  ["manyo_cross_market_discovery", "c5e3901a9d1a17f875087b8c858c15c34b71c973844f609fa4c0094b032f9aca"]
]);

assert.equal(evidence.source_captures.length, 6);

for (const source of evidence.source_captures) {
  const expectedDigest = expectedSources.get(source.source_id);
  assert.ok(expectedDigest, `unexpected source: ${source.source_id}`);
  assert.equal(source.canonical_capture_digest, expectedDigest);
  const material = { ...source };
  delete material.canonical_capture_digest;
  assert.equal(
    sha256(material),
    expectedDigest,
    `source capture digest mismatch: ${source.source_id}`
  );
  assert.match(source.source_locator, /^https:\/\//);
}

const expectedTasks = new Map([
  ["02b9ba0a-207c-4d23-b522-853bd45ff815", ["barrier_support_claim", "EVIDENCE_INSUFFICIENT", null, null]],
  ["e08b1e23-771d-4c0b-8263-8ca02fa687f6", ["primary_use_role", "EVIDENCE_INSUFFICIENT", null, null]],
  ["0d0cee84-f218-40bb-9dd3-4b2b00078259", ["barrier_support_claim", "EVIDENCE_INSUFFICIENT", null, null]],
  ["39449932-6c41-4762-bf39-e6848c9ad09a", ["primary_use_role", "DIRECT_EVIDENCE_FOUND", "multi_area", "usage_instruction"]],
  ["7cf58ffe-88c1-4f11-9f7a-905513cc6917", ["barrier_support_claim", "EVIDENCE_INSUFFICIENT", null, null]],
  ["6955dada-e845-4a53-a44a-0cdc53dd9ad8", ["primary_use_role", "EVIDENCE_INSUFFICIENT", null, null]]
]);

assert.equal(evidence.task_results.length, 6);

for (const task of evidence.task_results) {
  const expected = expectedTasks.get(task.task_id);
  assert.ok(expected, `unexpected task: ${task.task_id}`);
  assert.equal(task.fact_key, expected[0]);
  assert.equal(task.outcome, expected[1]);
  assert.equal(task.proposed_value, expected[2]);
  assert.equal(task.evidence_class, expected[3]);
  assert.equal(task.identity_match, true);
  assert.equal(task.market_match, true);
  assert.equal(task.formulation_match, true);
  assert.notEqual(task.outcome, "DIRECT_EVIDENCE_FOUND" && task.proposed_value === false);
}

const direct = evidence.task_results.filter(
  (task) => task.outcome === "DIRECT_EVIDENCE_FOUND"
);
assert.equal(direct.length, 1);
assert.equal(direct[0].task_id, "39449932-6c41-4762-bf39-e6848c9ad09a");
assert.equal(direct[0].proposed_value, "multi_area");
assert.equal(direct[0].evidence_class, "usage_instruction");
assert.deepEqual(direct[0].source_ids, ["etude_bundle_kr"]);

const insufficient = evidence.task_results.filter(
  (task) => task.outcome === "EVIDENCE_INSUFFICIENT"
);
assert.equal(insufficient.length, 5);
assert.ok(insufficient.every((task) => task.proposed_value === null));
assert.ok(insufficient.every((task) => task.evidence_class === null));

const manyoTasks = evidence.task_results.filter(
  (task) => task.product_id === "e15a1f7e-29b3-49fd-aae4-297bf9ada4ed"
);
assert.equal(manyoTasks.length, 2);
assert.ok(
  manyoTasks.every((task) =>
    (task.discovery_only_source_ids || []).includes(
      "manyo_cross_market_discovery"
    )
  )
);

assert.equal(
  evidence.next_gate.stage,
  "V2.1-8H-R12A_READY3_OFFICIAL_SOURCE_GAP_RECOVERY"
);
assert.equal(evidence.next_gate.status, "NOT_EXECUTED");
assert.equal(evidence.next_gate.unresolved_task_count, 5);
assert.equal(evidence.next_gate.direct_evidence_task_count, 1);
assert.equal(evidence.next_gate.evidence_ingest_authorized, false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: evidence.stage,
    terminal: evidence.terminal,
    direct: evidence.summary.direct_evidence_found,
    insufficient: evidence.summary.evidence_insufficient
  })
);
