#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  evaluateCleanserInitialAdmissionPreflight,
  CLEANSER_ADMISSION_PREFLIGHT_VERSION,
} from "../lib/cleanser-initial-admission-preflight-v1.mjs";
import {buildExistingCleanserTrustBackfillPlan} from "../lib/existing-cleanser-trust-backfill-plan-v1.mjs";
import {evaluateCleanserGovernedAdmissionShadow} from "../lib/cleanser-governed-admission-shadow-v1.mjs";
import {buildHwahaeReviewCaptureEnvelope} from "../lib/hwahae-review-capture-provenance.js";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SUBJECT_ID = "22222222-2222-4222-8222-222222222222";
const BINDING_ID = "33333333-3333-4333-8333-333333333333";
const officialUrl = "https://brand.example/products/cleanser";
const hwahaeUrl = "https://www.hwahae.co.kr/products/246810";
const now = new Date("2026-10-22T05:00:00.000Z");
function fixture() {
  return {
    now,
    product: {
      id: PRODUCT_ID,category:"cleanser",brand:"Test Brand",name:"Cleanser 120ml",
      normalized_brand:"test brand",normalized_name:"cleanser",
      source_url:officialUrl,hwahae_url:hwahaeUrl,size_ml:120,
      skin_types:["combination"],concerns:["dehydration"],
      review_signals:{source:"hwahae_ai_review",positive:[{label:"자극없는",count:1,mapped:["sensitive_safe"]}],negative:[],updated_at:"2026-10-21"},
      market_signals:{source:"hwahae_visible_page",review_count:1,rating:4.2,hwahae_review_page:hwahaeUrl,updated_at:"2026-10-21"},
      ingredient_signals:{source:"hwahae_visible_page",total_ingredients:12,risk:{low:10,medium:1,high:0,unknown:1},skin_type:{oily:{positive:0,negative:0},dry:{positive:1,negative:0},sensitive:{positive:0,negative:1}},updated_at:"2026-10-21"},
    },
    subject:{subject_id:SUBJECT_ID,product_id:PRODUCT_ID,identity_status:"resolved",current_state:"current",market_applicability:"KR",formulation_revision_key:"kr-2026"},
    officialBindings:[{binding_id:BINDING_ID,product_id:PRODUCT_ID,binding_state:"resolved",product_scope_state:"product",source_name:"brand_official",source_url:officialUrl}],
    observations:[{product_id:PRODUCT_ID,subject_id:SUBJECT_ID,source_binding_id:BINDING_ID,canonical_locator:officialUrl,market:"KR",source_kind:"brand_official_product_page",source_content_digest:"a".repeat(64),fetched_at:"2026-10-20T00:00:00Z",product_identity_observation:{product_id:PRODUCT_ID,subject_id:SUBJECT_ID,exact_catalog_product_binding:true,verified_variant_state:"exact",verified_capacity_amount:120,verified_capacity_unit:"ml"}}],
    confirmedFacts:[{
      subject_id:SUBJECT_ID,
      confirmation_id:"44444444-4444-4444-8444-444444444444",
      fact_instance_id:"55555555-5555-4555-8555-555555555555",
      fact_key:"low_ph",
      proposition_key:"a".repeat(64),
      registry_version:"product-fact-registry-cross-category-v1",
      semantic_status:"supported",
      authority_ceiling:"product_specific_primary",
      fused_confidence:"high",
      valid_from:"2026-10-01",
      valid_to:null,
      confirmation:{
        status:"confirmed",
        confirmation_id:"44444444-4444-4444-8444-444444444444",
        fact_instance_id:"55555555-5555-4555-8555-555555555555",
        subject_id:SUBJECT_ID,
        fact_key:"low_ph",
        proposition_key:"a".repeat(64),
        registry_version:"product-fact-registry-cross-category-v1",
        semantic_status:"supported",
        authority_ceiling:"product_specific_primary",
        fused_confidence:"high",
      },
    },{
      subject_id:SUBJECT_ID,
      confirmation_id:"66666666-6666-4666-8666-666666666666",
      fact_instance_id:"77777777-7777-4777-8777-777777777777",
      fact_key:"deep_cleansing",
      proposition_key:"b".repeat(64),
      registry_version:"product-fact-registry-cross-category-v1",
      semantic_status:"supported",
      authority_ceiling:"product_specific_primary",
      fused_confidence:"high",
      valid_from:"2026-10-01",
      valid_to:null,
      confirmation:{
        status:"confirmed",
        confirmation_id:"66666666-6666-4666-8666-666666666666",
        fact_instance_id:"77777777-7777-4777-8777-777777777777",
        subject_id:SUBJECT_ID,
        fact_key:"deep_cleansing",
        proposition_key:"b".repeat(64),
        registry_version:"product-fact-registry-cross-category-v1",
        semantic_status:"supported",
        authority_ceiling:"product_specific_primary",
        fused_confidence:"high",
      },
    }],
    catalogProducts:[],
  };
}
const evaluate = (input) => evaluateCleanserInitialAdmissionPreflight(input);
const good = evaluate(fixture());
assert.equal(good.version,CLEANSER_ADMISSION_PREFLIGHT_VERSION);
assert.equal(good.state,"AUTO_ADMISSION_PREFLIGHT_PASS");
assert.deepEqual(good.blockers,[]);
assert.deepEqual(good.conflicts,[]);
assert.equal(good.reviewConfidence,"limited");
assert.equal(good.admissionGranted,false);
assert.equal(good.recommendationRuntimeActivated,false);
assert.equal(good.requiresGovernedInitialAdmissionGrant,true);
const highReview=fixture();highReview.product.market_signals.review_count=3000;
assert.equal(evaluate(highReview).reviewConfidence,"standard");
const noReview=fixture();noReview.product.review_signals.positive=[];noReview.product.market_signals.review_count=0;
assert.equal(evaluate(noReview).state,"AUTO_ADMISSION_PREFLIGHT_PASS","few reviews must not force rejection");
const gram=fixture();gram.product.name="Pack Cleanser 130g";gram.product.size_ml=null;
gram.observations[0].product_identity_observation.verified_capacity_amount=130;
gram.observations[0].product_identity_observation.verified_capacity_unit="g";
assert.equal(evaluate(gram).state,"AUTO_ADMISSION_PREFLIGHT_PASS","grams must never convert to ml");

const cases = [
  ["missing_subject",x=>{x.subject=null},"CURRENT_EXACT_SUBJECT_REQUIRED"],
  ["wrong_subject",x=>{x.subject.product_id="66666666-6666-4666-8666-666666666666"},"CURRENT_EXACT_SUBJECT_REQUIRED"],
  ["retired_binding",x=>{x.officialBindings[0].binding_state="retired"},"RESOLVED_OFFICIAL_SOURCE_BINDING_REQUIRED"],
  ["retailer_binding",x=>{x.officialBindings[0].source_name="oliveyoung"},"RESOLVED_OFFICIAL_SOURCE_BINDING_REQUIRED"],
  ["wrong_observation_binding",x=>{x.observations[0].source_binding_id="77777777-7777-4777-8777-777777777777"},"CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED"],
  ["wrong_market",x=>{x.observations[0].market="US"},"CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED"],
  ["stale_fetch",x=>{x.observations[0].fetched_at="2025-01-01T00:00:00Z"},"CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED"],
  ["fake_digest",x=>{x.observations[0].source_content_digest="not-a-sha"},"CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED"],
  ["wrong_variant",x=>{x.observations[0].product_identity_observation.verified_variant_state="unknown"},"VERIFIED_EXACT_CAPACITY_REQUIRED"],
  ["wrong_ml",x=>{x.observations[0].product_identity_observation.verified_capacity_amount=200},"VERIFIED_EXACT_CAPACITY_REQUIRED"],
  ["missing_hwahae",x=>{x.product.hwahae_url=null},"HWAHAE_PRODUCT_CAPTURE_BINDING_REQUIRED"],
  ["captured_different_item",x=>{x.product.market_signals.hwahae_review_page="https://www.hwahae.co.kr/products/987654"},"HWAHAE_PRODUCT_CAPTURE_BINDING_REQUIRED"],
  ["unsafe_hwahae",x=>{x.product.hwahae_url="http://www.hwahae.co.kr/products/246810"},"HWAHAE_PRODUCT_CAPTURE_BINDING_REQUIRED"],
  ["fake_hwahae",x=>{x.product.hwahae_url="https://fake.example/products/246810";x.product.market_signals.hwahae_review_page=x.product.hwahae_url},"HWAHAE_PRODUCT_CAPTURE_BINDING_REQUIRED"],
  ["invalid_rating",x=>{x.product.market_signals.rating=6},"CURRENT_MARKET_SIGNALS_REQUIRED"],
  ["fake_review",x=>{x.product.review_signals.source="unknown"},"CURRENT_REVIEW_SIGNALS_REQUIRED"],
  ["stale_review",x=>{x.product.review_signals.updated_at="2025-01-01"},"CURRENT_REVIEW_SIGNALS_REQUIRED"],
  ["invalid_risk_total",x=>{x.product.ingredient_signals.risk.low=9},"VALID_CURRENT_INGREDIENT_SIGNALS_REQUIRED"],
  ["negative_risk",x=>{x.product.ingredient_signals.risk.high=-1},"VALID_CURRENT_INGREDIENT_SIGNALS_REQUIRED"],
  ["stale_ingredients",x=>{x.product.ingredient_signals.updated_at="2025-01-01"},"VALID_CURRENT_INGREDIENT_SIGNALS_REQUIRED"],
  ["missing_skin",x=>{x.product.skin_types=null},"VERIFIED_RECOMMENDATION_SEMANTICS_REQUIRED"],
  ["missing_concerns",x=>{x.product.concerns=[]},"VERIFIED_RECOMMENDATION_SEMANTICS_REQUIRED"],
  ["missing_current_fact",x=>{x.confirmedFacts=[]},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["missing_low_ph",x=>{x.confirmedFacts=x.confirmedFacts.filter(f=>f.fact_key!=="low_ph")},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["missing_deep_cleansing",x=>{x.confirmedFacts=x.confirmedFacts.filter(f=>f.fact_key!=="deep_cleansing")},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["unconfirmed_current_fact",x=>{x.confirmedFacts[0].confirmation.status="pending"},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["untrusted_fact_authority",x=>{x.confirmedFacts[0].authority_ceiling="review_only"},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["wrong_fact_binding",x=>{x.confirmedFacts[0].confirmation.fact_instance_id="66666666-6666-4666-8666-666666666666"},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["stale_fact",x=>{x.confirmedFacts[0].valid_to="2026-10-20"},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["irrelevant_fact",x=>{x.confirmedFacts[0].fact_key="spf_value";x.confirmedFacts[0].confirmation.fact_key="spf_value"},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["untrusted_registry",x=>{x.confirmedFacts[0].registry_version="unreviewed-registry";x.confirmedFacts[0].confirmation.registry_version="unreviewed-registry"},"GOVERNED_CURRENT_FACT_REQUIRED"],
  ["bad_category",x=>{x.product.category="sunscreen"},"CANONICAL_PRODUCT_INVALID"],
];
for(const [name,mutate,expected] of cases){
  const x=fixture();mutate(x);const result=evaluate(x);
  assert.notEqual(result.state,"AUTO_ADMISSION_PREFLIGHT_PASS",name);
  assert.ok(result.blockers.includes(expected),name+" missing "+expected);
  assert.equal(result.admissionGranted,false,name);
}
const alternateOfficial=fixture();alternateOfficial.officialBindings[0].source_name="lagom_official";
assert.equal(evaluate(alternateOfficial).state,"AUTO_ADMISSION_PREFLIGHT_PASS");
const duplicate=fixture();duplicate.catalogProducts.push({
  id:"88888888-8888-4888-8888-888888888888",
  normalized_brand:"Test Brand",normalized_name:"cleanser"
});
const duplicateResult=evaluate(duplicate);
assert.equal(duplicateResult.state,"MANUAL_REVIEW_REQUIRED");
assert.deepEqual(duplicateResult.conflicts,["CANONICAL_DUPLICATE_OR_VARIANT_COLLISION"]);
assert.deepEqual(evaluate(fixture()),good);
const readyPlan = buildExistingCleanserTrustBackfillPlan(fixture().product,good);
assert.equal(readyPlan.tasks.length,0);
assert.equal(readyPlan.nextTask,"EXTEND_GOVERNED_CLEANSER_G2_INITIAL_ADMISSION");
assert.equal(readyPlan.recommendationAdmissionGranted,false);
assert.equal(readyPlan.runtimeCutover,false);
const incomplete=fixture();
incomplete.subject=null;
incomplete.officialBindings=[];
incomplete.observations=[];
incomplete.confirmedFacts=[];
incomplete.product.review_signals=null;
incomplete.product.ingredient_signals={};
incomplete.product.market_signals={};
incomplete.product.hwahae_url=null;
incomplete.product.skin_types=null;
incomplete.product.concerns=null;
const plan=buildExistingCleanserTrustBackfillPlan(incomplete.product,evaluate(incomplete));
assert.equal(plan.sourceUrlClassification,"OFFICIAL_SOURCE_CANDIDATE_UNVERIFIED");
assert.equal(plan.researchLocatorCandidate,officialUrl);
assert.deepEqual(plan.tasks.map(x=>x.code),[
  "VALIDATE_OFFICIAL_PRODUCT_SOURCE",
  "RESOLVE_EXISTING_PRODUCT_SUBJECT",
  "CAPTURE_EXACT_OFFICIAL_VARIANT",
  "LINK_AND_REVALIDATE_HWAHAE_CAPTURE",
  "ESTABLISH_RECOMMENDATION_SEMANTICS",
  "CONFIRM_GOVERNED_CLEANSER_FACT"
]);
assert.equal(plan.productionWrites,0);
assert.equal(plan.recommendationAdmissionGranted,false);
const retailer=structuredClone(incomplete);
retailer.product.source_url="https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=TEST";
const retailPlan=buildExistingCleanserTrustBackfillPlan(retailer.product,evaluate(retailer));
assert.equal(retailPlan.sourceUrlClassification,"RETAILER_OR_SECONDARY");
assert.equal(retailPlan.researchLocatorCandidate,null);
const collided=buildExistingCleanserTrustBackfillPlan(duplicate.product,duplicateResult);
assert.equal(collided.nextTask,"RECONCILE_CANONICAL_IDENTITY");
assert.equal(collided.automaticConfirmation,false);
assert.throws(()=>buildExistingCleanserTrustBackfillPlan({},good),/INVALID_INPUT/);
const shadowDefault=evaluateCleanserGovernedAdmissionShadow(fixture(),{now});
assert.equal(shadowDefault.shadowEligible,false,"bare preflight must NOT auto grant");
assert.ok(shadowDefault.reasons.includes("GOVERNED_RECOMMENDATION_METADATA_REQUIRED:skin_types"));
assert.ok(shadowDefault.reasons.includes("VERIFIED_HWAHAE_CAPTURE_ENVELOPE_REQUIRED"));
assert.ok(shadowDefault.reasons.includes("CURRENT_SUBJECT_ATTESTATION_REQUIRED"));
const shadowInput=fixture();
shadowInput.hwahaeCaptureEnvelope=buildHwahaeReviewCaptureEnvelope({
  productId:PRODUCT_ID,
  canonicalLocator:hwahaeUrl,
  observedAt:"2026-10-21T00:00:00Z",
  payload:{review_raw:{positive:[{label:"자극없는",count:1}],negative:[]}},
});
shadowInput.subjectScopeAttestation={
  product_id:PRODUCT_ID,subject_id:SUBJECT_ID,current_state:"current",
  identity_status:"resolved",market:"KR",evidence_digest:"c".repeat(64),
  authority:"governed_exact_subject_identity",
};
const reviewedAt="2026-10-21T00:00:00Z";
shadowInput.metadataReviews=["skin_types","concerns"].map((field)=>({
  product_id:PRODUCT_ID,field_name:field,field_value:JSON.stringify(shadowInput.product[field]),
  review_state:"confirmed",confidence:"high",
  reviewed_by:"88888888-8888-4888-8888-888888888888",reviewed_at:reviewedAt,
  evidence_digest:"d".repeat(64),evidence_refs:["https://brand.example/products/cleanser"],
  evidence_records:[{product_id:PRODUCT_ID,source_authority:"product_specific_primary",
    content_digest:"a".repeat(64),official_source_url:"https://brand.example/products/cleanser"}],
}));
const shadowPositive=evaluateCleanserGovernedAdmissionShadow(shadowInput,{now});
assert.equal(shadowPositive.shadowEligible,true);
assert.equal(shadowPositive.decision,"SHADOW_ELIGIBLE_FOR_INITIAL_ADMISSION");
assert.deepEqual(shadowPositive.reasons,[]);
assert.equal(shadowPositive.actualAdmissionGranted,false);
assert.equal(shadowPositive.governedG2GrantIssued,false);
assert.equal(shadowPositive.liveRankingChanged,false);
const corruptedShadow=structuredClone(shadowInput);
corruptedShadow.metadataReviews[0].field_value=JSON.stringify(["oily"]);
assert.equal(evaluateCleanserGovernedAdmissionShadow(corruptedShadow,{now}).shadowEligible,false);
const wrongCapture=structuredClone(shadowInput);
wrongCapture.hwahaeCaptureEnvelope.raw.review_raw.positive.push({label:"fake",count:1000});
assert.ok(evaluateCleanserGovernedAdmissionShadow(wrongCapture,{now}).reasons.includes("VERIFIED_HWAHAE_CAPTURE_ENVELOPE_REQUIRED"));
const wrongEvidenceLineage=structuredClone(shadowInput);
wrongEvidenceLineage.metadataReviews[0].evidence_records[0].content_digest="f".repeat(64);
assert.ok(evaluateCleanserGovernedAdmissionShadow(wrongEvidenceLineage,{now}).reasons.includes("GOVERNED_RECOMMENDATION_METADATA_REQUIRED:skin_types"));
const wrongSubject=structuredClone(shadowInput);
wrongSubject.subjectScopeAttestation.subject_id="99999999-9999-4999-8999-999999999999";
assert.ok(evaluateCleanserGovernedAdmissionShadow(wrongSubject,{now}).reasons.includes("CURRENT_SUBJECT_ATTESTATION_REQUIRED"));

console.log(JSON.stringify({
  status:"PASS",version:CLEANSER_ADMISSION_PREFLIGHT_VERSION,
  adversarialCases:cases.length+1,validLowReview:true,validGrams:true,
  grantAuthorityUntouched:true,dbWrites:0,productionCutover:false
},null,2));
