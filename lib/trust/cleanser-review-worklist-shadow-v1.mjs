/**
 * R5/C4: read-only, existing-ten cleanser review worklist.
 * Snapshot contains ONLY derived flags and counts from authorized SELECTs.
 * Counts of review signals are NOT equal to evidence approvals.
 * No Product/Intake/Fact/Offer creation, G2 grant or source approval.
 */
export const CLEANSER_REVIEW_WORKLIST_VERSION="cleanser-review-worklist-shadow-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bool=x=>x===true;
const num=x=>Number.isSafeInteger(x)&&x>=0;
const requiredNums=["subjects","official_bindings","official_observations",
  "research_tasks","approved_metadata_fields","offers"];
const requiredFlags=["source_link_present","hwahae_link_equal",
  "hwahae_signals_present","skin_type_present","concern_present"];
const guardedRow=x=>x&&typeof x==="object"&&!Array.isArray(x)&&UUID.test(x.id)&&
  x.category==="cleanser"&&typeof x.brand==="string"&&x.brand.trim()&&
  typeof x.name==="string"&&x.name.trim()&&
  requiredNums.every(k=>num(x[k]))&&
  requiredFlags.every(k=>x[k]===true||x[k]===false);
const sort=x=>[...new Set(x)].sort();
export function buildCleanserReviewWorklistV1({rows,expected_product_ids,as_of="2026-10-23"}={}){
  if(!Array.isArray(rows)||rows.length!==10||rows.some(x=>!guardedRow(x))||
    !Array.isArray(expected_product_ids)||expected_product_ids.length!==10||
    new Set(expected_product_ids).size!==10||
    expected_product_ids.some(x=>!UUID.test(String(x)))||
    sort(rows.map(x=>x.id)).join("|")!==sort(expected_product_ids).join("|")||
    typeof as_of!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(as_of))
    throw new TypeError("EXACT_TEN_REDACTED_READONLY_COHORT_REQUIRED");
  const products=rows.map(x=>{
    const actions=[];
    const evidence=[];
    // Even an already resolved subject requires official source + exact observation
    // before declaring a validation worklist candidate. None of these facts
    // grants a governed review/confirmation.
    if(x.subjects===0||x.official_bindings===0||x.official_observations===0) {
      actions.push("P1_VERIFY_OFFICIAL_SKU_SUBJECT_SOURCE");
      if(x.source_link_present) evidence.push("CATALOG_LINK_IS_LEAD_ONLY");
    }
    if(!x.hwahae_link_equal||!x.hwahae_signals_present)
      actions.push("P2_RESEARCH_HWAHAE_EXACT_PRODUCT_CAPTURE");
    else evidence.push("HWAHAE_SIGNALS_PRESENT_NOT_GOVERNED_AUTHORITY");
    if(!x.skin_type_present||!x.concern_present||x.approved_metadata_fields<2)
      actions.push("P3_REVIEW_SKIN_TYPE_AND_CONCERN_METADATA");
    if(x.research_tasks!==2)
      actions.push("P0_RECONCILE_EXISTING_RESEARCH_TASKS");
    else evidence.push("PRESERVE_EXISTING_TWO_RESEARCH_TASKS");
    actions.push("P4_FACT_REVIEW_ONLY_AFTER_SUBJECT_AND_SOURCE_APPROVAL");
    const notice=[];
    if(x.size_ml===null&&/130\s*g\b/i.test(x.name))
      notice.push("130G_IS_NOT_130ML");
    if(x.brand==="라곰"&&x.size_ml==="120")
      notice.push("UNVERIFIED_RESEARCH_LEAD_120_TO_150ML");
    if(x.brand==="라곰"&&x.size_ml==="170")
      notice.push("UNVERIFIED_RESEARCH_LEAD_170_TO_220ML");
    if(x.brand==="제로이드"&&x.size_ml==="240")
      notice.push("UNVERIFIED_OFFICIAL_240ML");
    const approved=false;
    return Object.freeze({
      product_id:x.id,product_name:x.brand+" "+x.name,
      next_action:actions[0],actions:Object.freeze(actions),
      special_size_review:Object.freeze(notice),
      inventory:Object.freeze({
        current_subjects:x.subjects,
        official_bindings:x.official_bindings,
        official_observations:x.official_observations,
        existing_research_tasks:x.research_tasks,
        approved_recommendation_metadata_fields:x.approved_metadata_fields,
        offer_rows:x.offers
      }),
      evidence_is_not_authority:Object.freeze(evidence),
      source_review_granted:approved,subject_creation_granted:approved,
      fact_confirmation_granted:approved,
      recommendation_admission_granted:approved,
      production_writes:0
    });
  }).sort((a,b)=>a.product_id.localeCompare(b.product_id,"en"));
  const count=token=>products.filter(x=>x.actions.includes(token)).length;
  return Object.freeze({
    version:CLEANSER_REVIEW_WORKLIST_VERSION,as_of,products_count:10,
    missing_official_identity_count:count("P1_VERIFY_OFFICIAL_SKU_SUBJECT_SOURCE"),
    missing_hwahae_capture_count:count("P2_RESEARCH_HWAHAE_EXACT_PRODUCT_CAPTURE"),
    missing_approved_recommendation_metadata_count:count("P3_REVIEW_SKIN_TYPE_AND_CONCERN_METADATA"),
    research_queue_mismatch_count:count("P0_RECONCILE_EXISTING_RESEARCH_TASKS"),
    official_source_facts_created:0,admission_grants:0,production_writes:0,
    products:Object.freeze(products)
  });
}
