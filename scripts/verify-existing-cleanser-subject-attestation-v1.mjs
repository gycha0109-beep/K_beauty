#!/usr/bin/env node
import assert from "node:assert/strict";
import {materializeExistingCleanserSubjectAttestation} from "../lib/cleanser-existing-subject-attestation-v1.mjs";
const id="11111111-1111-4111-8111-111111111111";
const subjectId="22222222-2222-4222-8222-222222222222";
const bindingId="33333333-3333-4333-8333-333333333333";
const observationId="44444444-4444-4444-8444-444444444444";
const intakeId="55555555-5555-4555-8555-555555555555";
const loc="https://brand.example/product/detail?product_no=99";
const digest="a".repeat(64);
const now=new Date("2026-10-22T12:00:00Z");
function fixture(){
  return {now,
    product:{id,category:"cleanser"},
    subject:{subject_id:subjectId,product_id:id,identity_status:"resolved",
      current_state:"current",market_applicability:"KR"},
    trustIntakes:[{id:intakeId,product_id:id,subject_id:subjectId,identity_state:"EXACT_SUBJECT_FOUND",
      market:"KR",identity_resolution_detail:{identity_authority:{
        authority_kind:"admin_identity_authority",market:"KR",
        authority_resolution_version:"admin-official-v1",
        official_source_locator:loc,source_content_digest:digest,
      }}}],
    officialBindings:[{binding_id:bindingId,product_id:id,binding_state:"resolved",
      product_scope_state:"product",source_name:"brand_official",source_url:loc}],
    observations:[{observation_id:observationId,product_id:id,subject_id:subjectId,
      source_binding_id:bindingId,market:"KR",source_content_digest:digest,
      canonical_locator:loc,fetched_at:"2026-10-21T12:00:00Z",
      product_identity_observation:{product_id:id,subject_id:subjectId,
        exact_catalog_product_binding:true}}],
  };
}
const value=materializeExistingCleanserSubjectAttestation(fixture());
assert.equal(value.authority,"governed_exact_subject_identity");
assert.equal(value.governed_intake_id,intakeId);
assert.equal(value.official_observation_id,observationId);
assert.equal(value.evidence_digest,digest);
assert.deepEqual(value,materializeExistingCleanserSubjectAttestation(fixture()));
const cases=[
  ["wrong_product",x=>{x.subject.product_id=subjectId}],
  ["wrong_category",x=>{x.product.category="sunscreen"}],
  ["wrong_market",x=>{x.subject.market_applicability="US"}],
  ["historical_subject",x=>{x.subject.current_state="historical"}],
  ["unresolved_subject",x=>{x.subject.identity_status="unresolved"}],
  ["missing_intake",x=>{x.trustIntakes=[]}],
  ["unreviewed_intake",x=>{x.trustIntakes[0].identity_state="SUBJECT_CREATION_REQUIRED"}],
  ["fake_admin_kind",x=>{x.trustIntakes[0].identity_resolution_detail.identity_authority.authority_kind="gpt_claim"}],
  ["missing_digest",x=>{x.trustIntakes[0].identity_resolution_detail.identity_authority.source_content_digest=null}],
  ["wrong_digest",x=>{x.trustIntakes[0].identity_resolution_detail.identity_authority.source_content_digest="b".repeat(64)}],
  ["other_product_intake",x=>{x.trustIntakes[0].product_id=subjectId}],
  ["other_subject_intake",x=>{x.trustIntakes[0].subject_id=id}],
  ["multiple_intakes",x=>{x.trustIntakes.push(structuredClone(x.trustIntakes[0]))}],
  ["no_official_binding",x=>{x.officialBindings=[]}],
  ["retailer_not_official",x=>{x.officialBindings[0].source_name="hwahae"}],
  ["unresolved_binding",x=>{x.officialBindings[0].binding_state="retired"}],
  ["subject_scope_unresolved",x=>{x.officialBindings[0].product_scope_state="product_subject_unresolved"}],
  ["other_source",x=>{x.officialBindings[0].source_url="https://fake.example/product/detail?product_no=99"}],
  ["other_sku",x=>{x.officialBindings[0].source_url="https://brand.example/product/detail?product_no=100"}],
  ["other_binding_observation",x=>{x.observations[0].source_binding_id=intakeId}],
  ["other_subject_observation",x=>{x.observations[0].subject_id=id}],
  ["old_observation",x=>{x.observations[0].fetched_at="2025-01-01T00:00:00Z"}],
  ["future_observation",x=>{x.observations[0].fetched_at="2027-01-01T00:00:00Z"}],
  ["false_subject_binding",x=>{x.observations[0].product_identity_observation.exact_catalog_product_binding=false}],
  ["missing_official_observation",x=>{x.observations=[]}],
  ["multiple_observations",x=>{x.observations.push(structuredClone(x.observations[0]))}],
];
for(const [name,mutate] of cases){
  const x=fixture();mutate(x);
  assert.equal(materializeExistingCleanserSubjectAttestation(x),null,name);
}
console.log(JSON.stringify({status:"PASS",cases:cases.length+1,
  currentSubjectAttestationAuthority:"GOVERNED_OBSERVATION_ONLY",
  dbWrites:0,grants:0},null,2));
