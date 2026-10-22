#!/usr/bin/env node
import assert from "node:assert/strict";
import {processClaimedTask} from "./trust-research-worker.mjs";

const PRODUCT="11111111-1111-4111-8111-111111111111";
const SUBJECT="22222222-2222-4222-8222-222222222222";
const BINDING="33333333-3333-4333-8333-333333333333";
const TASK="44444444-4444-4444-8444-444444444444";
const SOURCE="https://brand.example/product/120?variant=1";
const safeSource={
  source_binding_id:BINDING,source_name:"brand_official",
  external_type:"brand_official_product_page",
  binding_method:"official_product_url",product_scope_state:"product",
  canonical_locator:SOURCE,market:"KR",locale:"ko-KR",
};
function task(fact="low_ph",seeds=[safeSource]){
  return {task_id:TASK,product_id:PRODUCT,subject_id:SUBJECT,
    fact_key:fact,official_source_seeds:seeds,parent_propositions:[]};
}
function html(title,description="",body=""){
  return Buffer.from("<html><head><title>"+title+"</title>"+
    '<meta name="description" content="'+description+'"></head><body>'+
    body+"</body></html>");
}
async function simulated(input,bytes,redirect=null){
  const calls=[];
  const db={
    async rpc(name,args){
      assert.equal(name,"record_trust_research_result_v1");
      assert.equal(args.p_task_id,TASK);
      calls.push(args.p_result);
      return {data:args.p_result,error:null};
    },
  };
  let fetched=0;
  const capture=await processClaimedTask(db,input,
    async()=>{throw Error("LIVE_NETWORK_MUST_NOT_RUN");},
    {fetchOfficialPage:async url=>{
      fetched++;
      assert.equal(url,SOURCE);
      return {bytes,finalUrl:redirect||SOURCE,contentType:"text/html"};
    }});
  assert.equal(calls.length,1,"one governed RPC write proposal only");
  assert.deepEqual(capture,calls[0]);
  return {capture,fetched};
}
const positive=await simulated(task("low_ph"),html(
  "닥터지 약산성 클렌징 젤 폼 200ml","순한 약산성 클렌징 젤 폼"));
assert.equal(positive.capture.outcome,"EVIDENCE_CANDIDATE");
assert.equal(positive.capture.candidate.normalized_value,true);
assert.equal(positive.capture.candidate.evidence_class,"product_claim");
assert.equal(positive.capture.candidate.confidence,"high");
assert.equal(positive.capture.source.source_binding_id,BINDING);
assert.equal(positive.capture.source.product_identity_observation.product_id,PRODUCT);
assert.equal(positive.capture.source.product_identity_observation.exact_catalog_product_binding,true);
assert.equal(positive.capture.source.observed_claim.productFactConfirmed,false);
assert.match(positive.capture.source.source_content_digest,/^[0-9a-f]{64}$/);
const alkaline=await simulated(task("low_ph"),html(
  "마녀공장 퓨어 소이빈 클렌징 폼 160ml",
  "숨은 노폐물까지 세정하는 약알칼리성 클렌징 폼"));
assert.equal(alkaline.capture.candidate.normalized_value,false);
assert.equal(alkaline.capture.outcome,"EVIDENCE_CANDIDATE");
const deep=await simulated(task("deep_cleansing"),html(
  "라로슈포제 에빠끌라 딥 클렌징 포밍 크림 125ml"));
assert.equal(deep.capture.candidate.normalized_value,true);
const notInBody=await simulated(task("deep_cleansing"),html(
  "제로이드 포밍 클렌저 240ml","촉촉한 데일리 세안",
  "<section>같이 구매하면 좋은 제품: 딥 클렌징 포밍 크림</section>"));
assert.equal(notInBody.capture.outcome,"EVIDENCE_INSUFFICIENT");
const absent=await simulated(task("low_ph"),html("제로이드 포밍 클렌저 240ml"));
assert.equal(absent.capture.outcome,"EVIDENCE_INSUFFICIENT");
const redirected=await simulated(task("low_ph"),html(
  "닥터지 약산성 클렌징 젤 폼 200ml"),
  "https://brand.example/product/120?variant=2");
assert.equal(redirected.capture.outcome,"SOURCE_BLOCKED");
assert.match(redirected.capture.detail,/exact_bound_source_redirect_mismatch/);
const redirectedHost=await simulated(task("deep_cleansing"),html(
  "라로슈포제 딥 클렌징 크림 125ml"),
  "https://other-brand.example/product/120?variant=1");
assert.equal(redirectedHost.capture.outcome,"SOURCE_BLOCKED");
const noSeeds=await simulated(task("low_ph",[]),Buffer.alloc(0));
assert.equal(noSeeds.capture.outcome,"SOURCE_BLOCKED");
assert.equal(noSeeds.fetched,0);
console.log(JSON.stringify({
  status:"PASS",cases:8,
  networkCalls:0,dbCalls:0,realCandidatesCreated:0,
  exactOfficialSourceRedirectEnforced:true,
  cleanserBooleanCandidateSerializationVerified:true,
  actualG2Grants:0,
},null,2));
