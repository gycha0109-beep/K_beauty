#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {buildMaterialization,canonical,digest,C} from "./build-product-fact-cross-category-materialization-dry-run-v1.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json");
let n=0,neg=0;
const ok=(x,m)=>{assert.ok(x,m);n++};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++};
const clone=x=>structuredClone(x);
const forbiddenKey=/decision[_-]?ax|user[_-]?concern|candidate[_-]?score|ranking|top[_-]?(pick|3)|recommendation/i;
const authorityRank={none:0,legacy_unreviewed:1,ingredient_basis:2,review_observation:3,limited_non_product_specific:4,product_specific_primary:5};

function walkKeys(v,at="$"){
  if(Array.isArray(v)){v.forEach((x,i)=>walkKeys(x,`${at}[${i}]`));return;}
  if(!v||typeof v!=="object")return;
  for(const [k,x] of Object.entries(v)){
    if(forbiddenKey.test(k)&&!((at==="$.invariants"&&["decision_axis_output","user_concern_output","recommendation_output"].includes(k)&&x===false)||(at==="$.invariants.lifecycle"&&["DECISION_AXIS_PRODUCTION_READY","DECISION_AXIS_CONSUMPTION","RECOMMENDATION_ACTIVATED"].includes(k)&&x==="NO"))) throw new Error(`forbidden scope field ${at}.${k}`);
    walkKeys(x,`${at}.${k}`);
  }
}

function validate(o,expected,{strict=true}={}){
  eq(o.dry_run_version,C.dry_run_version,"dry-run version");
  eq(o.authority.current_main_sha,C.main_sha,"authority main");
  eq(o.authority.frozen_pilot_head,C.pilot_head,"pilot head");
  eq(o.input_freeze.registry.git_blob,C.registry_blob,"registry blob");
  eq(o.input_freeze.corpus.git_blob,C.corpus_blob,"corpus blob");
  eq(o.input_freeze.corpus.sha256,C.corpus_sha256,"corpus digest");
  eq(o.input_freeze.mapping.git_blob,C.mapping_blob,"mapping blob");
  eq(o.input_freeze.mapping.sha256,C.mapping_sha256,"mapping digest");
  eq(o.input_freeze.gap_report.git_blob,C.gap_blob,"gap blob");
  eq(o.input_freeze.gap_report.sha256,C.gap_sha256,"gap digest");
  eq(o.input_freeze.frozen_verifier.git_blob,C.frozen_verifier_blob,"frozen verifier blob");
  eq(o.input_freeze.protected_pf_blobs.pf2,C.pf2_blob,"PF-2 blob");
  eq(o.input_freeze.protected_pf_blobs.controlled_write,C.controlled_blob,"174400 blob");
  eq(o.input_freeze.protected_pf_blobs.subject_registration,C.subject_blob,"174410 blob");
  eq(o.input_freeze.candidate_policy_manifest_blob,C.candidate_policy_manifest_blob,"CandidatePolicy manifest blob");

  const s=o.summary;
  eq(s.input_products,12,"products 12");eq(s.input_sources,15,"sources 15");eq(s.input_evidence_records,29,"evidence 29");eq(s.input_fused_facts,23,"fused facts 23");
  eq(s.resolved_subjects,11,"resolved 11");eq(s.ambiguous_subjects,1,"ambiguous 1");eq(s.eligible_subjects,11,"eligible subjects 11");eq(s.identity_blocked_subjects,1,"identity blocked subjects 1");
  eq(s.source_proposals,15,"source proposals 15");eq(s.binding_proposals,15,"binding proposals 15");eq(s.eligible_bindings,13,"eligible bindings 13");eq(s.blocked_bindings,2,"blocked bindings 2");
  eq(s.evidence_proposals,29,"evidence proposals 29");eq(s.evidence_materializable,23,"materializable evidence 23");eq(s.evidence_blocked,6,"blocked evidence 6");
  eq(s.fact_proposals,26,"fact proposals 26");eq(s.fact_proposal_status_counts,{supported:23,reviewed_not_established:2,evidence_insufficient:1,evidence_conflict:0},"fact status counts");
  eq(s.confirmation_eligible_facts,23,"confirmation eligible 23");eq(s.confirmation_blocked_facts,3,"confirmation blocked 3");
  eq(s.registry_gaps,5,"registry gaps 5");eq(s.source_blocked,6,"source blocked 6");eq(s.identity_blocked,3,"identity blocked 3");eq(s.forced_mapping_count,0,"forced mappings 0");
  eq(s.measurement_evidence_count,0,"measurement evidence 0");eq(s.frozen_gap_severity,{S1_VOCABULARY_ONLY:4,S2_STRUCTURAL:0,S3_RESEARCH_OR_IDENTITY:4},"frozen gap taxonomy");
  eq(s.materialization_contract_gap_count,0,"no structural materialization contract gap");eq(s.hosted_write_count,0,"summary Hosted writes zero");eq(o.hosted_write_count,0,"Hosted writes zero");

  eq(o.registry_proposal.definition_count,20,"20 governed definitions");eq(o.registry_proposal.expansion_attempted,false,"no registry expansion");eq(o.registry_proposal.registry_definition_keys.length,20,"20 registry keys listed");

  eq(o.subjects.length,12,"12 subject proposals");
  const subjectRefs=new Set(o.subjects.map(x=>x.subject_ref));eq(subjectRefs.size,12,"subject refs unique");
  for(const x of o.subjects){
    ok(/^[0-9a-f]{64}$/.test(x.proposed_subject_identity.subject_semantic_key),`subject semantic key ${x.pilot_id}`);
    ok(["resolved","ambiguous"].includes(x.identity_status),`subject identity state ${x.pilot_id}`);
    if(x.identity_status==="resolved"){
      eq(x.materialization_eligibility,"eligible",`resolved eligible ${x.pilot_id}`);eq(x.proposed_subject_identity.current_state,"current",`resolved current ${x.pilot_id}`);eq(x.confirmation_eligibility,true,`resolved confirmable ${x.pilot_id}`);
    }else{
      eq(x.pilot_id,"P2","only P2 ambiguous");eq(x.materialization_eligibility,"identity_blocked","ambiguous blocked");eq(x.proposed_subject_identity.current_state,"provisional","ambiguous provisional");eq(x.confirmation_eligibility,false,"ambiguous confirmation false");eq(x.current_creation_eligibility,false,"ambiguous current false");
    }
  }

  eq(o.sources.length,15,"15 source proposals");
  const sourceRefs=new Set(o.sources.map(x=>x.source_ref));eq(sourceRefs.size,15,"source refs unique");
  for(const x of o.sources){ok(/^https?:\/\//.test(x.canonical_locator),`source locator ${x.frozen_source_id}`);ok(/^[0-9a-f]{64}$/.test(x.content_digest),`source digest ${x.frozen_source_id}`);ok(x.content_digest_basis.includes("NOT live-page byte snapshot"),`digest basis explicit ${x.frozen_source_id}`);eq(x.provenance_preserved,true,`source provenance ${x.frozen_source_id}`);}

  eq(o.source_subject_bindings.length,15,"15 bindings");
  const bindingRefs=new Set(o.source_subject_bindings.map(x=>x.binding_ref));eq(bindingRefs.size,15,"binding refs unique");
  for(const b of o.source_subject_bindings){ok(sourceRefs.has(b.source_ref),`binding source ${b.binding_ref}`);if(b.proposed_subject_ref!==null)ok(subjectRefs.has(b.proposed_subject_ref),`binding subject ${b.binding_ref}`);if(b.evidence_admissibility==="eligible")ok(["exact_subject_match","equivalent_presentation_match"].includes(b.binding_state),`eligible binding state ${b.binding_ref}`);}
  const s02=o.source_subject_bindings.find(x=>x.frozen_source_id==="s02");eq(s02.binding_state,"variant_ambiguous","ROUND LAB linked US variant not exact KR subject");eq(s02.evidence_admissibility,"blocked","ROUND LAB US blocked");
  const s14=o.source_subject_bindings.find(x=>x.frozen_source_id==="s14");eq(s14.binding_state,"formulation_ambiguous","NEEDLY lineage ambiguous");eq(s14.evidence_admissibility,"blocked","NEEDLY binding blocked");

  eq(o.evidence_records.length,29,"29 evidence proposals");
  const evidenceRefs=new Set(o.evidence_records.map(x=>x.evidence_ref));eq(evidenceRefs.size,29,"evidence refs unique");
  const eligibleEvidence=new Set(o.evidence_records.filter(x=>x.materialization_eligibility==="eligible").map(x=>x.frozen_evidence_id));eq(eligibleEvidence.size,23,"23 eligible evidence refs");
  for(const e of o.evidence_records){ok(sourceRefs.has(e.source_ref),`evidence source ${e.frozen_evidence_id}`);ok(bindingRefs.has(e.binding_ref),`evidence binding ${e.frozen_evidence_id}`);ok(/^[0-9a-f]{64}$/.test(e.canonical_evidence_digest),`evidence digest ${e.frozen_evidence_id}`);eq(e.provenance_preserved,true,`evidence provenance ${e.frozen_evidence_id}`);eq(e.forced_mapping,false,`evidence not forced ${e.frozen_evidence_id}`);if(e.materialization_eligibility==="eligible"){ok(subjectRefs.has(e.proposed_subject_ref),`eligible evidence subject ${e.frozen_evidence_id}`);ok(/^[0-9a-f]{64}$/.test(e.proposition_key),`eligible evidence proposition ${e.frozen_evidence_id}`);}}
  for(const ref of ["e03","e07","e10","e18","e25","e30"])eq(o.evidence_records.find(x=>x.frozen_evidence_id===ref).materialization_eligibility,"blocked",`${ref} fail-closed`);
  eq(o.evidence_records.find(x=>x.frozen_evidence_id==="e18").block_reason,"not_linked_to_frozen_mapped_fact","ANUA incomplete claim not promoted");

  eq(o.fact_proposals.length,26,"26 fact proposals");
  const propKeys=new Set(o.fact_proposals.map(x=>x.proposition_key));eq(propKeys.size,26,"proposition keys unique");
  for(const f of o.fact_proposals){
    ok(subjectRefs.has(f.subject_ref),`fact subject ${f.proposal_ref}`);ok(/^[0-9a-f]{64}$/.test(f.proposition_key),`fact proposition ${f.proposal_ref}`);ok(/^[0-9a-f]{64}$/.test(f.fusion_input_digest),`fusion digest ${f.proposal_ref}`);eq(digest(f.fusion_digest_inputs),f.fusion_input_digest,`fusion digest deterministic ${f.proposal_ref}`);
    eq(f.runtime_fusion_input_digest.status,"deferred_until_hosted_ids_are_allocated",`runtime digest deferred ${f.proposal_ref}`);
    for(const r of [...f.supporting_evidence_refs,...f.opposing_evidence_refs,...f.context_evidence_refs])ok(evidenceRefs.has(`evidence:${r}`),`fact evidence ref ${f.proposal_ref}/${r}`);
    const admissible=[...f.supporting_evidence_refs,...f.opposing_evidence_refs].map(r=>o.evidence_records.find(e=>e.frozen_evidence_id===r)).filter(e=>e?.materialization_eligibility==="eligible");
    const max=Math.max(0,...admissible.map(e=>authorityRank[e.evidence_authority]));const expectedAuthority=Object.entries(authorityRank).find(([,r])=>r===max)[0];eq(f.authority_ceiling,expectedAuthority,`authority ceiling ${f.proposal_ref}`);
    if(f.semantic_status==="supported"){
      ok(f.supporting_evidence_refs.length>0,`supported has evidence ${f.proposal_ref}`);ok(f.typed_columns.value_type!==null,`supported typed ${f.proposal_ref}`);eq(f.confirmation_eligibility,"eligible",`supported eligible ${f.proposal_ref}`);
    }else{
      eq(f.typed_columns,{value_type:null,value_boolean:null,value_enum:null,value_number:null,value_unit:null,value_range_min:null,value_range_max:null,value_entity_identifier:null},`non-supported has no value ${f.proposal_ref}`);eq(f.confirmation_eligibility,"blocked",`non-supported blocked for V2.1-3 selection ${f.proposal_ref}`);
    }
  }
  eq(o.fact_proposals.filter(f=>f.semantic_status==="supported").length,23,"23 supported proposals");eq(o.fact_proposals.filter(f=>f.semantic_status==="reviewed_not_established").length,2,"2 directly materializable RNE proposals");eq(o.fact_proposals.filter(f=>f.semantic_status==="evidence_insufficient").length,1,"1 evidence-insufficient proposal");

  const t2=o.fact_proposals.filter(f=>f.pilot_id==="T2"&&f.semantic_status==="supported");
  const t2Act=t2.filter(f=>f.fact_key==="contains_active");eq(t2Act.length,2,"T2 multi-active 2");ok(t2Act.some(f=>f.typed_value==="mandelic_acid"),"mandelic identity");ok(t2Act.some(f=>f.typed_value==="sodium_hyaluronate_crosspolymer"),"HA crosspolymer identity");
  const mandelic=t2Act.find(f=>f.typed_value==="mandelic_acid"),conc=t2.find(f=>f.fact_key==="active_concentration");eq(conc.parent_proposition_key,mandelic.proposition_key,"10% bound only to mandelic");
  ok(o.blocked_materialization.some(b=>["relationship_identity_blocked","semantic_outcome_not_materializable"].includes(b.kind)&&b.pilot_id==="T2"&&b.semantic_status==="reviewed_not_established"&&/sodium_hyaluronate_crosspolymer/i.test(b.candidate_concept||"")),"HA concentration remains fail-closed reviewed_not_established");

  const s1Facts=o.fact_proposals.filter(f=>f.pilot_id==="S1"&&f.semantic_status==="supported");ok(s1Facts.every(f=>f.scope.market==="KR"),"ROUND LAB supported scopes remain KR");
  const s3Facts=o.fact_proposals.filter(f=>f.pilot_id==="S3"&&f.semantic_status==="supported");ok(s3Facts.every(f=>f.scope.market==="JP"&&f.scope.variant==="NA"),"ANESSA JP+NA scope preserved");
  eq(o.summary.measurement_evidence_count,0,"ANUA does not create measurement evidence");eq(o.evidence_records.find(e=>e.frozen_evidence_id==="e18").evidence_class,"product_claim","ANUA remains claim");
  const m2=o.fact_proposals.filter(f=>f.pilot_id==="M2");ok(m2.some(f=>f.fact_key==="primary_use_role")&&m2.some(f=>f.fact_key==="barrier_support_claim"),"Cicaplast role/claim separated");
  const p3=o.fact_proposals.filter(f=>f.pilot_id==="P3"&&f.semantic_status==="supported");for(const k of ["product_format","wipe_off_use","pad_surface_texture"])ok(p3.some(f=>f.fact_key===k),`P3 ${k}`);ok(p3.some(f=>f.fact_key==="contains_active"&&f.typed_value==="lactic_acid"),"P3 lactic identity");ok(p3.some(f=>f.fact_key==="contains_active"&&f.typed_value==="salicylic_acid"),"P3 salicylic identity");ok(!p3.some(f=>/intensity|strength|magnitude|score/i.test(f.fact_key)),"P3 no invented magnitude");
  ok(o.blocked_materialization.filter(b=>b.pilot_id==="P3"&&["relationship_identity_blocked","semantic_outcome_not_materializable"].includes(b.kind)&&b.semantic_status==="reviewed_not_established").length>=2,"P3 acid concentrations remain fail-closed not established");

  eq(o.invariants.missing_not_false,true,"missing != false");eq(o.invariants.supported_false_distinct_from_reviewed_not_established,true,"supported(false) separated");eq(o.invariants.registry_expansion,false,"no registry expansion");eq(o.invariants.fusion_recalibration,false,"no fusion recalibration");eq(o.invariants.decision_axis_output,false,"no Decision Axis output");eq(o.invariants.recommendation_output,false,"no recommendation output");eq(o.invariants.cleanser_corpus_adoption,false,"no cleanser adoption");eq(o.invariants.catalog_wide_backfill,false,"no catalog-wide backfill");
  eq(o.invariants.frozen_gap_taxonomy,{S1_VOCABULARY_ONLY:4,S2_STRUCTURAL:0,S3_RESEARCH_OR_IDENTITY:4},"gap taxonomy preserved");
  for(const b of o.blocked_materialization)eq(b.forced_mapping,false,`blocked item not forced ${b.block_ref}`);
  walkKeys(o);

  const approved=new Set(["admin_publish_product_fact_registry_v1","admin_register_product_fact_subject_v1","admin_ingest_product_fact_evidence_v1","admin_prepare_product_fact_review_v1","admin_preflight_product_fact_confirmation_v1","admin_confirm_product_fact_v1"]);
  eq(o.expected_operations.length,6,"six controlled operations");for(const x of o.expected_operations){ok(approved.has(x.operation),`approved operation ${x.operation}`);eq(x.v21_2_executed_calls,0,`operation not executed ${x.operation}`);}
  eq(o.expected_operations.find(x=>x.operation==="admin_ingest_product_fact_evidence_v1").expected_calls_full_plan,30,"23 evidence + 7 binding-only ingest calls");
  eq(o.expected_operations.find(x=>x.operation==="admin_prepare_product_fact_review_v1").expected_calls_full_plan,57,"34 initial + 23 ready transitions");
  eq(o.expected_operations.find(x=>x.operation==="admin_confirm_product_fact_v1").v21_2_executed_calls,0,"confirm never executed");

  const w=o.expected_writes;
  eq(Object.keys(w).sort(),["product_evidence_records","product_evidence_source_subject_bindings","product_evidence_sources","product_fact_confirmations","product_fact_current","product_fact_definition_snapshots","product_fact_evidence_links","product_fact_instances","product_fact_registry_versions","product_fact_review_assignments","product_fact_review_events","product_fact_subjects"].sort(),"12-table expected write plan");
  const expectedInserts={product_fact_registry_versions:1,product_fact_definition_snapshots:20,product_fact_subjects:12,product_evidence_sources:15,product_evidence_source_subject_bindings:15,product_evidence_records:23,product_fact_instances:23,product_fact_evidence_links:23,product_fact_review_assignments:34,product_fact_review_events:115,product_fact_confirmations:23,product_fact_current:23};
  for(const [r,c] of Object.entries(expectedInserts)){eq(w[r].expected_insert_count,c,`${r} insert count`);eq(w[r].expected_delete_count,0,`${r} delete zero`);eq(w[r].v21_2_actual_write_count,0,`${r} V2.1-2 write zero`);}
  eq(w.product_fact_review_assignments.expected_update_count,46,"review assignment full-envelope updates");for(const [r,x] of Object.entries(w))if(r!=="product_fact_review_assignments")eq(x.expected_update_count,0,`${r} no expected update`);

  eq(o.subjects.filter(x=>x.catalog_product_id&&x.product_identity_input?.canonical_product_name).length,12,"only 12 pilot products");ok(!o.subjects.some(x=>/cleanser/i.test(x.product_identity_input?.canonical_product_name||"")||/cleanser/i.test(x.product_identity_input?.pilot_id||"")),"no cleanser subject");
  eq(o.invariants.lifecycle.PRODUCT_FACT_CATALOG_ADOPTED,"NO","catalog not adopted");eq(o.invariants.lifecycle.DECISION_AXIS_CONSUMPTION,"NO","Decision Axis not consumed");eq(o.invariants.lifecycle.RECOMMENDATION_ACTIVATED,"NO","recommendation inactive");

  if(strict) eq(o,expected,"committed output equals deterministic builder result");
}

function rejectMutation(name,mutate,expected){
  const m=clone(expected);mutate(m);let rejected=false;try{validate(m,expected,{strict:false});}catch{rejected=true;}ok(rejected,`negative mutation rejected: ${name}`);neg++;
}

const expectedA=buildMaterialization(),expectedB=buildMaterialization();eq(canonical(expectedA),canonical(expectedB),"builder deterministic in-memory");
assert.ok(fs.existsSync(OUT),"materialization output missing; run builder first");
const output=JSON.parse(fs.readFileSync(OUT,"utf8"));validate(output,expectedA);

rejectMutation("ambiguous_to_resolved",m=>{const x=m.subjects.find(s=>s.pilot_id==="P2");x.identity_status="resolved";x.proposed_subject_identity.identity_status="resolved";x.materialization_eligibility="eligible";},expectedA);
rejectMutation("identity_blocked_to_supported",m=>{const x=m.blocked_materialization.find(b=>b.kind==="identity_blocked");x.semantic_status="supported";},expectedA);
rejectMutation("reviewed_not_established_to_false",m=>{const x=m.fact_proposals.find(f=>f.semantic_status==="reviewed_not_established");x.semantic_status="supported";x.typed_columns.value_type="boolean";x.typed_columns.value_boolean=false;},expectedA);
rejectMutation("family_or_variant_match_to_exact",m=>{const x=m.source_subject_bindings.find(b=>b.frozen_source_id==="s02");x.binding_state="exact_subject_match";x.evidence_admissibility="eligible";x.proposed_subject_ref="subject:S1";},expectedA);
rejectMutation("market_scope_collapse",m=>{const x=m.fact_proposals.find(f=>f.pilot_id==="S1"&&f.semantic_status==="supported");x.scope.market="US";},expectedA);
rejectMutation("unmapped_evidence_removal",m=>{m.evidence_records=m.evidence_records.filter(e=>e.frozen_evidence_id!=="e03");m.summary.evidence_proposals--;},expectedA);
rejectMutation("registry_gap_forced_key_mapping",m=>{const x=m.evidence_records.find(e=>e.frozen_evidence_id==="e03");x.fact_key="uva_label";x.materialization_eligibility="eligible";x.forced_mapping=true;},expectedA);
rejectMutation("fusion_digest_input_removed",m=>{const x=m.fact_proposals.find(f=>f.semantic_status==="supported");x.fusion_digest_inputs.supporting_evidence=[];},expectedA);
rejectMutation("dangling_evidence_reference",m=>{const x=m.fact_proposals.find(f=>f.semantic_status==="supported");x.supporting_evidence_refs.push("e999");},expectedA);
rejectMutation("decision_axis_injection",m=>{m.decision_axis={cleansing_burden:1};},expectedA);
rejectMutation("recommendation_injection",m=>{m.recommendation={top_pick:"x"};},expectedA);
rejectMutation("hosted_write_nonzero",m=>{m.hosted_write_count=1;m.summary.hosted_write_count=1;},expectedA);

console.log(`PASS verify-product-fact-cross-category-materialization-dry-run-v1 assertions=${n} negative_mutations=${neg} products=12 sources=15 evidence=29 materializable_evidence=23 fact_proposals=26 confirmation_eligible=23 forced_mapping=0 hosted_writes=0`);
