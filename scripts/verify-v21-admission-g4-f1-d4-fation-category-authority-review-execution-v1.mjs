#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d4-fation-category-authority-review-execution-v1.json",
  "utf8"
));
const d3=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d3-fation-category-authority-review-preflight-v1.json",
  "utf8"
));
const runtime=fs.readFileSync(
  "lib/server/recommendation-candidate-admission-runtime.js",
  "utf8"
);
const authorityReader=fs.readFileSync(
  "lib/recommendation-admission-authority-reader.js",
  "utf8"
);

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F1-D4");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F1_D4_FATION_CATEGORY_AUTHORITY_REVIEW_ESTABLISHED_PASS"
);
assert.equal(
  d3.next_gate,
  "V2.1-ADMISSION-G4-F1-D4_FATION_CATEGORY_AUTHORITY_REVIEW_EXECUTION"
);

assert.equal(
  evidence.execution.request_id,
  "v21-admission-g4-f1-d4-fation-category-authority-establish-v1"
);
assert.equal(evidence.execution.writer_boundary,"service_role");
assert.equal(evidence.execution.direct_ledger_write,false);
assert.equal(evidence.execution.result.status,"reviewed");
assert.equal(evidence.execution.result.category,"treatment");
assert.equal(evidence.execution.result.review_state,"established");
assert.equal(evidence.execution.result.inserted,true);
assert.equal(evidence.execution.result.idempotent,false);
assert.equal(evidence.execution.result.product_row_mutated,false);
assert.equal(evidence.execution.result.taxonomy_assignment_mutated,false);
assert.equal(evidence.execution.result.recommendation_admission_mutated,false);
assert.equal(evidence.execution.result.production_cutover_authorized,false);

assert.equal(evidence.production_poststate.review_rows,1);
assert.equal(evidence.production_poststate.current_review_rows,1);
assert.equal(evidence.production_poststate.current_established_rows,1);
assert.equal(evidence.production_poststate.exact_audit_events,1);
assert.equal(evidence.production_poststate.products_category,null);
assert.equal(evidence.production_poststate.taxonomy_mode,"shadow/shadow_only");
assert.equal(evidence.production_poststate.product_fact_subject_count,0);
assert.equal(evidence.production_poststate.product_fact_current_count,0);
assert.equal(
  evidence.production_poststate.assignment_snapshot_digest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39"
);

assert.equal(
  evidence.protected_reader_poststate.status,
  "CATEGORY_AUTHORITY_RESOLVED"
);
assert.equal(evidence.protected_reader_poststate.category,"treatment");
assert.equal(
  evidence.protected_reader_poststate.read_contract_version,
  "recommendation-category-authority-read-v1"
);
assert.equal(
  evidence.protected_reader_poststate.recommendation_admission_mutated,
  false
);
assert.equal(
  evidence.protected_reader_poststate.production_cutover_authorized,
  false
);
assert.equal(
  evidence.protected_reader_poststate.temporary_probe_grant_residue,
  0
);

assert.equal(runtime.includes("read_recommendation_category_authority_v1"),false);
assert.equal(authorityReader.includes("read_recommendation_category_authority_v1"),false);
assert.equal(
  evidence.runtime_boundary.recommendation_candidate_admission_runtime_category_reader_wired,
  false
);
assert.equal(
  evidence.runtime_boundary.recommendation_admission_authority_reader_category_reader_wired,
  false
);
assert.equal(evidence.runtime_boundary.recommendation_admission_changed,false);

for(const value of Object.values(evidence.unchanged_boundaries)){
  assert.equal(value,true);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F2_CATEGORY_AUTHORITY_SHADOW_DUAL_READ"
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  category:evidence.protected_reader_poststate.category,
  reviewRows:evidence.production_poststate.review_rows,
  recommendationAdmissionChanged:false,
  nextGate:evidence.next_gate
},null,2));
