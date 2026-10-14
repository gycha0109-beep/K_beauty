#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {classifyTrustP3ReadOnlyFunnelRow as classify,
  summarizeTrustP3ReadOnlyFunnel as summarize,TRUST_P3_FUNNEL_STAGES}
  from "../lib/trust/official-p3-readonly-funnel-v1.mjs";
const fetched="IDENTITY_OR_VARIANT_REVIEW_REQUIRED";
const okRoot={parseComplete:true,status:"SCOPED_NAME_AND_FORM_CANDIDATE"};
const sample=(status,root,gate="IDENTITY_REVIEW_REQUIRED")=>({status,
  live:root?{strictPrimaryRoot:root,gate}:undefined});
const rows=[
  {status:"PLAN_ONLY"},
  {status:"SOURCE_FETCH_HOLD"},
  {status:"SOURCE_POLICY_HOLD"},
  sample(fetched,{parseComplete:false,status:"AMBIGUOUS_ATTRIBUTES",
    attributeFailure:{reason:"PRIVATE_HTML_SECRET",tagKind:"DIV",attributeOrdinal:2}}),
  sample(fetched,{parseComplete:true,status:"PRIMARY_ROOT_NOT_PROVEN"}),
  sample(fetched,{parseComplete:true,status:"OWNER_FORM_UNPROVEN"}),
  sample(fetched,okRoot),
  sample(fetched,{...okRoot,selectedVariantShadow:{
    status:"NO_EXPLICIT_SELECTED_SIZE_HOLD"}}),
  sample(fetched,{...okRoot,selectedVariantShadow:{
    status:"SELECTED_SIZE_MATCH_SHADOW_ONLY",
    catalogSizeMatchShadow:true,selectedSizeVerified:false,exactSkuVerified:false}}),
  sample("DIRECT_PRODUCT_CANDIDATE_REVIEW_REQUIRED",{parseComplete:false,
    status:"UNBALANCED_HTML"},"EVIDENCE_CANDIDATE_ONLY"),
];
const wanted=["NOT_EXECUTED","SOURCE_HOLD","SOURCE_HOLD","ROOT_PARSER_HOLD",
  "PRIMARY_ROOT_HOLD","OWNED_FORM_HOLD","SIZE_NOT_EVALUATED",
  "SIZE_SELECTION_HOLD","SELECTED_SIZE_MATCH_SHADOW_ONLY","ROOT_PARSER_HOLD"];
assert.deepEqual(rows.map(r=>classify(r).stage),wanted);
const r=summarize(rows);
assert.equal(r.denominators.officialLocators,10);
assert.equal(r.denominators.htmlFetched,7);
assert.equal(r.primaryNameAndOwnedFormObserved,3);
assert.equal(r.explicitSelectedSizeMatchObserved,1);
assert.equal(r.existingP3ReviewCandidates,1);
assert.deepEqual(r.stageCounts,Object.fromEntries(TRUST_P3_FUNNEL_STAGES.map(x=>
 [x,wanted.filter(k=>k===x).length])));
assert.equal(Object.values(r.stageCounts).reduce((a,b)=>a+b),10);
for(const obj of [...rows.map(classify),r]){
  assert.equal(obj.exactSkuVerified??obj.verifiedExactSkuCount,false,
    "no verified SKU from preview");
  assert.equal(obj.factConfirmationAuthorized??obj.factWrites,0,
    "no fact write/authority from preview");
  assert.equal(obj.aiApiCalls,0);
  assert.equal(obj.dbWrites,0);
}
const malicious={status:fetched,live:{gate:"EVIDENCE_CANDIDATE_ONLY",
  strictPrimaryRoot:{...okRoot,selectedVariantShadow:{
    status:"SELECTED_SIZE_MATCH_SHADOW_ONLY",catalogSizeMatchShadow:true,
    selectedSizeVerified:true,exactSkuVerified:true,
    embeddedHTML:"VERY_PRIVATE_FORM_SECRET"}}}};
assert.equal(classify(malicious).stage,"SIZE_SELECTION_HOLD");
const encoded=JSON.stringify([r,classify(rows[3]),classify(malicious)]);
for(const secret of ["PRIVATE_HTML_SECRET","VERY_PRIVATE_FORM_SECRET",
  "SCOPED_NAME_AND_FORM_CANDIDATE","EVIDENCE_CANDIDATE_ONLY",
  "product_name","value=\"40ml\""]){
 assert.equal(encoded.includes(secret),false,"leaked diagnostic input "+secret);
}
assert.equal(classify({status:"totally unexpected"}).stage,"SOURCE_HOLD");
assert.throws(()=>summarize(Array(26).fill({status:"PLAN_ONLY"})),/INVALID_ROWS/);
const a=summarize(rows),b=summarize(rows);
assert.deepEqual(a,b);
const src=fs.readFileSync("lib/trust/official-p3-readonly-funnel-v1.mjs","utf8").toLowerCase();
for(const forbidden of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc(",
  "supabase_service_role_key","openai","gemini"]){
 assert.ok(!src.includes(forbidden),"forbidden side effect "+forbidden);
}
console.log("TRUST_P3_READONLY_FUNNEL_PR_D0_PASS");
