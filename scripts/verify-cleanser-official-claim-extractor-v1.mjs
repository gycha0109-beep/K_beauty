#!/usr/bin/env node
import assert from "node:assert/strict";
import {extractStrictFactCandidate} from "./trust-research-worker.mjs";
import {inspectOfficialProductSemanticSurfacesV1} from "../lib/trust/official-source-semantic-adapter.mjs";
import {extractStrictCleanserOfficialClaim,CLEANSER_OFFICIAL_CLAIM_EXTRACTOR_VERSION}
  from "../lib/trust/cleanser-official-claim-extractor-v1.mjs";

const makeDoc=(title,meta="",og="")=>({
  document:{
    title,meta_title:null,og_title:og||null,
    meta_description:meta||null,og_description:null,
  },
});
const extract=(factKey,surfaces,noise="")=>
  extractStrictFactCandidate(factKey,noise,[],{semanticSurfaces:surfaces});
const examples=[
  {name:"low_ph_true_product_heading",fact:"low_ph",
   doc:makeDoc("닥터지 약산성 클렌징 젤 폼 200mL"),expected:true},
  {name:"low_ph_true_english_heading",fact:"low_ph",
   doc:makeDoc("Gentle Low-pH Cleansing Foam 200ml"),expected:true},
  {name:"low_ph_false_tied_description",fact:"low_ph",
   doc:makeDoc("마녀공장 퓨어 소이빈 클렌징 폼 160ml","숨은 노폐물까지 세정하는 약알칼리성 클렌징 폼"),expected:false},
  {name:"low_ph_false_english_claim",fact:"low_ph",
   doc:makeDoc("Gentle Cleansing Foam 160ml","Alkaline cleansing foam, removing impurities"),expected:false},
  {name:"deep_cleansing_true_heading",fact:"deep_cleansing",
   doc:makeDoc("라로슈포제 에빠끌라 딥 클렌징 포밍 크림 125ml"),expected:true},
  {name:"deep_cleansing_true_english",fact:"deep_cleansing",
   doc:makeDoc("Deep-cleansing face wash 125ml"),expected:true},
  {name:"deep_cleansing_tied_description",fact:"deep_cleansing",
   doc:makeDoc("블랑네이처 아크네 클렌징 폼 150ml",
     "피지 정돈을 위한 딥 클렌징 포뮬러 클렌징 폼"),expected:true},
];
for(const item of examples){
  const out=extract(item.fact,item.doc);
  assert.ok(out,item.name);
  assert.equal(out.normalizedValue,item.expected,item.name);
  assert.equal(out.evidenceClass,"product_claim",item.name);
  assert.equal(out.qualifier.claim_scope,"official_product_heading_or_tied_description",item.name);
  assert.equal(out.observedClaim.extractor,CLEANSER_OFFICIAL_CLAIM_EXTRACTOR_VERSION,item.name);
  assert.equal(out.observedClaim.measurementProven,false,item.name);
  assert.equal(out.observedClaim.productFactConfirmed,false,item.name);
}

const none=[
  ["review_body_false_not_source", "low_ph",makeDoc("클렌저 리뷰 전체"),"이 제품은 약산성입니다."],
  ["generic_homepage_false", "low_ph",makeDoc("마녀공장 공식몰"),"약산성 클렌징 폼"],
  ["ingredient_inference_blocked", "low_ph",makeDoc("휩드 머그트리 비건 팩클렌저 130g"),"시트릭애씨드 함유"],
  ["low_ph_from_care_claim_blocked","low_ph",makeDoc("제로이드 포밍 클렌저 240ml",
    "민감 피부를 위한 저자극 보습 세정제"),""],
  ["pH_balanced_not_low_pH","low_ph",makeDoc("Foaming Cleanser 240ml",
    "pH-balanced foaming cleanser"),""],
  ["neutral_ph_not_low","low_ph",makeDoc("Neutral pH cleansing foam 200ml"),""],
  ["unrelated_meta_not_tied","low_ph",makeDoc("공식몰",
    "약산성 폼 클렌저 200ml"),""],
  ["nonproduct_headline","low_ph",makeDoc("약산성 스킨케어 가이드"),""],
  ["comparative_page","low_ph",makeDoc("약산성 클렌저 TOP 10 추천 비교"),""],
  ["review_overrides_heading","deep_cleansing",makeDoc("Gentle Foaming Cleanser 130g"),
    "딥 클렌징은 피부에 자극적이었어요"],
  ["generic_cleansing_not_deep","deep_cleansing",makeDoc("휩드 무화버터 비건 팩클렌저 130g",
    "세정력이 좋은 팩클렌저"),""],
  ["generic_sunscreen_removal_not_deep","deep_cleansing",makeDoc("휩드 유자몽 비건 팩클렌저 130g",
    "선크림 세정력 98%"),""],
  ["missing_product_scope","deep_cleansing",makeDoc("딥클렌징 가이드"),""],
  ["negated_deep","deep_cleansing",makeDoc("딥클렌징 아닌 저자극 클렌징 폼"),""],
  ["unsupported_field","not_in_registry",makeDoc("딥 클렌징 폼 130g"),""],
  ["body_without_metadata","low_ph",{}, "약산성 포밍 클렌저"],
];
for(const [name,fact,doc,noise] of none){
  assert.equal(extract(fact,doc,noise),null,name);
}
const conflict=makeDoc("약산성 클렌징 폼 200ml",
  "약알칼리성 클렌징 폼");
assert.equal(extract("low_ph",conflict),null,"contradictory source surfaces must hold");
const within=makeDoc("약산성과 약알칼리성을 비교하는 클렌징 폼 200ml");
assert.equal(extract("low_ph",within),null,"dual pH claim must hold");
const html=Buffer.from(
  "<html><head><title>닥터지 약산성 클렌징 젤 폼 200mL</title>"+
  '<meta name="description" content="민감 피부를 위한 약산성 클렌징 젤 폼">'+
  "</head><body><h2>추천 상품: 약알칼리성 딥 클렌징 폼</h2></body></html>"
);
const fromHtml=inspectOfficialProductSemanticSurfacesV1(html);
const parsed=extract("low_ph",fromHtml,
  "추천 상품: 약알칼리성 딥 클렌징 폼");
assert.equal(parsed?.normalizedValue,true,"unrelated body must not override product metadata");
assert.equal(extract("deep_cleansing",fromHtml,
  "추천 상품: 딥 클렌징 포밍 크림"),null,"unrelated deep-cleansing card blocked");
assert.equal(extractStrictCleanserOfficialClaim("low_ph",null),null);

console.log(JSON.stringify({
  status:"PASS",version:CLEANSER_OFFICIAL_CLAIM_EXTRACTOR_VERSION,
  positiveCases:examples.length,negativeCases:none.length+4,
  workerIntegrated:true,sourceScope:"PRODUCT_HEADING_AND_TIED_METADATA_ONLY",
  factsConfirmed:0,recommendationGrants:0,dbWrites:0,
},null,2));
