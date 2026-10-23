/**
 * C4 ten-existing-cleanser v1/v2 offline reconciliation.
 * The real v1 function must be injected by a trusted caller from upstream
 * PR #1390 after the branch is integrated. No v1 reimplementation here.
 * This does not fetch hosted data, alter v1, or grant recommendation access.
 */
import {compareCleanserInitialPreflightV1V2Shadow} from "./cleanser-preflight-v2-shadow-v1.mjs";

export const TEN_CLEANSER_PREFLIGHT_DIFF_VERSION="ten-cleanser-preflight-v1-v2-diff-v1";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const valid=v=>UUID.test(String(v||""));
export async function compareExistingTenCleanserPreflightsV1({
  cohort, evaluateV1, now=new Date()
}={}) {
  if(!cohort||!Array.isArray(cohort.expected_product_ids)||
      cohort.expected_product_ids.length!==10||
      new Set(cohort.expected_product_ids).size!==10||
      cohort.expected_product_ids.some(id=>!valid(id))||
      !Array.isArray(cohort.products)||cohort.products.length!==10||
      cohort.products.some(p=>!valid(p?.id)||p.category!=="cleanser")||
      [...new Set(cohort.products.map(p=>p.id))].sort().join("|")!==
      [...cohort.expected_product_ids].sort().join("|")||
      typeof evaluateV1!=="function"||!Number.isFinite(now?.getTime?.()))
    throw new TypeError("EXACT_TEN_CLEANSER_V1_EVALUATOR_AND_COHORT_REQUIRED");
  const required=["subjects","official_bindings","observations","confirmed_facts","governed_formula_pairs","catalog_products"];
  if(required.some(k=>!Array.isArray(cohort[k])))throw new TypeError("COMPLETE_GOVERNED_SCOPE_READ_REQUIRED");
  const ids=new Set(cohort.expected_product_ids);
  for(const key of ["subjects","official_bindings","observations","confirmed_facts","governed_formula_pairs"]) {
    if(cohort[key].length>200)throw new TypeError("SCOPE_CARDINALITY_LIMIT_REACHED");
    if(key!=="confirmed_facts"&&cohort[key].some(row=>!ids.has(row?.product_id)))
      throw new TypeError("OTHER_PRODUCT_EVIDENCE_FORBIDDEN");
  }
  // Existing v1 materialization joins Product Fact through Subject, not product_id.
  const subjectIds=new Set(cohort.subjects.map(row=>row.subject_id));
  if(cohort.confirmed_facts.some(row=>!subjectIds.has(row?.subject_id)))
    throw new TypeError("OTHER_SUBJECT_CONFIRMED_FACT_FORBIDDEN");
  const results=[];
  for(const product of [...cohort.products].sort((a,b)=>a.id.localeCompare(b.id,"en"))) {
    const ofId=key=>cohort[key].filter(row=>row.product_id===product.id);
    const availableSubjects=ofId("subjects");
    const currentSubjects=availableSubjects.filter(x=>x.current_state==="current");
    const subject=currentSubjects.length===1?currentSubjects[0]:null;
    const officialBindings=ofId("official_bindings");
    const observations=ofId("observations");
    const confirmedFacts=cohort.confirmed_facts.filter(row=>row.subject_id===subject?.subject_id);
    const snapshot={
      product,subject,officialBindings,observations,confirmedFacts,
      catalogProducts:cohort.catalog_products,now
    };
    const v1=await evaluateV1(snapshot);
    if(!v1||v1.version!=="cleanser-initial-admission-preflight-v1"||
       v1.productId!==product.id||!Array.isArray(v1.blockers)||
       !Array.isArray(v1.conflicts)||v1.admissionGranted!==false||
       v1.recommendationRuntimeActivated!==false)
      throw new TypeError("UPSTREAM_V1_RETURN_SHAPE_OR_AUTHORITY_INVALID");
    const formulaPairs=ofId("governed_formula_pairs");
    if(formulaPairs.length>1)throw new TypeError("AMBIGUOUS_FORMULA_PAIR_SCOPE");
    const pair=formulaPairs[0];
    const v2=compareCleanserInitialPreflightV1V2Shadow({
      v1_preflight:v1,product,subject,official_bindings:officialBindings,
      observations,requested_presentation:pair?.requested_presentation,
      governed_formula_sources:pair?.governed_formula_sources,now
    });
    if(v2.admission_granted!==false||v2.production_writes!==0||
       v2.source_subject_fact_reuse_authorized!==false)
      throw new Error("PRODUCTION_AUTHORITY_ESCALATION");
    results.push(Object.freeze({
      product_id:product.id, v1_state:v1.state,
      v1_blockers:Object.freeze([...v1.blockers].sort()),
      v1_conflicts:Object.freeze([...v1.conflicts].sort()),
      v2_state:v2.v2_state,
      v2_remaining_blockers:v2.v2_remaining_blockers,
      capacity_blocker_separated:v2.v1_capacity_blocked,
      exact_presentation_verified:v2.observed_presentation_verified,
      formula_decision:v2.formula_decision,
      admission_granted:false,production_writes:0
    }));
  }
  return Object.freeze({
    version:TEN_CLEANSER_PREFLIGHT_DIFF_VERSION,
    total:results.length,
    v1_capacity_block_count:results.filter(x=>x.capacity_blocker_separated).length,
    v2_capacity_scope_reconciled_count:results.filter(x=>x.v2_state==="SHADOW_CAPACITY_SCOPE_RECONCILED").length,
    v2_review_required_count:results.filter(x=>x.v2_state==="REVIEW_REQUIRED").length,
    admission_grants:0,production_writes:0,results:Object.freeze(results)
  });
}
