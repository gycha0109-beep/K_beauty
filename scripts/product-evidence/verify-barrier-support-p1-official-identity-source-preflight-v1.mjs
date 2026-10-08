#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const dir="evidence/product-decision-axis-non-numeric-shadow-v2/";
const path=dir+"barrier-support-p1-official-identity-source-preflight-v1.json";
const queuePath=dir+"barrier-support-coverage-recovery-priority-queue-v1.json";
const reportPath="docs/evidence/v21-8h-r16a-p1-official-identity-source-preflight-v1.md";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const hash=p=>execFileSync("git",["hash-object",p],{encoding:"utf8"}).trim();
const d=read(path),q=read(queuePath),report=fs.readFileSync(reportPath,"utf8");
const p1=q.queue.filter(r=>r.priority_band==="P1_FULL_CONTEXT_BOUND_SOURCE").sort((a,b)=>a.research_order-b.research_order);

assert.equal(d.stage,"V2.1-8H-R16A_P1_OFFICIAL_IDENTITY_SOURCE_PREFLIGHT");
assert.equal(d.version,"barrier-support-p1-official-identity-source-preflight-v1");
assert.equal(d.production_project,"bygrczggxfuisupcevaz");
assert.equal(hash(queuePath),d.upstream.r8_queue_git_blob_sha);
assert.equal(d.upstream.r8_queue_path,queuePath);
assert.equal(d.products.length,11);
assert.equal(p1.length,11);
assert.deepEqual(d.products.map(r=>r.product_id),p1.map(r=>r.product_id));
assert.deepEqual(d.products.map(r=>r.research_order),p1.map(r=>r.research_order));
assert.equal(d.products[0].research_order,6);
assert.equal(d.products.at(-1).research_order,16);

const allTasks=[];
const allBindings=[];
for(let i=0;i<11;i++){
 const r=d.products[i],baseline=p1[i];
 assert.equal(r.product_id,baseline.product_id);
 assert.equal(r.brand,baseline.brand);
 assert.equal(r.name,baseline.name);
 assert.equal(r.category,baseline.category);
 assert.equal(r.priority_band,baseline.priority_band);
 assert.ok(r.catalog_size_ml===null || (Number.isFinite(r.catalog_size_ml) && r.catalog_size_ml>0));
 assert.deepEqual(r.historical_hold,baseline.historical_hold ?? null);
 assert.equal(r.market_attention_review_count,baseline.market_review_count);
 assert.equal(r.subject_count,0);
 assert.equal(r.fact_instance_count,0);
 assert.equal(r.intakes.length,1);
 assert.equal(r.intakes[0].state,"SUBJECT_CREATION_REQUIRED");
 assert.equal(r.intakes[0].trust,"REVIEW_REQUIRED");
 assert.equal(r.intakes[0].subject_id,null);
 assert.equal(r.research_tasks.length,2);
 assert.deepEqual(new Set(r.research_tasks.map(t=>t.fact_key)),new Set(["barrier_support_claim","primary_use_role"]));
 for(const t of r.research_tasks){
  assert.equal(t.state,"REVIEW_REQUIRED");
  assert.equal(t.attempts,0);
  allTasks.push(t.id);
 }
 assert.ok(r.source_bindings.length>0);
 for(const b of r.source_bindings){
  assert.equal(b.binding_state,"resolved");
  assert.equal(b.scope,"product_subject_unresolved");
  assert.equal(b.exact_product_verified_by_binding_alone,false);
  const hostname=new URL(b.url).hostname.toLowerCase();
  assert.equal(b.hostname,hostname);
  assert.equal(b.declared_vs_host_mismatch,b.source_name==="hwahae"&&!hostname.endsWith("hwahae.co.kr"));
  allBindings.push(b);
 }
 assert.equal(r.subject_registration_authorized,false);
 assert.equal(r.evidence_ingest_authorized,false);
 assert.equal(r.fact_confirmation_authorized,false);
 assert.ok(r.official_research.reason_code);
 assert.ok(r.official_research.unresolved.length>0);
 if(i<4){
  assert.ok(["READY","HOLD_PRESENTATION"].includes(r.official_research.status));
  assert.ok(r.official_research.sources.length>0);
  for(const s of r.official_research.sources){
   const host=new URL(s.url).hostname;
   assert.ok(["snature.kr","www.snature.kr","www.hwahae.co.kr","m.innisfree.com","www.anua.kr"].includes(host),host);
  }
 }else{
  assert.equal(r.official_research.status,"DEFERRED_P1_RESEARCH");
  assert.equal(r.official_research.confidence,"NOT_EVALUATED");
  assert.deepEqual(r.official_research.sources,[]);
 }
}
assert.equal(new Set(allTasks).size,22);
assert.equal(d.products[0].product_id,"b639c8b4-6a61-440e-b4db-fac7381593ff");
assert.equal(d.products[0].catalog_size_ml,160);
assert.equal(d.products[0].historical_hold.reason_code,"PRESENTATION_SCOPE_UNRESOLVED");
assert.equal(d.products[0].official_research.status,"HOLD_PRESENTATION");
assert.equal(d.products[0].official_research.reason_code,"CATALOG_160ML_EQUALS_RETAILER_DOUBLE_BUNDLE_NOT_BRAND_CONFIRMED_SINGLE_SKU");
const b=d.products[0].official_research.sources;
assert.deepEqual(b.filter(s=>s.authority==="KR_BRAND_OFFICIAL_EXACT_SINGLE_UNIT").map(s=>s.size_ml).sort((a,b)=>a-b),[60,80]);
assert.equal(b.find(s=>s.authority==="SECONDARY_RETAILER_BUNDLE").size_ml,160);
assert.ok(b.find(s=>s.authority==="SECONDARY_RETAILER_BUNDLE").observed.includes("80ml 더블"));
assert.deepEqual(d.products.slice(1,4).map(x=>x.official_research.status),["READY","READY","READY"]);
assert.deepEqual(d.products.slice(1,4).map(x=>x.catalog_size_ml),[40,60,80]);
assert.deepEqual(d.products.slice(1,4).map(x=>x.official_research.sources[0].size_ml),[40,60,80]);
assert.equal(d.products[7].historical_hold.reason_code,"FIRST_PARTY_SKU_AUTHORITY_MISSING");
assert.equal(d.products[7].official_research.status,"DEFERRED_P1_RESEARCH");
assert.equal(allBindings.filter(b=>b.declared_vs_host_mismatch).length,3);
assert.deepEqual(d.products.filter(x=>x.source_bindings.some(b=>b.declared_vs_host_mismatch)).map(x=>x.research_order),[11,13,14]);
assert.equal(allBindings.filter(b=>b.locator_type==="CATEGORY_RANKING").length,1);
assert.equal(d.products[3].source_bindings[0].locator_type,"CATEGORY_RANKING");

const s=d.summary;
assert.equal(s.p1_inventory,11);
assert.equal(s.deep_research,4);
assert.equal(s.official_identity_ready,3);
assert.equal(s.hold_presentation,1);
assert.equal(s.deferred,7);
assert.equal(s.subjects,0);
assert.equal(s.intakes,11);
assert.equal(s.research_tasks,22);
assert.equal(s.source_binding_mismatches,3);
assert.equal(s.ranking_locator_count,1);
assert.equal(s.production_writes,0);
assert.equal(d.capture_method.raw_source_bytes_archived,false);
assert.equal(d.capture_method.content_digest_generated,false);
assert.equal(d.capture_method.source_capture_sha256,null);
assert.equal(d.capture_method.no_invented_digest,true);
for(const k of ["subject_registration_authorized","evidence_ingest_authorized","fact_confirmation_authorized"])assert.ok(d.products.every(x=>x[k]===false));
for(const k of ["registry_changed","source_bindings_mutated","production_cutover_authorized","outdoor_rankable_signal_authorized","public_activation","recommendation_activation_authorized","numeric_pda_enabled"])assert.equal(d.invariance[k],false,k);
for(const k of ["subject_writes","trust_intake_writes","product_writes","evidence_writes","review_writes","fact_instance_writes","confirmation_writes","research_task_writes","recommendation_writes","numeric_contribution_delta","rank_delta","eligibility_delta"])assert.equal(d.invariance[k],0,k);
assert.equal(d.invariance.frozen_candidates,164);
assert.equal(d.invariance.frozen_scenarios,12);
assert.equal(d.invariance.frozen_evaluations,1968);
assert.equal(d.invariance.frozen_candidates*d.invariance.frozen_scenarios,d.invariance.frozen_evaluations);
assert.equal(d.rules.historical_hold_auto_release_forbidden,true);
assert.equal(d.rules.bundle_total_volume_is_not_single_sku,true);
assert.equal(d.rules.source_binding_resolved_is_not_first_party_authority,true);
assert.equal(d.decision,"R16A_P1_SOURCE_PREFLIGHT_READY3_HOLD1_DEFERRED7");
assert.deepEqual(d.next_gate.ready_candidate_product_ids,d.products.slice(1,4).map(x=>x.product_id));
assert.deepEqual(d.next_gate.hold_product_ids,[d.products[0].product_id]);
assert.equal(d.next_gate.deferred_product_ids.length,7);
assert.equal(d.next_gate.registration_authorized,false);
assert.equal(d.next_gate.registry_change_authorized,false);
assert.equal(d.next_gate.source_binding_repair_authorized,false);
assert.equal(d.next_gate.recommendation_activation_authorized,false);
for(const k of ["R16A_P1_SOURCE_PREFLIGHT_READY3_HOLD1_DEFERRED7","HOLD_PRESENTATION","이니스프리","아누아","80ml 더블","1,968","REVIEW_REQUIRED","바인딩 메타 불일치 3건"])assert.ok(report.includes(k),k);

console.log(JSON.stringify({status:"PASS",stage:d.stage,p1:11,deep:4,ready:3,hold:1,deferred:7,bindings_mismatched:3,ranking_urls:1,hosted_writes:0,activation:false}));
