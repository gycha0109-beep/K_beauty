#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateBushmanSemanticS4Audit } from "../lib/admin/bushman-sunscreen-semantic-s4-audit.mjs";
import { BUSHMAN_SEMANTIC_REVIEW_FIELDS } from "../lib/admin/bushman-sunscreen-semantic-review-contract.mjs";

const s2 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s2-bushman-web-review-evidence-v1.json", "utf8"));
const ownerHold = "data-ai29c-c5-presentation-identity-correction-v1";
const ownerReady = "trust-phase5-admin-subject-review-v1";
const uuid = i => `00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`;
const digest = "a".repeat(64);
function liveUnreviewed() {
  return {
    productId:s2.scope.productId,subjectId:s2.scope.subjectId,
    contractVersion:"sunscreen-recommendation-semantic-bundle-v1",subjectCount:1,
    requiredFieldCount:12,reviewedFieldCount:0,establishedFieldCount:0,
    reviewedNotEstablishedFieldCount:0,notReviewedFieldCount:12,conflictFieldCount:0,
    fields:Object.fromEntries(BUSHMAN_SEMANTIC_REVIEW_FIELDS.map(k=>[k,{
      state:"not_reviewed",value:null,confidence:"unknown",
      reviewId:null,evidenceDigest:null,reviewedAt:null,
    }])),
  };
}
function complete() {
  const live = liveUnreviewed();
  live.reviewedFieldCount=12;live.establishedFieldCount=2;
  live.reviewedNotEstablishedFieldCount=10;live.notReviewedFieldCount=0;
  const audits=[];
  BUSHMAN_SEMANTIC_REVIEW_FIELDS.forEach((name,i)=>{
    const p=s2.rpcPayloadPreview.find(x=>x.field_name===name);
    const reviewId=uuid(i),auditId=uuid(i+20);
    live.fields[name]={
      state:p.review_state,value:p.field_value,confidence:p.confidence,
      reviewId,evidenceDigest:digest,reviewedAt:"2026-10-10T10:00:00+09:00",
    };
    audits.push({
      id:auditId,target_id:reviewId,
      action:"admin.sunscreen_recommendation_semantic_field_reviewed",
      target_type:"sunscreen_recommendation_semantic_field_review",
      after_value:{
        product_id:s2.scope.productId,subject_id:s2.scope.subjectId,
        field_name:name,review_state:p.review_state,field_value:p.field_value,
        confidence:p.confidence,evidence_digest:digest,
      },
      metadata:{
        product_row_mutated:false,recommendation_admission_mutated:false,
        production_ranking_changed:false,
      },
    });
  });
  return {live,audits,evidence:structuredClone(s2)};
}
const base=liveUnreviewed();
const existing=evaluateBushmanSemanticS4Audit(s2,base,[],ownerHold);
assert.equal(existing.reviewReady,false);
assert.equal(existing.audited,0);
assert.equal(existing.readyForAdmissionPreflight,false);
assert.ok(existing.blockers.includes("SEMANTIC_12_OF_12_NOT_CURRENT"));
assert.ok(existing.blockers.includes("SUBJECT_AUTHORITY_NOT_GOVERNED"));
assert.ok(existing.blockers.includes("AUDIT_12_OF_12_NOT_VERIFIED"));

const x=complete();
const full=evaluateBushmanSemanticS4Audit(x.evidence,x.live,x.audits,ownerHold);
assert.equal(full.reviewReady,true);
assert.equal(full.audited,12);
assert.equal(full.subjectAuthorityReady,false);
assert.equal(full.readyForAdmissionPreflight,false);
assert.ok(full.blockers.includes("SUBJECT_AUTHORITY_NOT_GOVERNED"));
assert.equal(full.admissionGranted,false);
const governed=evaluateBushmanSemanticS4Audit(x.evidence,x.live,x.audits,ownerReady);
assert.equal(governed.reviewReady,true);
assert.equal(governed.readyForAdmissionPreflight,true);
assert.equal(governed.admissionGranted,false);
assert.equal(governed.recommendationsChanged,false);
assert.equal(governed.productionRankingChanged,false);

const invalid=[
  ["audit_missing",({audits})=>audits.pop(),"AUDIT_CARDINALITY_INVALID:pilling_risk"],
  ["audit_duplicate",({audits})=>audits.push(structuredClone(audits[0])),"AUDIT_CARDINALITY_INVALID:category_slot"],
  ["audit_product_changed",({audits})=>{audits[0].after_value.product_id="other"},"AUDIT_FACT_OR_MUTATION_MISMATCH:category_slot"],
  ["audit_subject_changed",({audits})=>{audits[0].after_value.subject_id="other"},"AUDIT_FACT_OR_MUTATION_MISMATCH:category_slot"],
  ["audit_field_changed",({audits})=>{audits[0].after_value.field_name="tone_up"},"AUDIT_FACT_OR_MUTATION_MISMATCH:category_slot"],
  ["audit_evidence_changed",({audits})=>{audits[0].after_value.evidence_digest="0".repeat(64)},"AUDIT_FACT_OR_MUTATION_MISMATCH:category_slot"],
  ["audit_claims_rank_changed",({audits})=>{audits[0].metadata.production_ranking_changed=true},"AUDIT_FACT_OR_MUTATION_MISMATCH:category_slot"],
  ["review_value_changed",({live})=>{live.fields.uv_filter_type.value="organic"},"REVIEW_VALUE_OR_STATE_MISMATCH:uv_filter_type"],
  ["review_sensitivity_guessed",({live})=>{live.fields.sensitivity_safe.state="established"},"REVIEW_VALUE_OR_STATE_MISMATCH:sensitivity_safe"],
  ["review_digest_missing",({live})=>{live.fields.eye_sting.evidenceDigest=null},"REVIEW_PROVENANCE_INVALID:eye_sting"],
  ["review_uuid_duplicate",({live})=>{live.fields.skin_types.reviewId=live.fields.category_slot.reviewId},"REVIEW_PROVENANCE_INVALID:skin_types"],
  ["review_time_invalid",({live})=>{live.fields.skin_types.reviewedAt="bad"},"REVIEW_PROVENANCE_INVALID:skin_types"],
  ["count_forgery",({live})=>{live.establishedFieldCount=12},"SEMANTIC_12_OF_12_NOT_CURRENT"],
  ["wrong_subject",({live})=>{live.subjectId="other"},"LIVE_EXACT_SUBJECT_OR_FIELDS_MISMATCH"],
  ["missing_field",({live})=>{delete live.fields.eye_sting},"LIVE_EXACT_SUBJECT_OR_FIELDS_MISMATCH"],
  ["s2_changed",({evidence})=>{evidence.decision="FAKE_APPROVED"},"FROZEN_S2_PROPOSAL_MISMATCH"],
];
for(const [name,mutate,blocker] of invalid){
  const changed=complete();
  mutate(changed);
  const r=evaluateBushmanSemanticS4Audit(changed.evidence,changed.live,changed.audits,ownerReady);
  assert.equal(r.reviewReady,false,name);
  assert.equal(r.readyForAdmissionPreflight,false,name);
  assert.ok(r.blockers.includes(blocker),name+":"+r.blockers);
  assert.equal(r.admissionGranted,false,name);
}

const srv=fs.readFileSync("lib/admin/bushman-sunscreen-semantic-review.js","utf8");
const ui=fs.readFileSync("app/admin/products/bushman-semantic-review/BushmanSemanticReviewWorkbench.js","utf8");
for (const expected of [
  'from("admin_audit_logs")', '.select("id,target_id,action,target_type,after_value,metadata")',
  '.in("target_id", currentIds)', 'identity_resolution_version',
  "evaluateBushmanSemanticS4Audit(", "s4,"
])assert.ok(srv.includes(expected),"missing S4 read-only audit boundary: "+expected);
assert.ok(ui.includes("workbench.s4?.reviewReady"),"admin workbench must display S4 result");
assert.ok(ui.includes("workbench.s4?.subjectAuthorityReady"),"Subject independent HOLD required");
console.log(JSON.stringify({
  status:"PASS",stage:"DATA-AI29C-FILTER-R4-D-S4",
  currentProdExpectedHold:true,syntheticReviewed12Audited12:true,
  subjectAuthorityIndependentHold:true,negativeTests:invalid.length,
  productionWrites:0,admissionGranted:false,
},null,2));
