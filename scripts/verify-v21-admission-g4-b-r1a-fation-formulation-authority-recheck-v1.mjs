#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-b-r1a-fation-formulation-authority-recheck-v1.json",
  "utf8"
));
const r1=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-b-r1-fation-formulation-authority-recovery-v1.json",
  "utf8"
));
const f2d1=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f2-d1-deployed-shadow-dual-read-observation-v1.json",
  "utf8"
));

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-B-R1A");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_B_R1A_FORMULATION_AUTHORITY_RECHECK_NOT_RECOVERED"
);
assert.equal(
  r1.decision,
  "V21_ADMISSION_G4_B_R1_FORMULATION_AUTHORITY_NOT_RECOVERED"
);
assert.equal(
  f2d1.decision,
  "V21_ADMISSION_G4_F2_D1_DEPLOYED_SHADOW_DUAL_READ_OBSERVED_PASS"
);

assert.equal(evidence.revalidation.qualifying_authority_found,false);
assert.equal(evidence.revalidation.formulation_effective_date_found,false);
assert.equal(evidence.revalidation.lot_bound_current_panel_found,false);
assert.equal(evidence.revalidation.first_party_reformulation_notice_found,false);
assert.equal(
  evidence.revalidation.first_party_written_current_formula_statement_found,
  false
);

assert.equal(evidence.revalidation.observations.length,4);
assert.deepEqual(
  [...new Set(evidence.revalidation.observations.map(x=>x.ingredient_order_class))].sort(),
  ["mugwort_first_a","mugwort_first_b","water_first"]
);
assert.equal(evidence.revalidation.ordering_summary.distinct_ordering_count,3);
assert.equal(evidence.revalidation.ordering_summary.ingredient_set_count,1);
assert.equal(evidence.revalidation.ordering_summary.ingredient_count,26);
assert.equal(evidence.revalidation.ordering_summary.same_ingredient_set,true);
assert.equal(evidence.revalidation.ordering_summary.first_party_conflict_persists,true);

assert.equal(evidence.adjudication.result,"FORMULATION_AUTHORITY_NOT_RECOVERED");
assert.equal(evidence.adjudication.formulation_revision_resolved,false);
assert.equal(evidence.adjudication.subject_registration_allowed,false);
assert.equal(evidence.adjudication.r2_authorized,false);
assert.equal(evidence.adjudication.g4_g_authorized,false);

assert.equal(evidence.category_lane.resolved,true);
assert.equal(evidence.category_lane.category,"treatment");
assert.equal(evidence.category_lane.shadow_dual_read_pass,true);
assert.equal(evidence.category_lane.recommendation_cutover,false);

for(const [key,value] of Object.entries(evidence.production_boundary)){
  if(key==="production_writes") assert.equal(value,0);
  else assert.equal(value,false);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-B-R2_FATION_FORMULATION_AUTHORITY_EVIDENCE_REVIEW"
);
assert.equal(evidence.next_gate_authorized,false);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  distinctOrderings:evidence.revalidation.ordering_summary.distinct_ordering_count,
  formulationRevisionResolved:evidence.adjudication.formulation_revision_resolved,
  categoryLaneResolved:evidence.category_lane.resolved,
  r2Authorized:evidence.next_gate_authorized,
  productionWrites:evidence.production_boundary.production_writes
},null,2));
