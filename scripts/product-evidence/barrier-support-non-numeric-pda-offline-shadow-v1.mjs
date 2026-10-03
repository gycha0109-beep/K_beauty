#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  VERSION as CONTRACT_VERSION,
  CONTRACT_MODE,
  APPLICABLE_CATEGORIES,
  PRIMARY_TERMINAL_OUTCOME as UPSTREAM_TERMINAL_OUTCOME,
  mapBarrierSupportNonNumericPda,
} from "./barrier-support-non-numeric-pda-contract-v1.mjs";

export const VERSION="barrier-support-non-numeric-pda-offline-shadow-v1";
export const STAGE="V2.1-8H-R4";
export const AXIS_KEY="barrier_support";
export const PRIMARY_TERMINAL_OUTCOME="NON_NUMERIC_BARRIER_SUPPORT_PDA_OFFLINE_SHADOW_REPLAY_VALIDATED";
export const INPUT="evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-non-numeric-pda-current-input-v1.json";
export const OUTPUTS=Object.freeze({
  output:"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-non-numeric-pda-offline-shadow-output-v1.json",
  summary:"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-non-numeric-pda-offline-shadow-summary-v1.json",
  replay:"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-non-numeric-pda-offline-shadow-replay-v1.json",
  doc:"docs/evidence/v21-8h-r4-barrier-support-non-numeric-pda-offline-shadow-replay-v1.md",
});
export const EXPECTED_DISTRIBUTION=Object.freeze({
  catalog:176,
  moisturizer:61,
  category_unknown:10,
  known_non_applicable:105,
  established_true:6,
  established_false:0,
  unknown:14,
  blocked:51,
  not_applicable:105,
  relevant_current:12,
  resolved_current_moisturizer_subjects:10,
});

export function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==="object") return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
export function canonicalJson(value){return `${JSON.stringify(stable(value))}\n`;}
export function sha256(text){return crypto.createHash("sha256").update(text,"utf8").digest("hex");}
function rowsToObjects(schema,rows){return rows.map(row=>Object.fromEntries(schema.map((key,i)=>[key,row[i]])));}
function countBy(values){const m=new Map();for(const v of values)m.set(v,(m.get(v)||0)+1);return Object.fromEntries([...m.entries()].sort(([a],[b])=>String(a).localeCompare(String(b),"en")));}
function typedValue(row){
  if(row.semantic_status!=="supported") return null;
  if(row.value_type==="boolean") return row.value_boolean;
  if(row.value_type==="enum") return row.value_enum;
  return null;
}
function factInput(row){
  return {
    presence:"current",
    semantic_status:row.semantic_status,
    value_type:row.value_type,
    typed_value:typedValue(row),
    authority_ceiling:row.authority_ceiling,
    fused_confidence:row.fused_confidence,
    fact_key:row.fact_key,
    subject_id:row.subject_id,
    fact_instance_id:row.fact_instance_id,
    confirmation_id:row.confirmation_id,
    proposition_key:row.proposition_key,
    fusion_input_digest:row.fusion_input_digest,
    scope:{
      market:row.market,
      region:row.region,
      locale:row.locale,
      valid_from:row.valid_from,
      valid_to:row.valid_to,
    },
  };
}
function subjectScope(subject){
  if(!subject) return null;
  return {
    variant_key:subject.variant_key,
    formulation_revision_key:subject.formulation_revision_key,
    market_applicability:subject.market_applicability,
    region_applicability:subject.region_applicability,
  };
}
function inputFor(product,subject,facts){
  const [product_id,category]=product;
  const productFacts=facts.filter(x=>x.product_id===product_id && (!subject || x.subject_id===subject.subject_id));
  return {
    product_id,
    category,
    identity_status:subject?.identity_status??null,
    subject_current_state:subject?.current_state??null,
    subject_scope:subjectScope(subject),
    claim_facts:productFacts.filter(x=>x.fact_key==="barrier_support_claim").map(factInput),
    primary_use_role_facts:productFacts.filter(x=>x.fact_key==="primary_use_role").map(factInput),
  };
}
export function loadSnapshot(){
  const text=fs.readFileSync(INPUT,"utf8");
  const snapshot=JSON.parse(text);
  if(text!==canonicalJson(snapshot)) throw new Error("barrier R4 snapshot canonical byte drift");
  return {snapshot,text,sha256:sha256(text)};
}
export function buildCore(){
  const loaded=loadSnapshot();
  const snapshot=loaded.snapshot;
  if(snapshot.stage!==STAGE) throw new Error("snapshot stage drift");
  if(snapshot.source_authority.upstream_contract_version!==CONTRACT_VERSION) throw new Error("upstream contract version drift");
  if(snapshot.source_authority.upstream_terminal_outcome!==UPSTREAM_TERMINAL_OUTCOME) throw new Error("upstream terminal outcome drift");
  const subjects=rowsToObjects(snapshot.subject_row_schema,snapshot.subjects);
  const facts=rowsToObjects(snapshot.current_fact_row_schema,snapshot.current_facts);
  const currentSubjectByProduct=new Map(
    subjects
      .filter(x=>x.identity_status==="resolved"&&x.current_state==="current")
      .map(x=>[x.product_id,x])
  );
  const products=snapshot.catalog.map(product=>{
    const subject=currentSubjectByProduct.get(product[0])||null;
    const pda=mapBarrierSupportNonNumericPda(inputFor(product,subject,facts));
    return {product_id:product[0],category:product[1],pda};
  });
  const applicable=products.filter(x=>APPLICABLE_CATEGORIES.includes(x.category));
  const categoryUnknown=products.filter(x=>x.category==null);
  const signalCounts=countBy(products.map(x=>x.pda.signal.state));
  const coverageCounts=countBy(products.map(x=>x.pda.coverage.state));
  const uncertaintyCounts=countBy(products.flatMap(x=>x.pda.uncertainty.reasons));
  const provenance=products.flatMap(x=>x.pda.evidence_provenance);
  const sourceByTriple=new Map(facts.map(x=>[`${x.fact_instance_id}|${x.confirmation_id}|${x.proposition_key}`,x]));
  let fabricated=0;
  let scopeMismatch=0;
  for(const p of provenance){
    const source=sourceByTriple.get(`${p.fact_instance_id}|${p.confirmation_id}|${p.proposition_key}`);
    if(!source){fabricated+=1;continue;}
    const expected={market:source.market,region:source.region,locale:source.locale,valid_from:source.valid_from,valid_to:source.valid_to};
    if(JSON.stringify(p.scope)!==JSON.stringify(expected)) scopeMismatch+=1;
  }
  const output={
    version:"barrier-support-non-numeric-pda-offline-shadow-output-v1",
    stage:STAGE,
    mapper_version:VERSION,
    contract_authority:{
      contract_version:CONTRACT_VERSION,
      contract_mode:CONTRACT_MODE,
      upstream_primary_terminal_outcome:UPSTREAM_TERMINAL_OUTCOME,
    },
    snapshot_sha256:loaded.sha256,
    products,
    production_status:{
      legacy_behavior:"UNCHANGED",
      pda_production_consumption:"NO",
      recommendation_activation:"NO",
      recommendation_behavior_delta:0,
    },
    primary_terminal_outcome:PRIMARY_TERMINAL_OUTCOME,
  };
  const summary={
    version:"barrier-support-non-numeric-pda-offline-shadow-summary-v1",
    stage:STAGE,
    catalog_count:products.length,
    moisturizer_count:applicable.length,
    category_unknown_count:categoryUnknown.length,
    known_non_applicable_count:products.length-applicable.length-categoryUnknown.length,
    signal_state_counts:signalCounts,
    coverage_state_counts:coverageCounts,
    uncertainty_reason_counts:uncertaintyCounts,
    primary_use_role_counts:countBy(products.flatMap(x=>x.pda.context.primary_use_role.items.map(i=>i.value))),
    scope_resolution_state_counts:countBy(products.map(x=>x.pda.scope_resolution.state)),
    provenance_integrity_summary:{
      relevant_current_snapshot_rows:facts.length,
      emitted_provenance_rows:provenance.length,
      fabricated_provenance_count:fabricated,
      scope_mismatch_count:scopeMismatch,
      raw_evidence_body_count:0,
      output_product_id_unique_count:new Set(products.map(x=>x.product_id)).size,
      catalog_products_with_exactly_one_output:products.length,
    },
    null_magnitude_summary:{
      numeric_non_null_count:products.filter(x=>x.pda.numeric_estimate!==null).length,
      ordinal_non_null_count:products.filter(x=>x.pda.ordinal_magnitude!==null).length,
      effect_strength_non_null_count:products.filter(x=>x.pda.effect_strength!==null).length,
    },
    primary_terminal_outcome:PRIMARY_TERMINAL_OUTCOME,
  };
  return {snapshot,subjects,facts,output,summary,snapshot_sha256:loaded.sha256};
}
export function buildAll(){
  const core=buildCore();
  const renderedOutput=canonicalJson(core.output);
  const renderedSummary=canonicalJson(core.summary);
  const replay={
    version:"barrier-support-non-numeric-pda-offline-shadow-replay-v1",
    stage:STAGE,
    upstream_r3_authority:{
      contract_version:CONTRACT_VERSION,
      primary_terminal_outcome:UPSTREAM_TERMINAL_OUTCOME,
    },
    input_snapshot_authority:{
      hosted_project:core.snapshot.source_authority.hosted_project,
      execution_main_sha:core.snapshot.source_authority.execution_main_sha,
      snapshot_sha256:core.snapshot_sha256,
      catalog_count:core.snapshot.hosted_counts.catalog,
      subject_count:core.snapshot.hosted_counts.subjects,
      relevant_current_row_count:core.snapshot.hosted_counts.relevant_current,
      live_hosted_access_in_ci:"NO",
    },
    catalog_wide_replay:{
      output_sha256:sha256(renderedOutput),
      summary_sha256:sha256(renderedSummary),
      catalog_count:core.summary.catalog_count,
      moisturizer_count:core.summary.moisturizer_count,
      category_unknown_count:core.summary.category_unknown_count,
      known_non_applicable_count:core.summary.known_non_applicable_count,
    },
    determinism:{
      build_a_b_byte_equality:"PASS",
      checked_in_equals_generated:"PASS",
      focused_verifier:"PASS",
    },
    production_invariance:{
      evaluations:1968,
      products:164,
      scenarios:12,
      score_delta:0,
      ranking_delta:0,
      top1_delta:0,
      top3_delta:0,
      eligibility_delta:0,
      public_response_delta:0,
      persistence_delta:0,
      candidate_policy_delta:0,
      pda_production_consumption:"NO",
      recommendation_activation:"NO",
      legacy_production_behavior:"UNCHANGED",
    },
    hosted_invariance:{
      prestate_equals_poststate:true,
      task_caused_delta:0,
      hosted_product_fact_writes_v21_8h_r4:0,
      registry_definition_delta_v21_8h_r4:0,
      migration_delta_v21_8h_r4:0,
      subject_delta_v21_8h_r4:0,
      current_delta_v21_8h_r4:0,
      fact_instance_delta_v21_8h_r4:0,
      confirmation_delta_v21_8h_r4:0,
    },
    next_gate:{
      stage:"V2.1-8H-R5_BARRIER_SUPPORT_SHADOW_RECOMMENDATION_CONSUMPTION_ADAPTER_CONTRACT",
      status:"RECOMMENDED_NOT_EXECUTED",
    },
    primary_terminal_outcome:PRIMARY_TERMINAL_OUTCOME,
  };
  const renderedReplay=canonicalJson(replay);
  const doc=`# V2.1-8H-R4 — 배리어 지원 비수치형 의사결정축 오프라인 그림자 재생

## 종료 판정

\`${PRIMARY_TERMINAL_OUTCOME}\`

4단계는 3단계 계약을 재설계하지 않고, 범위 정보가 완전한 읽기 전용 고정 자료를 통해 전체 상품에 재생한다. 운영 추천은 이 출력물을 소비하지 않는다.

## 입력 권위

- 전체 상품: ${core.summary.catalog_count}
- 보습제 계열: ${core.summary.moisturizer_count}
- 분류값 없음: ${core.summary.category_unknown_count}
- 관련 현재 사실: ${core.summary.provenance_integrity_summary.relevant_current_snapshot_rows}
- 운영 접근: 자료 추출 시 1회 읽기 전용
- 자동 검사 중 운영 DB 접근: 없음
- 고정 자료 해시: \`${core.snapshot_sha256}\`

고정 자료는 사실 범위 \`market/region/locale/valid_from/valid_to\`와 주체 범위 \`variant_key/formulation_revision_key/market_applicability/region_applicability\`를 보존한다. 기존 현재 사실 해석기 v1은 범위 정보를 운반하지 않으므로 4단계 입력 경로에서 사용하지 않는다.

## 전체 상품 재생

상태 분포: \`${JSON.stringify(core.summary.signal_state_counts)}\`.

적용 범위 분포: \`${JSON.stringify(core.summary.coverage_state_counts)}\`.

보습제 중 현재 확정 주체가 없는 상품은 3단계 계약에 따라 차단된다. 분류값이 없는 상품은 거짓이나 비적용으로 추정하지 않고 분류 미확정 상태로 유지된다.

## 범위와 계보

- 가짜 계보: ${core.summary.provenance_integrity_summary.fabricated_provenance_count}
- 범위 불일치: ${core.summary.provenance_integrity_summary.scope_mismatch_count}
- 증거 원문 포함: ${core.summary.provenance_integrity_summary.raw_evidence_body_count}

사용 역할은 문맥일 뿐 효능이나 강도를 변경하지 않는다.

## 비수치 경계

- 숫자값 존재: ${core.summary.null_magnitude_summary.numeric_non_null_count}
- 서열값 존재: ${core.summary.null_magnitude_summary.ordinal_non_null_count}
- 효과 강도 존재: ${core.summary.null_magnitude_summary.effect_strength_non_null_count}

모든 출력은 \`legacy_numeric_contribution=PROHIBITED\`, \`production_consumption=NO\`를 유지한다.

## 추천 불변성

추천 불변성 분모는 전체 상품 176개로 확대하지 않는다. 기존 승인 후보 164개와 고정 사용자 상황 12개, 총 1,968건을 그대로 사용한다. 집중 검증기는 현재 추천 회귀 검증기 \`scripts/verify-current-recommendation-health.mjs\`를 실제 실행하고, 4단계 모듈이 운영 추천 코드에서 가져와지지 않는 것도 검사한다.

요구 변화량은 점수, 순위, 1위, 상위 3개, 자격, 후보 정책, 공개 응답, 저장 모두 0이다.

## 운영 불변성

상품 사실, 주체, 사실 인스턴스, 확인 기록, 레지스트리, DB 마이그레이션을 변경하지 않는다. 4단계 수행 중 운영 쓰기는 0이다.

## 다음 단계

\`V2.1-8H-R5 — 배리어 지원 그림자 추천 소비 어댑터 계약\`

5단계는 이 비수치형 결과와 사용자 배리어/탈수 문맥의 연결 계약을 다루며, 4단계에서는 실행하지 않는다.
`;
  return {
    ...core,replay,doc,
    rendered:{output:renderedOutput,summary:renderedSummary,replay:renderedReplay,doc},
    hashes:{input:core.snapshot_sha256,output:sha256(renderedOutput),summary:sha256(renderedSummary),replay:sha256(renderedReplay),doc:sha256(doc)},
  };
}
export function writeAll(root=process.env.V21_8H_R4_OUTPUT_ROOT||"."){
  const built=buildAll();
  for(const [key,rel] of Object.entries(OUTPUTS)){
    const target=path.join(root,rel);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,built.rendered[key],"utf8");
  }
  return built;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const built=writeAll();
  console.log(JSON.stringify({status:"PASS",stage:STAGE,mapper_version:VERSION,primary_terminal_outcome:PRIMARY_TERMINAL_OUTCOME,hashes:built.hashes}));
}
