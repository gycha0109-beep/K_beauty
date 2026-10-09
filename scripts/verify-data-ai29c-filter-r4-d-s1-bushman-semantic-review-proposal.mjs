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
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s1-bushman-semantic-review-proposal-v1.json", "utf8"));
const upstream = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-r5-first-party-unit-conflict-v1.json", "utf8"));
const expectedNames = [
  "category_slot", "skin_types", "concerns", "texture", "finish",
  "uv_filter_type", "sensitivity_safe", "irritation_risk",
  "tone_up", "white_cast", "eye_sting", "pilling_risk",
];
const openNames = expectedNames.filter(x => !["category_slot", "uv_filter_type", "white_cast"].includes(x));
const officialUrl = "https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/";
const evidenceID = "88d1b9fc-a02c-4af3-9d49-f102978d4769";

function errors(x) {
  const out = [];
  const dec = x.ownerDecision ?? {};
  if(x.stage !== "DATA-AI29C-FILTER-R4-D-S1" ||
     x.decision !== "BUSHMAN_12_FIELD_SEMANTIC_REVIEW_PROPOSAL_READY_NOT_APPLIED" ||
     x.predecessor?.r4cR5Merge !== "171b1dd121946332fb936e928f7f815bdbffe32d")out.push("STAGE");
  if(dec.scope !== "INTERNAL_CATALOG_IDENTITY_PRESENTATION_ONLY" ||
     dec.decision !== "TREAT_50G_AND_50ML_AS_SAME_PRODUCT_FOR_REVIEW_PREPARATION" ||
     dec.manufacturerAttested !== false ||
     dec.verifiedSkuBarcode !== false ||
     dec.changesFormalSubjectAuthority !== false ||
     dec.overridesSafetyClaims !== false)out.push("ASSUMPTION_OVERCLAIM");
  const t=x.target??{};
  if(t.productId !== BUSHMAN_MIXED_REGISTRY_TARGET.productId ||
     t.subjectId !== BUSHMAN_MIXED_REGISTRY_TARGET.subjectId ||
     t.subjectSemanticKey !== BUSHMAN_MIXED_REGISTRY_TARGET.subjectSemanticKey ||
     t.formulationRevisionKey !== BUSHMAN_MIXED_REGISTRY_TARGET.formulationRevisionKey ||
     t.subjectAuthority !== "data-ai29c-c5-presentation-identity-correction-v1")out.push("SCOPE");
  const src=x.source??{};
  if(src.url !== officialUrl || src.firstPartyProductNo !== 31 ||
     src.latestFrozenOfficialSourceId !== "94b32b8d-8340-4b91-9e62-646794fd4f41" ||
     src.latestFrozenOfficialContentDigest !== "3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9" ||
     !src.officialClaimExcerpts?.some(c=>c.includes("백탁현상방지")) ||
     !src.officialClaimExcerpts?.some(c=>c.includes("저자극")) ||
     src.officialSourceUsedAsManufacturerClaimsOnly !== true ||
     !upstream.checked_urls.some(v=>v.source_tier==="BRAND_FIRST_PARTY" && v.url===officialUrl))out.push("SOURCE");
  const b=x.semanticBundle??{},f=b.fields??{};
  if(b.contractVersion !== "sunscreen-recommendation-semantic-bundle-v1" ||
     b.productId !== t.productId || b.subjectId !== t.subjectId || b.subjectCount !== 1 ||
     JSON.stringify(Object.keys(f).sort()) !== JSON.stringify([...expectedNames].sort()) ||
     !Array.isArray(x.reviewDecisions) || x.reviewDecisions.length !== 12 ||
     new Set(x.reviewDecisions.map(v=>v.field)).size !== 12)out.push("SEMANTIC_BUNDLE_SHAPE");
  for(const name of expectedNames) {
    const v=f[name],review=x.reviewDecisions?.find(y=>y.field===name);
    if(!v || !review ||
       v.state !== review.state || JSON.stringify(v.value) !== JSON.stringify(review.value) ||
       v.confidence !== review.confidence ||
       typeof review.rationale !== "string" || review.rationale.length < 30 ||
       !["official_product","governed_fact"].includes(review.authority) ||
       (review.authority==="official_product" && review.sourceLocator!==officialUrl) ||
       (review.authority==="governed_fact" && (name!=="uv_filter_type"||review.factEvidenceId!==evidenceID))) {
      out.push("SEMANTIC_REVIEW_PROVENANCE:"+name);
    }
  }
  if(f.category_slot?.state!=="established" || f.category_slot.value!=="sunscreen" ||
     f.uv_filter_type?.state!=="established" || f.uv_filter_type.value!=="hybrid" ||
     f.white_cast?.state!=="established" || f.white_cast.value!=="none" ||
     f.white_cast.confidence!=="medium" ||
     openNames.some(name=>f[name]?.state!=="reviewed_not_established" ||
       f[name]?.value!==null || f[name]?.confidence!=="unknown"))out.push("SEMANTIC_UNSUPPORTED_ASSERTION");
  if(x.reviewCounts?.required!==12 || x.reviewCounts?.proposedReviewed!==12 ||
     x.reviewCounts?.proposedEstablished!==3 || x.reviewCounts?.proposedUnresolved!==9 ||
     x.reviewCounts?.productionReviewed!==0 || x.productionBaseline?.currentSemanticReviewCount!==0 ||
     x.productionBaseline?.attestationTableDeployed!==false)out.push("COUNTS_OR_PROD_BASELINE");
  const exec=x.execution??{};
  if(exec.proposalOnly!==true || exec.adminReviewActorVerified!==false ||
     exec.reviewRpcExecuted!==false || exec.productionSemanticRowsWritten!==0 ||
     exec.productionMigrationsApplied!==0 || exec.productOrSubjectUpdated!==false ||
     exec.admissionGranted!==false || exec.betaOrRankingChanged!==false)out.push("UNAUTHORIZED_EXECUTION");
  if(x.nextGate!=="DATA_AI29C_FILTER_R4_D_S2_ADMIN_SEMANTIC_REVIEW_EXECUTION_DECISION")out.push("NEXT_GATE");
  return [...new Set(out)].sort();
}
assert.deepEqual(errors(data),[]);
const envelope=evaluateSunscreenSemanticEnvelope(data.semanticBundle);
assert.equal(envelope.envelopeReady,true);
assert.equal(envelope.coreEstablished,true);
assert.equal(envelope.allReviewed,true);
assert.deepEqual([...envelope.unresolvedFields],openNames);
const projection=projectEstablishedSunscreenSemantics(data.semanticBundle);
assert.deepEqual(projection.projected,{category:"sunscreen",uv_filter_type:"hybrid",white_cast:"none"});
for(const [context,allowed] of [
  [{},true],[{whiteCastRelevant:true},true],[{toneUpRelevant:true},false],
  [{sensitivityRelevant:true},false],[{textureRelevant:true},false],
  [{finishRelevant:true},false],[{eyeStingRelevant:true},false],
  [{pillingRelevant:true},false]
])assert.equal(evaluateSunscreenSemanticScoringEligibility(data.semanticBundle,context).eligible,allowed,JSON.stringify(context));
const mutations=[
  ["false_manufacturer_attestation",x=>x.ownerDecision.manufacturerAttested=true,"ASSUMPTION_OVERCLAIM"],
  ["false_subject_upgrade",x=>x.target.subjectAuthority="trust-phase5-admin-subject-review-v1","SCOPE"],
  ["wrong_source",x=>x.source.url="https://other.example","SOURCE"],
  ["false_skin_safety",x=>{x.semanticBundle.fields.sensitivity_safe={state:"established",value:true,confidence:"high"}},"SEMANTIC_UNSUPPORTED_ASSERTION"],
  ["false_eye_stinging",x=>{x.semanticBundle.fields.eye_sting={state:"established",value:"low",confidence:"high"}},"SEMANTIC_UNSUPPORTED_ASSERTION"],
  ["falsely_no_toneup",x=>{x.semanticBundle.fields.tone_up={state:"established",value:false,confidence:"medium"}},"SEMANTIC_UNSUPPORTED_ASSERTION"],
  ["uv_fact_spoof",x=>{x.reviewDecisions.find(v=>v.field==="uv_filter_type").factEvidenceId="fake"},"SEMANTIC_REVIEW_PROVENANCE:uv_filter_type"],
  ["missing_review",x=>x.reviewDecisions.pop(),"SEMANTIC_BUNDLE_SHAPE"],
  ["false_real_reviews",x=>x.reviewCounts.productionReviewed=12,"COUNTS_OR_PROD_BASELINE"],
  ["false_rpc_execution",x=>x.execution.reviewRpcExecuted=true,"UNAUTHORIZED_EXECUTION"],
  ["enable_beta",x=>x.execution.betaOrRankingChanged=true,"UNAUTHORIZED_EXECUTION"],
  ["whitecast_high_confidence",x=>{x.semanticBundle.fields.white_cast.confidence="high"},"SEMANTIC_UNSUPPORTED_ASSERTION"]
];
for(const [name,edit,reason] of mutations) {
  const changed=structuredClone(data);
  edit(changed);
  assert.ok(errors(changed).includes(reason),name);
}
console.log(JSON.stringify({status:"PASS",stage:data.stage,
  reviewedProposal:12,establishedProposal:3,unresolvedProposal:9,
  dryRunEnvelopeReady:envelope.envelopeReady,
  negativeTests:mutations.length,productionReviewWrites:0,admission:false},null,2));
