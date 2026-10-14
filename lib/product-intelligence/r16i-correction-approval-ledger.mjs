import { createHash } from "node:crypto";
import { R16I_PRODUCT_ID } from "../product-offer-r16i-r4-d4-live-review.mjs";

export const R16I_D8C_VERSION = "r16i-r4-d8c-v1";
export const R16I_STRATEGY = "A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const EVIDENCE="admin_product_correction_evidence_v1";
const REQUIRED_SELLERS = Object.freeze({
  official_single:"https://www.snature.kr/product/detail.html?product_no=151",
  hwahae_bundle:"https://www.hwahae.co.kr/goods/45194"
});
const VERDICTS="admin_product_correction_evidence_verdicts_v1";
const PROPOSALS="admin_product_correction_proposals_v1";
const DECISIONS="admin_product_correction_decisions_v1";
const ALLOWED = Object.freeze({
  "products.size_ml":"positive_decimal",
  "products.price_min":"money",
  "products.price_max":"money",
  "products.unit_price_per_10ml":"positive_decimal",
  "products.buy_link":"fixed_url"
});
const URLS=new Set(["https://www.snature.kr/product/detail.html?product_no=151",
  "https://www.hwahae.co.kr/goods/45194"]);
function fail(code) { throw new Error(code); }
function keysExact(obj,keys){
  return obj && typeof obj==="object" && !Array.isArray(obj) &&
    Object.keys(obj).length===keys.length && keys.every(k=>Object.hasOwn(obj,k));
}
function properText(v){return typeof v==="string"&&v.trim().length>=12&&v.trim().length<=2000;}
function uuid(v){return typeof v==="string"&&UUID.test(v);}
function oneRow({data,error},name) {
  if(error||!data)fail("R16I_D8C_"+name+"_FAILED");
  return data;
}
function rows({data,error},name) {
  if(error||!Array.isArray(data))fail("R16I_D8C_"+name+"_FAILED");
  return data;
}
export function r16iBaselineDigest(review) {
  if(review?.decision!=="REVIEW_REQUIRED"||review.product_id!==R16I_PRODUCT_ID ||
    !review.live_read_verified||!review.revision_matches||!review.collision_free ||
    !Array.isArray(review.reviewed_fields)||review.reviewed_fields.length!==20)
    fail("R16I_D8C_PRESTATE_BLOCKED");
  const stable=review.reviewed_fields.map(row=>[row.entity,row.field,row.before]);
  return createHash("sha256").update(JSON.stringify({
    product_id:review.product_id,revision:review.product_revision,fields:stable
  })).digest("hex");
}
export function validateR16IVerdict(input) {
  if(!keysExact(input,["evidenceId","verdict","reason","requestId"]) ||
    !uuid(input.evidenceId)||!uuid(input.requestId)||
    !["VERIFIED","REJECTED"].includes(input.verdict)||!properText(input.reason))
    fail("R16I_D8C_INVALID_EVIDENCE_REVIEW");
  return input;
}
export function validateR16IProposal(input,review) {
  if(!keysExact(input,["strategy","baselineSha256","productRevision",
      "fieldChanges","evidenceIds","rationale","requestId"]) ||
      input.strategy!==R16I_STRATEGY || !SHA.test(input.baselineSha256??"")||
      !uuid(input.requestId)||!properText(input.rationale) ||
      input.productRevision!==review?.product_revision ||
      input.baselineSha256!==r16iBaselineDigest(review) ||
      !Array.isArray(input.fieldChanges) || input.fieldChanges.length<1 || input.fieldChanges.length>8 ||
      !Array.isArray(input.evidenceIds)||input.evidenceIds.length<2||input.evidenceIds.length>12 ||
      input.evidenceIds.some(id=>!uuid(id)) ||
      new Set(input.evidenceIds).size!==input.evidenceIds.length)
    fail("R16I_D8C_INVALID_PROPOSAL");
  const beforeMap=new Map(review.reviewed_fields.map(row=>[row.entity+"."+row.field,row.before]));
  const checked=new Set();
  const fields=input.fieldChanges.map(row=>{
    if(!keysExact(row,["field","before","after"])||
       !Object.hasOwn(ALLOWED,row.field)||checked.has(row.field)||
       !beforeMap.has(row.field)||JSON.stringify(beforeMap.get(row.field))!==JSON.stringify(row.before))
      fail("R16I_D8C_FIELD_NOT_AUTHORIZED");
    checked.add(row.field);
    const kind=ALLOWED[row.field];
    if(kind==="money" && !(Number.isSafeInteger(row.after)&&row.after>=0&&row.after<=100000000))
      fail("R16I_D8C_INVALID_AFTER");
    if(kind==="positive_decimal" &&
       !(typeof row.after==="number" && Number.isFinite(row.after)&&row.after>0&&row.after<=100000))
      fail("R16I_D8C_INVALID_AFTER");
    if(kind==="fixed_url" && !URLS.has(row.after))
      fail("R16I_D8C_INVALID_AFTER");
    if(JSON.stringify(row.after)===JSON.stringify(row.before))
      fail("R16I_D8C_UNCHANGED_FIELD");
    return {field:row.field,before:row.before,after:row.after};
  });
  const max=fields.find(f=>f.field==="products.price_max");
  const min=fields.find(f=>f.field==="products.price_min");
  if(max && min && max.after<min.after)fail("R16I_D8C_PRICE_ORDER_INVALID");
  // This review approves a human-authored draft, not a unit-price projection.
  return {strategy:input.strategy,fieldChanges:fields,
    evidenceIds:[...input.evidenceIds],productRevision:input.productRevision,
    baselineSha256:input.baselineSha256,rationale:input.rationale.trim(),requestId:input.requestId};
}
export function validateR16IDecision(input) {
  if(!keysExact(input,["proposalId","decision","reason","requestId"])||
     !uuid(input.proposalId)||!uuid(input.requestId)||
     !["APPROVE_FOR_D8D_REVIEW","HOLD","REJECT"].includes(input.decision)||
     !properText(input.reason))fail("R16I_D8C_INVALID_DECISION");
  return input;
}
export async function listR16ID8C(client,review) {
  const baselineSha256=r16iBaselineDigest(review);
  const [v,p,d]=await Promise.all([
    client.from(VERDICTS).select("evidence_id,verdict,reason,reviewed_at").order("reviewed_at",{ascending:false}).limit(50),
    client.from(PROPOSALS).select("proposal_id,product_revision,baseline_sha256,field_changes,evidence_ids,rationale,created_at,authored_by").eq("product_id",R16I_PRODUCT_ID).order("created_at",{ascending:false}).limit(30),
    client.from(DECISIONS).select("decision_id,proposal_id,decision,reason,decided_at").order("decided_at",{ascending:false}).limit(50)
  ]);
  return {
    baselineSha256,productRevision:review.product_revision,
    verdicts:rows(v,"VERDICT_READ").map(t=>({evidenceId:t.evidence_id,verdict:t.verdict,reason:t.reason,reviewedAt:t.reviewed_at})),
    proposals:rows(p,"PROPOSAL_READ").map(t=>({proposalId:t.proposal_id,productRevision:t.product_revision,
      baselineSha256:t.baseline_sha256,fieldChanges:t.field_changes,evidenceIds:t.evidence_ids,
      rationale:t.rationale,createdAt:t.created_at,stale:t.baseline_sha256!==baselineSha256})),
    decisions:rows(d,"DECISION_READ").map(t=>({decisionId:t.decision_id,proposalId:t.proposal_id,
      decision:t.decision,reason:t.reason,decidedAt:t.decided_at})),
    writeAuthorized:false,releaseReady:false,version:R16I_D8C_VERSION
  };
}
export async function reviewR16IEvidence(client,input,actorId) {
  const valid=validateR16IVerdict(input);
  if(!uuid(actorId))fail("R16I_D8C_MISSING_ACTOR");
  const evidence=oneRow(await client.from(EVIDENCE).select("evidence_id,product_id")
    .eq("evidence_id",valid.evidenceId).eq("product_id",R16I_PRODUCT_ID).maybeSingle(),"EVIDENCE_SCOPE");
  if(evidence.product_id!==R16I_PRODUCT_ID)fail("R16I_D8C_EVIDENCE_SCOPE_MISMATCH");
  const {data,error}=await client.from(VERDICTS).insert({
    evidence_id:valid.evidenceId,verdict:valid.verdict,reason:valid.reason.trim(),
    reviewer_id:actorId,request_id:valid.requestId
  }).select("verdict_id,evidence_id,verdict,reviewed_at").single();
  const saved=oneRow({data,error},"EVIDENCE_VERDICT_WRITE");
  return {verdictId:saved.verdict_id,evidenceId:saved.evidence_id,verdict:saved.verdict,
    reviewedAt:saved.reviewed_at,productWrites:0,priceApproved:false};
}
export async function createR16IProposal(client,input,actorId,review) {
  if(!uuid(actorId))fail("R16I_D8C_MISSING_ACTOR");
  const valid=validateR16IProposal(input,review);
  const ev=rows(await client.from(EVIDENCE).select("evidence_id,product_id,source_key,source_url")
    .eq("product_id",R16I_PRODUCT_ID).in("evidence_id",valid.evidenceIds).limit(12),"EVIDENCE_READ");
  if(ev.length!==valid.evidenceIds.length)fail("R16I_D8C_EVIDENCE_NOT_IN_SCOPE");
  // Prevent single-seller proposals from being stored as if they were eligible
  // for an OWNER decision. The D8D database gate enforces this independently.
  if(ev.some(row=>!Object.hasOwn(REQUIRED_SELLERS,row.source_key) ||
      row.source_url!==REQUIRED_SELLERS[row.source_key]) ||
      new Set(ev.map(row=>row.source_key)).size!==2)
    fail("R16I_D8C_TWO_SOURCE_EVIDENCE_REQUIRED");
  const verified=rows(await client.from(VERDICTS).select("evidence_id,verdict")
    .in("evidence_id",valid.evidenceIds).limit(12),"VERDICTS_READ");
  if(verified.length!==valid.evidenceIds.length || verified.some(x=>x.verdict!=="VERIFIED"))
    fail("R16I_D8C_EVIDENCE_NOT_VERIFIED");
  const {data,error}=await client.from(PROPOSALS).insert({
    product_id:R16I_PRODUCT_ID,product_revision:valid.productRevision,
    baseline_sha256:valid.baselineSha256,strategy:valid.strategy,
    field_changes:valid.fieldChanges,evidence_ids:valid.evidenceIds,
    rationale:valid.rationale,authored_by:actorId,request_id:valid.requestId
  }).select("proposal_id,created_at,field_changes").single();
  const saved=oneRow({data,error},"PROPOSAL_WRITE");
  return {proposalId:saved.proposal_id,createdAt:saved.created_at,fieldChanges:saved.field_changes,
    status:"AWAITING_OWNER_DECISION",productWrites:0,writeAuthorized:false};
}
export async function decideR16IProposal(client,input,actorId,review) {
  if(!uuid(actorId))fail("R16I_D8C_MISSING_ACTOR");
  r16iBaselineDigest(review);
  const valid=validateR16IDecision(input);
  const {data,error}=await client.rpc("decide_r16i_product_correction_v1",{
    p_proposal_id:valid.proposalId,p_decision:valid.decision,
    p_reason:valid.reason.trim(),p_actor_id:actorId,p_request_id:valid.requestId
  });
  if(error||!data||data.productWrites!==0||data.productionWriteAuthorized!==false ||
     data.offerWrites!==0||data.rankingWrites!==0)
    fail("R16I_D8C_DECISION_RPC_FAILED");
  return data;
}
