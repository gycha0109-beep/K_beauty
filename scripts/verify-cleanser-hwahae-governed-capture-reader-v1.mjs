#!/usr/bin/env node
import assert from "node:assert/strict";
import {buildHwahaeReviewCaptureEnvelope} from "../lib/hwahae-review-capture-provenance.js";
import {materializeGovernedCleanserHwahaeCapture} from "../lib/cleanser-hwahae-governed-capture-reader-v1.mjs";
const PRODUCT="11111111-1111-4111-8111-111111111111";
const SUBJECT="22222222-2222-4222-8222-222222222222";
const SOURCE="33333333-3333-4333-8333-333333333333";
const URL="https://www.hwahae.co.kr/products/246810";
const NOW=new Date("2026-10-22T08:00:00Z");
function fixture(){
  const capture=buildHwahaeReviewCaptureEnvelope({
    productId:PRODUCT,canonicalLocator:URL,observedAt:"2026-10-21T08:00:00.000Z",
    payload:{review_raw:{positive:[{label:"자극없는",count:1}],negative:[]}},
  });
  return {
    now:NOW,
    product:{id:PRODUCT,category:"cleanser",hwahae_url:URL},
    subject:{subject_id:SUBJECT,product_id:PRODUCT,current_state:"current",identity_status:"resolved",market_applicability:"KR"},
    evidenceSources:[{source_id:SOURCE,publisher:"hwahae",source_kind:"product_review_aggregate",
      market:"KR",content_digest:capture.capture_source.content_digest,
      canonical_locator:URL,observed_at:"2026-10-21T08:00:00.000Z",
      external_snapshot_reference:"trusted://frozen-hwahae-capture/246810",
      source_metadata:{capture_envelope:capture}}],
    sourceSubjectBindings:[{source_id:SOURCE,product_id:PRODUCT,subject_id:SUBJECT,
      binding_state:"exact_subject_match",scope_relation:"equivalent"}],
  };
}
const valid=fixture();
const result=materializeGovernedCleanserHwahaeCapture(valid);
assert.ok(result);
assert.equal(result.productId,PRODUCT);
assert.equal(result.capture_source.content_digest,valid.evidenceSources[0].content_digest);
assert.deepEqual(result,materializeGovernedCleanserHwahaeCapture(fixture()));
const invalid=[
  ["absent_source",x=>{x.evidenceSources=[]}],
  ["absent_binding",x=>{x.sourceSubjectBindings=[]}],
  ["secondary_source",x=>{x.evidenceSources[0].publisher="other"}],
  ["wrong_source_kind",x=>{x.evidenceSources[0].source_kind="market_review"}],
  ["foreign_market",x=>{x.evidenceSources[0].market="US"}],
  ["wrong_source_url",x=>{x.evidenceSources[0].canonical_locator="https://www.hwahae.co.kr/products/999999"}],
  ["wrong_digest",x=>{x.evidenceSources[0].content_digest="f".repeat(64)}],
  ["missing_frozen_snapshot",x=>{x.evidenceSources[0].external_snapshot_reference=""}],
  ["missing_envelope",x=>{x.evidenceSources[0].source_metadata={}}],
  ["tampered_review",x=>{x.evidenceSources[0].source_metadata.capture_envelope.raw.review_raw.negative.push({label:"fake",count:1})}],
  ["wrong_subject",x=>{x.sourceSubjectBindings[0].subject_id=PRODUCT}],
  ["wrong_binding_state",x=>{x.sourceSubjectBindings[0].binding_state="ambiguous"}],
  ["wrong_scope",x=>{x.sourceSubjectBindings[0].scope_relation="narrower"}],
  ["historical_subject",x=>{x.subject.current_state="historical"}],
  ["foreign_subject",x=>{x.subject.market_applicability="US"}],
  ["wrong_product",x=>{x.product.hwahae_url="https://www.hwahae.co.kr/products/999999"}],
  ["old_source",x=>{x.evidenceSources[0].observed_at="2025-01-01T08:00:00Z"}],
  ["future_source",x=>{x.evidenceSources[0].observed_at="2027-01-01T08:00:00Z"}],
  ["no_identity",x=>{x.evidenceSources[0].source_metadata.capture_envelope.productId="bad"}],
  ["multiple_sources",x=>{x.evidenceSources.push({...structuredClone(x.evidenceSources[0]),source_id:"44444444-4444-4444-8444-444444444444"});x.sourceSubjectBindings.push({...structuredClone(x.sourceSubjectBindings[0]),source_id:"44444444-4444-4444-8444-444444444444"})}],
  ["wrong_category",x=>{x.product.category="sunscreen"}],
];
for(const [name,mutate] of invalid){
  const x=fixture();mutate(x);
  assert.equal(materializeGovernedCleanserHwahaeCapture(x),null,name);
}
console.log(JSON.stringify({status:"PASS",positiveCases:1,negativeCases:invalid.length,
  contract:"GOVERNED_HWAHAE_EVIDENCE_CAPTURE_ONLY",writes:0,grants:0},null,2));
