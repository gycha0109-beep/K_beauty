#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const STAGE = "V2.1-9C";
export const TERMINAL = "NORMATIVE_PRODUCTION_POLICY_READY_FOR_SEPARATE_ACTIVATION_AUTHORIZATION";
export const BASE_MAIN = "851eac78646c04196673e57ab7b52f77cacae8ae";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const P = {
  r8z:"exfoliation-non-numeric-pda-normative-production-policy-activation-readiness-contract-v1.json",
  a8z:"exfoliation-non-numeric-pda-normative-production-policy-readiness-evidence-assessment-v1.json",
  gate:"exfoliation-non-numeric-pda-normative-production-policy-activation-gate-v1.json",
  obs:"exfoliation-non-numeric-pda-normative-production-policy-observability-requirements-v1.json",
  rb:"exfoliation-non-numeric-pda-normative-production-policy-rollback-requirements-v1.json",
  fb:"exfoliation-non-numeric-pda-normative-production-policy-failure-fallback-matrix-v1.json",
  sim:"exfoliation-non-numeric-pda-normative-production-policy-hypothetical-enforcement-simulation-v1.json",
  enf:"exfoliation-non-numeric-pda-normative-production-policy-enforcement-boundary-contract-v1.json",
  rt8y:"exfoliation-non-numeric-pda-normative-production-policy-shadow-runtime-evidence-v1.json",
  s9a:"exfoliation-non-numeric-pda-additional-shadow-evidence-summary-v1.json",
  d9a:"exfoliation-non-numeric-pda-additional-shadow-divergence-distribution-v1.json",
  g9a:"exfoliation-non-numeric-pda-additional-shadow-readiness-gap-reassessment-v1.json",
  s9b:"exfoliation-existing-eligibility-candidate-availability-shadow-evidence-summary-v1.json",
  g9b:"exfoliation-existing-eligibility-candidate-availability-gap-reassessment-v1.json",
  x9b:"exfoliation-existing-eligibility-candidate-availability-restrict-classification-v1.json",
  b9b:"exfoliation-existing-eligibility-candidate-availability-enforcement-boundary-validation-v1.json",
};
export const OUTPUTS = {
  summary:"exfoliation-normative-production-policy-activation-readiness-reassessment-summary-v1.json",
  matrix:"exfoliation-normative-production-policy-readiness-matrix-v1.json",
  prerequisites:"exfoliation-normative-production-policy-activation-prerequisite-evaluation-v1.json",
  lineage:"exfoliation-normative-production-policy-evidence-lineage-map-v1.json",
  risk:"exfoliation-normative-production-policy-divergence-readiness-risk-summary-v1.json",
  live:"exfoliation-normative-production-policy-live-production-evidence-requirement-assessment-v1.json",
  boundary:"exfoliation-normative-production-policy-separate-activation-authorization-boundary-v1.json",
};
const FROZEN={v21_8x:"7dd6f3566ca3a680627eb64430ca8d34178b53bd",v21_8y:"5ce7195670eab6f2e9a2aff7810d4f48c9b6f688",v21_8z:"57211ec9c2c99ea02da74c4f8d2c707ca89aa597",v21_9a:"1c65eced12e05ca4a81d74bbef167f367e170582",v21_9b:BASE_MAIN};
const read=(k)=>JSON.parse(fs.readFileSync(path.join(ROOT,P[k]),"utf8"));
const ok=(v,m)=>{if(!v) throw new Error(m);};
const stable=(v)=>Array.isArray(v)?v.map(stable):(v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v);
export const canonical=(v)=>`${JSON.stringify(stable(v))}\n`;
const ref=(k)=>`${ROOT}/${P[k]}`;
const rr=(dimension,status,authority_source,evidence_refs,materiality,note)=>({dimension,status,authority_source,evidence_refs:[...evidence_refs].sort(),materiality,blocker_boolean:false,blocker_reason:null,note});

export function buildAll(){
  const r8z=read("r8z"),a8z=read("a8z"),gate=read("gate"),obs=read("obs"),rb=read("rb"),fb=read("fb"),sim=read("sim"),enf=read("enf"),rt8y=read("rt8y"),s9a=read("s9a"),d9a=read("d9a"),g9a=read("g9a"),s9b=read("s9b"),g9b=read("g9b"),x9b=read("x9b"),b9b=read("b9b");
  ok(r8z.stage==="V2.1-8Z"&&r8z.primary_terminal_outcome==="NORMATIVE_PRODUCTION_POLICY_ACTIVATION_REQUIRES_ADDITIONAL_SHADOW_EVIDENCE","8Z readiness drift");
  ok(r8z.readiness_result.semantic_blocker_present===false&&r8z.readiness_result.enforcement_semantics_fully_defined===true,"8Z semantic/enforcement drift");
  ok(a8z.quantitative_sample_threshold==="NOT_ARBITRARILY_DEFINED"&&a8z.future_activation_evidence_gate.length===9,"8Z evidence gate drift");
  ok(gate.default_mode==="OFF"&&gate.current_state.enforce_authorized===false&&gate.activation_version_contract.production_enforce_requires_separate_authorization===true,"8Z gate drift");
  ok(obs.telemetry_state==="CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED"&&rb.rollback_state==="CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED","8Z safety contract state drift");
  ok(fb.design_principles.default_allow_forbidden===true&&fb.fallback_mode==="FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH","8Z fallback drift");
  ok(sim.scenario_count===19&&enf.future_integration_boundary.preferred_boundary==="POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY","8Z mechanism drift");
  ok(rt8y.validation_summary.canonical_cases===17&&rt8y.validation_summary.canonical_production_identical===true,"8Y runtime drift");
  ok(s9a.coverage.evaluations===1968&&s9a.coverage.contexts===12&&s9a.coverage.actions.RESTRICT===6&&s9a.coverage.actions.CAUTION===12&&s9a.coverage.actions.NOT_APPLICABLE===1176,"9A coverage drift");
  ok(s9a.classification_model.live_count===0&&d9a.unexplained_high_risk===0&&d9a.enforcement_relevance.REQUIRES_REVIEW===6,"9A live/divergence drift");
  ok(g9a.remaining_material_gap.includes("existing eligibility"),"9A material gap drift");
  ok(s9b.coverage.evaluations===1968&&s9b.coverage.eligibility.ELIGIBLE===1968&&s9b.coverage.availability.PRESENT_AT_ENFORCEMENT_BOUNDARY===1968,"9B state drift");
  ok(s9b.coverage.restrict.DEFINITE_NEW_EXCLUSION===6&&s9b.boundary_validation==="BOUNDARY_CONFIRMED"&&g9b.material_eligibility_availability_gap_remaining===false,"9B closure drift");
  ok(x9b.classification.DEFINITE_NEW_EXCLUSION===6&&x9b.rows.every(x=>x.score_order_top3===false),"9B RESTRICT rows drift");
  ok(b9b.result==="BOUNDARY_CONFIRMED"&&b9b.semantic_refinement_required===false,"9B boundary artifact drift");

  const M=[
    rr("SEMANTIC","READY","8X+8Z",[ref("r8z"),ref("enf")],"MATERIAL_PRE_AUTHORIZATION","Five-action semantics and downstream effects remain deterministic; ALLOW is not approval, DEFER is not ALLOW, RESTRICT is eligibility-only."),
    rr("RUNTIME","READY","8Y",[ref("rt8y")],"MATERIAL_PRE_AUTHORIZATION","Deterministic versioned shadow runtime remains 17/17 and canonical-output isolated."),
    rr("ACTION_COVERAGE","READY","9A",[ref("s9a")],"MATERIAL_PRE_AUTHORIZATION","All five actions occur in the 164x12 bounded corpus."),
    rr("REAL_PRODUCT_COVERAGE","READY","9A",[ref("s9a"),ref("g9a")],"MATERIAL_PRE_AUTHORIZATION","Governed real products plus controlled contexts cover ALLOW/DEFER/CAUTION/RESTRICT; actual catalog non-applicability is separate. No controlled context is promoted to live observation."),
    rr("EXTERNAL_CONTEXT_COVERAGE","READY","9A",[ref("s9a"),ref("g9a")],"MATERIAL_PRE_AUTHORIZATION","12/12 controlled external-context families covered."),
    rr("NOT_APPLICABLE_COVERAGE","READY","9A",[ref("s9a")],"MATERIAL_PRE_AUTHORIZATION","1176 actual catalog evaluations are NOT_APPLICABLE."),
    rr("DIVERGENCE","READY","8T+9A+9B",[ref("d9a"),ref("x9b")],"MATERIAL_PRE_AUTHORIZATION","Six enforcement-relevant rows are mechanically explainable; unexplained high-risk divergence is zero."),
    rr("ELIGIBILITY","READY","9B",[ref("s9b"),ref("g9b")],"MATERIAL_PRE_AUTHORIZATION","1968/1968 existing-eligibility rows materialized ELIGIBLE with unknown=0."),
    rr("CANDIDATE_AVAILABILITY","READY","9B",[ref("s9b"),ref("g9b")],"MATERIAL_PRE_AUTHORIZATION","1968/1968 rows PRESENT_AT_ENFORCEMENT_BOUNDARY."),
    rr("RESTRICT_EXCLUSION","READY","9B",[ref("x9b")],"MATERIAL_PRE_AUTHORIZATION","6/6 RESTRICT rows are definite hypothetical new exclusions."),
    rr("TOP_K_MECHANISM","READY","8Z synthetic + 9B bounded",[ref("sim"),ref("s9b")],"MATERIAL_PRE_AUTHORIZATION","8Z covers inside/outside/multiple RESTRICT and refill; current 9B RESTRICT rows are outside Top3 with Top1/Top3/refill/insufficiency all zero."),
    rr("FAILURE_FALLBACK","READY_AS_CONTRACT","8Z",[ref("fb"),ref("sim")],"MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE","Failure=>DEFER+legacy path; default ALLOW and partial enforcement forbidden. Runtime adapter validation remains pre-activation work."),
    rr("OBSERVABILITY_CONTRACT","READY_AS_CONTRACT","8Z",[ref("obs"),ref("r8z")],"MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE","Required telemetry and privacy contract frozen; production implementation remains required before activation."),
    rr("ROLLBACK_CONTRACT","READY_AS_CONTRACT","8Z",[ref("rb"),ref("sim")],"MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE","One-step LEGACY_ONLY rollback frozen; runtime kill-switch validation remains required before activation."),
    rr("ACTIVATION_GATE_CONTRACT","READY_AS_CONTRACT","8Z",[ref("gate")],"MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE","OFF/SHADOW/ENFORCE, default OFF, kill-switch precedence and separate ENFORCE authorization frozen."),
    rr("VERSION_PINNING","READY_AS_CONTRACT","8Z",[ref("gate")],"MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE","Exact policy/runtime/activation/upstream version pins required and specified."),
    rr("LEGACY_FALLBACK","READY_AS_CONTRACT","8Z",[ref("fb"),ref("rb"),ref("gate")],"MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE","LEGACY_ONLY remains recoverable without Product Fact/Registry/DB rollback."),
    rr("LIVE_PRODUCTION_EVIDENCE","NOT_REQUIRED_AT_THIS_STAGE","8Z+9A+9B",[ref("a8z"),ref("s9a"),ref("g9b")],"NON_BLOCKING_FOR_ENTRY_TO_SEPARATE_AUTHORIZATION_STAGE","Live observation remains zero. 8Z freezes no live-count/numeric threshold for entering a separate authorization stage; a later authorization stage may require staged SHADOW evidence before ENFORCE."),
  ];
  const matrix={version:"exfoliation-normative-production-policy-readiness-matrix-v1",stage:STAGE,terminal:TERMINAL,rows:M,blocker_count:0,material_not_ready_count:0,activation_readiness_passed:true,ready_for_separate_activation_authorization:true};

  const G=a8z.future_activation_evidence_gate;
  const prerequisites={version:"exfoliation-normative-production-policy-activation-prerequisite-evaluation-v1",stage:STAGE,terminal:TERMINAL,source_prerequisites:"V2.1-8Z future_activation_evidence_gate",rows:[
    {prerequisite:G[0],status:"SATISFIED",evidence_refs:[ref("rt8y"),ref("s9a")],required_before_activation:true,required_before_authorization_stage:true},
    {prerequisite:G[1],status:"SATISFIED",evidence_refs:[ref("r8z")],required_before_activation:true,required_before_authorization_stage:true},
    {prerequisite:G[2],status:"SATISFIED_BY_CLASSIFIED_REAL_PRODUCT_SHADOW_EVIDENCE",evidence_refs:[ref("s9a"),ref("g9a")],required_before_activation:true,required_before_authorization_stage:true},
    {prerequisite:G[3],status:"SATISFIED_BY_REAL_PRODUCT_CONTROLLED_CONTEXT_SHADOW",evidence_refs:[ref("s9a"),ref("g9a")],required_before_activation:true,required_before_authorization_stage:true},
    {prerequisite:G[4],status:"SATISFIED_BY_BOUNDED_CATALOG_OFFLINE_SHADOW_DISTRIBUTION",evidence_refs:[ref("s9a"),ref("d9a")],required_before_activation:true,required_before_authorization_stage:true},
    {prerequisite:G[5],status:"SATISFIED",evidence_refs:[ref("d9a"),ref("x9b"),ref("s9b")],required_before_activation:true,required_before_authorization_stage:true},
    {prerequisite:G[6],status:"NOT_REQUIRED_AT_THIS_STAGE_CONTRACT_READY_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION",evidence_refs:[ref("fb"),ref("sim"),ref("r8z")],required_before_activation:true,required_before_authorization_stage:false},
    {prerequisite:G[7],status:"NOT_REQUIRED_AT_THIS_STAGE_CONTRACTS_READY_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION",evidence_refs:[ref("obs"),ref("rb"),ref("gate"),ref("r8z")],required_before_activation:true,required_before_authorization_stage:false},
    {prerequisite:G[8],status:"SATISFIED_AND_REVERIFIED_IN_9C_CI",evidence_refs:[ref("rt8y"),ref("s9b")],required_before_activation:true,required_before_authorization_stage:true},
  ],pre_authorization_unsatisfied_count:0,downstream_pre_activation_implementation_obligations:["failure/fallback runtime adapter validation","observability runtime implementation and validation","kill-switch/rollback runtime implementation and validation","versioned activation gate implementation and validation"],numeric_threshold_invented:false};

  const lineage={version:"exfoliation-normative-production-policy-evidence-lineage-map-v1",stage:STAGE,terminal:TERMINAL,rows:[
    {readiness_need:"deterministic five-action semantics",frozen_8z_state:"READY",evidence_progression:["8X contract frozen","8Y 17/17 runtime replay"],current_status:"SATISFIED"},
    {readiness_need:"real-product action/context coverage",frozen_8z_state:"ADDITIONAL_SHADOW_EVIDENCE_REQUIRED",evidence_progression:["9A actual/governed states","9A controlled CAUTION/RESTRICT on real products","9A 12/12 contexts"],current_status:"SATISFIED"},
    {readiness_need:"bounded action/divergence distribution",frozen_8z_state:"INSUFFICIENT",evidence_progression:["9A 164x12 distribution","9A 8T taxonomy","9A unexplained high-risk=0"],current_status:"SATISFIED_BY_BOUNDED_OFFLINE_SHADOW"},
    {readiness_need:"RESTRICT definite exclusion",frozen_8z_state:"PARTIAL",evidence_progression:["9A RESTRICT=6 eligibility unknown","9B eligibility/availability fully known","9B 6/6 definite exclusion"],current_status:"SATISFIED"},
    {readiness_need:"Top-K/refill mechanism",frozen_8z_state:"SYNTHETIC_MECHANISM_DEFINED_REAL_DISTRIBUTION_GAP",evidence_progression:["8Z inside/outside/multiple RESTRICT simulations","9B bounded current Top3 analysis"],current_status:"SATISFIED_MECHANISM_VALIDATED"},
    {readiness_need:"enforcement boundary",frozen_8z_state:"CONTRACT_IDENTIFIED",evidence_progression:["8Z boundary contract","9B BOUNDARY_CONFIRMED"],current_status:"SATISFIED"},
    {readiness_need:"failure/observability/rollback/version safety",frozen_8z_state:"CONTRACT_FROZEN_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION",evidence_progression:["8Z safety contracts frozen"],current_status:"CONTRACT_READY_DOWNSTREAM_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION"},
    {readiness_need:"live production traffic",frozen_8z_state:"NO_EXPLICIT_PRE_AUTHORIZATION_THRESHOLD",evidence_progression:["9A live count=0","9B live unavailable/non-blocking for shadow reassessment"],current_status:"NOT_REQUIRED_BEFORE_SEPARATE_AUTHORIZATION_STAGE"},
  ]};

  const positions=x9b.rows.map(x=>x.sorted_position).sort((a,b)=>a-b);
  const risk={version:"exfoliation-normative-production-policy-divergence-readiness-risk-summary-v1",stage:STAGE,terminal:TERMINAL,divergence_taxonomy:d9a.taxonomy,distribution:d9a.primary,supporting_distribution:d9a.supporting,unexplained_high_risk_divergence:0,enforcement_relevant_rows:6,enforcement_relevant_rows_definite_new_exclusion:6,activation_authorization_blocking_divergence:0,bounded_restrict_positions:positions,bounded_restrict_inside_top3:0,interpretation:"Six bounded RESTRICT rows are mechanically explainable and outside current Top3. This does not claim future RESTRICT can never enter Top-K; 8Z synthetic scenarios validate that mechanism.",remaining_downstream_activation_risks:["runtime observability implementation not yet active","runtime rollback/kill-switch implementation not yet active","canonical activation/version gate not yet implemented","ENFORCE adapter not implemented or authorized"],additional_evidence_acquisition_required_before_authorization_stage:false};

  const live={version:"exfoliation-normative-production-policy-live-production-evidence-requirement-assessment-v1",stage:STAGE,terminal:TERMINAL,finding:"LIVE_TRAFFIC_NOT_REQUIRED_BEFORE_AUTHORIZATION_STAGE",live_production_observation_count:0,live_production_observation_fabricated:false,frozen_8z_explicit_live_traffic_numeric_threshold:null,frozen_8z_quantitative_sample_threshold:a8z.quantitative_sample_threshold,numeric_readiness_threshold_invented:false,basis:["8Z requires bounded production-distribution shadow action/divergence evidence but freezes no live-traffic count threshold for entry to a separate authorization stage.","9A supplies bounded 164x12 catalog distributions while preserving LIVE_PRODUCTION_OBSERVATION=0.","9B closes eligibility/availability and definite-exclusion gaps and treats live distribution as unavailable/non-blocking for shadow reassessment.","A later separately authorized SHADOW/staged rollout may define live evidence requirements before ENFORCE; 9C does not authorize it."],blocker_boolean:false};

  const boundary={version:"exfoliation-normative-production-policy-separate-activation-authorization-boundary-v1",stage:STAGE,terminal:TERMINAL,activation_readiness_passed:true,ready_for_separate_activation_authorization:true,production_activation_authorized:false,activation_executed:false,normative_policy_runtime_active:false,restrict_enforcement_implemented:false,restrict_canonical_exclusion_active:false,readiness_pass_does_not_authorize:["ENFORCE","production activation","RESTRICT canonical exclusion","rollout percentage","user exposure","live SHADOW rollout"],next_stage_may_independently_decide:["whether activation is authorized","rollout mode and initial blast radius","required runtime observability implementation","runtime rollback/kill-switch implementation","versioned activation gate implementation","enforcement adapter implementation prerequisites","pre-activation and post-activation verification","whether staged SHADOW live evidence is required before ENFORCE"],next_stage_must_preserve:["default OFF until explicitly authorized","separate authorization for ENFORCE","existing_eligibility AND normative_policy_eligibility","RESTRICT-only exclusion semantics","no score recomputation or reranking","FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH","LEGACY_ONLY one-step rollback target"]};

  const summary={version:"exfoliation-normative-production-policy-activation-readiness-reassessment-summary-v1",stage:STAGE,terminal:TERMINAL,authority:{repository:"gycha0109-beep/K_beauty",base_main:BASE_MAIN,frozen:FROZEN},activation_readiness_passed:true,ready_for_separate_activation_authorization:true,blocker_count:0,pre_authorization_unsatisfied_prerequisites:0,additional_evidence_acquisition_required_before_authorization_stage:false,live_production_evidence_requirement:live.finding,current_evidence:{canonical_cases_8y:17,bounded_evaluations_9a_9b:1968,action_distribution_9a:s9a.coverage.actions,unexplained_high_risk_divergence_9a:0,existing_eligibility_9b:s9b.coverage.eligibility,candidate_availability_9b:s9b.coverage.availability,restrict_classification_9b:x9b.classification,top1_changed_9b:s9b.impact.score_order_top1_changed_scenarios,top3_changed_9b:s9b.impact.score_order_top3_changed_scenarios,refill_count_9b:s9b.impact.refill_count,top_k_insufficient_9b:s9b.impact.top_k_insufficient_scenarios,live_observations:0},downstream_pre_activation_implementation_obligations:prerequisites.downstream_pre_activation_implementation_obligations,invariants:{NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED:"YES",NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED:"NO",NORMATIVE_POLICY_RUNTIME_ACTIVE:"NO",PRODUCTION_POLICY_ACTIVATED:"NO",PRODUCTION_ACTIVATION_AUTHORIZED:"NO",ACTIVATION_EXECUTED:"NO",RESTRICT_ENFORCEMENT_IMPLEMENTED:"NO",RESTRICT_CANONICAL_EXCLUSION_ACTIVE:"NO",ALLOW_PROMOTED_TO_CANONICAL_APPROVAL:"NO",DEFER_PROMOTED_TO_ALLOW:"NO",EXISTING_ELIGIBILITY_RULE_CHANGED:"NO",CANDIDATE_AVAILABILITY_RULE_CHANGED:"NO",RECOMMENDATION_SCORER_CHANGED:"NO",RECOMMENDATION_RANKER_CHANGED:"NO",CANDIDATE_POLICY_PRODUCTION_CHANGED:"NO",RECOMMENDATION_ACTIVATED:"NO",LEGACY_HEURISTIC_REPLACED:"NO",LIVE_PRODUCTION_OBSERVATION_FABRICATED:"NO",NUMERIC_READINESS_THRESHOLD_INVENTED:"NO",NUMERIC_FITTING:0,POTENCY_ORDERING_CREATED:"NO",HOSTED_PRODUCT_FACT_WRITES:0,REGISTRY_DEFINITION_DELTA:0,MIGRATION_DELTA:0,ACTIVATION_READINESS_PASSED:"YES",READY_FOR_SEPARATE_ACTIVATION_AUTHORIZATION:"YES"},next_stage:"SEPARATE_NORMATIVE_POLICY_ACTIVATION_AUTHORIZATION_AND_RUNTIME_SAFETY_IMPLEMENTATION"};
  return {summary,matrix,prerequisites,lineage,risk,live,boundary};
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){const mode=process.argv[2]||"summary";const all=buildAll();if(!(mode in all))throw new Error(`unknown mode: ${mode}`);process.stdout.write(canonical(all[mode]));}
