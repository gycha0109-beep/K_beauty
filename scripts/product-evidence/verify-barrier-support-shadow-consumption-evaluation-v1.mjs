#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { build, canonical, STAGE, TERMINAL, DECISION } from "./build-barrier-support-shadow-consumption-evaluation-v1.mjs";

const ROOT="evidence/product-decision-axis-non-numeric-shadow-v2";
const SUMMARY=`${ROOT}/barrier-support-shadow-consumption-evaluation-summary-v1.json`;
const REPLAY=`${ROOT}/barrier-support-shadow-consumption-evaluation-replay-v1.json`;
const DOC="docs/evidence/v21-8h-r7-barrier-support-shadow-consumption-evaluation-v1.md";
const R6_IMPL=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-implementation-v1.json`;
const R6_REPLAY=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-validation-replay-v1.json`;
const ADAPTER="lib/barrier-support-non-numeric-pda-shadow-adapter.js";
const BLOBS={
  adapter:"095ee315f40e601f38991700ec660faf2629c599",
  implementation:"4c32fa31187608cab77a2625acf03c212fce0027",
  replay:"384cd5627582c01efaa4b98c7945baa4980d7eb9"
};

let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1};
const ok=(v,m)=>{assert.ok(v,m);assertions+=1};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const blob=p=>{const b=fs.readFileSync(p);return crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex")};

eq(blob(ADAPTER),BLOBS.adapter,"R6 adapter blob");
eq(blob(R6_IMPL),BLOBS.implementation,"R6 implementation blob");
eq(blob(R6_REPLAY),BLOBS.replay,"R6 replay blob");
eq(json(R6_IMPL).primary_terminal_outcome,"BARRIER_SUPPORT_SHADOW_CONSUMPTION_ADAPTER_IMPLEMENTATION_VALIDATED","R6 terminal");
eq(json(R6_REPLAY).production_invariance.evaluations,1968,"R6 invariance denominator");

const A=build(), B=build();
eq(canonical(A.summary),canonical(B.summary),"summary A/B deterministic");
eq(canonical(A.replay),canonical(B.replay),"replay A/B deterministic");
eq(A.doc,B.doc,"doc A/B deterministic");
eq(read(SUMMARY),canonical(A.summary),"checked summary");
eq(read(REPLAY),canonical(A.replay),"checked replay");
eq(read(DOC),A.doc,"checked doc");

eq(A.summary.stage,STAGE,"stage");
eq(A.summary.primary_terminal_outcome,TERMINAL,"terminal");
eq(A.summary.evaluation_decision,DECISION,"decision");
eq(A.summary.frozen_evaluation_boundary.candidate_products,164,"164 products");
eq(A.summary.frozen_evaluation_boundary.user_scenarios,12,"12 scenarios");
eq(A.summary.frozen_evaluation_boundary.candidate_scenario_evaluations,1968,"1968 evaluations");
eq(A.summary.frozen_evaluation_boundary.ranking_outputs_inspected,false,"ranking not inspected");
eq(A.summary.frozen_evaluation_boundary.top1_top3_exposure_established,false,"top exposure not claimed");

eq(A.summary.user_context_coverage.relevant_scenarios,9,"9 relevant scenarios");
eq(A.summary.user_context_coverage.non_relevant_scenarios,3,"3 non-relevant scenarios");
eq(A.summary.user_context_coverage.relevant_scenario_ids,["U10","U11","U2","U3","U4","U5","U6","U7","U9"],"relevant scenario ids");
eq(A.summary.user_context_coverage.dual_axis_scenario_ids,["U10","U11","U4"],"dual-axis scenarios");

const coverage=A.summary.candidate_product_fact_coverage;
eq(coverage.applicable_candidates,61,"61 applicable");
eq(coverage.positive_claim_candidates,6,"6 positive");
eq(coverage.explicit_negative_candidates,0,"0 explicit negative");
eq(coverage.unknown_candidates,4,"4 unknown");
eq(coverage.blocked_candidates,51,"51 blocked");
eq(coverage.not_applicable_candidates,103,"103 not applicable");
eq(coverage.blocked_share_of_applicable,0.836066,"blocked share");
eq(coverage.positive_share_of_applicable,0.098361,"positive share");

const agg=A.summary.aggregate_shadow_output;
eq(agg.annotation_state_counts,{
  blocked:612,
  held_unknown_product_fact:36,
  not_applicable:1236,
  not_relevant:30,
  positive_claim_context_available:54
},"1968 annotation distribution");
eq(agg.positive_claim_role_counts,{full_face:9,local_area:9,multi_area:36},"role distribution");
eq(agg.relevant_scenario_evaluations,1476,"relevant evals");
eq(agg.non_relevant_scenario_evaluations,492,"non-relevant evals");
eq(agg.positive_claim_context_rows,54,"positive rows");
eq(agg.held_unknown_product_fact_rows,36,"unknown rows");
eq(agg.blocked_rows,612,"blocked rows");
eq(agg.not_applicable_rows,1236,"not applicable rows");
eq(agg.dual_axis_positive_context_rows,18,"dual-axis positive rows");
eq(agg.numeric_contribution_units,0,"no numeric contribution");
eq(agg.rank_effect_units,0,"no rank effect");
eq(agg.eligibility_effect_units,0,"no eligibility effect");
eq(agg.barrier_dehydration_double_count_units,0,"no double count");

eq(A.summary.utility_assessment.explanation.verdict,"BOUNDED_USEFUL","explanation verdict");
eq(A.summary.utility_assessment.comparison.verdict,"CONTEXT_ONLY_NOT_ORDERING","comparison verdict");
eq(A.summary.utility_assessment.routine_context.verdict,"BOUNDED_USEFUL","routine verdict");
eq(A.summary.utility_assessment.production_activation.verdict,"NOT_AUTHORIZED","activation verdict");
eq(A.summary.bottleneck.primary,"PRODUCT_FACT_SUBJECT_COVERAGE","coverage bottleneck");
eq(A.summary.bottleneck.blocked_applicable_candidates,51,"bottleneck blocked count");
eq(A.summary.next_gate.stage,"V2.1-8H-R8_BARRIER_SUPPORT_COVERAGE_RECOVERY_PRIORITIZATION","next gate");
eq(A.summary.next_gate.status,"RECOMMENDED_NOT_EXECUTED","next gate not executed");

for(const s of A.replay.scenario_results){
  eq(s.candidate_evaluations,164,`${s.scenario_id}: candidate count`);
  eq(s.numeric_contribution_units,0,`${s.scenario_id}: numeric zero`);
  eq(s.rank_effect_units,0,`${s.scenario_id}: rank zero`);
  eq(s.eligibility_effect_units,0,`${s.scenario_id}: eligibility zero`);
  if(s.barrier_context_relevant){
    eq(s.annotation_state_counts.positive_claim_context_available,6,`${s.scenario_id}: positive 6`);
    eq(s.annotation_state_counts.held_unknown_product_fact,4,`${s.scenario_id}: unknown 4`);
    eq(s.annotation_state_counts.blocked,51,`${s.scenario_id}: blocked 51`);
    eq(s.annotation_state_counts.not_applicable,103,`${s.scenario_id}: NA 103`);
  }else{
    eq(s.annotation_state_counts.not_relevant,10,`${s.scenario_id}: not relevant 10`);
    eq(s.annotation_state_counts.blocked,51,`${s.scenario_id}: blocked preserved 51`);
    eq(s.annotation_state_counts.not_applicable,103,`${s.scenario_id}: NA 103`);
  }
}

for(const k of ["score_delta","ranking_delta","top1_delta","top3_delta","eligibility_delta","candidate_policy_delta","public_response_delta","persistence_delta"]){
  eq(A.summary.production_invariance[k],0,`production ${k}`);
}
eq(A.summary.production_invariance.pda_production_consumption,"NO","no production consumption");
eq(A.summary.production_invariance.recommendation_activation,"NO","no activation");
eq(A.summary.hosted_invariance.product_fact_writes,0,"no writes");
eq(A.summary.hosted_invariance.registry_definition_delta,0,"no registry delta");
eq(A.summary.hosted_invariance.migration_delta,0,"no migration");

const doc=read(DOC);
for(const token of [TERMINAL,DECISION,"51개","83.61%","Top1/Top3","PRODUCT_FACT_SUBJECT_COVERAGE","V2.1-8H-R8"]){
  ok(doc.includes(token),`doc token ${token}`);
}

console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,decision:DECISION,assertions,blocked_applicable:51,positive_applicable:6,evaluations:1968}));
