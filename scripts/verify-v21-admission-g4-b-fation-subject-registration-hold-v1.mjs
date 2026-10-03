#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const path =
  "evidence/recommendation-governance/v21-admission-g4-b-fation-subject-registration-hold-v1.json";
const priorPath =
  "evidence/product-fact-subject-coverage-v1/trust-phase5c-fation-formulation-conflict-v1.json";
const g4aPath =
  "evidence/recommendation-governance/v21-admission-g4-a-subject-registration-reprocess-contract-v1.json";

const evidence=JSON.parse(fs.readFileSync(path,"utf8"));
const prior=JSON.parse(fs.readFileSync(priorPath,"utf8"));
const g4a=JSON.parse(fs.readFileSync(g4aPath,"utf8"));

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-B");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_B_FATION_SUBJECT_REGISTRATION_HOLD"
);
assert.equal(evidence.mode,"ZERO_WRITE_HOLD");
assert.equal(
  g4a.next_gate,
  "V2.1-ADMISSION-G4-B_FATION_SUBJECT_REGISTRATION"
);
assert.equal(prior.conflict.state,"FORMULATION_CONFLICT");
assert.equal(prior.conflict.resolution,"HOLD");

const p=evidence.production_prestate;
assert.equal(p.subject_count,0);
assert.equal(p.current_kr_subject_count,0);
assert.equal(p.intake_identity_state,"SUBJECT_CREATION_REQUIRED");
assert.equal(p.intake_trust_state,"REVIEW_REQUIRED");
assert.equal(p.research_tasks.length,3);
for(const task of p.research_tasks){
  assert.equal(task.state,"REVIEW_REQUIRED");
  assert.equal(task.blocker_code,"SUBJECT_CREATION_REQUIRED");
  assert.equal(task.attempt_count,0);
  assert.equal(task.evidence_id,null);
}

const r=evidence.current_first_party_revalidation;
assert.equal(r.retrieved_on,"2026-10-03");
assert.equal(r.distinct_orderings,3);
assert.equal(r.same_ingredient_set,true);
assert.equal(r.ingredient_count,26);
assert.equal(r.conflict.state,"FORMULATION_CONFLICT");
assert.equal(r.conflict.resolution,"HOLD");
assert.equal(r.conflict.first_party_current_30ml_ordering_count,3);
assert.equal(r.conflict.formulation_revision_identifiable,false);

const byId=new Map(r.observations.map(x=>[x.source_id,x]));
assert.equal(
  byId.get("fation_product_329").ingredients_sha256,
  "6eeed9473eaaee36bd09a73fb7b9ac1ddd4b7761c9fe21ae57070c9bc0484334"
);
assert.equal(
  byId.get("fation_set_613").ingredients_sha256,
  "2c0cd6fc3765c9b59baf72b6f34abd4ad905e94c07a49c3c7c5c4facbf977d20"
);
assert.equal(
  byId.get("donga_product_NNTS20").ingredients_sha256,
  "2bfec79eb1d7c9600e898cfbdecfcbbf53606767bf7c6561db6732f5a5583cc4"
);
assert.equal(
  byId.get("fation_set_757").ingredients_sha256,
  byId.get("donga_product_NNTS20").ingredients_sha256
);
assert.notEqual(
  byId.get("fation_product_329").ingredients_sha256,
  byId.get("fation_set_613").ingredients_sha256
);
assert.notEqual(
  byId.get("fation_set_613").ingredients_sha256,
  byId.get("donga_product_NNTS20").ingredients_sha256
);
assert.notEqual(
  byId.get("fation_product_329").ingredients_sha256,
  byId.get("donga_product_NNTS20").ingredients_sha256
);

const preflight=evidence.subject_identity_preflight;
assert.equal(preflight.variant_key,"NOSCA9_TROUBLE_SERUM_KR_30ML");
assert.equal(preflight.variant_key_status,"PROVISIONAL_NOT_AUTHORIZED");
assert.equal(preflight.formulation_revision_key,null);
assert.equal(preflight.formulation_label,null);
assert.equal(preflight.subject_semantic_key,null);
assert.equal(preflight.registration_allowed,false);
assert.equal(
  preflight.reason_code,
  "EXTERNAL_FORMULATION_AUTHORITY_REQUIRED"
);

for(const value of Object.values(evidence.authorized_deltas)){
  assert.equal(value,0);
}
for(const value of Object.values(evidence.authority_boundary)){
  assert.equal(value,false);
}

const serialized=JSON.stringify(evidence);
for(const forbidden of [
  '"registration_allowed":true',
  '"product_fact_subjects":1',
  '"product_fact_evidence":1',
  '"product_fact_confirmations":1',
  '"product_fact_current":1',
  '"recommendations":1'
]){
  assert.equal(serialized.includes(forbidden),false,forbidden);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-B-R1_FATION_FORMULATION_AUTHORITY_RECOVERY"
);

const urls=r.observations.map(x=>x.url);
assert.equal(new Set(urls).size,urls.length);
for(const url of urls) assert.match(url,/^https:\/\//);

const decisionDigest=crypto.createHash("sha256").update(
  JSON.stringify({
    target:evidence.target.product_id,
    orderings:[...new Set(r.observations.map(x=>x.ingredients_sha256))].sort(),
    resolution:r.conflict.resolution,
    next_gate:evidence.next_gate
  })
).digest("hex");

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  distinctOrderings:r.distinct_orderings,
  registrationAllowed:preflight.registration_allowed,
  nextGate:evidence.next_gate,
  decisionDigest
},null,2));
