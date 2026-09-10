#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {C,buildPlan,pretty,digest} from "./trust-p8-sunscreen-hosted-adoption-plan-v1.mjs";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const blob=p=>execFileSync("git",["hash-object",p],{cwd:ROOT,encoding:"utf8"}).trim();
assert.equal(blob(C.p7Path),C.p7Blob,"P7 blob authority drift");
const p7=JSON.parse(read(C.p7Path)),frozen=JSON.parse(read(C.output)),rebuilt=buildPlan(p7);
assert.equal(pretty(frozen),pretty(rebuilt),"deterministic plan drift");
assert.equal(frozen.plan_content_sha256,digest(Object.fromEntries(Object.entries(frozen).filter(([k])=>k!=="plan_content_sha256"))),"plan digest");
assert.equal(frozen.source_main_sha,C.sourceMain);
assert.equal(frozen.phase_a_expected_writes,0);
assert.equal(frozen.phase_b_execution_authorized,false);
assert.equal(frozen.subjects.length,3); assert.equal(frozen.sources.length,3); assert.equal(frozen.propositions.length,6);
assert.ok(!frozen.subjects.some(x=>x.product_id===C.blocked));
assert.deepEqual([...new Set(frozen.propositions.map(x=>x.fact_key))].sort(),["spf_value","uva_label"]);
for(const s of frozen.subjects) assert.match(s.subject_semantic_key,/^[0-9a-f]{64}$/);
for(const s of frozen.sources){
  assert.match(s.content_digest,/^[0-9a-f]{64}$/);
  assert.equal(s.digest_basis,"trust-p7-frozen-source-observation-v1-not-live-page-bytes");
}
for(const p of frozen.propositions){
  assert.match(p.proposition_key,/^[0-9a-f]{64}$/); assert.match(p.canonical_evidence_digest,/^[0-9a-f]{64}$/);
  assert.equal(p.evidence_class,"product_claim"); assert.equal(p.evidence_authority,"product_specific_primary");
  if(p.fact_key==="spf_value"){assert.equal(p.value,50);assert.equal(p.value_type,"number");assert.deepEqual(p.qualifier,{plus_modifier:"plus"});}
  else{assert.equal(p.value,"PA++++");assert.equal(p.value_type,"enum");assert.deepEqual(p.qualifier,{});}
}
const boj="765b3ca1-6927-49b0-bee6-4138d03dd915";
assert.ok(frozen.propositions.filter(x=>x.product_id===boj).every(x=>x.scope.market==="GLOBAL"));
assert.ok(frozen.propositions.filter(x=>x.product_id!==boj).every(x=>x.scope.market==="KR"));
assert.ok(frozen.sources.filter(x=>x.product_id!==boj).every(x=>x.binding_scope_relation==="narrower"&&x.companion_identity_source_urls.length===1));
assert.equal(new Set(frozen.propositions.map(x=>x.proposition_key)).size,6);
console.log(JSON.stringify({ok:true,stage:frozen.stage,source_main_sha:frozen.source_main_sha,products:3,propositions:6,phase_a_writes:0,plan_content_sha256:frozen.plan_content_sha256},null,2));
