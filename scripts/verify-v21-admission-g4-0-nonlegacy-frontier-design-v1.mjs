#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const p="evidence/recommendation-governance/v21-admission-g4-0-nonlegacy-frontier-design-v1.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));

assert.equal(d.version,"v21-admission-g4-0-nonlegacy-frontier-design-v1");
assert.equal(d.stage,"V2.1-ADMISSION-G4-0");
assert.equal(d.decision,"V21_ADMISSION_G4_0_NONLEGACY_FRONTIER_DESIGN_FROZEN");
assert.equal(d.mode,"ZERO_WRITE_DESIGN");

assert.equal(d.corrections_to_initial_hypothesis.eight_h_products_all_legacy,true);
assert.equal(d.corrections_to_initial_hypothesis.eight_h_products.length,4);

assert.equal(d.nonlegacy_frontier.product_count,12);
assert.deepEqual(d.nonlegacy_frontier.candidate_classification_counts,{sunscreen:11,treatment:1});
assert.equal(d.nonlegacy_frontier.g2_supported_frontier_count,1);

const f=d.nonlegacy_frontier.selected_product;
assert.equal(f.product_id,"da5df70c-8cdd-4eb2-93b6-ede46c2f171d");
assert.equal(f.candidate_id,"6a9627b6-a5da-458f-84f7-3a40f91453be");
assert.equal(f.intake_id,"15566618-d039-44c5-ad45-6413ee399db3");
assert.equal(f.legacy_category_projection,null);
assert.equal(f.canonical_taxonomy.assignment_count,1);
assert.equal(f.canonical_taxonomy.assignment_state,"shadow");
assert.equal(f.canonical_taxonomy.assignment_method,"source_classification");
assert.equal(f.canonical_taxonomy.canonical_category,"treatment");
assert.equal(f.canonical_taxonomy.legacy_projection_key,null);
assert.equal(f.catalog_identity.state,"resolved");
assert.equal(f.catalog_identity.treated_as_product_fact_authority,false);

assert.equal(f.product_fact_prestate.subject_count,0);
assert.equal(f.product_fact_prestate.current_fact_count,0);
assert.equal(f.product_fact_prestate.intake_identity_state,"SUBJECT_CREATION_REQUIRED");
assert.equal(f.product_fact_prestate.intake_trust_state,"REVIEW_REQUIRED");
assert.equal(f.product_fact_prestate.tasks.length,3);
assert.deepEqual(
  f.product_fact_prestate.tasks.map(x=>x.fact_key).sort(),
  ["active_concentration","contains_active","recommended_use_frequency"]
);
for(const task of f.product_fact_prestate.tasks){
  assert.equal(task.state,"REVIEW_REQUIRED");
  assert.equal(task.blocker_code,"SUBJECT_CREATION_REQUIRED");
  assert.equal(task.attempt_count,0);
}

assert.equal(d.runtime_risk.subject_registration_current_reprocess,"process_catalog_trust_product_v1(uuid)");
assert.equal(d.runtime_risk.required_reprocess,"process_catalog_trust_product_v3(uuid,text)");
assert.equal(d.runtime_risk.required_registry_version,"product-fact-registry-cross-category-v1");
assert.match(d.runtime_risk.current_reprocess_sha256,/^[0-9a-f]{64}$/);
assert.match(d.runtime_risk.required_reprocess_sha256,/^[0-9a-f]{64}$/);

assert.match(d.frozen_architecture.legacy_projection_rule,/Do not backfill products\.category/);
assert.match(d.frozen_architecture.category_bridge_rule,/product-scoped reviewed grant/);
assert.deepEqual(d.staged_plan.map(x=>x.stage),[
  "V2.1-ADMISSION-G4-A",
  "V2.1-ADMISSION-G4-B",
  "V2.1-ADMISSION-G4-C",
  "V2.1-ADMISSION-G4-D",
  "V2.1-ADMISSION-G4-E",
  "V2.1-ADMISSION-G4-F",
  "V2.1-ADMISSION-G4-G"
]);

assert.equal(d.authority_boundary.production_writes_in_g4_0,0);
for(const [key,value] of Object.entries(d.authority_boundary)){
  if(key!=="production_writes_in_g4_0") assert.equal(value,false,key);
}
assert.equal(d.next_gate,"V2.1-ADMISSION-G4-A_SUBJECT_REGISTRATION_REPROCESS_CONTRACT");

const legacy=fs.readFileSync("fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt","utf8")
  .split(/\r?\n/).map(x=>x.trim().toLowerCase()).filter(Boolean);
assert.equal(legacy.length,164);
for(const x of d.corrections_to_initial_hypothesis.eight_h_products){
  assert.ok(legacy.includes(x.product_id),`${x.slug} must remain in frozen Legacy 164`);
}

const g2=fs.readFileSync("scripts/product-evidence/initial-admission-grant-policy-v1.mjs","utf8");
for(const category of ["treatment","toner_essence","toner_pad"]) {
  assert.ok(g2.includes(category),`G2 supported category missing: ${category}`);
}
assert.ok(g2.includes("contains_active"));
assert.ok(g2.includes("INITIAL_ADMISSION_GRANT"));

const taxonomy8=JSON.parse(fs.readFileSync("evidence/catalog-taxonomy-v1/data-taxonomy8-nullable-legacy-category-projection-v1.json","utf8"));
assert.equal(taxonomy8.post_application_semantics.canonical_classification,"public.product_catalog_taxonomy_assignments");
assert.equal(taxonomy8.post_application_semantics.null_category_grants_recommendation_admission,false);

const taxonomy11=JSON.parse(fs.readFileSync("evidence/catalog-taxonomy-v1/data-taxonomy11-catalog-only-transactional-adoption-v1.json","utf8"));
assert.equal(taxonomy11.transactional_contract.recommendation_admission_allowed,false);

const parity=fs.readFileSync("scripts/product-evidence/verify-data-taxonomy15-recommendation-parity-catalog-only-v2.mjs","utf8");
assert.ok(parity.includes("catalogOnlyRecommendationLeakCount"));
assert.ok(parity.includes("catalogOnlyShadowValid"));

console.log(JSON.stringify({
  status:"PASS",
  stage:d.stage,
  frontierProduct:f.product_id,
  nonlegacyProducts:d.nonlegacy_frontier.product_count,
  nextGate:d.next_gate,
  decision:d.decision
},null,2));
