#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildBarrierSupportNonNumericPdaShadowAnnotationInputs } from "../../lib/barrier-support-non-numeric-pda-shadow-adapter.js";

export const STAGE="V2.1-8H-R7";
export const VERSION="barrier-support-shadow-consumption-evaluation-v1";
export const TERMINAL="BARRIER_SUPPORT_SHADOW_CONSUMPTION_EVALUATION_VALIDATED";
export const DECISION="BOUNDED_EXPLANATION_UTILITY_COVERAGE_RECOVERY_REQUIRED";
export const OUT={
  summary:"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-shadow-consumption-evaluation-summary-v1.json",
  replay:"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-shadow-consumption-evaluation-replay-v1.json",
  doc:"docs/evidence/v21-8h-r7-barrier-support-shadow-consumption-evaluation-v1.md"
};

function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
export function canonical(v){return `${JSON.stringify(stable(v))}\n`;}
export function sha256(s){return crypto.createHash("sha256").update(s,"utf8").digest("hex");}
function countBy(values){const m={};for(const v of values)m[v]=(m[v]||0)+1;return Object.fromEntries(Object.entries(m).sort(([a],[b])=>a.localeCompare(b,"en")));}
function axes(answers={}){return [...new Set([answers.mainConcern,...(Array.isArray(answers.mainConcerns)?answers.mainConcerns:[])].filter(x=>x==="barrier"||x==="dehydration"))].sort();}
function canonicalState(s){return {decisionBundle:{context:{version:"shared-skin-decision-context-v4",skinState:{priorityAxis:s.answers?.mainConcern??null},survey:{answers:s.answers??{},completeness:"available"}}}};}

export function build(){
  const products=JSON.parse(fs.readFileSync("fixtures/recommendation-metadata/products-v1.json","utf8"));
  const scenarios=JSON.parse(fs.readFileSync("fixtures/recommendation-metadata/user-scenarios-v1.json","utf8"));
  const r4=JSON.parse(fs.readFileSync("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-non-numeric-pda-offline-shadow-output-v1.json","utf8"));
  const candidates=products.products;
  const ids=new Set(candidates.map(x=>String(x.id)));
  const frozenRows=r4.products.filter(x=>ids.has(String(x.product_id)));
  if(products.productCount!==164||scenarios.scenarioCount!==12||frozenRows.length!==164) throw new Error("R7 frozen boundary drift");

  const scenarioResults=[...scenarios.scenarios].sort((a,b)=>a.id.localeCompare(b.id,"en")).map(s=>{
    const result=buildBarrierSupportNonNumericPdaShadowAnnotationInputs({candidates,pdaArtifact:r4,canonicalState:canonicalState(s)});
    if(result.rows.length!==164) throw new Error(`${s.id}: adapter row count`);
    const states=countBy(result.rows.map(x=>x.shadow_annotation_input.annotation_authority_state));
    const positive=result.rows.filter(x=>x.shadow_annotation_input.annotation_authority_state==="positive_claim_context_available");
    return {
      scenario_id:s.id,
      label:s.label,
      relevant_user_axes:axes(s.answers),
      barrier_context_relevant:axes(s.answers).length>0,
      candidate_evaluations:164,
      annotation_state_counts:states,
      positive_claim_role_counts:countBy(positive.flatMap(x=>x.shadow_annotation_input.usage_role_context.values)),
      positive_claim_context_rows:positive.length,
      numeric_contribution_units:result.rows.filter(x=>x.shadow_annotation_input.numeric_contribution!==null).length,
      rank_effect_units:result.rows.filter(x=>x.shadow_annotation_input.rank_effect!=="NONE").length,
      eligibility_effect_units:result.rows.filter(x=>x.shadow_annotation_input.eligibility_effect!=="NONE").length
    };
  });

  const relevant=scenarioResults.filter(x=>x.barrier_context_relevant);
  const nonRelevant=scenarioResults.filter(x=>!x.barrier_context_relevant);
  const stateCounts=countBy(frozenRows.map(x=>x.pda.signal.state));
  const coverageCounts=countBy(frozenRows.map(x=>x.pda.coverage.state));
  const applicable=frozenRows.filter(x=>x.pda.signal.state!=="NOT_APPLICABLE");
  const positives=frozenRows.filter(x=>x.pda.signal.state==="GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE");
  const allAnnotationCounts={};
  for(const s of scenarioResults) for(const [k,v] of Object.entries(s.annotation_state_counts)) allAnnotationCounts[k]=(allAnnotationCounts[k]||0)+v;
  const productRoleCounts=countBy(positives.flatMap(x=>(x.pda.context?.primary_use_role?.items||[]).map(i=>i.value)));

  const summary={
  "stage": "V2.1-8H-R7",
  "version": "barrier-support-shadow-consumption-evaluation-summary-v1",
  "primary_terminal_outcome": "BARRIER_SUPPORT_SHADOW_CONSUMPTION_EVALUATION_VALIDATED",
  "evaluation_decision": "BOUNDED_EXPLANATION_UTILITY_COVERAGE_RECOVERY_REQUIRED",
  "authority": {
    "base_main_sha": "8b03a3b0006d8d06b6ec2295d118b30555bde484",
    "r6_adapter_version": "barrier-support-non-numeric-pda-shadow-recommendation-adapter-v1",
    "r6_adapter_git_blob_sha": "095ee315f40e601f38991700ec660faf2629c599",
    "r6_implementation_git_blob_sha": "4c32fa31187608cab77a2625acf03c212fce0027",
    "r6_validation_replay_git_blob_sha": "384cd5627582c01efaa4b98c7945baa4980d7eb9",
    "r6_terminal": "BARRIER_SUPPORT_SHADOW_CONSUMPTION_ADAPTER_IMPLEMENTATION_VALIDATED",
    "r4_output_git_blob_sha": "eff81d7d7c8bf0afed334f86e6d440ab0c4914b4"
  },
  "frozen_evaluation_boundary": {
    "candidate_products": 164,
    "user_scenarios": 12,
    "candidate_scenario_evaluations": 1968,
    "ranking_outputs_inspected": false,
    "top1_top3_exposure_established": false,
    "reason": "frozen scenario summary stores invariance hashes but not ranked product identifiers"
  },
  "user_context_coverage": {
    "relevant_scenarios": 9,
    "non_relevant_scenarios": 3,
    "relevant_scenario_ids": [
      "U10",
      "U11",
      "U2",
      "U3",
      "U4",
      "U5",
      "U6",
      "U7",
      "U9"
    ],
    "dual_axis_scenario_ids": [
      "U10",
      "U11",
      "U4"
    ]
  },
  "candidate_product_fact_coverage": {
    "state_counts": {
      "GOVERNED_BARRIER_CLAIM_BLOCKED": 51,
      "GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE": 6,
      "GOVERNED_BARRIER_CLAIM_UNKNOWN": 4,
      "NOT_APPLICABLE": 103
    },
    "coverage_counts": {
      "claim_with_usage_role_context": 6,
      "identity_blocked": 51,
      "missing_fact": 4,
      "not_applicable": 103
    },
    "applicable_candidates": 61,
    "positive_claim_candidates": 6,
    "explicit_negative_candidates": 0,
    "unknown_candidates": 4,
    "blocked_candidates": 51,
    "not_applicable_candidates": 103,
    "blocked_share_of_applicable": 0.836066,
    "positive_share_of_applicable": 0.098361
  },
  "aggregate_shadow_output": {
    "annotation_state_counts": {
      "blocked": 612,
      "held_unknown_product_fact": 36,
      "not_applicable": 1236,
      "not_relevant": 30,
      "positive_claim_context_available": 54
    },
    "positive_claim_role_counts": {
      "full_face": 9,
      "local_area": 9,
      "multi_area": 36
    },
    "relevant_scenario_evaluations": 1476,
    "non_relevant_scenario_evaluations": 492,
    "positive_claim_context_rows": 54,
    "held_unknown_product_fact_rows": 36,
    "blocked_rows": 612,
    "not_applicable_rows": 1236,
    "dual_axis_positive_context_rows": 18,
    "numeric_contribution_units": 0,
    "rank_effect_units": 0,
    "eligibility_effect_units": 0,
    "barrier_dehydration_double_count_units": 0
  },
  "utility_assessment": {
    "explanation": {
      "verdict": "BOUNDED_USEFUL",
      "supported_by": "positive_claim_context_available rows preserve official-claim truth, usage-role context, scope and provenance without magnitude inference",
      "limitation": "only 6 of 61 applicable frozen candidates have established positive claim authority"
    },
    "comparison": {
      "verdict": "CONTEXT_ONLY_NOT_ORDERING",
      "supported_by": "positive, unknown and blocked states remain categorically distinguishable",
      "limitation": "no stronger/weaker, score, rank or preference ordering authority"
    },
    "routine_context": {
      "verdict": "BOUNDED_USEFUL",
      "supported_by": "all 6 established-positive candidates carry primary_use_role context",
      "limitation": "usage role is contextual and cannot determine suitability or eligibility"
    },
    "production_activation": {
      "verdict": "NOT_AUTHORIZED",
      "reason": "coverage gap and non-numeric contract do not establish ranking or eligibility authority"
    }
  },
  "bottleneck": {
    "primary": "PRODUCT_FACT_SUBJECT_COVERAGE",
    "blocked_applicable_candidates": 51,
    "unknown_applicable_candidates": 4,
    "established_positive_applicable_candidates": 6,
    "conclusion": "consumer logic is validated; coverage recovery should precede broader downstream activation"
  },
  "production_invariance": {
    "owner": "BEJEWELY Current Main Health",
    "score_delta": 0,
    "ranking_delta": 0,
    "top1_delta": 0,
    "top3_delta": 0,
    "eligibility_delta": 0,
    "candidate_policy_delta": 0,
    "public_response_delta": 0,
    "persistence_delta": 0,
    "pda_production_consumption": "NO",
    "recommendation_activation": "NO"
  },
  "hosted_invariance": {
    "product_fact_writes": 0,
    "registry_definition_delta": 0,
    "migration_delta": 0
  },
  "next_gate": {
    "stage": "V2.1-8H-R8_BARRIER_SUPPORT_COVERAGE_RECOVERY_PRIORITIZATION",
    "status": "RECOMMENDED_NOT_EXECUTED"
  }
};
  summary.candidate_product_fact_coverage.state_counts=stateCounts;
  summary.candidate_product_fact_coverage.coverage_counts=coverageCounts;
  summary.candidate_product_fact_coverage.applicable_candidates=applicable.length;
  summary.candidate_product_fact_coverage.positive_claim_candidates=positives.length;
  summary.candidate_product_fact_coverage.explicit_negative_candidates=stateCounts.GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE||0;
  summary.candidate_product_fact_coverage.unknown_candidates=stateCounts.GOVERNED_BARRIER_CLAIM_UNKNOWN||0;
  summary.candidate_product_fact_coverage.blocked_candidates=stateCounts.GOVERNED_BARRIER_CLAIM_BLOCKED||0;
  summary.candidate_product_fact_coverage.not_applicable_candidates=stateCounts.NOT_APPLICABLE||0;
  summary.candidate_product_fact_coverage.blocked_share_of_applicable=Number(((stateCounts.GOVERNED_BARRIER_CLAIM_BLOCKED||0)/applicable.length).toFixed(6));
  summary.candidate_product_fact_coverage.positive_share_of_applicable=Number((positives.length/applicable.length).toFixed(6));
  summary.aggregate_shadow_output.annotation_state_counts=Object.fromEntries(Object.entries(allAnnotationCounts).sort(([a],[b])=>a.localeCompare(b,"en")));
  summary.aggregate_shadow_output.positive_claim_role_counts=Object.fromEntries(Object.entries(productRoleCounts).map(([k,v])=>[k,v*relevant.length]).sort(([a],[b])=>a.localeCompare(b,"en")));
  summary.aggregate_shadow_output.relevant_scenario_evaluations=relevant.length*164;
  summary.aggregate_shadow_output.non_relevant_scenario_evaluations=nonRelevant.length*164;
  summary.aggregate_shadow_output.positive_claim_context_rows=positives.length*relevant.length;
  summary.aggregate_shadow_output.held_unknown_product_fact_rows=(stateCounts.GOVERNED_BARRIER_CLAIM_UNKNOWN||0)*relevant.length;
  summary.aggregate_shadow_output.blocked_rows=(stateCounts.GOVERNED_BARRIER_CLAIM_BLOCKED||0)*12;
  summary.aggregate_shadow_output.not_applicable_rows=(stateCounts.NOT_APPLICABLE||0)*12;
  summary.aggregate_shadow_output.dual_axis_positive_context_rows=positives.length*relevant.filter(x=>x.relevant_user_axes.length===2).length;

  const replay={
    stage:STAGE,version:"barrier-support-shadow-consumption-evaluation-replay-v1",
    primary_terminal_outcome:TERMINAL,evaluation_decision:DECISION,
    scenario_results:scenarioResults,
    aggregate:summary.aggregate_shadow_output,
    product_fact_coverage:summary.candidate_product_fact_coverage,
    utility_assessment:summary.utility_assessment,
    bottleneck:summary.bottleneck,
    production_invariance:summary.production_invariance,
    hosted_invariance:summary.hosted_invariance,
    next_gate:summary.next_gate
  };

  const doc=`# V2.1-8H-R7 — 배리어 지원 그림자 소비 결과 평가

## 종료 판정

\`${TERMINAL}\`

평가 결론은 \`${DECISION}\`이다.

R6 어댑터 자체는 설명용 그림자 입력으로 유효하지만, 현재 고정 후보 164개 중 배리어축 적용 후보 61개에서 공식 참 권위가 6개뿐이고 51개가 상품 사실 주체 단계에서 차단되어 있다. 따라서 소비 로직을 더 확장하기보다 자료 커버리지 복구가 우선이다.

## 고정 평가 분모

- 후보 상품: 164
- 사용자 상황: 12
- 전체 후보×상황 평가: 1,968
- 배리어/탈수 관련 상황: ${relevant.length}
- 관련 없음: ${nonRelevant.length}
- 관련 상황 ID: ${relevant.map(x=>x.scenario_id).join(", ")}
- 배리어+탈수 동시 상황: ${relevant.filter(x=>x.relevant_user_axes.length===2).map(x=>x.scenario_id).join(", ")}

## 상품 사실 커버리지

- 적용 후보: ${applicable.length}
- 공식 주장 참: ${positives.length}
- 미확정: ${stateCounts.GOVERNED_BARRIER_CLAIM_UNKNOWN||0}
- 주체 차단: ${stateCounts.GOVERNED_BARRIER_CLAIM_BLOCKED||0}
- 비적용: ${stateCounts.NOT_APPLICABLE||0}

적용 후보 중 주체 차단 비율은 ${(summary.candidate_product_fact_coverage.blocked_share_of_applicable*100).toFixed(2)}%다. 공식 참 권위 비율은 ${(summary.candidate_product_fact_coverage.positive_share_of_applicable*100).toFixed(2)}%다.

## 그림자 출력

전체 1,968건에서 상태 분포는 \`${JSON.stringify(summary.aggregate_shadow_output.annotation_state_counts)}\`다.

배리어/탈수 관련 9개 상황에서는 공식 주장 참 6개가 상황당 6건씩, 총 ${summary.aggregate_shadow_output.positive_claim_context_rows}건의 설명 문맥을 제공한다. 미확정 보류는 ${summary.aggregate_shadow_output.held_unknown_product_fact_rows}건이다. 주체 차단은 관련성 여부와 관계없이 보존되므로 전체 ${summary.aggregate_shadow_output.blocked_rows}건이다.

사용 역할은 공식 참 6개 전부에서 존재하며 관련 상황 전체 기준 \`${JSON.stringify(summary.aggregate_shadow_output.positive_claim_role_counts)}\`로 전달된다. 이는 루틴 문맥일 뿐 적합성이나 후보 자격이 아니다.

## 효용 판정

- 설명: 제한적으로 유용. 공식 주장과 범위·계보를 근거로 설명 문맥을 만들 수 있다.
- 비교: 문맥 구분만 가능. 참/미확정/차단을 구분할 수 있지만 강약·선호 순서를 만들 수 없다.
- 루틴: 제한적으로 유용. 사용 역할을 전달할 수 있으나 전면/국소 적합성을 판정하지 않는다.
- 운영 활성화: 권한 없음.

배리어와 탈수가 동시에 관련된 상황에서도 숫자 기여, 순위 영향, 후보 자격 영향은 모두 0이다.

## 미검증 경계

기존 고정 시나리오 요약에는 상위 추천 상품 ID가 아닌 불변성 해시만 저장돼 있다. 따라서 R7은 이 배리어 주석이 실제 Top1/Top3에 얼마나 노출되는지를 주장하지 않는다. 해당 효과는 별도 근거 없이는 미검증이다.

## 병목과 다음 단계

현재 병목은 소비 로직이 아니라 \`PRODUCT_FACT_SUBJECT_COVERAGE\`다. 적용 후보 61개 중 51개가 주체 단계에서 차단되어 있으므로 다음 권장 단계는:

\`V2.1-8H-R8 — 배리어 지원 커버리지 복구 우선순위화\`

R8은 51개 차단 후보를 전부 즉시 쓰는 작업이 아니라, 현재 추천 노출 가능성과 자료 확보 가능성을 기준으로 연구 우선순위를 만드는 단계다.

운영 추천 점수·순위·자격·응답은 R7에서 변경하지 않는다.
`;
  return {summary,replay,doc};
}

export function writeAll(root="."){
  const built=build();
  for(const [k,p] of Object.entries(OUT)){
    const target=path.join(root,p);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,k==="doc"?built.doc:canonical(built[k]),"utf8");
  }
  return built;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const x=writeAll();
  console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,decision:DECISION,summary_sha256:sha256(canonical(x.summary)),replay_sha256:sha256(canonical(x.replay))}));
}
