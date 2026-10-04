#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f2-category-authority-shadow-dual-read-v1.json",
  "utf8"
));
const d4=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d4-fation-category-authority-review-execution-v1.json",
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
const categoryReader=fs.readFileSync(
  "lib/recommendation-category-authority-reader.js",
  "utf8"
);
const route=fs.readFileSync(
  "app/api/internal/recommendation-category-authority-shadow-dual-read/route.js",
  "utf8"
);
const workflow=fs.readFileSync(
  ".github/workflows/v21-admission-g3a-pf-authority-read.yml",
  "utf8"
);

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F2");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F2_CATEGORY_AUTHORITY_SHADOW_DUAL_READ_READY"
);
assert.equal(
  d4.decision,
  "V21_ADMISSION_G4_F1_D4_FATION_CATEGORY_AUTHORITY_REVIEW_ESTABLISHED_PASS"
);
assert.equal(
  evidence.target.product_id,
  "da5df70c-8cdd-4eb2-93b6-ede46c2f171d"
);
assert.equal(evidence.target.expected_category,"treatment");
assert.equal(
  evidence.target.expected_assignment_snapshot_digest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39"
);

assert.equal(
  evidence.architecture.category_reader_rpc,
  "public.read_recommendation_category_authority_v1(uuid)"
);
assert.equal(
  evidence.architecture.credential_boundary,
  "recommendation_admission_runtime"
);
assert.equal(evidence.architecture.production_admission_runtime_modified,false);
assert.equal(evidence.architecture.production_authority_reader_modified,false);

assert.equal(
  runtime.includes("read_recommendation_category_authority_v1"),
  false
);
assert.equal(
  runtime.includes("recommendation-category-authority-reader"),
  false
);
assert.equal(
  authorityReader.includes("read_recommendation_category_authority_v1"),
  false
);
assert.ok(
  categoryReader.includes("read_recommendation_category_authority_v1")
);
assert.ok(
  categoryReader.includes("RECOMMENDATION_ADMISSION_RUNTIME_ROLE")
);
assert.ok(
  route.includes("readRecommendationAdmissionAuthority")
);
assert.ok(
  route.includes("runRecommendationCategoryAuthorityRuntimeSecurityProbe")
);
assert.ok(
  route.includes('productionDecisionSource: "G3_PF_AUTHORITY_ONLY"')
);
assert.ok(
  route.includes("categoryAuthorityObservationalOnly: true")
);

for(const key of [
  "recommendation_admission_mutated",
  "production_cutover_authorized",
  "products_category_mutated",
  "taxonomy_global_authority_activated",
  "product_fact_mutated",
]){
  assert.equal(evidence.shadow_contract[key],false);
}
assert.equal(
  evidence.shadow_contract.category_authority_observational_only,
  true
);
assert.equal(
  evidence.shadow_contract.production_decision_source,
  "G3_PF_AUTHORITY_ONLY"
);

for(const required of [
  "lib/recommendation-category-authority-reader.js",
  "app/api/internal/recommendation-category-authority-shadow-dual-read/route.js",
  "scripts/verify-v21-admission-g4-f2-category-authority-shadow-dual-read-v1.mjs",
  "Probe deployed G4-F2 category authority shadow dual-read",
  "Verify G4-F2 category authority shadow dual-read",
]){
  assert.ok(workflow.includes(required), required);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F2-D1_DEPLOYED_SHADOW_DUAL_READ_OBSERVATION"
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  targetProduct:evidence.target.product_id,
  expectedCategory:evidence.target.expected_category,
  productionDecisionSource:evidence.shadow_contract.production_decision_source,
  recommendationAdmissionMutated:false,
  nextGate:evidence.next_gate
},null,2));
