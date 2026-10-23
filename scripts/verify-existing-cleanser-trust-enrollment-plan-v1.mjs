#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  planExistingCleanserTrustResearchEnrollment,
  CLEANSER_REGISTRY_VERSION,
  CLEANSER_REQUIRED_FACT_KEYS,
} from "../lib/existing-cleanser-trust-enrollment-plan-v1.mjs";

const UUID="11111111-1111-4111-8111-111111111111";
const OTHER="22222222-2222-4222-8222-222222222222";
function fixture() {
  const product={id:UUID,brand:"Sample",name:"Sample Cleanser",
    category:"cleanser",normalized_brand:"sample",normalized_name:"sample cleanser"};
  return {
    product,
    catalogProducts:[{id:UUID,normalized_brand:"sample",normalized_name:"sample cleanser"}],
    existingIntakes:[],
    policy:{registryVersion:CLEANSER_REGISTRY_VERSION,
      requiredFactKeys:[...CLEANSER_REQUIRED_FACT_KEYS],allNewLineageAllowed:true},
  };
}
const ready=planExistingCleanserTrustResearchEnrollment(fixture());
assert.equal(ready.state,"TRUST_INTAKE_ENROLLMENT_PROPOSED");
assert.equal(ready.proposal.product_id,UUID);
assert.equal(ready.proposal.catalog_revision,"existing-cleanser-trust-research-v1:"+UUID);
assert.equal(ready.proposal.source_candidate_id,null);
assert.equal(ready.proposal.subject_id,null);
assert.equal(ready.proposal.market,"KR");
assert.equal(ready.proposal.identity_state,"PENDING");
assert.equal(ready.proposal.trust_state,"PENDING");
assert.equal(ready.enrollmentPerformed,false);
assert.equal(ready.admissionGrantsIssued,0);
assert.equal(ready.productionWrites,0);
assert.deepEqual(ready,planExistingCleanserTrustResearchEnrollment(fixture()));
const cases=[
  ["existing_intake",x=>{x.existingIntakes.push({product_id:UUID,catalog_revision:"candidate:old"})},"EXISTING_TRUST_INTAKE_PRESENT"],
  ["duplicate_name",x=>{x.catalogProducts.push({id:OTHER,normalized_brand:"sample",normalized_name:"sample cleanser"})},"CANONICAL_IDENTITY_COLLISION"],
  ["duplicate_normalization",x=>{x.catalogProducts.push({id:OTHER,normalized_brand:"  SAMPLE  ",normalized_name:" SAMPLE   CLEANSER "})},"CANONICAL_IDENTITY_COLLISION"],
  ["product_missing",x=>{x.catalogProducts=[]},"CANONICAL_PRODUCT_MISSING_FROM_INVENTORY"],
  ["invalid_uuid",x=>{x.product.id="garbage"},"INVALID_EXISTING_CANONICAL_CLEANSER"],
  ["bad_category",x=>{x.product.category="sunscreen"},"INVALID_EXISTING_CANONICAL_CLEANSER"],
  ["missing_brand",x=>{x.product.normalized_brand=""},"INVALID_EXISTING_CANONICAL_CLEANSER"],
  ["no_policy",x=>{x.policy=null},"GOVERNED_REGISTRY_WRITE_POLICY_UNVERIFIED"],
  ["wrong_registry",x=>{x.policy.registryVersion="unknown"},"GOVERNED_REGISTRY_WRITE_POLICY_UNVERIFIED"],
  ["wrong_facts",x=>{x.policy.requiredFactKeys=["spf_value","uva_label"]},"GOVERNED_REGISTRY_WRITE_POLICY_UNVERIFIED"],
  ["partial_facts",x=>{x.policy.requiredFactKeys=["low_ph"]},"GOVERNED_REGISTRY_WRITE_POLICY_UNVERIFIED"],
  ["blocked_registry",x=>{x.policy.allNewLineageAllowed=false},"GOVERNED_REGISTRY_WRITE_POLICY_UNVERIFIED"],
  ["missing_catalog_inventory",x=>{x.catalogProducts=null},"INVENTORY_SCOPE_UNVERIFIED"],
  ["missing_intake_inventory",x=>{x.existingIntakes=null},"INVENTORY_SCOPE_UNVERIFIED"],
];
for(const [name,mutate,reason] of cases){
  const data=fixture();mutate(data);
  const result=planExistingCleanserTrustResearchEnrollment(data);
  assert.equal(result.state,"TRUST_INTAKE_ENROLLMENT_HELD",name);
  assert.ok(result.blockers.includes(reason),name+" -> "+result.blockers);
  assert.equal(result.proposal,null,name);
  assert.equal(result.productionWrites,0,name);
}
console.log(JSON.stringify({
  status:"PASS",testCases:cases.length+1,
  scope:"READ_ONLY_EXISTING_PRODUCT_INTAKE_PROPOSAL",
  existingProductIdPreserved:true,admissionGrantsIssued:0,dbWrites:0,
},null,2));
