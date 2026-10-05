#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const evidencePath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-official-source-gap-recovery-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-official-evidence-research-v1.json";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));

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

assert.equal(evidence.stage, "V2.1-8H-R12A");
assert.equal(
  evidence.terminal,
  "BARRIER_SUPPORT_P0_READY3_OFFICIAL_SOURCE_GAP_RECOVERY_0_OF_5"
);
assert.equal(
  evidence.registry.version,
  "product-fact-registry-cross-category-v1"
);
assert.equal(
  evidence.registry.registry_checksum,
  "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575"
);

assert.equal(
  evidence.parent_research.terminal,
  "BARRIER_SUPPORT_P0_READY3_OFFICIAL_EVIDENCE_RESEARCH_DIRECT1_INSUFFICIENT5"
);
assert.equal(
  evidence.parent_research.direct_evidence_task_id,
  "39449932-6c41-4762-bf39-e6848c9ad09a"
);
assert.equal(parent.stage, "V2.1-8H-R12");
assert.equal(
  parent.terminal,
  evidence.parent_research.terminal
);

assert.deepEqual(evidence.summary, {
  source_gap_tasks: 5,
  recovered: 0,
  unresolved: 5,
  prior_direct_evidence_preserved: 1,
  new_direct_evidence: 0,
  evidence_db_writes: 0,
  fact_instance_writes: 0,
  confirmation_writes: 0,
  recommendation_writes: 0
});

assert.equal(evidence.production_readback.global_counts.product_fact_subjects, 50);
assert.ok(
  evidence.production_readback.global_counts.product_fact_current >= 101
);
assert.ok(
  evidence.production_readback.global_counts.fact_instances >= 102
);
assert.ok(
  evidence.production_readback.global_counts.confirmations >= 102
);
assert.equal(
  evidence.production_readback.ready3_subject_fact_instances,
  0
);
assert.equal(
  evidence.production_readback.ready3_subject_current_facts,
  0
);
assert.equal(
  evidence.production_readback.ready3_tasks_research_pending,
  6
);
assert.equal(
  evidence.production_readback.ready3_task_attempt_count_nonzero,
  0
);

for (const [key, expected] of Object.entries({
  evidence_db_writes: 0,
  fact_instance_writes: 0,
  confirmation_writes: 0,
  recommendation_writes: 0,
  public_activation: false,
  missing_implies_false: false,
  line_or_sibling_claim_transfer: false,
  cross_market_evidence_transfer: false,
  category_or_form_inference_to_usage_role: false
})) {
  assert.equal(evidence.authority_boundary[key], expected, key);
}

const expectedTaskIds = new Set([
  "02b9ba0a-207c-4d23-b522-853bd45ff815",
  "e08b1e23-771d-4c0b-8263-8ca02fa687f6",
  "0d0cee84-f218-40bb-9dd3-4b2b00078259",
  "7cf58ffe-88c1-4f11-9f7a-905513cc6917",
  "6955dada-e845-4a53-a44a-0cdc53dd9ad8"
]);

assert.deepEqual(new Set(evidence.unresolved_task_ids), expectedTaskIds);
assert.equal(evidence.task_results.length, 5);

for (const task of evidence.task_results) {
  assert.ok(expectedTaskIds.has(task.task_id), task.task_id);
  assert.equal(task.prior_outcome, "EVIDENCE_INSUFFICIENT");
  assert.equal(task.recovery_outcome, "NOT_RECOVERED");
  assert.equal(task.final_research_state, "EVIDENCE_INSUFFICIENT");
}

assert.equal(evidence.source_captures.length, 8);
for (const source of evidence.source_captures) {
  assert.match(source.source_locator, /^https:\/\//);
  assert.match(
    source.canonical_capture_digest,
    /^[0-9a-f]{64}$/
  );
  const material = { ...source };
  delete material.canonical_capture_digest;
  assert.equal(
    sha256(material),
    source.canonical_capture_digest,
    `source capture digest mismatch: ${source.source_id}`
  );
}

const harnayQna = evidence.source_captures.find(
  (source) => source.source_id === "theharnay_official_qna"
);
assert.ok(harnayQna);
assert.equal(
  harnayQna.authority_kind,
  "official_kr_brand_staff_qna"
);

const harnayBarrier = evidence.task_results.find(
  (task) => task.task_id === "02b9ba0a-207c-4d23-b522-853bd45ff815"
);
assert.ok(harnayBarrier.source_ids.includes("theharnay_home_line_context"));
assert.match(harnayBarrier.reason, /line-level|cream-specific/i);

const harnayRole = evidence.task_results.find(
  (task) => task.task_id === "e08b1e23-771d-4c0b-8263-8ca02fa687f6"
);
assert.ok(harnayRole.source_ids.includes("theharnay_official_qna"));
assert.match(harnayRole.reason, /never declares/i);

const etudeBarrier = evidence.task_results.find(
  (task) => task.task_id === "0d0cee84-f218-40bb-9dd3-4b2b00078259"
);
assert.equal(etudeBarrier.rejected_discovery.length, 1);
assert.match(etudeBarrier.rejected_discovery[0], /Third-party/);

const manyoBarrier = evidence.task_results.find(
  (task) => task.task_id === "7cf58ffe-88c1-4f11-9f7a-905513cc6917"
);
assert.ok(manyoBarrier.source_ids.includes("manyo_panthetoin_category"));

const manyoRole = evidence.task_results.find(
  (task) => task.task_id === "6955dada-e845-4a53-a44a-0cdc53dd9ad8"
);
assert.deepEqual(
  manyoRole.discovery_only_source_ids,
  ["manyo_jp_exact_product_discovery"]
);

assert.equal(
  evidence.next_gate.stage,
  "V2.1-8H-R12B_READY3_DIRECT_EVIDENCE_INGEST_PREFLIGHT"
);
assert.equal(evidence.next_gate.status, "NOT_EXECUTED");
assert.deepEqual(
  evidence.next_gate.candidate_task_ids,
  ["39449932-6c41-4762-bf39-e6848c9ad09a"]
);
assert.deepEqual(
  new Set(evidence.next_gate.unresolved_task_ids),
  expectedTaskIds
);
assert.equal(evidence.next_gate.evidence_ingest_authorized, false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: evidence.stage,
    terminal: evidence.terminal,
    recovered: evidence.summary.recovered,
    unresolved: evidence.summary.unresolved,
    nextCandidate: evidence.next_gate.candidate_task_ids[0]
  })
);
