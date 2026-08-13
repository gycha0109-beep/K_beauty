#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BASE,FROZEN,REGISTRY,SERIALIZER,SUBJECT_SERIALIZER,deriveHistoricalM1,adjudicateScopeContract,proposition} from './product-evidence/product-fact-source-gap-recovery-wave-1-v1.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const E='evidence/product-evidence-expansion-v1/source-gap-recovery-wave-1-v1.json';
const M='evidence/product-fact-adoption-v1/source-gap-recovery-wave-1-materialization-v1.json';
const D='docs/evidence/product-fact-source-gap-recovery-wave-1-v1.md';
const HIST='evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json';
const BAD=['d60057513710623057d50147f88a6e1dd163858dfafbd63d78ed5f68aee85852','pilot-freeze-f858fe0da89dc69b5a88653faac76efc'];
const J=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [p,h] of [[HIST,FROZEN.materialization],['evidence/product-evidence-decision-axis-v1/cross-category-real-evidence-pilot-v1.json',FROZEN.corpus],['evidence/product-evidence-decision-axis-v1/cross-category-real-fact-mapping-pilot-v1.json',FROZEN.mapping],['evidence/product-evidence-decision-axis-v1/cross-category-real-pilot-gap-report-v1.json',FROZEN.gap]]) assert.equal(hash(fs.readFileSync(path.join(ROOT,p))),h,`frozen drift ${p}`);
const h=deriveHistoricalM1();
assert.deepEqual({digest:h.identity_digest,formulation:h.formulation_revision_key,subject:h.subject_semantic_key,market:h.selected_market,applicability:h.market_applicability},{digest:'eaa1452f7abd275fb4d096089a03e4b2d70fd07b6da6911c851d69a543392fba',formulation:'pilot-freeze-eaa1452f7abd275fb4d096089a03e4b2',subject:'d600446336216d911d4aada62502fcbcc5b800abc671094b27fa5625f241d810',market:'KR',applicability:null});
assert.equal(h.subject_identity_serializer_version,SUBJECT_SERIALIZER);
const scope=adjudicateScopeContract();
assert.deepEqual({result:scope.result,state:scope.binding_state,relation:scope.binding_scope_relation,change:scope.subject_identity_change_required},{result:'VALID_NARROWER_FACT_SCOPE',state:'exact_subject_match',relation:'narrower',change:false});
const o=J(E),m=J(M),texts=[E,M,D].map(p=>fs.readFileSync(path.join(ROOT,p),'utf8'));
assert.equal(o.authority.source_main_sha,BASE); assert.equal(o.authority.registry_version,REGISTRY); assert.equal(o.authority.proposition_serializer_version,SERIALIZER);
for(const bad of BAD) for(const text of texts) assert.ok(!text.includes(bad),`R1 bad authority leaked ${bad}`);
assert.deepEqual(o.research_scope,{target_pilots:['M1','M3','P1'],excluded_pilots:['P2'],targeted_source_gap_fact_slots:6});
assert.deepEqual(o.research_decision.per_target_fact_slot,{RECOVERED_SUPPORTED:2,VARIANT_SCOPE_CONFLICT:2,FORMULATION_SCOPE_CONFLICT:2,REMAINS_SOURCE_BLOCKED:0});
assert.deepEqual(o.research_decision.product_status,{M1:'RECOVERED_SUPPORTED',M3:'VARIANT_SCOPE_CONFLICT',P1:'FORMULATION_SCOPE_CONFLICT'});
assert.equal(o.fact_proposals.length,2); assert.equal(o.evidence_records.length,2); assert.equal(new Set(o.fact_proposals.map(x=>x.proposition_key)).size,2);
for(const fact of o.fact_proposals){const fresh=proposition(fact.fact_key,fact.typed_value,h.subject_semantic_key,{market:'KR'});assert.deepEqual(fact.proposition_identity,fresh.identity);assert.equal(fact.proposition_key,fresh.proposition_key);assert.equal(fact.semantic_status,'supported');assert.equal(fact.authority_ceiling,'product_specific_primary');assert.equal(fact.fused_confidence,'high');assert.deepEqual(fact.scope,{market:'KR'});assert.equal(fact.supporting_evidence_refs.length,1);}
const keyed=Object.fromEntries(o.fact_proposals.map(x=>[x.fact_key,x])); assert.equal(keyed.primary_use_role.typed_value,'multi_area'); assert.equal(keyed.barrier_support_claim.typed_value,true);
const slots=Object.fromEntries(o.recovery_outcomes.map(x=>[`${x.pilot_id}:${x.fact_key}`,x])); assert.equal(Object.keys(slots).length,6); for(const k of ['M3:primary_use_role','M3:barrier_support_claim']) assert.deepEqual([slots[k].outcome,slots[k].proposition_key],['VARIANT_SCOPE_CONFLICT',null]); for(const k of ['P1:product_format','P1:contains_active']) assert.deepEqual([slots[k].outcome,slots[k].proposition_key],['FORMULATION_SCOPE_CONFLICT',null]);
assert.deepEqual(o.registry_gaps,[{pilot_id:'M3',concept:'subjective_soothing_observation',outcome:'REGISTRY_GAP',registry_mutation:false}]); assert.equal(o.invariants.registry_expansion,false); assert.equal(o.invariants.missing_as_false,false); assert.equal(o.invariants.scope_conflict_promoted_to_supported,false); assert.equal(o.invariants.authority_inflation,false); assert.deepEqual(o.hosted_write_intent,{register_subject:0,ingest_evidence:0,prepare_review:0,preflight:0,confirm:0,direct_table_writes:0,hosted_product_fact_writes:0});
assert.deepEqual({products:m.summary.future_candidate_products,props:m.summary.future_candidate_propositions,subjects:m.summary.future_new_subjects,current:m.summary.future_new_current},{products:1,props:2,subjects:1,current:2}); assert.equal(m.candidate.historical_subject_identity.subject_semantic_key,h.subject_semantic_key); assert.equal(m.candidate.historical_subject_identity.market_applicability,null); assert.deepEqual(m.candidate.source_binding_plan,{source_ref:'source:wave1:M1:amorepacific',binding_state:'exact_subject_match',scope_relation:'narrower',subject_identity_change_required:false}); assert.equal(m.hosted_write_intent,0); assert.deepEqual(m.non_candidates.map(x=>[x.pilot_id,x.future_subject_registration_required,x.future_current]),[['M3',false,0],['P1',false,0],['P2',false,0]]);
assert.ok(!fs.existsSync(path.join(ROOT,'tmp/v21-8d-canonical/source-gap-recovery-wave-1-materialization-v1.json')),'tracked tmp staging remains');
for(const dir of ['app','components','lib']){const abs=path.join(ROOT,dir); if(!fs.existsSync(abs))continue; const stack=[abs]; while(stack.length){const cur=stack.pop(); for(const e of fs.readdirSync(cur,{withFileTypes:true})){const p=path.join(cur,e.name); if(e.isDirectory())stack.push(p); else if(/\.(?:js|mjs|jsx|ts|tsx)$/.test(e.name)){const t=fs.readFileSync(p,'utf8'); assert.ok(!t.includes('source-gap-recovery-wave-1-v1')&&!t.includes('source-gap-recovery-wave-1-materialization-v1'),`production import edge ${path.relative(ROOT,p)}`);}}}}
const a=fs.mkdtempSync(path.join(os.tmpdir(),'v21-8d-a-')),b=fs.mkdtempSync(path.join(os.tmpdir(),'v21-8d-b-')); for(const out of [a,b]) execFileSync(process.execPath,[path.join(ROOT,'scripts/build-product-fact-source-gap-recovery-wave-1-v1.mjs')],{cwd:ROOT,env:{...process.env,V21_8D_BASE_MAIN_SHA:BASE,V21_8D_OUTPUT_ROOT:out},stdio:'pipe'}); const hashes={}; for(const rel of [E,M,D]){const ba=fs.readFileSync(path.join(a,rel)),bb=fs.readFileSync(path.join(b,rel)),bc=fs.readFileSync(path.join(ROOT,rel));assert.deepEqual(ba,bb,`Build A/B mismatch ${rel}`);assert.deepEqual(ba,bc,`canonical drift ${rel}`);hashes[rel]=hash(ba);} fs.rmSync(a,{recursive:true,force:true});fs.rmSync(b,{recursive:true,force:true});
console.log(JSON.stringify({status:'PASS',historical_m1:{identity_digest:h.identity_digest,formulation_revision_key:h.formulation_revision_key,subject_semantic_key:h.subject_semantic_key,selected_market:h.selected_market,market_applicability:h.market_applicability},scope_relation:scope.result,binding_scope_relation:scope.binding_scope_relation,recovered_propositions:2,build_hashes:hashes,hosted_write_intent:0},null,2));
