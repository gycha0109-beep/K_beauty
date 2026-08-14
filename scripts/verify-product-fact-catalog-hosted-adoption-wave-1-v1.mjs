#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const J=rel=>JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));
const fileSha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value);
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(stable(value))).digest('hex');
let assertions=0; const A=(x,m)=>{assert.ok(x,m);assertions++;}; const E=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++;};
const research=J('evidence/product-evidence-expansion-v1/catalog-evidence-research-wave-1-v1.json');
const materialization=J('evidence/product-fact-adoption-v1/catalog-evidence-research-wave-1-materialization-v1.json');
const plan=J('evidence/product-fact-adoption-v1/catalog-hosted-adoption-wave-1-v1.json');
const registry=J('evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json');
E(fileSha('evidence/product-evidence-expansion-v1/catalog-evidence-research-wave-1-v1.json'),'9dcf1462a5601c32594a7fd37b93b3ae4a7393b2e99a3a3c2856ece5a3dd734e');
E(fileSha('evidence/product-fact-adoption-v1/catalog-evidence-research-wave-1-materialization-v1.json'),'a632351a04cccdb4e55c2203f63735d726edebce208ebdf4f10f4b84adb78120');
E(fileSha('docs/evidence/product-fact-catalog-evidence-research-wave-1-v1.md'),'425cf92474583644cd3c479e895d168ca895ac44f844f41de61e459a1c1a3fd3');
E(research.summary.researched_products,12); E(research.summary.target_fact_slots_terminal,45); E(research.summary.supported_product_count,7); E(research.summary.disposition_counts.SUPPORTED,12); E(research.summary.supported_proposition_count,16); E(research.summary.proposition_collision_count,0);
E(materialization.summary.future_new_subjects,7); E(materialization.summary.future_new_current,16); E(materialization.summary.projected_adopted_product_count,16); E(materialization.summary.projected_current_fact_count,41);
E(plan.version,'catalog-hosted-adoption-wave-1-v1'); E(plan.stage,'V2.1-8H'); E(plan.phase,'A_DETERMINISTIC_PLAN_FREEZE');
E(plan.exact_scope.products,7); E(plan.exact_scope.propositions,16); E(plan.subjects.length,7); E(plan.sources.length,7); E(plan.propositions.length,16);
const expectedProducts=['1f20944c-5a86-4748-8daf-7d57259ea6c0','24103bd1-c7ba-4cc9-b9b9-8129c6452232','51d526de-b127-47c4-83f1-64fc1ec4aa10','59b149d0-5ffa-4610-8141-c0a501b60565','65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc','be8a590e-e5cb-4af4-84e7-99c7e121f45a','c4a5f510-8d9e-46bd-a31c-3c0a34fee331'];
const excluded=['173c63a8-a40d-4d1e-acb6-a7944d66ec43','97deb2cc-2fae-4dbb-8253-03170e197002','dfc4b232-9997-4584-a886-bc7074b6f247','8889342d-d9a2-454b-aa27-60d4934b9978','0b59cb66-ab03-4a0d-815e-7a94a5c7ae65'];
E([...new Set(plan.subjects.map(x=>x.product_id))].sort(),expectedProducts);
A(!plan.propositions.some(x=>excluded.includes(x.product_id)),'excluded product entered adoption');
const expectedPropositionKeys=[
'148e2493e2d97b5bf7366345ed246ce0d48c63c28f8d69cfae8fb54672a15522',
'36feec2c175c7181f93d7e0ef3f7c703c93a18431bca7497e4fe661e3790043a',
'4dd6a17d799351a2d34dcb422ff7e84985415b2be08e30dd0aadd6add8c3be0b',
'4e220dad3e8fc36e86a5dc34f7f5fd9bfe9f813756513f63b170e31029059a2f',
'6fd066cc24bef6d755cb749d43278ca02ed0615c95bf64f26f1896198884aec1',
'7ad1e29dbcbcc1e24550732023c53dd09d9397d111e3fb004e339e1d0374db9f',
'9fa0c13ec45a496187ca605349c39bd1936fdb058ae4b132375287db28b7f289',
'a667fd875319508fc621e89b4a9e130f3731849f9904dec716503ec470c11eb6',
'bba056dda7fd4d029c2e3619df33e14d16d05da66ce51959b4514c4173ce10c4',
'c4c500478d662d022495e162280592077b906540bb499e583b5809afd0ae1562',
'c9e5e2b03416dfb5fecd4d895e3a50291682524cfa7796904109a30f9c30c5b2',
'cf65e7f0e64ad41929d035c081d338c41b2348f714fbfb08e2969fd42decc83c',
'd8fb9a208c3dd26d4dc36e3b4490933a4f62f67c78b71806ff2e5ae56259574c',
'e41dcc38f80b4b4f43d254ae31ffe0f51c38f7d38db1121ebf57516e41db56e2',
'f61493fcb981aeeaf90ae0439e9e762f132df81ec5498bc57d0b517e16964cae',
'f77373d8990861b445a27ea6700806fd597934b7bdd4586b5760770912dbd24c'
].sort();
const upstreamKeys=materialization.fact_candidates.map(x=>x.proposition_key).sort();
E(upstreamKeys,expectedPropositionKeys); E(plan.propositions.map(x=>x.proposition_key).sort(),expectedPropositionKeys); E(new Set(upstreamKeys).size,16);
const supportedByKey=new Map(research.supported_propositions.map(x=>[x.proposition_key,x]));
const evidenceByKey=new Map(research.evidence_records.map(x=>[x.proposition_key,x]));
for(const s of plan.subjects){
  const payload=s.payload;
  const semantic={product_id:payload.product_id,variant_key:payload.variant_key,formulation_revision_key:payload.formulation_revision_key,market_applicability:payload.market_applicability,region_applicability:payload.region_applicability,valid_from:payload.valid_from,valid_to:payload.valid_to};
  E(sha(semantic),payload.subject_semantic_key,`subject serializer ${payload.product_id}`);
  E(payload.subject_identity_serializer_version,'product-fact-subject-identity-v1');
}
const defs=new Map(registry.facts.map(x=>[x.fact_key,x]));
E(registry.registry_version,'product-fact-registry-cross-category-v1'); E(registry.facts.length,20);
for(const row of plan.propositions){
  const up=supportedByKey.get(row.proposition_key); A(up,`unsupported proposition ${row.proposition_key}`); E(row.authority,'product_specific_primary'); E(row.confidence,'high');
  const identity={subject_semantic_key:row.subject_semantic_key,registry_version:'product-fact-registry-cross-category-v1',fact_key:row.fact_key,value_identity:row.value,scope:stable(row.scope),qualifier:{},parent_proposition_key:null,serializer_version:'product-fact-proposition-pilot-v1'};
  E(sha(identity),row.proposition_key,`proposition serializer ${row.proposition_key}`);
  const ev=evidenceByKey.get(row.proposition_key); A(ev,'frozen evidence missing'); E(row.canonical_evidence_digest,ev.canonical_evidence_digest); E(row.ingest_payload.evidence.evidence_authority,'product_specific_primary');
  const def=defs.get(row.fact_key); A(def && def.deprecated===false,`Registry definition invalid ${row.fact_key}`);
  if(def.value_type==='boolean')E(typeof row.value,'boolean');
  if(def.value_type==='enum')A(def.allowed_values.includes(row.value),`enum invalid ${row.fact_key}`);
  if(def.value_type==='entity_identifier')E(typeof row.value,'string');
  E(row.ingest_payload.binding.binding_state,'exact_subject_match'); E(row.ingest_payload.binding.scope_relation,'narrower');
  E(row.review_payloads.map(x=>x.operational_state),['under_review','ready_for_confirm']);
  E(row.preflight_payload_template,row.confirmation_payload_template);
  E(row.confirmation_payload_template.semantic_status,'supported');
  E(row.confirmation_payload_template.authority_ceiling,'product_specific_primary');
  A(row.confirmation_payload_template.supporting_evidence_ids.length===1,'supporting evidence cardinality');
}
E(plan.controlled_rpc_sequence,['admin_register_product_fact_subject_v1','admin_ingest_product_fact_evidence_v1','admin_prepare_product_fact_review_v1','admin_preflight_product_fact_confirmation_v1','admin_confirm_product_fact_v1']);
E(plan.phase_b_execution_stages.map(x=>x.count),[7,16,16,16,16,16]);
E(plan.expected_writes.product_fact_subjects,7); E(plan.expected_writes.product_evidence_sources,7); E(plan.expected_writes.product_evidence_source_subject_bindings,7);
for(const k of ['product_evidence_records','product_fact_instances','product_fact_evidence_links','product_fact_review_assignments','product_fact_confirmations','product_fact_current'])E(plan.expected_writes[k],16);
E(plan.expected_writes.product_fact_review_events,7+16*4); E(plan.expected_writes.adopted_products,7); E(plan.expected_poststate_reference.current,41); E(plan.expected_poststate_reference.adopted_products,16); E(plan.expected_poststate_reference.review_events,180);
const digestCopy=structuredClone(plan); delete digestCopy.plan_content_sha256; E(sha(digestCopy),plan.plan_content_sha256,'plan content digest');
for(const [k,v] of Object.entries(plan.invariants)){
  if(['phase_a_hosted_execution_enabled','direct_product_fact_business_table_dml','migration','ddl','schema_mutation','rpc_sql_mutation','registry_mutation','external_research','new_fact_adjudication','secondary_source_adoption','missing_to_false','reviewed_not_established_to_false','recommendation_scorer_changed','recommendation_activated','decision_axis_production_consumption','catalog_fully_adopted','next_stage_started'].includes(k))E(v,false,`invariant ${k}`);
}
const changedFiles=[
  'evidence/product-fact-adoption-v1/catalog-hosted-adoption-wave-1-v1.json',
  'docs/evidence/product-fact-catalog-hosted-adoption-wave-1-v1.md',
  'scripts/product-evidence/product-fact-catalog-hosted-adoption-wave-1-v1.mjs',
  'scripts/build-product-fact-catalog-hosted-adoption-wave-1-v1.mjs',
  'scripts/verify-product-fact-catalog-hosted-adoption-wave-1-v1.mjs',
  '.github/workflows/v21-8h-catalog-hosted-adoption-wave-1.yml'
];
for(const rel of changedFiles.filter(x=>x.endsWith('.mjs'))){const text=fs.readFileSync(path.join(ROOT,rel),'utf8');A(!/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.(?:product_fact_|product_evidence_)/i.test(text),`direct Product Fact DML text in ${rel}`);}
console.log(JSON.stringify({status:'PASS',assertions,products:7,propositions:16,proposition_collisions:0,review_event_delta:71,phase_a_hosted_writes:0,projected_adopted_products:16,projected_current:41}));
