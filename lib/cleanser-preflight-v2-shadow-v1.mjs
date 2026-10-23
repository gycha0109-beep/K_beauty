/**
 * R4/C4: standalone v2 comparer for the existing cleanser v1 preflight.
 * v1 lives in draft PR #1390 and MUST be executed by its own trusted reader.
 * This module does not import/fork/modify v1, alter G2, or produce grants.
 */
import { compareGovernedFormulaPresentationsV1 } from "./trust/formula-governed-binding-adapter-v1.mjs";

export const CLEANSER_PREFLIGHT_V2_SHADOW_VERSION="cleanser-preflight-v2-shadow-v1";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const has=x=>typeof x==="string"&&x.trim().length>0;
const uuid=x=>UUID.test(String(x||""));
const capacityKind=new Set(["ml","g","sheet","item"]);
const observedKinds=new Set(["brand_official_product_page","manufacturer_official_document","official_market_sales_page"]);
function sameUrl(a,b) {
  try {
    const x=new URL(a),y=new URL(b);
    return x.protocol==="https:"&&y.protocol==="https:"&&
      !x.username&&!y.username&&!x.password&&!y.password&&!x.hash&&!y.hash&&
      x.href===y.href;
  }catch{return false;}
}
const unique=items=>Object.freeze([...new Set(items)].sort());
function held(v1, product, reasons, original, formulaDecision) {
  return Object.freeze({
    version:CLEANSER_PREFLIGHT_V2_SHADOW_VERSION,
    product_id:uuid(product?.id)?product.id:null,
    v1_state:v1?.state??null,
    v1_blockers:Object.freeze([...(v1?.blockers||[])]),
    v1_conflicts:Object.freeze([...(v1?.conflicts||[])]),
    v2_state:"REVIEW_REQUIRED",
    v2_remaining_blockers:unique(reasons),
    v1_capacity_blocked:original,
    observed_presentation_verified:false,
    formula_decision:formulaDecision,
    catalog_identity:"NOT_PROMOTED",
    source_subject_fact_reuse_authorized:false,
    admission_granted:false,governed_g2_grant_issued:false,
    runtime_candidate_included:false,production_writes:0
  });
}
export function compareCleanserInitialPreflightV1V2Shadow({
  v1_preflight,product,subject,official_bindings=[],observations=[],
  requested_presentation,governed_formula_sources,now=new Date()
}={}){
  const v1=v1_preflight;
  if(!v1||v1.version!=="cleanser-initial-admission-preflight-v1"||
    !Array.isArray(v1.blockers)||!Array.isArray(v1.conflicts)||
    !["AUTO_ADMISSION_PREFLIGHT_PASS","MANUAL_REVIEW_REQUIRED","RESEARCH_OR_EVIDENCE_REQUIRED"].includes(v1.state))
    throw new TypeError("TRUSTED_V1_PREFLIGHT_OUTPUT_REQUIRED");
  if(!uuid(product?.id)||product.category!=="cleanser"||v1.productId!==product.id||
    !Number.isFinite(now?.getTime?.()))
    throw new TypeError("V1_PRODUCT_SNAPSHOT_SCOPE_MISMATCH");
  const capacityBlocked=v1.blockers.includes("VERIFIED_EXACT_CAPACITY_REQUIRED");
  const comparison=governed_formula_sources?
    compareGovernedFormulaPresentationsV1(governed_formula_sources):null;
  const formula=comparison?.decision||"FORMULA_UNRESOLVED";
  const remaining=[...v1.blockers.filter(x=>x!=="VERIFIED_EXACT_CAPACITY_REQUIRED"),...v1.conflicts];
  if(!capacityBlocked) {
    // No reason to expand an already-exact v1 admission result.
    return held(v1,product,remaining.length?remaining:["NO_V1_CAPACITY_SCOPE_DIFFERENCE"],
      false,formula);
  }
  const reasons=[...remaining];
  const presentation=requested_presentation;
  if(!uuid(subject?.subject_id)||subject.product_id!==product.id||
    subject.identity_status!=="resolved"||subject.current_state!=="current"||
    subject.market_applicability!=="KR"||!has(subject.formulation_revision_key))
    reasons.push("CURRENT_EXACT_SUBJECT_REQUIRED");
  if(presentation?.product_id!==product.id||presentation.market!=="KR"||
    !has(presentation.sku)||!has(presentation.presentation_key)||
    !Number.isFinite(presentation.capacity_amount)||presentation.capacity_amount<=0||
    !capacityKind.has(presentation.capacity_unit))
    reasons.push("EXACT_PHYSICAL_PRESENTATION_REQUIRED");
  const right=governed_formula_sources?.right;
  if(!right||right.requested_presentation?.product_id!==product.id||
    right.requested_presentation?.market!=="KR"||
    right.requested_presentation?.sku!==presentation?.sku||
    right.requested_presentation?.presentation_key!==presentation?.presentation_key||
    right.subject?.subject_id!==subject?.subject_id)
    reasons.push("GOVERNED_FORMULA_TARGET_SCOPE_MISMATCH");
  if(formula!=="SAME_FORMULA_CONFIRMED")
    reasons.push("CROSS_SIZE_FORMULA_EQUIVALENCE_REVIEW_REQUIRED");
  if(!Array.isArray(official_bindings)||!Array.isArray(observations))
    throw new TypeError("READONLY_SOURCE_OBSERVATION_ARRAY_REQUIRED");
  const exact=official_bindings.filter(b=>
    b?.product_id===product.id&&b.binding_state==="resolved"&&
    b.product_scope_state==="product"&&/^[a-z0-9_]+_official$/.test(String(b.source_name||"")));
  const verified=exact.length>0&&observations.some(o=>
    o?.product_id===product.id&&o.subject_id===subject?.subject_id&&
    o.market==="KR"&&observedKinds.has(o.source_kind)&&
    SHA.test(String(o.source_content_digest||""))&&
    Number.isFinite(Date.parse(o.fetched_at||""))&&
    Date.parse(o.fetched_at)<=now.getTime()&&
    now.getTime()-Date.parse(o.fetched_at)<=180*86400000&&
    exact.some(b=>b.binding_id===o.source_binding_id&&sameUrl(b.source_url,o.canonical_locator))&&
    o.product_identity_observation?.product_id===product.id&&
    o.product_identity_observation?.subject_id===subject?.subject_id&&
    o.product_identity_observation?.exact_catalog_product_binding===true&&
    o.product_identity_observation?.verified_variant_state==="exact"&&
    o.product_identity_observation?.verified_sku===presentation?.sku&&
    o.product_identity_observation?.verified_presentation_key===presentation?.presentation_key&&
    Number(o.product_identity_observation?.verified_capacity_amount)===presentation?.capacity_amount&&
    o.product_identity_observation?.verified_capacity_unit===presentation?.capacity_unit
  );
  if(!verified)reasons.push("VERIFIED_EXACT_TARGET_PRESENTATION_SOURCE_REQUIRED");
  if(reasons.length)return held(v1,product,reasons,true,formula);
  // This is an offline scope reconciliation, NOT v1 PASS or a G2 grant.
  return Object.freeze({
    ...held(v1,product,[],true,formula),
    v2_state:"SHADOW_CAPACITY_SCOPE_RECONCILED",
    v2_remaining_blockers:Object.freeze([]),
    observed_presentation_verified:true,
    catalog_identity:"CATALOG_ANCHOR_PRESERVED"
  });
}
