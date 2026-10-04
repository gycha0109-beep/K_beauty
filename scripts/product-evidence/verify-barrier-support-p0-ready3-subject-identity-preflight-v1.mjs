#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const STAGE="V2.1-8H-R10";
const TERMINAL="BARRIER_SUPPORT_P0_READY3_SUBJECT_IDENTITY_PREFLIGHT_PASS";
const ROOT="evidence/product-decision-axis-non-numeric-shadow-v2";
const PREFLIGHT=`${ROOT}/barrier-support-p0-ready3-subject-identity-preflight-v1.json`;
const READBACK=`${ROOT}/barrier-support-p0-ready3-subject-identity-production-readback-v1.json`;
const R9_RESEARCH=`${ROOT}/barrier-support-p0-official-identity-authority-research-v1.json`;
const R9_LEDGER=`${ROOT}/barrier-support-p0-official-identity-decision-ledger-v1.json`;
const DOC="docs/evidence/v21-8h-r10-barrier-p0-ready3-subject-identity-preflight-v1.md";
const R9_RESEARCH_BLOB="c040d01f85dbda02afa8261b1ac46f05903c87f5";
const R9_LEDGER_BLOB="f87a71963f974d2cf83e8f118198c3a56ea6b709";

let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1};
const ok=(v,m)=>{assert.ok(v,m);assertions+=1};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const canonicalValue=v=>JSON.stringify(stable(v));
const canonicalFile=p=>canonicalValue(json(p))+"\n";
const sha256=v=>crypto.createHash("sha256").update(canonicalValue(v),"utf8").digest("hex");
const blob=p=>{const b=fs.readFileSync(p);return crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex")};

eq(blob(R9_RESEARCH),R9_RESEARCH_BLOB,"frozen R9 research blob");
eq(blob(R9_LEDGER),R9_LEDGER_BLOB,"frozen R9 ledger blob");
const r9=json(R9_LEDGER), p=json(PREFLIGHT), rb=json(READBACK);
eq(r9.primary_terminal_outcome,"BARRIER_SUPPORT_P0_OFFICIAL_IDENTITY_RESEARCH_READY3_HOLD2","R9 terminal");
eq(p.stage,STAGE,"stage");
eq(p.primary_terminal_outcome,TERMINAL,"terminal");
eq(p.products.length,3,"READY3 only");
eq(new Set(p.products.map(x=>x.product_id)),new Set(r9.ready_product_ids),"exact R9 READY3");
for(const id of r9.hold_product_ids) ok(!p.products.some(x=>x.product_id===id),`${id}: HOLD excluded`);

eq(p.production_prestate.product_fact_subject_total,47,"subject total");
eq(p.production_prestate.semantic_key_collisions,0,"semantic collisions");
eq(p.production_prestate.formulation_key_collisions,0,"formulation collisions");
eq(p.production_prestate.target_existing_subjects,0,"target subjects");
eq(p.production_prestate.target_intakes,3,"target intakes");
eq(p.production_prestate.target_research_tasks,6,"target tasks");
eq(p.production_prestate.target_source_candidates,0,"legacy target candidates");

const seenSemantic=new Set(), seenRevision=new Set(), seenIntakes=new Set(), seenTasks=new Set();
for(const x of p.products){
  eq(sha256(x.canonical_capture),x.capture_digest,`${x.product_id}: capture digest`);
  eq(x.formulation_revision_key,`v21-8h-r10:${x.capture_digest}`,`${x.product_id}: formulation revision`);
  eq(sha256(x.semantic_identity),x.subject_semantic_key,`${x.product_id}: semantic key`);
  eq(x.semantic_identity.product_id,x.product_id,`${x.product_id}: semantic product`);
  eq(x.semantic_identity.variant_key,null,`${x.product_id}: variant null`);
  eq(x.semantic_identity.market_applicability,"KR",`${x.product_id}: KR semantic market`);
  eq(x.prestate.existing_subject_count,0,`${x.product_id}: no subject`);
  eq(x.prestate.source_candidate_count,0,`${x.product_id}: no source candidate`);
  eq(x.prestate.intake.market,null,`${x.product_id}: legacy null market`);
  eq(x.prestate.intake.subject_id,null,`${x.product_id}: intake no subject`);
  eq(x.prestate.intake.identity_state,"SUBJECT_CREATION_REQUIRED",`${x.product_id}: intake identity state`);
  eq(x.prestate.intake.trust_state,"REVIEW_REQUIRED",`${x.product_id}: intake trust state`);
  eq(x.prestate.tasks.length,2,`${x.product_id}: two tasks`);
  eq(new Set(x.prestate.tasks.map(t=>t.fact_key)),new Set(["barrier_support_claim","primary_use_role"]),`${x.product_id}: exact task keys`);
  for(const t of x.prestate.tasks){
    eq(t.state,"REVIEW_REQUIRED",`${t.id}: review required`);
    eq(t.blocker_code,"SUBJECT_CREATION_REQUIRED",`${t.id}: subject blocker`);
    eq(t.subject_id,null,`${t.id}: no task subject`);
    eq(t.attempt_count,0,`${t.id}: pristine attempts`);
    eq(t.registry_version,"product-fact-registry-cross-category-v1",`${t.id}: registry v1`);
    ok(!seenTasks.has(t.id),`${t.id}: unique task`);seenTasks.add(t.id);
  }
  eq(x.intake_identity_payload.intake_id,x.prestate.intake.id,`${x.product_id}: intake payload id`);
  eq(x.intake_identity_payload.expected_updated_at,x.prestate.intake.expected_updated_at,`${x.product_id}: optimistic lock`);
  eq(x.intake_identity_payload.market,"KR",`${x.product_id}: intake KR`);
  eq(x.intake_identity_payload.source_content_digest,x.capture_digest,`${x.product_id}: intake digest`);
  eq(x.intake_identity_payload.official_source_locator,x.canonical_capture.source_locator,`${x.product_id}: intake locator`);
  eq(Object.keys(x.intake_identity_payload).sort(),[
    "expected_updated_at","identity_resolution_version","intake_id","market",
    "official_source_locator","resolution_reason","source_content_digest"
  ],`${x.product_id}: exact intake payload keys`);
  eq(Object.keys(x.subject_registration_payload).sort(),[
    "current_state","formulation_label","formulation_revision_key","identity_resolution_version",
    "identity_status","market_applicability","predecessor_subject_id","product_id","region_applicability",
    "subject_identity_serializer_version","subject_semantic_key","supersession_kind","valid_from","valid_to","variant_key"
  ],`${x.product_id}: exact subject payload keys`);
  eq(x.subject_registration_payload.subject_semantic_key,x.subject_semantic_key,`${x.product_id}: subject key`);
  eq(x.subject_registration_payload.subject_identity_serializer_version,"product-fact-subject-identity-v1",`${x.product_id}: serializer`);
  eq(x.subject_registration_payload.identity_status,"resolved",`${x.product_id}: resolved`);
  eq(x.subject_registration_payload.current_state,"current",`${x.product_id}: current`);
  eq(x.subject_registration_payload.market_applicability,"KR",`${x.product_id}: subject KR`);
  eq(x.subject_registration_payload.predecessor_subject_id,null,`${x.product_id}: no predecessor`);
  eq(x.subject_registration_payload.supersession_kind,null,`${x.product_id}: no supersession`);
  eq(x.reconciliation_call.registry_version,"product-fact-registry-cross-category-v1",`${x.product_id}: reconcile registry`);
  for(const [k,v] of Object.entries(x.preflight_checks)) eq(v,true,`${x.product_id}: ${k}`);
  ok(!seenSemantic.has(x.subject_semantic_key),`${x.product_id}: unique semantic`);seenSemantic.add(x.subject_semantic_key);
  ok(!seenRevision.has(x.formulation_revision_key),`${x.product_id}: unique revision`);seenRevision.add(x.formulation_revision_key);
  ok(!seenIntakes.has(x.prestate.intake.id),`${x.product_id}: unique intake`);seenIntakes.add(x.prestate.intake.id);
}

eq(seenTasks.size,6,"six task ids");
eq(rb.targets.length,3,"readback targets");
eq(rb.function_readback.length,3,"three service functions");
for(const f of rb.function_readback){
  eq(f.anon_execute,false,`${f.signature}: anon denied`);
  eq(f.authenticated_execute,false,`${f.signature}: auth denied`);
  eq(f.service_role_execute,true,`${f.signature}: service allowed`);
}
eq(rb.mutation_counts,{subject_writes:0,intake_writes:0,task_writes:0,evidence_writes:0,product_fact_writes:0},"no production mutations");
for(const k of [
  "subject_registration_authorized_in_r10","intake_mutation_authorized_in_r10","task_mutation_authorized_in_r10",
  "evidence_research_started","product_fact_adjudication_started","product_fact_write_authorized",
  "recommendation_change_authorized","public_activation"
]) eq(p.authority_boundary[k],false,`boundary ${k}`);
eq(p.authority_boundary.missing_implies_false,false,"missing != false");
eq(p.next_gate.stage,"V2.1-8H-R11_BARRIER_SUPPORT_P0_READY3_CONTROLLED_SUBJECT_REGISTRATION","next gate");
eq(p.next_gate.product_count,3,"next 3");
eq(p.next_gate.status,"RECOMMENDED_NOT_EXECUTED","R11 not executed");
for(const f of [PREFLIGHT,READBACK]) eq(read(f),canonicalFile(f),`${f}: canonical bytes`);
const doc=read(DOC);
for(const token of [TERMINAL,"READY 3","Subject 0","intake 1","task 2","충돌 0","V2.1-8H-R11"]) ok(doc.includes(token),`doc token ${token}`);
console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,assertions,ready:3,tasks:6,mutations:0}));
