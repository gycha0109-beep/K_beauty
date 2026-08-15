#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { adaptExfoliationNonNumericPdaShadowDecisionInput, buildExfoliationNonNumericPdaShadowDecisionInputs } from "../../lib/exfoliation-non-numeric-pda-shadow-adapter.js";
import { evaluateCandidateExposurePolicy } from "../../lib/candidate-exposure-policy.js";
import { resolveCandidateExposurePolicyShadowControl, runCandidateExposurePolicyShadow } from "../../lib/candidate-exposure-policy-shadow.js";

const STAGE="V2.1-8R", TERMINAL="SHADOW_RECOMMENDATION_ADAPTER_IMPLEMENTATION_VALIDATED";
const ROOT="evidence/product-decision-axis-non-numeric-shadow-v1";
const CONTRACT=`${ROOT}/exfoliation-non-numeric-pda-shadow-adapter-contract-v1.json`;
const P8=`${ROOT}/exfoliation-non-numeric-pda-offline-shadow-output-v1.json`;
const EXAMPLES="evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-examples-v1.json";
const IMPL=`${ROOT}/exfoliation-non-numeric-pda-shadow-adapter-implementation-v1.json`;
const REPLAY=`${ROOT}/exfoliation-non-numeric-pda-shadow-adapter-validation-replay-v1.json`;
const DOC="docs/evidence/exfoliation-non-numeric-pda-shadow-recommendation-adapter-implementation-v1.md";
const CONTRACT_BLOB="2930e353d0182576cb81432eef55fa1889be8847";
const P8_SHA="03d4446fd7ea1ce8dd23c44bb6c641804bd3394b4aab39db9ee0d7e021029624";
const SNAPSHOT_SHA="31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea";
const ALLOWED=["active_presence_state","active_identity_set","identity_overlap_set","duplicate_exfoliation_state","routine_stacking_state","same_window_conflict_state","recommended_use_frequency_context","sensitivity_interaction_state","reaction_instability_interaction_state","caution_restriction_shadow_input","coverage_state","uncertainty_state","provenance"].sort();
let assertions=0; const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++}; const ok=(v,m)=>{assert.ok(v,m);assertions++};
const read=p=>fs.readFileSync(p,"utf8"), json=p=>JSON.parse(read(p));
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const blob=p=>{const b=fs.readFileSync(p);return crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex")};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const canonical=p=>`${JSON.stringify(stable(json(p)))}\n`;
const prov=(id,x)=>({fact_instance_id:`fixture-${id}-${x}`});
const pda=(id,{category="treatment",status="GOVERNED_SIGNAL_ESTABLISHED",ids=["mandelic_acid"],coverage,missing=[],uncertainty=[]}={})=>({product_id:id,category,pda:{contract_version:"exfoliation-non-numeric-pda-contract-v1",signal_status:status,active_identities:{items:ids.map(x=>({identity:x,provenance:prov(id,x)})),semantic_ordering:"NONE",serialization_order:"IDENTITY_THEN_PROPOSITION_KEY"},multi_active_status:status==="NOT_APPLICABLE"?"not_applicable":status==="GOVERNED_SIGNAL_UNKNOWN"?"unknown":ids.length>1?"multiple":ids.length?"single":"none_established",context:{},coverage:{applicable_category:status==="NOT_APPLICABLE"?null:category,missing_context_keys:missing,state:coverage||(status==="NOT_APPLICABLE"?"not_applicable":ids.length?"active_identity_only":"no_relevant_fact")},uncertainty:{reasons:uncertainty},evidence_provenance:ids.map(x=>prov(id,x))}});
const ctx=({current=[],partial=false,windows={},sensitivity="low",safety="stable",sensitive="no",expand="yes",skin="no",change="no",reaction="no",link="none_reported",recent="none_reported"}={})=>({current_product_set:current.map(x=>({source_state:"selected",routine_windows:["pm.treatment"],...x})),current_product_set_completeness:partial?"partial":current.length?"known":"empty",candidate_routine_windows:windows,safety_state:{level:safety,sensitive_burden:sensitive,exfoliation_expansion_allowed:expand},user_sensitivity_state:sensitivity,recent_skin_or_product_change_state:{recent_skin_change:skin,recent_product_change:change},reaction_instability_state:{product_reaction:reaction,reaction_link_state:link,recent_exposure_state:recent}});
const adapt=(record,records=[record],context=ctx())=>adaptExfoliationNonNumericPdaShadowDecisionInput({product:record,pdaRecord:record,pdaRecords:records,externalContext:context,pdaAuthority:{contract_version:"exfoliation-non-numeric-pda-contract-v1",mapper_version:"fixture",snapshot_sha256:SNAPSHOT_SHA}}).shadow_decision_input;

const contract=json(CONTRACT), p8=json(P8), examples=json(EXAMPLES), impl=json(IMPL), replay=json(REPLAY);
eq(blob(CONTRACT),CONTRACT_BLOB,"frozen 8Q contract blob"); eq(sha(P8),P8_SHA,"frozen 8P bytes"); eq(p8.snapshot_sha256,SNAPSHOT_SHA,"8P snapshot"); eq(p8.products.length,164,"8P 164 products");
eq(contract.stage,"V2.1-8Q","contract stage"); eq(contract.implementation_status,"DESIGNED_NOT_IMPLEMENTED","8Q history preserved"); eq(contract.boundary,"non_numeric_exfoliation_pda + routine_user_context -> shadow_decision_input","boundary"); eq(contract.outputs.allowed.slice().sort(),ALLOWED,"allowed outputs exact");
for(const x of contract.outputs.forbidden) ok(["numeric_potency","ordinal_potency","stronger_weaker","identity_count_as_magnitude","multiple_to_stronger","concentration_to_cross_active_magnitude","unknown_to_false","missing_to_zero","legacy_strength_promoted_to_governed_authority"].includes(x),`frozen guard ${x}`);

const single=pda("single"), multi=pda("multi",{ids:["lactic_acid","salicylic_acid"]});
const none=pda("none",{status:"GOVERNED_SIGNAL_NOT_ESTABLISHED",ids:[],coverage:"no_relevant_fact",uncertainty:["NEGATIVE_SIGNAL_NOT_AUTHORIZED"]});
const unknown=pda("unknown",{status:"GOVERNED_SIGNAL_UNKNOWN",ids:[],coverage:"missing_fact",uncertainty:["SOURCE_BLOCKED_OR_MISSING_CURRENT"]});
const missing=pda("missing",{missing:["active_concentration","recommended_use_frequency"],uncertainty:["ACTIVE_CONCENTRATION_MISSING","RECOMMENDED_USE_FREQUENCY_MISSING"]});
const currentM=pda("current-m",{ids:["mandelic_acid"]}), currentS=pda("current-s",{ids:["salicylic_acid"]});
const na=pda("na",{category:"cleanser",status:"NOT_APPLICABLE",ids:[],coverage:"not_applicable"});
const cases=[
 ["single_active",adapt(single),"present"],
 ["multi_active",adapt(multi),"present"],
 ["no_relevant_active_established",adapt(none),"not_established"],
 ["unknown_product_fact_authority",adapt(unknown,[unknown],ctx({partial:true})),"unknown"],
 ["missing_concentration",adapt(missing),"present"],
 ["identity_overlap_present",adapt(pda("overlap"),[pda("overlap"),currentM],ctx({current:[{product_id:"current-m"}],windows:{overlap:["pm.treatment"]}})),"present"],
 ["identity_overlap_absent",adapt(pda("no-overlap"),[pda("no-overlap"),currentS],ctx({current:[{product_id:"current-s"}],windows:{"no-overlap":["am.treatment"]}})),"present"],
 ["duplicate_exfoliation",adapt(pda("duplicate"),[pda("duplicate"),currentS],ctx({current:[{product_id:"current-s"}],windows:{duplicate:["am.treatment"]}})),"present"],
 ["routine_stacking",adapt(pda("stacking"),[pda("stacking"),currentS],ctx({current:[{product_id:"current-s",routine_windows:["am.treatment"]}],windows:{stacking:["pm.treatment"]}})),"present"],
 ["same_window_conflict",adapt(pda("same-window"),[pda("same-window"),currentS],ctx({current:[{product_id:"current-s"}],windows:{"same-window":["pm.treatment"]}})),"present"],
 ["sensitivity_interaction",adapt(pda("sensitive"),[pda("sensitive")],ctx({sensitivity:"high",safety:"caution",sensitive:"yes",windows:{sensitive:["pm.treatment"]}})),"present"],
 ["recent_reaction_instability",adapt(pda("reaction"),[pda("reaction")],ctx({reaction:"yes",link:"unresolved",windows:{reaction:["pm.treatment"]}})),"present"],
 ["not_applicable_product",adapt(na),"not_applicable"]
];
eq(cases.length,13,"13 semantic cases");
for(const [name,out,presence] of cases){eq(Object.keys(out).sort(),ALLOWED,`${name} exact outputs`);eq(out.active_presence_state,presence,`${name} presence`);eq(out.active_identity_set.semantic_ordering,"NONE",`${name} no ordering`);eq(out.uncertainty_state.unknown_preserved,true,`${name} unknown preserved`);eq(out.uncertainty_state.missing_preserved,true,`${name} missing preserved`);eq(out.provenance.cross_product_overlap_derivation,"GOVERNED_ACTIVE_IDENTITY_INTERSECTION_ONLY",`${name} overlap rule`);eq(out.provenance.external_context_embedded_in_intrinsic_pda,false,`${name} external boundary`)}
eq(cases[1][1].active_identity_set.items,["lactic_acid","salicylic_acid"],"multi set no magnitude"); eq(cases[2][1].active_presence_state,"not_established","not established not false"); eq(cases[3][1].duplicate_exfoliation_state,"unknown","unknown not false"); ok(cases[4][1].coverage_state.missing_context_keys.includes("active_concentration"),"missing concentration explicit");
eq(cases[5][1].identity_overlap_set.items,[{identity:"mandelic_acid",current_product_ids:["current-m"]}],"overlap exact identity intersection"); eq(cases[6][1].identity_overlap_set.state,"not_established","no identity overlap"); eq(cases[7][1].duplicate_exfoliation_state,"present","duplicate state"); eq(cases[8][1].routine_stacking_state,"present","stacking state"); eq(cases[9][1].same_window_conflict_state,"present","same-window state"); eq(cases[10][1].sensitivity_interaction_state,"caution","sensitivity state"); eq(cases[11][1].reaction_instability_interaction_state,"caution","reaction state");
const serialized=JSON.stringify(cases); for(const word of ["numeric_potency","ordinal_potency","stronger_weaker","identity_count_as_magnitude","cross_active_magnitude","legacy_strength_promoted"]) ok(!serialized.includes(word),`forbidden absent ${word}`);

const canonicalCandidates=examples.examples.map(x=>({id:x.source_product.product_id,category:x.source_product.category}));
const canonicalState={decisionBundle:{context:{skinState:{sensitivity:"low"},safetyState:{level:"stable",sensitiveBurden:false,exfoliationExpansionAllowed:true,recentSkinChange:"no",recentlyChangedProduct:"no"},productExposureState:{rows:[],unknownExposurePresent:false,recentExposureState:"none_reported",reactionLinkState:"none_reported"},conditionSignalState:{recentSkinChange:"no",recentProductChange:"no",productReaction:"no"}}}};
const lineage=buildExfoliationNonNumericPdaShadowDecisionInputs({candidates:canonicalCandidates,pdaArtifact:p8,canonicalState}); eq(lineage.rows.length,4,"4 canonical lineage products");
for(const ex of examples.examples){const row=lineage.rows.find(x=>x.product_id===ex.source_product.product_id).shadow_decision_input, expected=ex.expected_output;const presence=expected.signal_status==="GOVERNED_SIGNAL_ESTABLISHED"?"present":expected.signal_status==="GOVERNED_SIGNAL_NOT_ESTABLISHED"?"not_established":expected.signal_status==="NOT_APPLICABLE"?"not_applicable":"unknown";eq(row.active_presence_state,presence,`${ex.example_id} presence`);eq(row.active_identity_set.items,expected.active_identities.items.map(x=>x.identity).sort(),`${ex.example_id} identities`);eq(row.coverage_state,expected.coverage,`${ex.example_id} coverage`);eq(row.provenance.evidence_provenance,expected.evidence_provenance,`${ex.example_id} provenance`)}

const runtimeState={decisionBundle:{locale:"ko",context:{version:"shared-skin-decision-context-v4",skinState:{priorityAxis:"uneven_tone",concernScores:{uneven_tone:20},sensitivity:"low"},survey:{answers:{skinType:"normal",sensitivity:"low",recentSkinChange:"no",recentlyChangedProduct:"no"},completeness:"available"},safetyState:{level:"stable",sensitiveBurden:false,activeExpansionAllowed:true,exfoliationExpansionAllowed:true,protectionMustMaintain:true,recentSkinChange:"no",recentlyChangedProduct:"no"},productExposureState:{rows:[],unknownExposurePresent:false,recentExposureState:"none_reported",reactionLinkState:"none_reported"},conditionSignalState:{recentSkinChange:"no",recentProductChange:"no",productReaction:"no"}}},functionalPolicy:{version:"functional-policy-v1",locale:"ko",priorityAxis:"uneven_tone",primaryGoal:"tone_spot",functionalDirection:"tone_care",planMode:"START",allowedIntensity:"low_to_moderate",recommendationSuppressed:false,safety:{level:"stable",activeExpansionAllowed:true,protectionMustMaintain:true}},consistency:{version:"cross-domain-consistency-v1",verdict:"consistent",effectivePolicySource:"raw"},currentProductFindings:{findings:[],summary:{evaluableSelectedCount:0,notInDbCount:0,notUsingCount:0,unansweredCount:0}}};
const candidate={id:"0b88019a-9eb2-4be9-842d-f1e60e42cf51",name:"fixture",brand:"fixture",category:"serum",irritation_risk:"low",sensitivity_safe:true,skin_types:["normal"],concerns:["tone"],ingredient_signals:{functional:[{label:"Whitening",count:4}]}};
const direct=evaluateCandidateExposurePolicy({canonicalState:structuredClone(runtimeState),candidates:[structuredClone(candidate)]}); const response={stable:true}, snapshot={stable:true};
const shadow=runCandidateExposurePolicyShadow({control:resolveCandidateExposurePolicyShadowControl({DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW:"1",VERCEL_ENV:"preview"}),canonicalState:runtimeState,candidates:[candidate],legacyExecution:null,responseValue:response,snapshotValue:snapshot,telemetrySink:()=>{}});
eq(shadow.policyResult,direct,"runtime existing evaluator identical"); eq(shadow.exfoliationPdaShadow.status,"evaluated","adapter actual shadow path"); eq(shadow.exfoliationPdaShadow.rows[0].shadow_decision_input.active_presence_state,"present","default frozen 8P consumed"); eq(response,{stable:true},"public response unchanged"); eq(snapshot,{stable:true},"snapshot unchanged"); ok(!Object.hasOwn(shadow.telemetry,"exfoliationPdaShadow"),"telemetry schema unchanged");
const bad={}; Object.defineProperty(bad,"products",{get(){throw new Error("fixture")}}); const isolated=runCandidateExposurePolicyShadow({control:resolveCandidateExposurePolicyShadowControl({DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW:"1",VERCEL_ENV:"preview"}),canonicalState:runtimeState,candidates:[candidate],legacyExecution:null,responseValue:{},snapshotValue:{},exfoliationPdaArtifact:bad,telemetrySink:()=>{}}); eq(isolated.policyResult,direct,"adapter failure isolated"); eq(isolated.exfoliationPdaShadow.status,"adapter_execution_failed","adapter failure explicit");

for(const p of [IMPL,REPLAY]){const a=canonical(p),b=canonical(p);eq(a,b,`Build A/B ${p}`);eq(read(p),a,`canonical bytes ${p}`)}
eq(impl.stage,STAGE,"implementation stage"); eq(impl.primary_terminal_outcome,TERMINAL,"implementation terminal"); eq(replay.primary_terminal_outcome,TERMINAL,"replay terminal"); eq(replay.cases.length,13,"replay 13"); eq(replay.production_invariance.candidate_evaluations,1968,"164x12"); eq(replay.production_invariance.expected_nonzero_delta_count,0,"zero delta");
for(const [k,v] of Object.entries({production_consumption:"NO",recommendation_scorer_changed:"NO",recommendation_activated:"NO",candidate_policy_production_changed:"NO",legacy_heuristic_replaced:"NO",numeric_fitting:0,potency_ordering_created:"NO",hosted_product_fact_writes:0,registry_definition_delta:0,migration_delta:0})) eq(impl.lifecycle[k],v,`lifecycle ${k}`);
console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,assertions,validation_cases:13,canonical_lineage_cases:4,candidate_evaluations:1968,artifact_sha256:{implementation:sha(IMPL),replay:sha(REPLAY),doc:sha(DOC)}},null,2));
