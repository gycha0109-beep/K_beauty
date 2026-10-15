#!/usr/bin/env node
// R16I D8K-12 owner review / withdrawal contract and security regression.
// All records are SYNTHETIC. Does not contact Supabase or change products.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {
 validateR16IVerdict,reviewR16IEvidence,listR16ID8C,createR16IProposal,
 r16iBaselineDigest
} from "../../lib/product-intelligence/r16i-correction-approval-ledger.mjs";
import {R16I_PRODUCT_ID}
 from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";

let n=0;
function eq(actual,expected,msg){assert.deepEqual(actual,expected,msg);n++;}
function has(source,re,msg){assert.match(source,re,msg);n++;}
function lacks(source,re,msg){assert.doesNotMatch(source,re,msg);n++;}
function yes(condition,msg){assert.ok(condition,msg);n++;}

const evidence1=randomUUID(),evidence2=randomUUID();
const verdict1=randomUUID(),verdict2=randomUUID();
const actor=randomUUID(),requestId=randomUUID();
const now=new Date().toISOString();
const review={
 decision:"REVIEW_REQUIRED",product_id:R16I_PRODUCT_ID,
 product_revision:"2026-09-10T00:32:38.713599Z",live_read_verified:true,
 revision_matches:true,collision_free:true,
 reviewed_fields:Array.from({length:20},(_,i)=>({
  entity:i<5?"products":"other",
  field:i===0?"size_ml":i===1?"price_min":i===2?"price_max":
    i===3?"unit_price_per_10ml":i===4?"buy_link":"field_"+i,
  before:i===0?160:i===1||i===2?29900:
    i===3?1868.75:i===4?"https://www.hwahae.co.kr/goods/45194":null
 }))
};
const rows={
 admin_product_correction_evidence_verdicts_v1:[
  {verdict_id:verdict1,evidence_id:evidence1,verdict:"VERIFIED",
   reason:"Independent source check",reviewed_at:now},
  {verdict_id:verdict2,evidence_id:evidence2,verdict:"VERIFIED",
   reason:"Independent option check",reviewed_at:now}
 ],
 admin_product_correction_evidence_review_events_v2:[
  {event_sequence:2,evidence_id:evidence1,current_verdict_id:verdict1,
   verdict:"VERIFIED",reason:"Independent source check",recorded_at:now},
  {event_sequence:1,evidence_id:evidence2,current_verdict_id:verdict2,
   verdict:"VERIFIED",reason:"Independent option check",recorded_at:now}
 ],
 admin_product_correction_proposals_v1:[],
 admin_product_correction_decisions_v1:[],
 admin_product_correction_evidence_v1:[
  {evidence_id:evidence1,product_id:R16I_PRODUCT_ID,
   source_key:"official_single",
   source_url:"https://www.snature.kr/product/detail.html?product_no=151"},
  {evidence_id:evidence2,product_id:R16I_PRODUCT_ID,
   source_key:"hwahae_bundle",
   source_url:"https://www.hwahae.co.kr/goods/45194"}
 ]
};
const calls=[];
function mock({withdrawn=false,forged=false,missingEvent=false,
 rpcError=false,rpcPriceApproved=false,rpcWrongEvidence=false}={}){
 return {
  from(table){
   if(!Object.hasOwn(rows,table))throw Error("Unexpected table read "+table);
   const filters=[];
   const query={
    select(){return query;},
    order(){return query;},
    eq(k,v){filters.push(x=>x[k]===v);return query;},
    in(k,vs){filters.push(x=>vs.includes(x[k]));return query;},
    limit:async()=>({data:rows[table].filter(x=>filters.every(fn=>fn(x))).map(x=>{
     if(x.evidence_id!==evidence1)return x;
     if(table==="admin_product_correction_evidence_verdicts_v1"&&withdrawn)
      return {...x,verdict:"REJECTED"};
     if(table==="admin_product_correction_evidence_review_events_v2"){
      if(missingEvent)return null;
      return {...x,
       ...(withdrawn?{verdict:"REVOKED",reason:"Removed fraudulent capture"}:{}),
       ...(forged?{current_verdict_id:randomUUID()}:{})};
     }
     return x;
    }).filter(Boolean),error:null})
   };
   return query;
  },
  async rpc(name,args){
   calls.push({name,args});
   eq(name,"review_r16i_evidence_v2");
   if(rpcError)return {data:null,error:{message:"DB_DENIED"}};
   return {data:{
    verdictId:verdict1,
    evidenceId:rpcWrongEvidence?evidence2:args.p_evidence_id,
    verdict:args.p_verdict,reviewedAt:now,productWrites:0,
    priceApproved:rpcPriceApproved
   },error:null};
  }
 };
}
const approve={evidenceId:evidence1,verdict:"VERIFIED",
 reason:"Independent review of source",requestId};
const revoke={...approve,verdict:"REVOKED",reason:"Withdraw because option mismatch"};
eq(validateR16IVerdict(revoke).verdict,"REVOKED");
eq(validateR16IVerdict({...approve,reason:"오"}).reason,"오");
for(const verdict of ["approved","REVOKE","DELETE",null,""]){
 assert.throws(()=>validateR16IVerdict({...revoke,verdict}),
  /INVALID_EVIDENCE_REVIEW/);n++;
}
assert.throws(()=>validateR16IVerdict({...revoke,extra:true}),
 /INVALID_EVIDENCE_REVIEW/);n++;

let x=await reviewR16IEvidence(mock(),approve,actor);
eq(x.verdict,"VERIFIED");eq(x.priceApproved,false);
eq(x.productWrites,0);
eq(calls.at(-1).args.p_actor_id,actor);
eq(calls.at(-1).args.p_request_id,requestId);
x=await reviewR16IEvidence(mock(),revoke,actor);
eq(x.verdict,"REVOKED");eq(x.priceApproved,false);
eq(calls.at(-1).args.p_verdict,"REVOKED");
for(const changes of [
 {rpcError:true},{rpcPriceApproved:true},{rpcWrongEvidence:true}
]){
 await assert.rejects(()=>reviewR16IEvidence(mock(changes),revoke,actor),
  /R16I_D8K12_REVIEW_RPC_FAILED/);n++;
}
await assert.rejects(()=>reviewR16IEvidence(mock(),revoke,"not-uuid"),
 /R16I_D8C_MISSING_ACTOR/);n++;

const ledger=await listR16ID8C(mock(),review);
eq(ledger.verdicts.length,2);
eq(ledger.verdicts[0].verdict,"VERIFIED");
eq(ledger.reviewHistory.length,2);
eq(ledger.writeAuthorized,false);eq(ledger.releaseReady,false);
const withdrawn=await listR16ID8C(mock({withdrawn:true}),review);
eq(withdrawn.verdicts[0].verdict,"REVOKED");
eq(withdrawn.reviewHistory[0].verdict,"REVOKED");
for(const changes of [{forged:true},{missingEvent:true}]){
 await assert.rejects(()=>listR16ID8C(mock(changes),review),
 /R16I_D8K12_CURRENT_VERDICT_HISTORY_MISMATCH/);n++;
}
// A revoked approval must not create a new Product correction proposal.
const proposal={
 strategy:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
 baselineSha256:r16iBaselineDigest(review),
 productRevision:review.product_revision,
 fieldChanges:[{field:"products.size_ml",before:160,after:80}],
 evidenceIds:[evidence1,evidence2],
 rationale:"Existing two source files cannot be used again after withdrawal",
 requestId:randomUUID()
};
await assert.rejects(()=>createR16IProposal(mock({withdrawn:true}),proposal,actor,review),
 /R16I_D8C_EVIDENCE_NOT_VERIFIED/);n++;

const migration=readFileSync(
 "supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql","utf8");
const ledgerSource=readFileSync(
 "lib/product-intelligence/r16i-correction-approval-ledger.mjs","utf8");
const route=readFileSync(
 "app/api/admin/products/r16i-correction-review/approval/route.js","utf8");
const ui=readFileSync(
 "app/admin/products/r16i-correction-review/R16IR4D8CorrectionApproval.js","utf8");
const decideSql=readFileSync(
 "supabase/migrations/20261012172837_taxonomy_ai_r16i_correction_approval_ledger_v1.sql","utf8");
const d8dV1=readFileSync(
 "supabase/migrations/20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql","utf8");
const d8dV2=readFileSync(
 "supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql","utf8");
for(const re of [
 /D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION/,
 /CREATE TABLE public\.admin_product_correction_evidence_review_events_v2/,
 /GENERATED ALWAYS AS IDENTITY UNIQUE/,
 /ENABLE ROW LEVEL SECURITY/,
 /REVOKE ALL ON public\.admin_product_correction_evidence_review_events_v2/,
 /GRANT SELECT ON public\.admin_product_correction_evidence_review_events_v2/,
 /REVOKE INSERT,UPDATE,DELETE ON public\.admin_product_correction_evidence_verdicts_v1/,
 /REVOKE ALL ON FUNCTION public\.review_r16i_evidence_v2/,
 /GRANT EXECUTE ON FUNCTION public\.review_r16i_evidence_v2[\s\S]*?TO service_role/,
 /SECURITY DEFINER SET search_path=''/,
 /D8K12_REVIEWER_CANNOT_APPROVE_OWN_CAPTURE/,
 /e\.submitted_by=p_actor_id/,
 /role='admin_owner' AND is_active=true/,
 /FOR UPDATE/,
 /D8K12_SUPERSEDED_REVIEW_CANNOT_REPLAY/,
 /D8K12_APPEND_ONLY_REVIEW_EVENT/,
 /D8K12_ONLY_REVOCATION_ALLOWED_AFTER_REVIEW/,
 /D8K12_PREVIOUS_VERDICT_IS_TERMINAL_OR_UNAUDITED/,
 /SET[\s\S]*?verdict='REJECTED',reason=normalized_reason/,
 /current_verdict_id/,
 /productWrites',0/,
 /priceApproved',false/
])has(migration,re,"migration security contract");
for(const re of [
 /review_r16i_evidence_v2/,
 /R16I_D8K12_CURRENT_VERDICT_HISTORY_MISMATCH/,
 /event_sequence DESC|event_sequence",{ascending:false}/,
 /reviewHistory/,
 /verdict==="REVOKED"\?"REJECTED":event\.verdict/
])has(ledgerSource,re);
lacks(ledgerSource,/from\(VERDICTS\)\.insert\(/);
has(route,/ownerOnly=body\.action==="review_evidence"/);
has(route,/a\.access\.role!==ADMIN_ROLES\.OWNER/);
has(route,/request\.headers\.get\("origin"\)/);
for(const re of [/승인 철회 확정/,/승인·반려·철회 이력/,
 /ledger\.owner/,/isRevocation/,/verdict:"REVOKED"/])has(ui,re);
for(const sql of [decideSql,d8dV1,d8dV2])
 has(sql,/v\.verdict='VERIFIED'/,"old SQL sees current revoked as REJECTED");
for(const re of [
 /\b(INSERT|UPDATE|DELETE)\s+(?:public\.)?(?:products|product_offers|product_fact_subjects)\b/i,
 /GRANT (?:SELECT,)?INSERT .*TO anon/,
 /ALTER TABLE\s+public\.products/i,
 /VALUES\('R16I_S_NATURE_PRODUCT_1',true/
])lacks(migration,re);
yes(migration.indexOf("SELECT 1 FROM public.products")<
    migration.indexOf("SELECT * INTO e FROM public.admin_product_correction_evidence_v1"),
 "Product lock precedes evidence lock and current verdict read");
console.log(JSON.stringify({
 status:"PASS",stage:"D8K12_OWNER_SELF_REVIEW_AND_REVOCATION_CONTRACT",
 assertions:n,syntheticOnly:true,nativePostgresqlExecuted:false,
 baselineCurrentVerdictReaderCompatible:true,
 anonymousAuthorityGranted:false,actualDbWriteAttempted:false,
 productionReleaseAuthorized:false
}));
