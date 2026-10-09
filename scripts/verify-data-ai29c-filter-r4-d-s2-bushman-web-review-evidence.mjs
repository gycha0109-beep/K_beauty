#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateSunscreenSemanticEnvelope,
  evaluateSunscreenSemanticScoringEligibility,
  projectEstablishedSunscreenSemantics,
} from "../lib/sunscreen-recommendation-semantic-projection.mjs";
import { BUSHMAN_MIXED_REGISTRY_TARGET } from "../lib/sunscreen-mixed-registry-admission-compatibility-contract.mjs";

const data = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s2-bushman-web-review-evidence-v1.json", "utf8"));
const s1 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s1-bushman-semantic-review-proposal-v1.json", "utf8"));

const FIELD_NAMES = Object.freeze([
  "category_slot", "skin_types", "concerns", "texture", "finish", "uv_filter_type",
  "sensitivity_safe", "irritation_risk", "tone_up", "white_cast", "eye_sting", "pilling_risk",
]);
const CORE = Object.freeze({category_slot:"sunscreen",uv_filter_type:"hybrid"});
const FIRST_PARTY = "https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/";
const HW = "https://www.hwahae.com/en/products/BUSHMAN-Waterproof-Pro-Suncream-SPF50PLUS-PAPLUS-PLUS-PLUS-PLUS/1884027/reviews";
const ALLOWED_EVIDENCE_TYPES = new Set([
  "canonical_taxonomy", "product_fact_current", "official_product_page",
  "hwahae_review_signal", "hwahae_review_sample",
]);
const sourceToType = {GOVERNED_UV_FACT:"product_fact_current"};

function issues(x) {
  const fail=[];
  const scope=x.scope??{}, prev=x.predecessor??{}, ind=x.independence??{}, ex=x.execution??{};
  if(x.stage!=="DATA-AI29C-FILTER-R4-D-S2" ||
     x.decision!=="WEB_REVIEW_EVIDENCE_CROSSCHECK_COMPLETE_ADMIN_REVIEW_NOT_EXECUTED" ||
     prev.s1MergeSha!=="6051434dd47428bb3574010fe942dc6d9a2cf8f0" ||
     prev.s1Established!==3 || prev.s1Unresolved!==9) fail.push("STAGE_OR_PREDECESSOR");
  if(scope.productId!==BUSHMAN_MIXED_REGISTRY_TARGET.productId ||
     scope.subjectId!==BUSHMAN_MIXED_REGISTRY_TARGET.subjectId ||
     scope.formulationRevisionKey!==BUSHMAN_MIXED_REGISTRY_TARGET.formulationRevisionKey ||
     scope.ownerDecision!=="50g/50ml same product for internal review only") fail.push("EXACT_IDENTITY_SCOPE");
  const trueKeys=["ownerAssumesSameProductForInternalCatalog","reviewKeywordCountsAreNotPrevalence","reviewersMayBeIncentivizedOrSelfSelected"];
  const falseKeys=["manufacturerSignedSkuEquivalence","representativeSampleOrDenominatorValidated","sourceRawSnapshotNewlyIngested","sourceContentDigestNewlyComputed","researchDoesNotCreateAdminApproval"];
  if(trueKeys.some(k=>ind[k]!==true) || falseKeys.some(k=>ind[k]!==false) || ind.researchDoesNotCreateAdminApproval!==true){
     // researchDoesNotCreateAdminApproval must be true, never a fictitious admin approval
     fail.push("SOURCE_AUTHORITY_OVERCLAIM");
  }
  if(!Array.isArray(x.sources) || x.sources.length!==8 ||
     new Set(x.sources?.map(s=>s.id)).size!==8)fail.push("SOURCE_INVENTORY");
  const sources=new Map((x.sources??[]).map(s=>[s.id,s]));
  const brand=sources.get("BRAND_PRODUCT_31"), tag=sources.get("HWAHAE_REVIEW_TAGS"), fact=sources.get("GOVERNED_UV_FACT");
  if(brand?.url!==FIRST_PARTY || brand?.level!=="brand_first_party_claim" ||
     tag?.level!=="review_aggregate_tag_ui" || tag?.tagCountIsNotIncidence!==true ||
     tag?.observedTags?.no_white_cast!==32 || tag?.observedTags?.no_eye_pain!==22 ||
     tag?.observedTags?.allergic_reaction!==3 ||
     fact?.level!=="governed_product_fact_current" ||
     fact?.sourceRef!=="db:product_fact_current:1a4602c5-02e8-4ae0-b2f5-92dc66c85fc0" ||
     (x.sources??[]).some(s=>s.rawCapturedInThisStage!==false)) fail.push("SOURCE_INTEGRITY");
  const items=x.reviewDecisions??[], b=x.refinedSemanticBundle??{}, fields=b.fields??{},p=x.rpcPayloadPreview??[];
  if(!Array.isArray(items) || items.length!==12 || !Array.isArray(p) || p.length!==12 ||
     JSON.stringify(Object.keys(fields).sort())!==JSON.stringify([...FIELD_NAMES].sort()) ||
     new Set(items.map(v=>v.field)).size!==12 || new Set(p.map(v=>v.field_name)).size!==12 ||
     b.productId!==scope.productId || b.subjectId!==scope.subjectId || b.subjectCount!==1 ||
     b.contractVersion!=="sunscreen-recommendation-semantic-bundle-v1")fail.push("BUNDLE_SHAPE");
  for(const name of FIELD_NAMES) {
    const review=items.find(v=>v.field===name), f=fields[name], q=p.find(v=>v.field_name===name);
    const established=Object.hasOwn(CORE,name);
    const expectedState=established?"established":"reviewed_not_established";
    const expectedVal=established?CORE[name]:null;
    const expectedConf=established?"high":"unknown";
    if(!review || !f || review.state!==expectedState || f.state!==expectedState ||
      JSON.stringify(f.value)!==JSON.stringify(expectedVal) ||
      JSON.stringify(review.value)!==JSON.stringify(expectedVal) ||
      f.confidence!==expectedConf || review.confidence!==expectedConf ||
      typeof review.reason!=="string" || review.reason.length<60 ||
      !Array.isArray(review.sourceIds) || review.sourceIds.length<1 ||
      review.sourceIds.some(id=>!sources.has(id)) ||
      review.sourceKinds?.length!==review.sourceIds.length ||
      review.sourceIds.some((id,i)=>review.sourceKinds[i]!==sources.get(id)?.level)){
        fail.push("REVIEW_UNSUPPORTED_OR_MISBOUND:"+name);
    }
    if(!q || Object.keys(q).sort().join("|")!==[
      "product_id","subject_id","field_name","review_state","field_value",
      "confidence","supersedes_review_id","evidence_records"
    ].sort().join("|") ||
      q.product_id!==scope.productId || q.subject_id!==scope.subjectId ||
      q.review_state!==expectedState || q.field_value!==expectedVal ||
      q.confidence!==expectedConf || q.supersedes_review_id!==null ||
      !Array.isArray(q.evidence_records) || q.evidence_records.length===0 ||
      q.evidence_records.length>32 ||
      q.evidence_records.some(z=>!ALLOWED_EVIDENCE_TYPES.has(z.source_type) ||
        typeof z.source_ref!=="string" || z.source_ref.length<3 ||
        (["canonical_taxonomy","product_fact_current"].includes(z.source_type)?
          !z.source_ref.startsWith("db:"):!z.source_ref.startsWith("https://"))) ||
      (name==="category_slot"&&!q.evidence_records.some(z=>z.source_type==="canonical_taxonomy")) ||
      (name==="uv_filter_type"&&!q.evidence_records.some(z=>z.source_type==="product_fact_current"))){
        fail.push("RPC_PREVIEW_CONTRACT:"+name);
    }
  }
  if(s1.semanticBundle?.fields?.white_cast?.value!=="none" ||
     s1.semanticBundle?.fields?.white_cast?.state!=="established" ||
     x.s1Adjustment?.field!=="white_cast" ||
     x.s1Adjustment?.from?.value!=="none" ||
     x.s1Adjustment?.to?.state!=="reviewed_not_established" ||
     x.s1Adjustment?.to?.value!==null ||
     x.s1Adjustment?.to?.confidence!=="unknown") fail.push("WHITE_CAST_COUNTEREVIDENCE_REVISION");
  if(x.resultCounts?.reviewedProposed!==12 || x.resultCounts?.establishedProposed!==2 ||
     x.resultCounts?.unresolvedProposed!==10 || x.resultCounts?.productionReviewed!==0 ||
     x.dryRun?.neutralEligible!==true || x.dryRun?.whiteCastRelevantEligible!==false ||
     x.dryRun?.eyeStingRelevantEligible!==false || x.dryRun?.envelopeReady!==true ||
     x.dryRun?.productionAdmissible!==false)fail.push("REVIEW_COUNTS_OR_DRY_RUN");
  if(ex.productionWrites!==0 || ex.adminActorVerified!==false || ex.adminRpcExecuted!==false ||
     ex.productionCurrentSemanticReviews!==0 || ex.changedProductFact!==false ||
     ex.changedSubjectAuthority!==false || ex.changedRecommendation!==false ||
     ex.changedRanking!==false || ex.changedBeta!==false ||
     ex.dispatchedManufacturerEmail!==false ||
     x.nextGate!=="DATA_AI29C_FILTER_R4_D_S3_REAL_ADMIN_REVIEW_CAPABILITY_AND_EVIDENCE_PAYLOAD_PRECHECK")fail.push("UNAUTHORIZED_AUTHORITY_OR_WRITE");
  return [...new Set(fail)].sort();
}
assert.deepEqual(issues(data),[], "S2 evidence must fail closed");
const bundle=data.refinedSemanticBundle;
const env=evaluateSunscreenSemanticEnvelope(bundle);
assert.equal(env.envelopeReady,true);
assert.equal(env.coreEstablished,true);
assert.equal(env.allReviewed,true);
assert.deepEqual([...env.unresolvedFields].sort(),
  FIELD_NAMES.filter(n=>!Object.hasOwn(CORE,n)).sort());
assert.deepEqual(projectEstablishedSunscreenSemantics(bundle).projected,
  {category:"sunscreen",uv_filter_type:"hybrid"});
for(const [key,allowed] of [
  ["neutral",true],["whiteCastRelevant",false],["sensitivityRelevant",false],
  ["eyeStingRelevant",false],["pillingRelevant",false],["toneUpRelevant",false],
  ["textureRelevant",false],["finishRelevant",false]
]) {
  const ctx=key==="neutral"?{}:{[key]:true};
  assert.equal(evaluateSunscreenSemanticScoringEligibility(bundle,ctx).eligible,allowed,key);
}
const mutations=[
["forged_manufacturer",x=>x.independence.manufacturerSignedSkuEquivalence=true,"SOURCE_AUTHORITY_OVERCLAIM"],
["fake_prevalence",x=>x.independence.reviewKeywordCountsAreNotPrevalence=false,"SOURCE_AUTHORITY_OVERCLAIM"],
["fake_raw_capture",x=>x.independence.sourceRawSnapshotNewlyIngested=true,"SOURCE_AUTHORITY_OVERCLAIM"],
["rewritten_official_url",x=>x.sources[0].url="https://example.com","SOURCE_INTEGRITY"],
["inflated_tag",x=>x.sources[1].observedTags.no_eye_pain=100,"SOURCE_INTEGRITY"],
["skin_type_unproven",x=>x.reviewDecisions.find(y=>y.field==="skin_types").state="established","REVIEW_UNSUPPORTED_OR_MISBOUND:skin_types"],
["white_cast_falsely_none",x=>x.refinedSemanticBundle.fields.white_cast={state:"established",value:"none",confidence:"high"},"REVIEW_UNSUPPORTED_OR_MISBOUND:white_cast"],
["stinging_falsely_low",x=>x.refinedSemanticBundle.fields.eye_sting={state:"established",value:"low",confidence:"high"},"REVIEW_UNSUPPORTED_OR_MISBOUND:eye_sting"],
["unknown_toneup_becomes_false",x=>x.reviewDecisions.find(y=>y.field==="tone_up").value=false,"REVIEW_UNSUPPORTED_OR_MISBOUND:tone_up"],
["missing_review",x=>x.reviewDecisions.pop(),"BUNDLE_SHAPE"],
["rpc_missing_evidence",x=>x.rpcPayloadPreview.find(y=>y.field_name==="category_slot").evidence_records=[],"RPC_PREVIEW_CONTRACT:category_slot"],
["rpc_wrong_fact_provenance",x=>x.rpcPayloadPreview.find(y=>y.field_name==="uv_filter_type").evidence_records[0].source_type="official_product_page","RPC_PREVIEW_CONTRACT:uv_filter_type"],
["rpc_unauthorized_key",x=>x.rpcPayloadPreview[0].actor_user_id="fake","RPC_PREVIEW_CONTRACT:category_slot"],
["pretend_reviews_were_written",x=>x.execution.productionCurrentSemanticReviews=12,"UNAUTHORIZED_AUTHORITY_OR_WRITE"],
["unapproved_semantic_rpc",x=>x.execution.adminRpcExecuted=true,"UNAUTHORIZED_AUTHORITY_OR_WRITE"],
["rank_promotion",x=>x.execution.changedRanking=true,"UNAUTHORIZED_AUTHORITY_OR_WRITE"]
];
for(const [name,mutate,reason] of mutations) {
  const bad=structuredClone(data);
  mutate(bad);
  assert.ok(issues(bad).includes(reason),name);
}
console.log(JSON.stringify({status:"PASS",stage:data.stage,sources:data.sources.length,
  fields:data.reviewDecisions.length,established:2,unresolved:10,negativeTests:mutations.length,
  envelopeDryRun:true,whiteCastContextEligible:false,productionWrites:0,admission:false},null,2));
