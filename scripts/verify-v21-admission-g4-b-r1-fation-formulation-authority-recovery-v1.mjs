#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const path =
  "evidence/recommendation-governance/v21-admission-g4-b-r1-fation-formulation-authority-recovery-v1.json";
const priorPath =
  "evidence/recommendation-governance/v21-admission-g4-b-fation-subject-registration-hold-v1.json";

const evidence=JSON.parse(fs.readFileSync(path,"utf8"));
const prior=JSON.parse(fs.readFileSync(priorPath,"utf8"));

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-B-R1");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_B_R1_FORMULATION_AUTHORITY_NOT_RECOVERED"
);
assert.equal(evidence.mode,"RESEARCH_ONLY_ZERO_WRITE");
assert.equal(
  prior.next_gate,
  "V2.1-ADMISSION-G4-B-R1_FATION_FORMULATION_AUTHORITY_RECOVERY"
);

const p=evidence.production_prestate;
assert.equal(p.subject_count,0);
assert.equal(p.current_kr_subject_count,0);
assert.equal(p.current_fact_count,0);
assert.equal(p.pristine_review_required_tasks,3);
assert.equal(p.intake_identity_state,"SUBJECT_CREATION_REQUIRED");
assert.equal(p.intake_trust_state,"REVIEW_REQUIRED");

const research=evidence.first_party_research;
assert.equal(research.reformulation_notice_found,false);
assert.equal(research.current_formulation_effective_date_found,false);
assert.equal(research.lot_bound_ingredient_panel_found,false);
assert.equal(research.current_30ml_formulation_statement_found,false);
assert.equal(research.ordering_summary.distinct_ordering_count,3);
assert.equal(research.ordering_summary.ingredient_set_count,1);
assert.equal(research.ordering_summary.ingredient_count,26);
assert.equal(research.ordering_summary.same_ingredient_set,true);
assert.equal(research.ordering_summary.current_official_conflict,true);

const byId=new Map(research.observations.map(x=>[x.source_id,x]));
assert.equal(
  byId.get("fation_product_329").ingredients_sha256,
  "6eeed9473eaaee36bd09a73fb7b9ac1ddd4b7761c9fe21ae57070c9bc0484334"
);
assert.equal(
  byId.get("fation_set_613").ingredients_sha256,
  "2c0cd6fc3765c9b59baf72b6f34abd4ad905e94c07a49c3c7c5c4facbf977d20"
);
for(const id of ["fation_set_757","fation_set_1126","donga_product_NNTS20"]){
  assert.equal(
    byId.get(id).ingredients_sha256,
    "2bfec79eb1d7c9600e898cfbdecfcbbf53606767bf7c6561db6732f5a5583cc4"
  );
}
assert.equal(
  byId.get("fation_set_1126").stock_time_statement,
  "2022년 6월 15일 이후 제조된 상품만을 취급"
);

assert.equal(
  evidence.adjudication.result,
  "FORMULATION_AUTHORITY_NOT_RECOVERED"
);
assert.equal(evidence.adjudication.product_identity_resolved,true);
assert.equal(evidence.adjudication.presentation_identity_resolved,true);
assert.equal(evidence.adjudication.formulation_revision_resolved,false);
assert.equal(evidence.adjudication.subject_registration_allowed,false);

const contract=evidence.recovery_contract;
assert.equal(contract.acceptable_authority.length,3);
assert.ok(contract.insufficient_authority.length>=5);
assert.equal(
  contract.first_party_contact_route.public_customer_contact,
  "080-920-3003"
);
assert.equal(
  contract.first_party_contact_route.exact_question_set.length,
  4
);
assert.equal(
  contract.first_party_contact_route.response_must_be_preserved_with_provenance,
  true
);

for(const value of Object.values(evidence.authorized_deltas)){
  assert.equal(value,0);
}
for(const value of Object.values(evidence.authority_boundary)){
  assert.equal(value,false);
}

const serialized=JSON.stringify(evidence);
for(const forbidden of [
  '"subject_registration_authorized":true',
  '"task_claim_authorized":true',
  '"evidence_ingest_authorized":true',
  '"product_fact_confirmation_authorized":true',
  '"recommendation_admission_cutover_authorized":true'
]){
  assert.equal(serialized.includes(forbidden),false,forbidden);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-B-R2_FATION_FORMULATION_AUTHORITY_EVIDENCE_REVIEW"
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  authorityRecovered:false,
  acceptableAuthorityKinds:contract.acceptable_authority.map(x=>x.kind),
  nextGate:evidence.next_gate
},null,2));
