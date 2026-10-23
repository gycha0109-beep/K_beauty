#!/usr/bin/env node
/**
 * Offline preview of the proposed *less restrictive* policy over exactly
 * the existing ten products. Review flags are not converted into approval.
 */
import {readFile} from "node:fs/promises";
import {evaluateCleanserEvidenceTierShadowV1 as evaluate}
  from "../lib/trust/cleanser-evidence-tier-shadow-v1.mjs";
if(process.argv.length!==2)throw new Error("NO_FLAGS_OR_PRODUCTION_AUTHORIZATION_ALLOWED");
const snapshot=JSON.parse(await readFile(
  "evidence/trust/cleanser-authority-next-actions-20261023.json","utf8"));
if(snapshot.version!=="cleanser-authority-next-actions-evidence-v1"||
  snapshot.rows?.length!==10||snapshot.expected_product_ids?.length!==10||
  new Set(snapshot.expected_product_ids).size!==10)
  throw new Error("EXACT_TEN_READONLY_COHORT_REQUIRED");
const expected=new Set(snapshot.expected_product_ids);
if(snapshot.rows.some(x=>!expected.has(x.id))||
   new Set(snapshot.rows.map(x=>x.id)).size!==10)
  throw new Error("EXACT_COHORT_IDENTITY_DRIFT");
const result=snapshot.rows.map(x=>{
  const decision=evaluate({product:{
    id:x.id,brand:x.brand,name:x.name,category:x.category,
    normalized_brand:x.brand,normalized_name:x.name
  }});
  // The stored 7 Hwahae aggregate flags are NOT reviewed capture proofs,
  // and the source name is not a verified normalized identity string.
  if(decision.tier!=="IDENTITY_ONLY"||decision.g2_grant_issued||
     decision.actual_recommendation_candidate_admitted||
     decision.controlled_nonfact_signals.length!==0)
    throw new Error("LIVE_UNREVIEWED_SIGNAL_AUTHORITY_LEAK");
  return {
    product_id:x.id,product_name:x.brand+" "+x.name,tier:decision.tier,
    review_aggregate_recorded:x.hwahae_signals_present,
    next_step:x.hwahae_signals_present?
      "정확한 제품/국가에 해당하는 리뷰 출처·검토자와 비-Fact 선호 신호를 검증":
      "정확한 상품/리뷰 연결을 확인하고 원본 근거를 확보",
    low_ph:decision.low_ph,deep_cleansing:decision.deep_cleansing,
    limited_fit_shadow_eligible:false,production_admission:false
  };
}).sort((a,b)=>a.product_id.localeCompare(b.product_id,"en"));
const summary={
  version:"cleanser-tiered-policy-existing-ten-offline-audit-v1",
  as_of:snapshot.as_of,total:result.length,identity_only:result.filter(x=>x.tier==="IDENTITY_ONLY").length,
  review_aggregate_recorded:result.filter(x=>x.review_aggregate_recorded).length,
  unmapped_or_missing_review_aggregate:result.filter(x=>!x.review_aggregate_recorded).length,
  limited_fit_shadow_eligible:0,production_admissions:0,
  facts_confirmed:0,source_bindings_created:0,production_writes:0,
  manufacturer_direct_reply_is_mandatory_for_limited_fit:false,
  products:result
};
process.stdout.write(JSON.stringify(summary,null,2)+"\n");
