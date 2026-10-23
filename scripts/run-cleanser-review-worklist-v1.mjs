#!/usr/bin/env node
/**
 * Offline readable worklist for the existing ten cleanser Product IDs.
 * Only embedded REDACTED SELECT snapshot is used. No credentials, network,
 * product updates, offer write, confirmation or admission.
 */
import {readFile} from "node:fs/promises";
import {buildCleanserReviewWorklistV1}
  from "../lib/trust/cleanser-review-worklist-shadow-v1.mjs";

if(process.argv.length!==2)throw new Error("NO_RUNTIME_FLAGS_OR_NETWORK_INPUT_ALLOWED");
const path="evidence/trust/cleanser-authority-next-actions-20261023.json";
const snapshot=JSON.parse(await readFile(path,"utf8"));
if(snapshot.version!=="cleanser-authority-next-actions-evidence-v1")
  throw new Error("EXACT_REDACTED_EVIDENCE_REQUIRED");
const plan=buildCleanserReviewWorklistV1({
  rows:snapshot.rows,expected_product_ids:snapshot.expected_product_ids,
  as_of:snapshot.as_of
});
const labels={
  P0_RECONCILE_EXISTING_RESEARCH_TASKS:"기존 연구 작업 확인",
  P1_VERIFY_OFFICIAL_SKU_SUBJECT_SOURCE:"제조사 원본·본품 규격·처방 신원 검토",
  P2_RESEARCH_HWAHAE_EXACT_PRODUCT_CAPTURE:"정확한 화해 상품 및 리뷰·성분 연결 확인",
  P3_REVIEW_SKIN_TYPE_AND_CONCERN_METADATA:"피부 타입·고민 메타데이터 검토",
  P4_FACT_REVIEW_ONLY_AFTER_SUBJECT_AND_SOURCE_APPROVAL:"처방 승인 뒤 기존 연구 작업의 Fact 별도 심사"
};
const result={
  as_of:plan.as_of,total:plan.products_count,
  summary:{
    official_sku_formulation_review:plan.missing_official_identity_count,
    hwahae_product_capture_review:plan.missing_hwahae_capture_count,
    recommendation_metadata_review:plan.missing_approved_recommendation_metadata_count,
    incorrect_task_count:plan.research_queue_mismatch_count,
    admission_grants:plan.admission_grants,production_writes:plan.production_writes
  },
  products:plan.products.map(p=>({
    product_id:p.product_id,name:p.product_name,
    next_step:labels[p.next_action]||p.next_action,
    remaining_steps:p.actions.map(x=>labels[x]||x),
    sizing_warnings:p.special_size_review
  }))
};
process.stdout.write(JSON.stringify(result,null,2)+"\n");
