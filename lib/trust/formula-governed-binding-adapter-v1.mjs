/**
 * R2/C2: adapt the EXISTING governed PF-1 binding/source/subject relations
 * into the read-only formula comparator. Legacy free-form presentation_metadata
 * is never upgraded to an exact SKU automatically.
 */
import { evaluateFormulationEquivalenceShadowV1 } from "./formulation-equivalence-shadow-v1.mjs";

export const FORMULA_GOVERNED_BINDING_ADAPTER_VERSION="formula-governed-binding-adapter-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/i;
const str=v=>typeof v==="string"&&v.trim()?v.trim():null;
const uuid=v=>UUID.test(String(v||""));
const validDate=v=>typeof v==="string"&&Number.isFinite(Date.parse(v));
const officialKind=new Set(["official_product_page","official_product_bundle_page","brand_official_product_page"]);
function exactHttps(value) {
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash;}
  catch{return false;}
}
function failed(productId,reasons) {
  return Object.freeze({adapter_version:FORMULA_GOVERNED_BINDING_ADAPTER_VERSION,
    product_id:productId||null,decision:"FORMULA_UNRESOLVED",
    reasons:Object.freeze([...new Set(reasons)].sort()),
    fact_reuse_authorized:false,subject_creation_authorized:false,
    source_binding_approval_authorized:false,production_admission_authorized:false
  });
}
function adapt(row, wanted) {
  const reasons=[];
  const b=row?.source_subject_binding,s=row?.evidence_source,t=row?.subject;
  if(!b||!s||!t) return {reasons:["GOVERNED_RELATION_MISSING"],data:null};
  if(!uuid(wanted?.product_id)||!str(wanted?.sku)||!str(wanted?.presentation_key)||
    !str(wanted?.market)) reasons.push("EXACT_PRESENTATION_REQUEST_REQUIRED");
  if(b.product_id!==wanted?.product_id||t.product_id!==wanted?.product_id ||
    b.subject_id!==t.subject_id||b.source_id!==s.source_id) reasons.push("GOVERNED_JOIN_MISMATCH");
  const meta=b.presentation_metadata;
  if(!meta||typeof meta!=="object"||Array.isArray(meta)||
    meta.exact_sku_reviewed!==true||
    meta.verified_sku!==wanted?.sku||
    meta.verified_presentation_key!==wanted?.presentation_key||
    meta.exact_source_locator!==s.canonical_locator||
    meta.verified_market!==wanted?.market)
    reasons.push("GOVERNED_EXACT_SKU_PRESENTATION_ATTESTATION_REQUIRED");
  // Legacy metadata like source_fill_size_ml, same_formulation_bridge,
  // bundle_units or exact_unit_match alone cannot identify the seller SKU.
  if(!uuid(s.source_id)||!HASH.test(String(s.content_digest||""))||
    !officialKind.has(s.source_kind)||!str(s.publisher)||
    !exactHttps(s.canonical_locator)||!str(s.external_snapshot_reference)||
    s.market!==wanted?.market)
    reasons.push("FROZEN_OFFICIAL_SOURCE_PROVENANCE_REQUIRED");
  if(!uuid(b.reviewed_by)||!validDate(b.reviewed_at)||
    !["exact_subject_match","equivalent_presentation_match"].includes(b.binding_state)||
    b.scope_relation!=="equivalent")
    reasons.push("GOVERNED_SOURCE_SUBJECT_REVIEW_REQUIRED");
  if(!uuid(t.subject_id)||t.identity_status!=="resolved"||
    !["current","historical"].includes(t.current_state)||
    t.market_applicability!==wanted?.market||!str(t.formulation_revision_key))
    reasons.push("RESOLVED_FORMULATION_SUBJECT_REQUIRED");
  if(reasons.length)return {reasons,data:null};
  return {reasons:[],data:{
    side:{...wanted},
    binding:{product_id:b.product_id,subject_id:b.subject_id,
      presentation_key:meta.verified_presentation_key,
      sku:meta.verified_sku,market:meta.verified_market,source_scope:"exact_sku",
      source_id:s.source_id,source_content_digest:s.content_digest,
      reviewed_by:b.reviewed_by,reviewed_at:new Date(b.reviewed_at).toISOString(),
      binding_state:b.binding_state,scope_relation:b.scope_relation,
      source_class:"manufacturer_official"},
    subject:{...t}
  }};
}
export function compareGovernedFormulaPresentationsV1({left,right}={}) {
  const a=adapt(left,left?.requested_presentation);
  const b=adapt(right,right?.requested_presentation);
  const reasons=[
    ...a.reasons.map(r=>"LEFT_"+r),
    ...b.reasons.map(r=>"RIGHT_"+r)
  ];
  const productId=uuid(left?.requested_presentation?.product_id)?left.requested_presentation.product_id:null;
  if(reasons.length)return failed(productId,reasons);
  const projected=evaluateFormulationEquivalenceShadowV1({
    left:a.data.side,right:b.data.side,
    left_binding:a.data.binding,right_binding:b.data.binding,
    left_subject:a.data.subject,right_subject:b.data.subject
  });
  return Object.freeze({...failed(productId,projected.reasons),decision:projected.decision});
}
