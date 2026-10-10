#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AUTOMATIC_PRODUCT_EVIDENCE_EVALUATOR_VERSION,
  AUTOMATIC_SUNSCREEN_FIELD_NAMES,
  evaluateAutomaticProductEvidence,
} from "../lib/product-intelligence/automatic-product-evidence-evaluator-v1.mjs";
import {
  buildBushmanOfflineEvaluationInput,
} from "../lib/product-intelligence/bushman-automatic-evaluation-offline-pilot-v1.mjs";
import {
  BUSHMAN_SEMANTIC_REVIEW_FIELDS,
} from "../lib/admin/bushman-sunscreen-semantic-review-contract.mjs";

const frozen = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s2-bushman-web-review-evidence-v1.json", "utf8"));
const input = buildBushmanOfflineEvaluationInput(frozen);
const evaluate = x => evaluateAutomaticProductEvidence(x);
const baseline = evaluate(input);

assert.equal(baseline.version,AUTOMATIC_PRODUCT_EVIDENCE_EVALUATOR_VERSION);
assert.deepEqual([...AUTOMATIC_SUNSCREEN_FIELD_NAMES].sort(),[...BUSHMAN_SEMANTIC_REVIEW_FIELDS].sort());
assert.equal(Object.keys(baseline.fields).length,12);
assert.equal(baseline.fields.category_slot.status,"verified_fact");
assert.equal(baseline.fields.category_slot.value,"sunscreen");
assert.equal(baseline.fields.uv_filter_type.status,"verified_fact");
assert.equal(baseline.fields.uv_filter_type.value,"hybrid");
assert.equal(Object.values(baseline.fields).filter(x=>x.status==="verified_fact").length,2);
assert.equal(Object.values(baseline.fields).filter(x=>x.status==="review_signal").length,7);
assert.equal(Object.values(baseline.fields).filter(x=>x.status==="insufficient").length,3);
for(const field of ["skin_types","concerns","tone_up"]) {
  assert.equal(baseline.fields[field].value,null);
  assert.equal(baseline.fields[field].status,"insufficient");
}
for(const field of ["white_cast","eye_sting","irritation_risk","sensitivity_safe","finish","texture"]) {
  assert.equal(baseline.fields[field].trend,"mixed");
  assert.equal(baseline.fields[field].value,null);
  assert.equal(baseline.fields[field].status,"review_signal");
}
assert.equal(baseline.fields.pilling_risk.trend,"unfavorable_signal");
assert.equal(baseline.fields.white_cast.claims[0].statement,"백탁현상방지");
assert.equal(baseline.fields.sensitivity_safe.claims[0].statement,"저자극");
assert.equal(baseline.fields.white_cast.incidenceEstimated,false);
assert.equal(baseline.evidenceReady,true);
assert.equal(baseline.operatorReviewsRequired,0);
assert.deepEqual(baseline.exceptions,[]);
assert.equal(baseline.adminReviewsCreated,0);
assert.equal(baseline.admissionGranted,false);
assert.equal(baseline.productionWrites,0);
assert.equal(baseline.rankingChanged,false);

const reversed = structuredClone(input);
reversed.verifiedFacts.reverse();
reversed.manufacturerClaims.reverse();
reversed.reviewObservations.reverse();
assert.deepEqual(evaluate(reversed),baseline,"input reordering must not affect deterministic result");
const repeats=structuredClone(input);
repeats.reviewObservations.push(structuredClone(repeats.reviewObservations[0]));
repeats.manufacturerClaims.push(structuredClone(repeats.manufacturerClaims[0]));
assert.deepEqual(evaluate(repeats),baseline,"duplicate source claims and signals must not inflate evidence");

const caution=evaluateAutomaticProductEvidence(input,{
  whiteCastRelevant:true,eyeStingRelevant:true,sensitivityRelevant:true,pillingRelevant:true,
});
assert.deepEqual([...caution.contextCautions].sort(),
  ["whiteCastRelevant","eyeStingRelevant","sensitivityRelevant","pillingRelevant"].sort());
assert.equal(caution.admissionGranted,false);
const normal=evaluateAutomaticProductEvidence(input,{});
assert.deepEqual(normal.contextCautions,[]);

const missing=structuredClone(input);
missing.verifiedFacts=missing.verifiedFacts.filter(f=>f.field!=="uv_filter_type");
const missingResult=evaluate(missing);
assert.equal(missingResult.evidenceReady,false);
assert.equal(missingResult.fields.uv_filter_type.value,null);
assert.ok(missingResult.researchNeeds.includes("uv_filter_type"));
assert.equal(missingResult.operatorReviewsRequired,0);
assert.equal(missingResult.admissionGranted,false);

const factConflict=structuredClone(input);
factConflict.verifiedFacts.push({
  ...factConflict.verifiedFacts.find(f=>f.field==="uv_filter_type"),
  sourceRef:"db:product_fact_current:alternate",
  value:"mineral",
});
const conflicting=evaluate(factConflict);
assert.equal(conflicting.evidenceReady,false);
assert.equal(conflicting.fields.uv_filter_type.value,null);
assert.equal(conflicting.operatorReviewsRequired,1);
assert.deepEqual(conflicting.exceptions,[{
  code:"AUTHORITATIVE_FACT_CONFLICT",field:"uv_filter_type",
}]);
assert.equal(conflicting.adminReviewsCreated,0);

const cross=structuredClone(input);
cross.reviewObservations[0].subjectId="11111111-1111-4111-8111-111111111111";
const crossResult=evaluate(cross);
assert.equal(crossResult.evidenceReady,false);
assert.ok(crossResult.exceptions.some(x=>x.code==="EVIDENCE_IDENTITY_SCOPE_MISMATCH"));
const subjectChanged=structuredClone(input);
subjectChanged.subject.currentState="historical";
const historical=evaluate(subjectChanged);
assert.equal(historical.evidenceReady,false);
assert.ok(historical.exceptions.some(x=>x.code==="SUBJECT_IDENTITY_UNRESOLVED"));

const invalid=[
  ["unsupported_category",x=>{x.category="cleanser"}],
  ["unknown_field",x=>{x.reviewObservations[0].field="completely_fake"}],
  ["unvalidated_fact",x=>{x.verifiedFacts[0].confirmed=false}],
  ["wrong_authority_kind",x=>{x.verifiedFacts[0].sourceKind="official_product_page"}],
  ["wrong_fact_source",x=>{x.verifiedFacts[0].sourceRef="https://example.com/product"}],
  ["unregulated_fact",x=>{x.verifiedFacts[0].field="sensitivity_safe"}],
  ["fake_negative",x=>{x.verifiedFacts[0].value=false}],
  ["wrong_catalog_category",x=>{x.verifiedFacts[0].value="serum"}],
  ["invalid_uv_filter",x=>{x.verifiedFacts[1].value="whatever"}],
  ["forged_review_direction",x=>{x.reviewObservations[0].direction="no_risk"}],
  ["insecure_review_source",x=>{x.reviewObservations[0].sourceRef="http://example.com"}],
  ["forged_claim_source",x=>{x.manufacturerClaims[0].sourceRef="javascript:alert(1)"}],
  ["invalid_review_mentions",x=>{x.reviewObservations[0].mentionCount=-12}],
];
for(const [name,mutate] of invalid) {
  const modified=structuredClone(input);
  mutate(modified);
  assert.throws(()=>evaluate(modified),TypeError,name);
}

const styleDoc=fs.readFileSync("docs/architecture/automatic-product-evidence-evaluation-exception-first-v1.md","utf8");
assert.ok(styleDoc.includes("자동 평가와 승인 권한 구분"));
assert.ok(styleDoc.includes("관리자"));
assert.ok(styleDoc.includes("Production DB 신규 쓰기 0건"));
assert.equal(styleDoc.includes("商品"),false);
const oldPolicy=fs.readFileSync("lib/sunscreen-recommendation-semantic-projection.mjs","utf8");
assert.ok(oldPolicy.includes("allReviewed && coreEstablished"),"legacy projection untouched");
console.log(JSON.stringify({
  status:"PASS",
  stage:"AUTOMATIC_EVIDENCE_EVALUATOR_V1",
  fields:12,verifiedFacts:2,reviewTrends:7,insufficient:3,
  operatorEscalationsForMixedReviews:0,
  severeConflictEscalations:1,
  negativeTests:invalid.length,
  producerAuthority:"OFFLINE_ONLY",
  productionWrites:0,adminApprovalsForged:0,
  rankingChanged:false,
},null,2));
