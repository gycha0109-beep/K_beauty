#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f2-d1-deployed-shadow-dual-read-observation-v1.json",
  "utf8"
));
const f2=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f2-category-authority-shadow-dual-read-v1.json",
  "utf8"
));
const runtime=fs.readFileSync(
  "lib/server/recommendation-candidate-admission-runtime.js",
  "utf8"
);
const categoryReader=fs.readFileSync(
  "lib/recommendation-category-authority-reader.js",
  "utf8"
);

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F2-D1");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F2_D1_DEPLOYED_SHADOW_DUAL_READ_OBSERVED_PASS"
);
assert.equal(
  f2.decision,
  "V21_ADMISSION_G4_F2_CATEGORY_AUTHORITY_SHADOW_DUAL_READ_READY"
);
assert.equal(
  evidence.deployment_observation.workflow_run_id,
  37194196847
);
assert.equal(evidence.deployment_observation.workflow_run_number,165);
assert.equal(
  evidence.deployment_observation.deployment_sha,
  "d34bd85a1943467b9a9e1f4f0378a2d2e3071c2e"
);
assert.equal(evidence.deployment_observation.deployment_ref,"main");
assert.equal(evidence.deployment_observation.http_status,200);
assert.equal(evidence.deployment_observation.result,"PASS");

const dual=evidence.dual_read_observation;
assert.equal(dual.credential_available,true);
assert.equal(dual.runtime_role_match,true);
assert.equal(dual.raw_category_review_select_denied,true);
assert.equal(dual.raw_taxonomy_select_denied,true);
assert.equal(dual.raw_taxonomy_version_select_denied,true);
assert.equal(dual.pf_authority_status,"NO_AUTHORITY");
assert.equal(dual.pf_authority_reason,"CURRENT_SUBJECT_MISSING");
assert.equal(
  dual.category_authority_status,
  "CATEGORY_AUTHORITY_RESOLVED"
);
assert.equal(dual.category_authority_reason,null);
assert.equal(
  dual.category_authority_read_contract_version,
  "recommendation-category-authority-read-v1"
);
assert.equal(dual.category,"treatment");
assert.equal(
  dual.assignment_snapshot_digest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39"
);
assert.equal(dual.production_decision_source,"G3_PF_AUTHORITY_ONLY");
assert.equal(dual.category_authority_observational_only,true);
assert.equal(dual.recommendation_admission_mutated,false);
assert.equal(dual.production_cutover_authorized,false);
assert.equal(dual.secret_value_exposed,false);

const parity=evidence.recommendation_parity_observation;
assert.equal(parity.recommendation_product_count,164);
assert.equal(parity.legacy_exact_overlay_count,165);
assert.equal(parity.catalog_only_recommendation_leak_count,0);
assert.equal(parity.score_delta_count,0);
assert.equal(parity.slot_delta_count,0);
assert.equal(parity.full_order_delta_count,0);
assert.equal(parity.top1_delta_count,0);
assert.equal(parity.top3_delta_count,0);
assert.equal(parity.recommendation_runtime_cutover,false);

assert.equal(
  runtime.includes("recommendation-category-authority-reader"),
  false
);
assert.ok(
  categoryReader.includes("read_recommendation_category_authority_v1")
);

for(const [key,value] of Object.entries(evidence.category_lane_closeout)){
  assert.equal(value, key === "category_authority_resolved" || key === "shadow_dual_read_verified");
}

assert.equal(evidence.g4_g_precondition.authorized_now,false);
assert.equal(
  evidence.g4_g_precondition.blocker,
  "FATION_PRODUCT_FACT_AUTHORITY_UNRESOLVED"
);
assert.equal(
  evidence.g4_g_precondition.pf_lane_decision,
  "V21_ADMISSION_G4_B_R1_FORMULATION_AUTHORITY_NOT_RECOVERED"
);
assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-G_FATION_INITIAL_ADMISSION_CUTOVER"
);
assert.equal(evidence.next_gate_authorized,false);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  category:dual.category,
  pfAuthority:`${dual.pf_authority_status}:${dual.pf_authority_reason}`,
  catalogOnlyRecommendationLeak:parity.catalog_only_recommendation_leak_count,
  recommendationRuntimeCutover:parity.recommendation_runtime_cutover,
  g4GAuthorized:evidence.next_gate_authorized
},null,2));
