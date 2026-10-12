#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {R16I_PRODUCT_ID} from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";
import {
 r16iBaselineDigest,validateR16IVerdict,validateR16IProposal,validateR16IDecision,
 reviewR16IEvidence,createR16IProposal,decideR16IProposal,listR16ID8C
} from "../../lib/product-intelligence/r16i-correction-approval-ledger.mjs";

const rev="2026-09-10T00:32:38.713599Z";
const fields=[
 ["products","size_ml",160],["products","price_min",29900],["products","price_max",29900],
 ["products","unit_price_per_10ml",1868.75],
 ["products","buy_link","https://www.hwahae.co.kr/goods/45194"],
 ...Array.from({length:15},(_,i)=>["other","field_"+i,null])
].map(([entity,field,before])=>({entity,field,before,after:null}));
const review={decision:"REVIEW_REQUIRED",product_id:R16I_PRODUCT_ID,
  product_revision:rev,live_read_verified:true,revision_matches:true,
  collision_free:true,reviewed_fields:fields};
const digest=r16iBaselineDigest(review);
assert.match(digest,/^[a-f0-9]{64}$/);
const evidenceId=randomUUID(),actor=randomUUID(),requestId=randomUUID(),proposalId=randomUUID();
const base={
  strategy:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
  baselineSha256:digest,productRevision:rev,
  fieldChanges:[{field:"products.size_ml",before:160,after:80}],
  evidenceIds:[evidenceId],rationale:"확인된 80ml 단품 원본 기준으로 검토",requestId
};
assert.equal(validateR16IProposal(base,review).fieldChanges[0].after,80);
assert.equal(validateR16IVerdict({evidenceId,verdict:"VERIFIED",reason:"현재 캡처 원본에서 옵션 직접 확인",requestId}).verdict,"VERIFIED");
assert.equal(validateR16IDecision({proposalId,decision:"HOLD",reason:"단품 가격 확인을 위해 보류",requestId}).decision,"HOLD");
let denied=0;
function no(label,run,code){assert.throws(run,new RegExp(code),label);denied++;}
no("wrong case",()=>r16iBaselineDigest({...review,product_id:randomUUID()}),"PRESTATE_BLOCKED");
no("missing rows",()=>r16iBaselineDigest({...review,reviewed_fields:fields.slice(1)}),"PRESTATE_BLOCKED");
no("baseline forged",()=>validateR16IProposal({...base,baselineSha256:"a".repeat(64)},review),"INVALID_PROPOSAL");
no("price is uncoupled before",()=>validateR16IProposal({...base,fieldChanges:[{field:"products.price_min",before:0,after:19900}]},review),"FIELD_NOT_AUTHORIZED");
no("wrong entity",()=>validateR16IProposal({...base,fieldChanges:[{field:"recommendation.ranking",before:null,after:1}]},review),"FIELD_NOT_AUTHORIZED");
no("unchanged",()=>validateR16IProposal({...base,fieldChanges:[{field:"products.size_ml",before:160,after:160}]},review),"UNCHANGED_FIELD");
no("negative money",()=>validateR16IProposal({...base,fieldChanges:[{field:"products.price_min",before:29900,after:-1}]},review),"INVALID_AFTER");
no("invalid money",()=>validateR16IProposal({...base,fieldChanges:[{field:"products.price_min",before:29900,after:0.5}]},review),"INVALID_AFTER");
no("duplicate fields",()=>validateR16IProposal({...base,fieldChanges:[base.fieldChanges[0],base.fieldChanges[0]]},review),"FIELD_NOT_AUTHORIZED");
no("duplicate evidence",()=>validateR16IProposal({...base,evidenceIds:[evidenceId,evidenceId]},review),"INVALID_PROPOSAL");
no("no evidence",()=>validateR16IProposal({...base,evidenceIds:[]},review),"INVALID_PROPOSAL");
no("injected access",()=>validateR16IProposal({...base,productionWriteAuthorized:true},review),"INVALID_PROPOSAL");
no("unknown offer",()=>validateR16IProposal({...base,fieldChanges:[{field:"product_offers.new_offer",before:null,after:{price:29900}}]},review),"FIELD_NOT_AUTHORIZED");
no("price order",()=>validateR16IProposal({...base,fieldChanges:[
 {field:"products.price_min",before:29900,after:30000},
 {field:"products.price_max",before:29900,after:20000}
]},review),"PRICE_ORDER_INVALID");
no("arbitrary url",()=>validateR16IProposal({...base,fieldChanges:[{field:"products.buy_link",before:"https://www.hwahae.co.kr/goods/45194",after:"https://evil.example"}]},review),"INVALID_AFTER");
no("invalid verdict",()=>validateR16IVerdict({evidenceId,verdict:"AUTO_APPROVED",reason:"123456789012",requestId}),"INVALID_EVIDENCE_REVIEW");
no("short verdict",()=>validateR16IVerdict({evidenceId,verdict:"VERIFIED",reason:"ok",requestId}),"INVALID_EVIDENCE_REVIEW");
no("injected verdict",()=>validateR16IVerdict({evidenceId,verdict:"VERIFIED",reason:"123456789012",requestId,write:true}),"INVALID_EVIDENCE_REVIEW");
no("invalid decision",()=>validateR16IDecision({proposalId,decision:"APPLY_PRODUCTION",reason:"123456789012",requestId}),"INVALID_DECISION");
no("short decision",()=>validateR16IDecision({proposalId,decision:"HOLD",reason:"no",requestId}),"INVALID_DECISION");
const events=[],data={
 "admin_product_correction_evidence_v1":[{evidence_id:evidenceId,product_id:R16I_PRODUCT_ID}],
 "admin_product_correction_evidence_verdicts_v1":[{evidence_id:evidenceId,verdict:"VERIFIED",reason:"원본에서 실제 옵션 확인",reviewed_at:new Date().toISOString()}],
 "admin_product_correction_proposals_v1":[],
 "admin_product_correction_decisions_v1":[]
};
function mockClient({verified=true}={}){
 return {
  from(table){
   assert.ok(Object.hasOwn(data,table),"unexpected table "+table);
   const entry=data[table], filter=[];
   let insertPayload=null;
   const chain={
    select(){return chain;},
    eq(k,v){filter.push(row=>row[k]===v);return chain;},
    in(k,v){filter.push(row=>v.includes(row[k]));return chain;},
    order(){return chain;},
    limit:async()=>({data:entry.filter(row=>filter.every(test=>test(row))).map(row=>({...row,
     verdict:verified?row.verdict:"REJECTED"})),error:null}),
    maybeSingle:async()=>({data:entry.filter(row=>filter.every(test=>test(row)))[0]||null,error:null}),
    insert(payload){insertPayload=payload;events.push({table,payload});return chain;},
    single:async()=>{
     if(table==="admin_product_correction_evidence_verdicts_v1")return {data:{
       verdict_id:randomUUID(),evidence_id:insertPayload.evidence_id,
       verdict:insertPayload.verdict,reviewed_at:new Date().toISOString()
     },error:null};
     if(table==="admin_product_correction_proposals_v1")return {data:{
       proposal_id:proposalId,created_at:new Date().toISOString(),field_changes:insertPayload.field_changes
     },error:null};
     return {data:null,error:{message:"unknown"}};
    }
   };
   return chain;
  },
  async rpc(name,args){
   assert.equal(name,"decide_r16i_product_correction_v1");
   assert.equal(args.p_actor_id,actor);
   events.push({rpc:name,args});
   return {data:{proposalId:args.p_proposal_id,decision:args.p_decision,
     productWrites:0,offerWrites:0,subjectWrites:0,rankingWrites:0,
     productionWriteAuthorized:false},error:null};
  }
 };
}
const verdict=await reviewR16IEvidence(mockClient(),{
 evidenceId,verdict:"VERIFIED",reason:"실제 캡처 상품 옵션 확인 완료",requestId:randomUUID()
},actor);
assert.equal(verdict.productWrites,0);
assert.equal(events[0].table,"admin_product_correction_evidence_verdicts_v1");
const proposal=await createR16IProposal(mockClient(),base,actor,review);
assert.equal(proposal.status,"AWAITING_OWNER_DECISION");
assert.equal(proposal.productWrites,0);
const decision=await decideR16IProposal(mockClient(),{
 proposalId,decision:"APPROVE_FOR_D8D_REVIEW",reason:"옵션 구분 증빙을 확인해 심사 승인",requestId:randomUUID()
},actor,review);
assert.equal(decision.productionWriteAuthorized,false);
await assert.rejects(()=>createR16IProposal(mockClient({verified:false}),base,actor,review),/EVIDENCE_NOT_VERIFIED/);
const state=await listR16ID8C(mockClient(),review);
assert.equal(state.writeAuthorized,false);
assert.equal(state.verdicts[0].verdict,"VERIFIED");
assert.equal(events.filter(x=>x.table==="products").length,0);
assert.equal(events.filter(x=>x.table==="product_offers").length,0);

const root="app/api/admin/products/r16i-correction-review/approval/route.js";
const api=fs.readFileSync(root,"utf8");
const ui=fs.readFileSync("app/admin/products/r16i-correction-review/R16IR4D8CorrectionApproval.js","utf8");
const parent=fs.readFileSync("app/admin/products/r16i-correction-review/R16ICorrectionEvidenceWorkbench.js","utf8");
const sql=fs.readFileSync("supabase/migrations/20261012172837_taxonomy_ai_r16i_correction_approval_ledger_v1.sql","utf8");
assert.match(api,/requireAdminCapability\(ADMIN_CAPABILITIES\.PRODUCTS_REVIEW\)/);
assert.match(api,/a\.access\.role!==ADMIN_ROLES\.OWNER/);
assert.match(api,/request\.headers\.get\("origin"\)/);
assert.match(api,/readGuardedReview\(a\.client\)/);
assert.match(api,/productionWriteAuthorized:false/);
assert.match(api,/Object\.keys\(body\)\.length!==2/);
assert.doesNotMatch(api,/export async function (PUT|PATCH|DELETE)\(/);
assert.doesNotMatch(api,/\.from\(["']products["']\)\.(insert|update|delete)/);
assert.match(ui,/증빙 검토 → 정정안 작성 → 소유자 결정/);
assert.match(ui,/검토 이력 새로고침/);
assert.match(ui,/정정안 제출 \(실제 적용 없음\)/);
assert.match(ui,/APPROVE_FOR_D8D_REVIEW/);
assert.match(parent,/<R16IR4D8CorrectionApproval review=\{review\} \/>/);
assert.match(parent,/실제 DB 반영 · D8-D 전까지 불가/);
assert.match(sql,/ENABLE ROW LEVEL SECURITY/g);
assert.match(sql,/REVOKE ALL ON public\.admin_product_correction_evidence_verdicts_v1/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.decide_r16i_product_correction_v1/);
assert.match(sql,/SECURITY INVOKER/);
assert.match(sql,/R16I_UNVERIFIED_EVIDENCE/);
assert.match(sql,/R16I_TWO_SOURCE_EVIDENCE_REQUIRED/);
assert.match(sql,/FOR UPDATE/);
assert.match(sql,/R16I_PRODUCT_REVISION_DRIFT/);
assert.match(sql,/R16I_SCOPE_COLLISION/);
assert.doesNotMatch(sql,/\b(UPDATE|DELETE)\s+(public\.)?(products|product_offers|product_fact_subjects)\b/i);
console.log(JSON.stringify({status:"PASS",stage:"R16I-R4-D8C",
 invalid_cases:denied,field_level_proposals:true,owner_only_decision:true,
 immutable_evidence_verdict:true,db_revision_lock:true,catalog_writes:0}));
