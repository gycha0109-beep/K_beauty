/**
 * R2/C2: read-only PF-1 Source -> Subject equivalence shadow.
 * Inputs must be materialized from governed DB source/binding/subject reads,
 * not from user-submitted metadata. Even a confirmed SHADOW result is NOT a
 * Product Fact confirmation, authorization, or production admission grant.
 */
export const FORMULA_EQUIVALENCE_SHADOW_VERSION="formulation-equivalence-shadow-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64=/^[a-f0-9]{64}$/i;
const BINDINGS=new Set(["exact_subject_match","equivalent_presentation_match"]);
const DATE=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
const s=v=>typeof v==="string"&&v.trim().length>0;
const uuid=v=>UUID.test(String(v||""));
const hold=(productId,reasons)=>Object.freeze({
  version:FORMULA_EQUIVALENCE_SHADOW_VERSION,product_id:productId||null,
  decision:"FORMULA_UNRESOLVED",reasons:Object.freeze([...new Set(reasons)].sort()),
  fact_reuse_authorized:false,subject_creation_authorized:false,
  evidence_write_authorized:false,production_admission_authorized:false
});
/**
 * A governed binding row MUST identify its exact observed presentation/SKU,
 * reviewed source and authorized Subject. No inferred or name-derived links.
 */
function validBoundSide(side,binding,subject,market) {
  if(!side||!uuid(side.product_id)||!s(side.presentation_key)||!s(side.sku)||
    !s(side.market)||side.market!==market) return false;
  return binding&&subject&&
    binding.product_id===side.product_id&&
    binding.presentation_key===side.presentation_key&&
    binding.sku===side.sku&&
    binding.market===market&&
    binding.source_scope==="exact_sku"&&
    uuid(binding.subject_id)&&binding.subject_id===subject.subject_id&&
    uuid(binding.source_id)&&HEX64.test(String(binding.source_content_digest||""))&&
    uuid(binding.reviewed_by)&&s(binding.reviewed_at)&&
    DATE.test(binding.reviewed_at)&&Number.isFinite(Date.parse(binding.reviewed_at))&&
    BINDINGS.has(binding.binding_state)&&binding.scope_relation==="equivalent"&&
    binding.source_class==="manufacturer_official"&&
    subject.product_id===side.product_id&&
    subject.identity_status==="resolved"&&
    (subject.current_state==="current"||subject.current_state==="historical")&&
    subject.market_applicability===market&&
    s(subject.formulation_revision_key);
}
export function evaluateFormulationEquivalenceShadowV1({
  left,right,left_binding,right_binding,left_subject,right_subject
}={}) {
  const productId=uuid(left?.product_id)?left.product_id:null;
  const blockers=[];
  if(!productId||right?.product_id!==productId)blockers.push("PRODUCT_ANCHOR_MISMATCH");
  if(!left?.market||left.market!==right?.market)blockers.push("MARKET_SCOPE_UNRESOLVED");
  const market=left?.market;
  if(!validBoundSide(left,left_binding,left_subject,market))
    blockers.push("LEFT_GOVERNED_EXACT_SKU_BINDING_REQUIRED");
  if(!validBoundSide(right,right_binding,right_subject,market))
    blockers.push("RIGHT_GOVERNED_EXACT_SKU_BINDING_REQUIRED");
  if(blockers.length)return hold(productId,blockers);
  // Two incompatible Subject links for the same exact physical presentation
  // cannot establish continuity by cross-comparing different source pages.
  if(left.presentation_key===right.presentation_key&&left.sku===right.sku&&
    left_subject.subject_id!==right_subject.subject_id)
    return hold(productId,["SAME_SKU_MULTIPLE_SUBJECT_CONFLICT"]);
  if(left_subject.subject_id===right_subject.subject_id)
    return Object.freeze({
      ...hold(productId,[]),
      decision:"SAME_FORMULA_CONFIRMED",
      reasons:Object.freeze(["REVIEWED_EQUIVALENT_SOURCE_SUBJECT_BINDINGS"])
    });
  const actualReformulation=
    (right_subject.predecessor_subject_id===left_subject.subject_id&&
      right_subject.supersession_kind==="reformulation")||
    (left_subject.predecessor_subject_id===right_subject.subject_id&&
      left_subject.supersession_kind==="reformulation");
  if(actualReformulation)
    return Object.freeze({
      ...hold(productId,[]),
      decision:"DIFFERENT_FORMULA_CONFIRMED",
      reasons:Object.freeze(["GOVERNED_REFORMULATION_LINEAGE"])
    });
  return hold(productId,["DISTINCT_SUBJECTS_WITHOUT_REVIEWED_REFORMULATION"]);
}
