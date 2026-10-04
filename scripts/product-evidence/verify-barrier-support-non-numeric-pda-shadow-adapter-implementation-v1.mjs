#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
  adaptBarrierSupportNonNumericPdaShadowAnnotationInput,
  buildBarrierSupportNonNumericPdaShadowAnnotationInputs
} from "../../lib/barrier-support-non-numeric-pda-shadow-adapter.js";
import { evaluateCandidateExposurePolicy } from "../../lib/candidate-exposure-policy.js";
import {
  resolveCandidateExposurePolicyShadowControl,
  runCandidateExposurePolicyShadow
} from "../../lib/candidate-exposure-policy-shadow.js";

const STAGE="V2.1-8H-R6";
const TERMINAL="BARRIER_SUPPORT_SHADOW_CONSUMPTION_ADAPTER_IMPLEMENTATION_VALIDATED";
const ROOT="evidence/product-decision-axis-non-numeric-shadow-v2";
const CONTRACT=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-contract-v1.json`;
const EXAMPLES=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-examples-v1.json`;
const R4=`${ROOT}/barrier-support-non-numeric-pda-offline-shadow-output-v1.json`;
const IMPL=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-implementation-v1.json`;
const REPLAY=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-validation-replay-v1.json`;
const DOC="docs/evidence/v21-8h-r6-barrier-support-shadow-consumption-adapter-implementation-v1.md";
const CONTRACT_BLOB="86e9d296ddd465659529a7914d98d528af69bb36";
const EXAMPLES_BLOB="615e2a969304bccec9333f1e20508afbbc1c54d4";
const R4_BLOB="eff81d7d7c8bf0afed334f86e6d440ab0c4914b4";

let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1};
const ok=(v,m)=>{assert.ok(v,m);assertions+=1};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const canonical=p=>`${JSON.stringify(stable(json(p)))}\n`;
const blob=p=>{const b=fs.readFileSync(p);return crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex")};

const contract=json(CONTRACT);
const examples=json(EXAMPLES);
const r4=json(R4);
const impl=json(IMPL);
const replay=json(REPLAY);

eq(blob(CONTRACT),CONTRACT_BLOB,"frozen R5 contract blob");
eq(blob(EXAMPLES),EXAMPLES_BLOB,"frozen R5 examples blob");
eq(blob(R4),R4_BLOB,"frozen R4 output blob");
eq(contract.primary_terminal_outcome,"BARRIER_SUPPORT_SHADOW_CONSUMPTION_ADAPTER_CONTRACT_FROZEN","R5 terminal");
eq(contract.implementation_status,"DESIGNED_NOT_IMPLEMENTED","R5 historical status");
eq(r4.products.length,176,"R4 catalog");

eq(BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,"barrier-support-non-numeric-pda-shadow-recommendation-adapter-v1","adapter version");
eq(examples.examples.length,12,"R5 case count");
for(const item of examples.examples){
  const actual=adaptBarrierSupportNonNumericPdaShadowAnnotationInput({
    productState:item.input.product_state,
    userContext:item.input.user_context
  });
  eq(actual,item.expected_output,`${item.case_id}: exact R5 contract replay`);
  eq(actual.numeric_contribution,null,`${item.case_id}: nonnumeric`);
  eq(actual.rank_effect,"NONE",`${item.case_id}: no rank effect`);
  eq(actual.eligibility_effect,"NONE",`${item.case_id}: no eligibility effect`);
}

const allCandidates=r4.products.map(row=>({id:row.product_id,category:row.category}));
const relevantState={
  decisionBundle:{
    context:{
      version:"shared-skin-decision-context-v4",
      skinState:{priorityAxis:"barrier"},
      survey:{answers:{mainConcern:"barrier",mainConcerns:["barrier","dehydration"]}}
    }
  }
};
const buildA=buildBarrierSupportNonNumericPdaShadowAnnotationInputs({
  candidates:allCandidates,pdaArtifact:r4,canonicalState:relevantState
});
const buildB=buildBarrierSupportNonNumericPdaShadowAnnotationInputs({
  candidates:allCandidates,pdaArtifact:r4,canonicalState:relevantState
});
eq(stable(buildB),stable(buildA),"adapter deterministic build A/B");
eq(buildA.rows.length,176,"R4 176 rows");

const counts={};
for(const row of buildA.rows){
  const state=row.shadow_annotation_input.annotation_authority_state;
  counts[state]=(counts[state]||0)+1;
  eq(row.shadow_annotation_input.numeric_contribution,null,`${row.product_id}: no numeric`);
  eq(row.shadow_annotation_input.rank_effect,"NONE",`${row.product_id}: no rank`);
  eq(row.shadow_annotation_input.eligibility_effect,"NONE",`${row.product_id}: no eligibility`);
}
eq(counts.positive_claim_context_available,6,"R4 positive context");
eq(counts.explicit_negative_claim_context_available??0,0,"R4 explicit negative context");
eq(counts.held_unknown_product_fact,14,"R4 unknown held");
eq(counts.blocked,51,"R4 blocked");
eq(counts.not_applicable,105,"R4 not applicable");

const trueIds=r4.products.filter(x=>x.pda.signal.state==="GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE").map(x=>x.product_id).sort();
eq(trueIds.length,6,"six actual true products");
for(const id of trueIds){
  const source=r4.products.find(x=>x.product_id===id);
  const row=buildA.rows.find(x=>x.product_id===id).shadow_annotation_input;
  eq(row.barrier_claim_presence_state,"present",`${id}: present`);
  eq(row.annotation_authority_state,"positive_claim_context_available",`${id}: annotation available`);
  eq(row.provenance.subject_scope,source.pda.subject_scope,`${id}: subject scope preserved`);
  eq(row.provenance.scope_resolution,source.pda.scope_resolution,`${id}: scope resolution preserved`);
  eq(row.provenance.evidence_provenance,source.pda.evidence_provenance,`${id}: evidence lineage preserved`);
  eq(row.provenance.external_user_context_embedded_in_product_fact,false,`${id}: user context external`);
}

const local=buildA.rows.find(x=>x.product_id==="c2bb9ffd-f261-4f9b-91ed-23f6cea9ada1").shadow_annotation_input;
eq(local.usage_role_context.values,["local_area"],"ATOPALM local_area preserved");
eq(local.eligibility_effect,"NONE","local_area does not change eligibility");

const dual=adaptBarrierSupportNonNumericPdaShadowAnnotationInput({
  productState:examples.examples.find(x=>x.case_id==="present_barrier_and_dehydration_single_annotation").input.product_state,
  userContext:{concern_axes:["barrier","dehydration"]}
});
eq(dual.relevant_user_axes,["barrier","dehydration"],"dual relevant axes preserved");
eq(dual.numeric_contribution,null,"dual axes no additive contribution");

const runtimeState={
  decisionBundle:{
    locale:"ko",
    context:{
      version:"shared-skin-decision-context-v4",
      skinState:{priorityAxis:"barrier",concernScores:{barrier:20,dehydration:12},sensitivity:"low"},
      survey:{answers:{mainConcern:"barrier",mainConcerns:["barrier","dehydration"],skinType:"normal",sensitivity:"low"},completeness:"available"},
      safetyState:{level:"stable",sensitiveBurden:false,activeExpansionAllowed:true,exfoliationExpansionAllowed:true,protectionMustMaintain:true,recentSkinChange:"no",recentlyChangedProduct:"no"},
      productExposureState:{rows:[],unknownExposurePresent:false,recentExposureState:"none_reported",reactionLinkState:"none_reported"},
      conditionSignalState:{recentSkinChange:"no",recentProductChange:"no",productReaction:"no"}
    }
  },
  functionalPolicy:{version:"functional-policy-v1",locale:"ko",priorityAxis:"barrier",primaryGoal:"barrier",functionalDirection:"barrier_support",planMode:"START",allowedIntensity:"low_to_moderate",recommendationSuppressed:false,safety:{level:"stable",activeExpansionAllowed:true,protectionMustMaintain:true}},
  consistency:{version:"cross-domain-consistency-v1",verdict:"consistent",effectivePolicySource:"raw"},
  currentProductFindings:{findings:[],summary:{evaluableSelectedCount:0,notInDbCount:0,notUsingCount:0,unansweredCount:0}}
};
const candidate={id:"c2bb9ffd-f261-4f9b-91ed-23f6cea9ada1",name:"fixture",brand:"fixture",category:"moisturizer",irritation_risk:"low",sensitivity_safe:true,skin_types:["normal"],concerns:["barrier"],ingredient_signals:{functional:[]}};
const direct=evaluateCandidateExposurePolicy({canonicalState:structuredClone(runtimeState),candidates:[structuredClone(candidate)]});
const response={stable:true}, snapshot={stable:true};
const control=resolveCandidateExposurePolicyShadowControl({DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW:"1",VERCEL_ENV:"preview"});
const shadow=runCandidateExposurePolicyShadow({
  control,canonicalState:runtimeState,candidates:[candidate],legacyExecution:null,
  responseValue:response,snapshotValue:snapshot,barrierSupportPdaArtifact:r4,telemetrySink:()=>{}
});
eq(shadow.policyResult,direct,"existing candidate policy result unchanged");
eq(shadow.barrierSupportPdaShadow.status,"evaluated","barrier adapter runtime path");
eq(shadow.barrierSupportPdaShadow.rows.length,1,"one runtime candidate row");
eq(shadow.barrierSupportPdaShadow.rows[0].shadow_annotation_input.annotation_authority_state,"positive_claim_context_available","runtime positive annotation");
eq(shadow.barrierSupportPdaShadow.rows[0].shadow_annotation_input.eligibility_effect,"NONE","runtime no eligibility effect");
eq(response,{stable:true},"public response unchanged");
eq(snapshot,{stable:true},"snapshot unchanged");
eq(shadow.fingerprints.responseMatch,true,"response fingerprint");
eq(shadow.fingerprints.snapshotMatch,true,"snapshot fingerprint");
eq(shadow.fingerprints.candidateOrderMatch,true,"candidate order fingerprint");
ok(!Object.hasOwn(shadow.telemetry,"barrierSupportPdaShadow"),"telemetry schema unchanged");

const bad={};
Object.defineProperty(bad,"products",{get(){throw new Error("fixture")}});
const isolated=runCandidateExposurePolicyShadow({
  control,canonicalState:runtimeState,candidates:[candidate],legacyExecution:null,
  responseValue:{stable:true},snapshotValue:{stable:true},
  barrierSupportPdaArtifact:bad,telemetrySink:()=>{}
});
eq(isolated.policyResult,direct,"barrier adapter failure isolated from policy");
eq(isolated.barrierSupportPdaShadow.status,"adapter_execution_failed","barrier adapter failure explicit");
eq(isolated.status,"executed","shadow policy still executes");

for(const p of [IMPL,REPLAY]){
  eq(read(p),canonical(p),`${p}: canonical bytes`);
}
eq(impl.stage,STAGE,"implementation stage");
eq(impl.primary_terminal_outcome,TERMINAL,"implementation terminal");
eq(impl.implementation.actual_runtime_shadow_path_wired,true,"runtime shadow wired");
eq(impl.implementation.existing_policy_evaluator_input_changed,false,"policy input unchanged");
eq(impl.implementation.existing_policy_result_changed,false,"policy result unchanged");
eq(impl.implementation.telemetry_schema_changed,false,"telemetry unchanged");
eq(replay.primary_terminal_outcome,TERMINAL,"replay terminal");
eq(replay.validation.r5_contract_cases_exact,12,"12 exact cases");
eq(replay.validation.r4_catalog_rows_evaluated,176,"176 replay");
eq(replay.validation.r4_provenance_scope_loss,0,"zero lineage loss");
eq(replay.validation.local_area_eligibility_changes,0,"local area no eligibility delta");
eq(replay.validation.barrier_dehydration_double_count_units,0,"no double count");
eq(replay.production_invariance.products,164,"frozen products");
eq(replay.production_invariance.scenarios,12,"frozen scenarios");
eq(replay.production_invariance.evaluations,1968,"frozen evaluations");
for(const key of ["score_delta","ranking_delta","top1_delta","top3_delta","eligibility_delta","candidate_policy_delta","public_response_delta","persistence_delta"]){
  eq(replay.production_invariance[key],0,`production ${key}`);
}
eq(replay.production_invariance.pda_production_consumption,"NO","production consumption");
eq(replay.production_invariance.recommendation_activation,"NO","recommendation activation");
ok(fs.existsSync("scripts/verify-current-recommendation-health.mjs"),"164x12 Current Main Health verifier exists");
ok(read(DOC).includes(TERMINAL),"doc terminal");

console.log(JSON.stringify({
  version:"verify-barrier-support-non-numeric-pda-shadow-adapter-implementation-v1",
  status:"PASS",
  assertions,
  stage:STAGE,
  contract_cases:12,
  catalog_rows:176,
  positive_claim_rows:6,
  production_invariance_owner:"BEJEWELY Current Main Health",
  primary_terminal_outcome:TERMINAL
}));
