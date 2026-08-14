#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {AUTHORITY,EXPECTED_PRODUCT_IDS,stable,sha256} from './product-evidence/product-fact-catalog-evidence-research-wave-1-v1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const skip=process.argv.includes('--skip-upstream-hash-check')||process.env.V21_8G_SKIP_UPSTREAM_HASH_CHECK==='1';
const J=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const fileSha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
let assertions=0; const A=(x,msg)=>{assert.ok(x,msg);assertions++;}; const E=(a,b,msg)=>{assert.deepEqual(a,b,msg);assertions++;};
const R=J('evidence/product-evidence-expansion-v1/catalog-evidence-research-wave-1-v1.json');
const M=J('evidence/product-fact-adoption-v1/catalog-evidence-research-wave-1-materialization-v1.json');

E(R.version,'catalog-evidence-research-wave-1-v1'); E(R.stage,'V2.1-8G');
E(R.batch.product_count,12); E(R.batch.target_slot_count,45); E(R.products.length,12); E(R.fact_slots.length,45);
const expectedIds=EXPECTED_PRODUCT_IDS; E(R.batch.exact_product_ids,expectedIds);
E(new Set(R.products.map(x=>x.product_id)).size,12); E(new Set(R.products.map(x=>x.product_id)),new Set(expectedIds));
E(R.products.every(x=>x.identity_status==='resolved'),true);
E(R.summary.supported_product_count,7); E(R.summary.supported_proposition_count,16); E(R.summary.proposition_collision_count,0);
E(R.summary.disposition_counts,{EVIDENCE_INSUFFICIENT:15,REGISTRY_GAP:2,REVIEWED_NOT_ESTABLISHED:9,SOURCE_ACCESS_BLOCKED:3,SOURCE_NOT_FOUND:4,SUPPORTED:12});
const terminal=new Set(['SUPPORTED','REVIEWED_NOT_ESTABLISHED','NOT_REVIEWED','EVIDENCE_INSUFFICIENT','SOURCE_NOT_FOUND','SOURCE_ACCESS_BLOCKED','IDENTITY_BLOCKED','VARIANT_SCOPE_CONFLICT','FORMULATION_SCOPE_CONFLICT','REGISTRY_GAP','EVIDENCE_CONFLICT']);
A(R.fact_slots.every(x=>terminal.has(x.disposition)),'non-terminal disposition');
A(!R.fact_slots.some(x=>x.disposition!=='SUPPORTED'&&x.normalized_value===false),'missing/RNE/blocked converted to false');
A(!R.fact_slots.some(x=>x.disposition==='REVIEWED_NOT_ESTABLISHED'&&x.normalized_value===false),'RNE converted to false');
A(R.fact_slots.filter(x=>x.disposition==='SUPPORTED').every(x=>x.authority==='product_specific_primary'),'supported authority inflation');
A(R.fact_slots.filter(x=>x.disposition==='SUPPORTED').every(x=>x.confidence==='high'),'supported confidence');
A(R.sources.filter(x=>x.source_authority_candidate==='none').every(x=>x.source_kind.startsWith('secondary')),'secondary source inflated');
A(R.supported_propositions.every(x=>x.authority==='product_specific_primary'&&x.fusion_status==='supported'),'fusion authority/status mismatch');
const allowedEntities=new Set(['hyaluronic_acid','mandelic_acid','niacinamide','panthenol','sodium_hyaluronate_crosspolymer']);
for(const f of R.supported_propositions.filter(x=>x.fact_key==='contains_active'))A(allowedEntities.has(f.value),'unapproved entity identifier');
for(const f of R.supported_propositions){
  const identity={subject_semantic_key:f.subject_semantic_key,registry_version:AUTHORITY.registry_version,fact_key:f.fact_key,value_identity:f.value,scope:stable(f.scope),qualifier:{},parent_proposition_key:null,serializer_version:AUTHORITY.proposition_serializer};
  E(sha256(identity),f.proposition_key,`proposition serialization ${f.product_id}/${f.fact_key}`);
}
E(new Set(R.supported_propositions.map(x=>x.proposition_key)).size,R.supported_propositions.length);
for(const s of R.supported_subjects){
  const semantic={product_id:s.product_id,variant_key:s.variant_key,formulation_revision_key:s.formulation_revision_key,market_applicability:s.market_applicability,region_applicability:s.region_applicability,valid_from:s.valid_from,valid_to:s.valid_to};
  E(sha256(semantic),s.subject_semantic_key,`subject serializer ${s.product_id}`);
  E(s.subject_identity_serializer_version,AUTHORITY.subject_serializer);
}
E(M.authority.research_json_sha256,fileSha('evidence/product-evidence-expansion-v1/catalog-evidence-research-wave-1-v1.json'));
E(M.summary.future_new_subjects,7); E(M.summary.future_new_sources,7); E(M.summary.future_new_bindings,7);
for(const k of ['future_new_evidence','future_new_fact_instances','future_new_evidence_links','future_new_review_assignments','future_new_confirmations','future_new_current'])E(M.summary[k],16);
E(M.summary.projected_adopted_product_count,16); E(M.summary.projected_current_fact_count,41);
E(M.hosted_write_intent,{register_subject:0,ingest_evidence:0,prepare_review:0,preflight:0,confirm:0,direct_table_writes:0});
E(M.invariants.hosted_product_fact_writes,0); E(M.invariants.v21_8h_started,false);
A(M.fact_candidates.every(x=>x.fusion_status==='supported'),'non-supported materialization candidate');
E(M.fact_candidates.length,R.supported_propositions.length);
E(M.evidence_candidates.length,R.evidence_records.length);
E(M.candidate_products.length,7);
if(!skip){
  E(fileSha('evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v1.json'),AUTHORITY.selection_json_sha256);
  E(fileSha('docs/evidence/product-fact-catalog-expansion-wave-1-selection-v1.md'),AUTHORITY.selection_md_sha256);
  const registry=J('evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json');
  E(registry.registry_version,AUTHORITY.registry_version); E(registry.facts.length,20);
  const defs=new Map(registry.facts.map(x=>[x.fact_key,x]));
  const expected=['primary_use_role','barrier_support_claim','contains_active','active_concentration','product_format','recommended_use_frequency','wipe_off_use','low_ph','deep_cleansing','fragrance_declared','pad_surface_texture'];
  for(const key of expected)A(defs.has(key),`Registry target missing ${key}`);
  E(defs.get('primary_use_role').allowed_values,['full_face','local_area','spot_use','multi_area','body_possible']);
  E(defs.get('product_format').allowed_values,['liquid','pad']);
  E(defs.get('pad_surface_texture').allowed_values,['smooth','embossed','textured']);
  E(defs.get('fragrance_declared').allowed_values,['fragrance_present_declared','fragrance_free_claim']);
}
console.log(JSON.stringify({status:'PASS',assertions,products:12,target_slots:45,supported_products:R.summary.supported_product_count,supported_propositions:R.summary.supported_proposition_count,proposition_collisions:R.summary.proposition_collision_count,hosted_writes:0,projected_adopted_products:M.summary.projected_adopted_product_count,projected_current:M.summary.projected_current_fact_count}));
