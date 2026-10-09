#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUSHMAN_SEMANTIC_REVIEW_FIELDS,
  BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET,
  evaluateBushmanSemanticReviewReadiness,
  isBushmanSemanticReviewRequestId,
} from "../lib/admin/bushman-sunscreen-semantic-review-contract.mjs";

const s2 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s2-bushman-web-review-evidence-v1.json", "utf8",
));
const template = {
  productId: BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.productId,
  subjectId: BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.subjectId,
  subjectCount: 1,
  contractVersion: "sunscreen-recommendation-semantic-bundle-v1",
  fields: Object.fromEntries(BUSHMAN_SEMANTIC_REVIEW_FIELDS.map(
    name => [name,{state:"not_reviewed",reviewId:null,value:null,confidence:"unknown"}],
  )),
};
for (const name of BUSHMAN_SEMANTIC_REVIEW_FIELDS) {
  const result=evaluateBushmanSemanticReviewReadiness(s2,template,name);
  assert.equal(result.status,"ready",name);
  assert.equal(result.payload.field_name,name);
  assert.deepEqual(Object.keys(result.payload).sort(),
    ["product_id","subject_id","field_name","review_state","field_value",
     "confidence","evidence_records","supersedes_review_id"].sort());
  assert.equal(result.payload.supersedes_review_id,null);
}
const sampleId="data-ai29c-r4ds3-eye_sting-123e4567-e89b-42d3-a456-426614174000";
assert.equal(isBushmanSemanticReviewRequestId(sampleId,"eye_sting"),true);
assert.equal(isBushmanSemanticReviewRequestId(sampleId,"white_cast"),false);
assert.equal(isBushmanSemanticReviewRequestId("garbage","eye_sting"),false);

const cases=[
["unknown_field",(e,l)=>{},"FIELD_NOT_IN_S2_SCOPE","__unsafe__"],
["wrong_product",(e,l)=>{l.productId="wrong"},"LIVE_EXACT_SUBJECT_MISMATCH","category_slot"],
["wrong_subject",(e,l)=>{l.subjectId="wrong"},"LIVE_EXACT_SUBJECT_MISMATCH","category_slot"],
["two_subjects",(e,l)=>{l.subjectCount=2},"LIVE_EXACT_SUBJECT_MISMATCH","category_slot"],
["missing_field",(e,l)=>{delete l.fields.white_cast},"LIVE_FIELD_SET_MISMATCH","category_slot"],
["already_reviewed",(e,l)=>{l.fields.eye_sting={state:"reviewed_not_established",reviewId:"some-id"}},"CURRENT_FIELD_ALREADY_REVIEWED_RECHECK_REQUIRED","eye_sting"],
["unreviewed_but_review_id",(e,l)=>{l.fields.eye_sting.reviewId="some-id"},"CURRENT_FIELD_ALREADY_REVIEWED_RECHECK_REQUIRED","eye_sting"],
["fake_signed_equivalence",(e,l)=>{e.independence.manufacturerSignedSkuEquivalence=true},"FROZEN_S2_EVIDENCE_MISMATCH","category_slot"],
["fake_prod_write",(e,l)=>{e.execution.productionWrites=12},"FROZEN_S2_EVIDENCE_MISMATCH","category_slot"],
["false_source_stage",(e,l)=>{e.decision="APPROVED"},"FROZEN_S2_EVIDENCE_MISMATCH","category_slot"],
["extra_record",(e,l)=>{e.rpcPayloadPreview[0].reviewer_id="fake"},"S2_PAYLOAD_CONTRACT_MISMATCH","category_slot"],
["change_core_fact",(e,l)=>{e.rpcPayloadPreview.find(p=>p.field_name==="uv_filter_type").field_value="organic"},"S2_PAYLOAD_CONTRACT_MISMATCH","uv_filter_type"],
["fake_toneup_false",(e,l)=>{e.rpcPayloadPreview.find(p=>p.field_name==="tone_up").field_value=false},"S2_PAYLOAD_CONTRACT_MISMATCH","tone_up"],
["false_white_cast_none",(e,l)=>{e.rpcPayloadPreview.find(p=>p.field_name==="white_cast").review_state="established"},"S2_PAYLOAD_CONTRACT_MISMATCH","white_cast"],
["wrong_source_scheme",(e,l)=>{e.rpcPayloadPreview.find(p=>p.field_name==="eye_sting").evidence_records[0].source_ref="http://insecure.test"},"S2_PAYLOAD_CONTRACT_MISMATCH","eye_sting"],
["wrong_category_evidence",(e,l)=>{e.rpcPayloadPreview.find(p=>p.field_name==="category_slot").evidence_records[0].source_type="official_product_page"},"S2_PAYLOAD_CONTRACT_MISMATCH","category_slot"],
["wrong_uv_evidence",(e,l)=>{e.rpcPayloadPreview.find(p=>p.field_name==="uv_filter_type").evidence_records[0].source_type="official_product_page"},"S2_PAYLOAD_CONTRACT_MISMATCH","uv_filter_type"],
];
for(const [name,mutate,expected,fieldName] of cases) {
  const evidence=structuredClone(s2), live=structuredClone(template);
  mutate(evidence,live);
  const actual=evaluateBushmanSemanticReviewReadiness(evidence,live,fieldName);
  assert.equal(actual.status,"hold",name);
  assert.equal(actual.reason,expected,name);
  assert.equal(actual.payload,null,name);
}
const route=fs.readFileSync("app/api/admin/products/bushman-semantic-review/confirm/route.js","utf8");
const service=fs.readFileSync("lib/admin/bushman-sunscreen-semantic-review.js","utf8");
const page=fs.readFileSync("app/admin/products/bushman-semantic-review/page.js","utf8");
const ui=fs.readFileSync("app/admin/products/bushman-semantic-review/BushmanSemanticReviewWorkbench.js","utf8");
for(const token of [
  "isAllowedAdminMutationRequest(request)",
  "requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW)",
  "actorUserId: access.userId",
  "Object.keys(body).sort()",
])assert.ok(route.includes(token),"missing required route protection: "+token);
for(const token of [
  "createSupabaseAdminClient",
  "read_sunscreen_recommendation_semantic_bundle_v1",
  "evaluateBushmanSemanticReviewReadiness(s2Evidence, live, fieldName)",
  "admin_register_sunscreen_recommendation_semantic_field_v1",
  "p_actor_user_id: actorUserId",
])assert.ok(service.includes(token),"missing bound server side behavior: "+token);
assert.ok(page.includes("requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW)"));
assert.ok(ui.includes("window.confirm("));
assert.ok(ui.includes("fieldName: field.name"));
assert.ok(!route.includes("body.actorUserId"),"client may never supply reviewer identity");
assert.ok(!service.includes("for (const fieldName"),"no implicit 12-field bulk write");
console.log(JSON.stringify({
  status:"PASS",stage:"DATA-AI29C-FILTER-R4-D-S3",
  exactUnreviewedFieldPreflights:BUSHMAN_SEMANTIC_REVIEW_FIELDS.length,
  negativeCases:cases.length,
  adminSessionBound:true,explicitPerFieldConfirmation:true,
  adminActorForged:false,productionWrites:0,subjectAuthorityUpgraded:false,
},null,2));
