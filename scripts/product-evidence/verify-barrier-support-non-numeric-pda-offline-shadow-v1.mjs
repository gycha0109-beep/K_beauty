#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  VERSION,STAGE,AXIS_KEY,PRIMARY_TERMINAL_OUTCOME,EXPECTED_DISTRIBUTION,
  INPUT,OUTPUTS,canonicalJson,buildAll
} from "./barrier-support-non-numeric-pda-offline-shadow-v1.mjs";
import { mapBarrierSupportNonNumericPda } from "./barrier-support-non-numeric-pda-contract-v1.mjs";

let assertions=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);assertions+=1;}
function ok(v,msg){assert.ok(v,msg);assertions+=1;}

const A=buildAll();
const B=buildAll();
const products=A.output.products;

eq(VERSION,"barrier-support-non-numeric-pda-offline-shadow-v1","version");
eq(STAGE,"V2.1-8H-R4","stage");
eq(AXIS_KEY,"barrier_support","axis");
eq(PRIMARY_TERMINAL_OUTCOME,"NON_NUMERIC_BARRIER_SUPPORT_PDA_OFFLINE_SHADOW_REPLAY_VALIDATED","terminal");
eq(A.output.primary_terminal_outcome,PRIMARY_TERMINAL_OUTCOME,"output terminal");
eq(A.summary.primary_terminal_outcome,PRIMARY_TERMINAL_OUTCOME,"summary terminal");
eq(A.replay.primary_terminal_outcome,PRIMARY_TERMINAL_OUTCOME,"replay terminal");

eq(fs.readFileSync(INPUT,"utf8"),canonicalJson(JSON.parse(fs.readFileSync(INPUT,"utf8"))),"snapshot canonical bytes");
for(const key of ["output","summary","replay"]) eq(A.rendered[key],B.rendered[key],`${key} A/B determinism`);
eq(A.rendered.doc,B.rendered.doc,"doc A/B determinism");
for(const [key,rel] of Object.entries(OUTPUTS)) eq(fs.readFileSync(rel,"utf8"),A.rendered[key],`${rel} generated equality`);

eq(A.snapshot.hosted_counts.catalog,EXPECTED_DISTRIBUTION.catalog,"catalog hosted");
eq(A.snapshot.hosted_counts.current,101,"Product Fact Current hosted");
eq(A.snapshot.hosted_counts.fact_instances,102,"Fact Instances hosted");
eq(A.snapshot.hosted_counts.confirmations,102,"Confirmations hosted");
eq(A.snapshot.hosted_counts.relevant_current,EXPECTED_DISTRIBUTION.relevant_current,"relevant Current");
eq(A.snapshot.hosted_counts.subjects,47,"subject count");
eq(A.snapshot.snapshot_scope.raw_evidence_bodies_included,false,"raw evidence absent");
eq(A.snapshot.snapshot_scope.unstable_access_timestamps_included,false,"unstable timestamps absent");

eq(A.summary.catalog_count,EXPECTED_DISTRIBUTION.catalog,"output catalog");
eq(A.summary.moisturizer_count,EXPECTED_DISTRIBUTION.moisturizer,"moisturizer count");
eq(A.summary.category_unknown_count,EXPECTED_DISTRIBUTION.category_unknown,"category unknown");
eq(A.summary.known_non_applicable_count,EXPECTED_DISTRIBUTION.known_non_applicable,"known non-applicable");

eq(A.summary.signal_state_counts.GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE,EXPECTED_DISTRIBUTION.established_true,"true");
eq(A.summary.signal_state_counts.GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE??0,EXPECTED_DISTRIBUTION.established_false,"false");
eq(A.summary.signal_state_counts.GOVERNED_BARRIER_CLAIM_UNKNOWN,EXPECTED_DISTRIBUTION.unknown,"unknown");
eq(A.summary.signal_state_counts.GOVERNED_BARRIER_CLAIM_BLOCKED,EXPECTED_DISTRIBUTION.blocked,"blocked");
eq(A.summary.signal_state_counts.NOT_APPLICABLE,EXPECTED_DISTRIBUTION.not_applicable,"not applicable");

eq(A.summary.coverage_state_counts.claim_with_usage_role_context,6,"claim+role");
eq(A.summary.coverage_state_counts.explicit_negative_claim_only??0,0,"negative claim only");
eq(A.summary.coverage_state_counts.explicit_negative_with_usage_role_context??0,0,"negative+role");
eq(A.summary.coverage_state_counts.missing_fact,4,"missing fact");
eq(A.summary.coverage_state_counts.identity_blocked,51,"identity blocked");
eq(A.summary.coverage_state_counts.category_unknown,10,"category unknown coverage");
eq(A.summary.coverage_state_counts.not_applicable,105,"not applicable coverage");

eq(A.summary.primary_use_role_counts.full_face,1,"full face");
eq(A.summary.primary_use_role_counts.local_area,1,"local area");
eq(A.summary.primary_use_role_counts.multi_area,4,"multi area");
eq(A.summary.scope_resolution_state_counts.SINGLE_VALUE,6,"single value scope");
eq(A.summary.scope_resolution_state_counts.CONTEXT_REQUIRED??0,0,"scope context required");
eq(A.summary.scope_resolution_state_counts.CONFLICT_BLOCKED,51,"identity conflict-blocked representation");
eq(A.summary.scope_resolution_state_counts.NO_SIGNAL,14,"no signal");
eq(A.summary.scope_resolution_state_counts.NOT_APPLICABLE,105,"scope not applicable");

eq(products.length,176,"exactly one output per catalog row");
eq(new Set(products.map(x=>x.product_id)).size,176,"unique product ids");
for(const x of products){
  eq(x.pda.axis_key,"barrier_support",`${x.product_id}: axis`);
  eq(x.pda.numeric_estimate,null,`${x.product_id}: numeric null`);
  eq(x.pda.ordinal_magnitude,null,`${x.product_id}: ordinal null`);
  eq(x.pda.effect_strength,null,`${x.product_id}: effect null`);
  eq(x.pda.legacy_numeric_contribution,"PROHIBITED",`${x.product_id}: no additive legacy`);
  eq(x.pda.production_consumption,"NO",`${x.product_id}: no production consumption`);
  if(x.category==null){
    eq(x.pda.signal.state,"GOVERNED_BARRIER_CLAIM_UNKNOWN",`${x.product_id}: unknown category truth`);
    eq(x.pda.signal.value,null,`${x.product_id}: unknown category not false`);
  }
  if(x.pda.coverage.state==="identity_blocked"){
    eq(x.pda.signal.state,"GOVERNED_BARRIER_CLAIM_BLOCKED",`${x.product_id}: identity block`);
    eq(x.pda.signal.value,null,`${x.product_id}: identity block not false`);
  }
  if(x.pda.coverage.state==="missing_fact"){
    eq(x.pda.signal.state,"GOVERNED_BARRIER_CLAIM_UNKNOWN",`${x.product_id}: missing unknown`);
    eq(x.pda.signal.value,null,`${x.product_id}: missing not false`);
  }
}

eq(A.summary.null_magnitude_summary.numeric_non_null_count,0,"numeric count");
eq(A.summary.null_magnitude_summary.ordinal_non_null_count,0,"ordinal count");
eq(A.summary.null_magnitude_summary.effect_strength_non_null_count,0,"effect count");
eq(A.summary.provenance_integrity_summary.relevant_current_snapshot_rows,12,"relevant rows");
eq(A.summary.provenance_integrity_summary.emitted_provenance_rows,12,"emitted provenance");
eq(A.summary.provenance_integrity_summary.fabricated_provenance_count,0,"fabricated provenance");
eq(A.summary.provenance_integrity_summary.scope_mismatch_count,0,"scope mismatch");
eq(A.summary.provenance_integrity_summary.raw_evidence_body_count,0,"raw evidence");
eq(A.summary.provenance_integrity_summary.output_product_id_unique_count,176,"unique output ids");

const falseSynthetic=mapBarrierSupportNonNumericPda({
  product_id:"r4-synthetic-explicit-false",
  category:"moisturizer_balm",
  identity_status:"resolved",
  subject_current_state:"current",
  subject_scope:{variant_key:null,formulation_revision_key:"fixture",market_applicability:"KR",region_applicability:null},
  claim_facts:[{
    presence:"current",semantic_status:"supported",value_type:"boolean",typed_value:false,
    authority_ceiling:"product_specific_primary",fused_confidence:"high",fact_key:"barrier_support_claim",
    subject_id:"fixture-subject",fact_instance_id:"fixture-fact",confirmation_id:"fixture-confirmation",
    proposition_key:"fixture-proposition",fusion_input_digest:"fixture-digest",
    scope:{market:"KR",region:null,locale:null,valid_from:null,valid_to:null}
  }],
  primary_use_role_facts:[]
});
eq(falseSynthetic.signal.state,"GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE","supported(false) regression");
eq(falseSynthetic.signal.value,false,"supported(false) boolean");
ok(falseSynthetic.signal.state!=="GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE","false must not become true");

const missingSynthetic=mapBarrierSupportNonNumericPda({
  product_id:"r4-synthetic-missing",category:"moisturizer_balm",
  identity_status:"resolved",subject_current_state:"current",subject_scope:null,
  claim_facts:[],primary_use_role_facts:[]
});
eq(missingSynthetic.signal.state,"GOVERNED_BARRIER_CLAIM_UNKNOWN","missing unknown");
eq(missingSynthetic.signal.value,null,"missing not false");

const source=A.facts.map(x=>({
  key:`${x.fact_instance_id}|${x.confirmation_id}|${x.proposition_key}`,
  scope:{market:x.market,region:x.region,locale:x.locale,valid_from:x.valid_from,valid_to:x.valid_to}
}));
const sourceMap=new Map(source.map(x=>[x.key,x.scope]));
for(const x of products){
  for(const p of x.pda.evidence_provenance){
    const key=`${p.fact_instance_id}|${p.confirmation_id}|${p.proposition_key}`;
    ok(sourceMap.has(key),`${x.product_id}: provenance source exists`);
    eq(p.scope,sourceMap.get(key),`${x.product_id}: scope exact`);
    ok(["SIGNAL","CONTEXT"].includes(p.mapper_input_role),`${x.product_id}: mapper role`);
  }
}

eq(A.replay.production_invariance.evaluations,1968,"recommendation evaluation denominator");
eq(A.replay.production_invariance.products,164,"frozen Recommendation candidate count");
eq(A.replay.production_invariance.scenarios,12,"scenario count");
for(const field of ["score_delta","ranking_delta","top1_delta","top3_delta","eligibility_delta","public_response_delta","persistence_delta","candidate_policy_delta"]){
  eq(A.replay.production_invariance[field],0,`production ${field}`);
}
eq(A.replay.production_invariance.pda_production_consumption,"NO","production PDA consumption");
eq(A.replay.production_invariance.recommendation_activation,"NO","recommendation activation");

const corpus=fs.readFileSync("fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt","utf8").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
eq(corpus.length,164,"frozen corpus count");
eq(new Set(corpus).size,164,"frozen corpus unique count");
const scenarios=JSON.parse(fs.readFileSync("fixtures/recommendation-metadata/user-scenarios-v1.json","utf8"));
eq(scenarios.scenarioCount,12,"frozen scenarios count");
eq(164*12,1968,"frozen replay denominator");

const moduleNeedle="barrier-support-non-numeric-pda-offline-shadow-v1";
function walk(root){
  if(!fs.existsSync(root)) return [];
  const out=[];
  for(const name of fs.readdirSync(root)){
    const p=path.join(root,name);
    const st=fs.statSync(p);
    if(st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
for(const root of ["lib","app","pages"]){
  for(const file of walk(root).filter(p=>/\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(p))){
    ok(!fs.readFileSync(file,"utf8").includes(moduleNeedle),`${file}: R4 shadow module must not be imported by production code`);
  }
}
const mapperSource=fs.readFileSync(new URL("./barrier-support-non-numeric-pda-offline-shadow-v1.mjs",import.meta.url),"utf8");
ok(!/(node:https|node:http|@supabase|fetch\s*\(|axios|supabase\.from|INSERT\s+INTO|UPDATE\s+product_fact|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)/i.test(mapperSource),"R4 mapper must remain offline/read-only");

for(const [k,v] of Object.entries(A.replay.hosted_invariance)){
  if(k.endsWith("_v21_8h_r4")||k==="task_caused_delta") eq(v,0,`hosted ${k}`);
}
eq(A.replay.next_gate.stage,"V2.1-8H-R5_BARRIER_SUPPORT_SHADOW_RECOMMENDATION_CONSUMPTION_ADAPTER_CONTRACT","next gate");
eq(A.replay.next_gate.status,"RECOMMENDED_NOT_EXECUTED","next gate not executed");

console.log(JSON.stringify({
  version:"verify-barrier-support-non-numeric-pda-offline-shadow-v1",
  status:"PASS",
  assertions,
  stage:STAGE,
  axis_key:AXIS_KEY,
  catalog:A.summary.catalog_count,
  signal_state_counts:A.summary.signal_state_counts,
  coverage_state_counts:A.summary.coverage_state_counts,
  recommendation_invariance_owner:"BEJEWELY_CURRENT_MAIN_HEALTH_164x12",
  primary_terminal_outcome:PRIMARY_TERMINAL_OUTCOME,
  hashes:A.hashes
}));
