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
const leads=JSON.parse(await readFile(
  "evidence/trust/cleanser-public-official-research-leads-20261023-v1.json","utf8"
));
if(leads.authority!=="RESEARCH_LEAD_ONLY_NOT_OFFICIAL_EVIDENCE"||
   leads.records?.length!==10||
   leads.records.some(x=>!snapshot.expected_product_ids.includes(x.product_id)||
     x.formulation_equivalence!=="FORMULA_UNRESOLVED"||
     x.fact_reuse_authorized!==false||x.admission_authorized!==false))
  throw new Error("PUBLIC_LEADS_CANNOT_BECOME_TRUST_AUTHORITY");
const publicByProduct=new Map(leads.records.map(x=>[x.product_id,x]));
if(publicByProduct.size!==10)throw new Error("EXACT_TEN_PUBLIC_LEADS_REQUIRED");
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
    public_manufacturer_display_matches:leads.records.filter(x=>x.quantity_comparison==="MANUFACTURER_QUANTITY_MATCHES_CATALOG_HINT").length,
    public_manufacturer_display_differs:leads.records.filter(x=>x.quantity_comparison==="MANUFACTURER_QUANTITY_DIFFERS_FROM_CATALOG_HINT").length,
    public_manufacturer_quantity_unknown:leads.records.filter(x=>x.quantity_comparison==="OFFICIAL_QUANTITY_NOT_EXPLICIT").length,
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
    sizing_warnings:p.special_size_review,
    manufacturer_public_research:{
      status:publicByProduct.get(p.product_id).quantity_comparison,
      db_display:publicByProduct.get(p.product_id).catalog_quantity_hint,
      manufacturer_display:publicByProduct.get(p.product_id).public_manufacturer_page.observed_quantity,
      research_only_not_reviewed:true,
      approved_formulation:false
    }
  }))
};
process.stdout.write(JSON.stringify(result,null,2)+"\n");
