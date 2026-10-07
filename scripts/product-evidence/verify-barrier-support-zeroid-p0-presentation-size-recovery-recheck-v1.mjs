#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-zeroid-p0-presentation-size-recovery-recheck-v1.json";
const r9ResearchPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-official-identity-authority-research-v1.json";
const r9LedgerPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-official-identity-decision-ledger-v1.json";

const artifact=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const r9=JSON.parse(fs.readFileSync(r9ResearchPath,"utf8"));
const ledger=JSON.parse(fs.readFileSync(r9LedgerPath,"utf8"));
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

assert.equal(artifact.stage,"V2.1-8H-R14A");
assert.equal(artifact.product.product_id,"7a98b5e7-2c1f-441a-afee-dd1c592d95bc");
assert.equal(artifact.product.catalog_size_ml,40);

assert.equal(gitBlob(r9ResearchPath),artifact.parent_authority.r9_research_git_blob_sha);
assert.equal(gitBlob(r9LedgerPath),artifact.parent_authority.r9_ledger_git_blob_sha);
assert.equal(artifact.parent_authority.prior_decision,"HOLD");
assert.equal(artifact.parent_authority.prior_reason_code,"FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED");

const oldR9=r9.products.find(x=>x.product_id===artifact.product.product_id);
const oldLedger=ledger.decisions.find(x=>x.product_id===artifact.product.product_id);
assert.ok(oldR9);
assert.ok(oldLedger);
assert.equal(oldR9.decision,"HOLD");
assert.equal(oldR9.reason_code,"FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED");
assert.equal(oldLedger.decision,"HOLD");
assert.equal(oldLedger.reason_code,"FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED");

assert.equal(artifact.authority_policy.first_party_product_identity_required,true);
assert.equal(artifact.authority_policy.secondary_source_may_corroborate_but_cannot_close_missing_first_party_presentation_scope,true);
assert.equal(artifact.authority_policy.subject_registration_authorized,false);
assert.equal(artifact.authority_policy.product_fact_write_authorized,false);

const official=artifact.current_research.first_party.find(x=>x.authority_type==="ZEROID_OFFICIAL_PRODUCT_PAGE");
assert.ok(official);
assert.equal(official.observed_name,"인텐시브 SOS 플러스 밤");
assert.equal(official.observed_size_ml,null);
assert.equal(official.html_text_contains_40ml,false);
assert.equal(official.official_image_size_text_verified,false);

assert.equal(artifact.current_research.official_family_domain_search.exact_40ml_first_party_text_found,false);
assert.ok(artifact.current_research.corroborating_sources.length>=3);
for(const s of artifact.current_research.corroborating_sources){
  assert.equal(s.observed_size_ml,40);
}

assert.deepEqual(artifact.production_readback,{
  product_size_ml:40,
  subject_count:0,
  current_fact_count:0,
  fact_instance_count:0,
  confirmation_count:0,
  hosted_writes_from_r14a:{
    product:0,
    subject:0,
    evidence:0,
    fact_instance:0,
    current:0,
    confirmation:0,
    recommendation:0
  }
});

assert.equal(artifact.decision.result,"HOLD");
assert.equal(artifact.decision.reason_code,"FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED");
assert.equal(artifact.decision.hold_auto_released,false);
assert.equal(artifact.next_gate.stage,"V2.1-8H-R14B_ZEROID_FIRST_PARTY_PRESENTATION_CAPTURE");
assert.equal(artifact.next_gate.status,"BLOCKED_PENDING_EXTERNAL_FIRST_PARTY_EVIDENCE");
assert.ok(artifact.next_gate.forbidden_until_entry_condition.includes("subject_registration"));
assert.ok(artifact.next_gate.forbidden_until_entry_condition.includes("confirmation"));
assert.ok(artifact.next_gate.forbidden_until_entry_condition.includes("recommendation_activation"));

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  productId:artifact.product.product_id,
  decision:artifact.decision.result,
  reasonCode:artifact.decision.reason_code,
  subjectWrites:0,
  factWrites:0,
  recommendationWrites:0
}));
