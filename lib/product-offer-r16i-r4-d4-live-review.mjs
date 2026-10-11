/**
 * R16I-R4-D4: server-fed, read-only operator review matrix.
 * Source: fresh SELECT only. It cannot authorize or execute a correction.
 */
export const R16I_R4_D4_VERSION = "r16i-r4-d4-live-operator-review-v1";
export const R16I_PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
export const R16I_RETAIL_URL = "https://www.hwahae.co.kr/goods/45194";
const BASE_PRODUCT_UPDATED_AT = "2026-09-10T09:32:38.713599+09:00";
const BINDING_ID = "53155404-5518-4130-825a-8c918588f37a";
const BINDING_UPDATED_AT = "2026-09-10T10:10:29.03509+09:00";
const INTAKE_ID = "ee3b675d-1b92-4144-88e0-2a984b3d7cec";
const INTAKE_UPDATED_AT = "2026-09-21T00:53:57.499289+09:00";
const fieldPolicies = Object.freeze([
  ["products","id","PRESERVE_EXISTING_PRODUCT_ANCHOR"],
  ["products","size_ml","UNIT_80ML_VS_LEGACY_KIT_160ML_UNAPPROVED"],
  ["products","price_min","KIT_DISPLAY_PRICE_NOT_OFFICIAL_SINGLE_CHECKOUT"],
  ["products","price_max","KIT_DISPLAY_PRICE_NOT_OFFICIAL_SINGLE_CHECKOUT"],
  ["products","unit_price_per_10ml","PRICE_DENOMINATOR_MUST_MATCH_PRESENTATION"],
  ["products","buy_link","RETAILER_KIT_LINK_SCOPE_MUST_BE_DECIDED"],
  ["products","hwahae_url","RETAILER_LISTING_REFERENCE_ONLY"],
  ["products","source_url","SOURCE_OF_PRODUCT_FACT_NOT_ESTABLISHED"],
  ["products","external_source","SOURCE_EXTERNAL_KEY_PRODUCT_VS_OFFER_UNRESOLVED"],
  ["products","external_type","SOURCE_EXTERNAL_KEY_PRODUCT_VS_OFFER_UNRESOLVED"],
  ["products","external_id","SOURCE_EXTERNAL_KEY_PRODUCT_VS_OFFER_UNRESOLVED"],
  ["products","market_signals","REVIEW_COUNTS_NOT_FORMULATION_SCOPED"],
  ["product_source_bindings","source_url","RETAILER_REFERENCE_NOT_FORMULATION"],
  ["product_source_bindings","binding_state","MUST_NOT_UPGRADE_PRODUCT_FACT_IDENTITY"],
  ["product_source_bindings","product_scope_state","FORMULATION_COHORT_NOT_PROVED"],
  ["catalog_trust_intake","identity_state","SUBJECT_CREATION_UNAPPROVED"],
  ["catalog_trust_intake","trust_state","REVIEW_REQUIRED_KEEP_HOLD"],
  ["product_offers","new_offer","EXACT_CHECKOUT_OPTION_AND_PRICE_MISSING"],
  ["product_fact_subjects","new_subject","FORMULATION_IDENTITY_NOT_ESTABLISHED"],
  ["recommendation","ranking","NO_ADOPTION_BEFORE_INVARIANCE_AND_APPROVAL"]
]);
const missingEvidence=Object.freeze([
  "LIVE_OFFICIAL_SINGLE_80ML_CHECKOUT_AND_SKU",
  "LIVE_RETAILER_80ML_X2_SERUM10ML_SELECTED_OPTION",
  "RETAILER_FINAL_PRICE_AND_PROMOTION_TERMS",
  "OFFICIAL_GIFT_SERUM_SKU",
  "REVIEW_POPULATION_AND_PRODUCT_FACT_ATTRIBUTION",
  "PRODUCT_VS_OFFER_PRICE_AND_BUY_LINK_OWNER_DECISION",
  "EXACT_FIELD_LEVEL_AUTHORIZED_BEFORE_AFTER",
  "TRANSACTIONAL_OPTIMISTIC_LOCK_AND_ROLLBACK",
  "RECOMMENDATION_164_X_12_REPLAY",
  "SUPPLY_CHAIN_SECURITY_ISSUE_1208"
]);
const isDate=(v)=> typeof v==="string" && Number.isFinite(Date.parse(v));
const sameDate=(a,b)=>isDate(a)&&isDate(b)&&Date.parse(a)===Date.parse(b);
const eqNumber=(a,b)=>a!==null && a!==undefined && Number.isFinite(Number(a)) && Number(a)===b;
const arr=(v)=>Array.isArray(v)?v:null;
const plain=(v)=>v&&typeof v==="object"&&!Array.isArray(v);
function empty(reason) {
  return Object.freeze({
    contract_version:R16I_R4_D4_VERSION,
    product_id:R16I_PRODUCT_ID,
    decision:"BLOCKED",
    reasons:Object.freeze([reason]),
    live_read_verified:false,
    revision_matches:false,
    collision_free:false,
    reviewed_fields:Object.freeze([]),
    missing_evidence:missingEvidence,
    operator_decision:null,
    suggested_option:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
    approved_after_values:null,
    write_set:null,
    executable_sql:null,
    release_ready:false,
    production_writes_authorized:false,
    offer_writes_authorized:false,
    subject_writes_authorized:false,
    ranking_writes_authorized:false
  });
}
const copy = (v) => v===null||v===undefined?null:structuredClone(v);

export function buildR16IR4D4LiveReview(snapshot) {
  if (!plain(snapshot) || !isDate(snapshot.observed_at) ||
    !plain(snapshot.product) || !arr(snapshot.bindings) ||
    !arr(snapshot.offers_by_product) || !arr(snapshot.offers_by_listing) ||
    !arr(snapshot.offers_by_url) || !arr(snapshot.subjects) || !arr(snapshot.intakes))
    return empty("MISSING_TRUSTED_LIVE_READ");

  const p=snapshot.product;
  if (p.id!==R16I_PRODUCT_ID || p.name!=="아쿠아 스쿠알란 수분크림" ||
    p.brand!=="에스네이처" || p.category!=="moisturizer_cream" ||
    !eqNumber(p.size_ml,160)||p.price_min!==29900||p.price_max!==29900||
    !eqNumber(p.unit_price_per_10ml,1868.75)||
    p.buy_link!==R16I_RETAIL_URL||p.hwahae_url!==R16I_RETAIL_URL||
    p.source_url!==R16I_RETAIL_URL||
    p.external_source!=="hwahae"||p.external_type!=="goods"||p.external_id!=="45194"||
    !sameDate(p.updated_at,BASE_PRODUCT_UPDATED_AT)||
    !plain(p.market_signals)||p.market_signals.source!=="hwahae_visible_page"||
    p.market_signals.review_count!==41475||!eqNumber(p.market_signals.rating,4.58)||
    p.market_signals.updated_at!=="2026-05-26")
    return empty("PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT");

  if (snapshot.offers_by_product.length||snapshot.offers_by_listing.length||
    snapshot.offers_by_url.length||snapshot.subjects.length)
    return empty("OFFER_LISTING_OR_SUBJECT_COLLISION");
  if (snapshot.bindings.length!==1||
    snapshot.bindings[0].binding_id!==BINDING_ID||
    snapshot.bindings[0].product_id!==R16I_PRODUCT_ID||
    snapshot.bindings[0].source_name!=="hwahae"||
    snapshot.bindings[0].external_type!=="goods"||
    snapshot.bindings[0].external_id!=="45194"||
    snapshot.bindings[0].source_url!==R16I_RETAIL_URL||
    snapshot.bindings[0].binding_state!=="resolved"||
    snapshot.bindings[0].product_scope_state!=="product_subject_unresolved"||
    !sameDate(snapshot.bindings[0].updated_at,BINDING_UPDATED_AT))
    return empty("SOURCE_BINDING_DRIFT");
  if(snapshot.intakes.length!==1||
    snapshot.intakes[0].id!==INTAKE_ID||
    snapshot.intakes[0].product_id!==R16I_PRODUCT_ID||
    snapshot.intakes[0].subject_id!==null||
    snapshot.intakes[0].identity_state!=="SUBJECT_CREATION_REQUIRED"||
    snapshot.intakes[0].trust_state!=="REVIEW_REQUIRED"||
    !sameDate(snapshot.intakes[0].updated_at,INTAKE_UPDATED_AT))
    return empty("TRUST_INTAKE_DRIFT");

  const binding=snapshot.bindings[0], intake=snapshot.intakes[0];
  const rows=fieldPolicies.map(([entity,field,reason])=>{
    const before=entity==="products"?copy(p[field]):
      entity==="product_source_bindings"?copy(binding[field]):
      entity==="catalog_trust_intake"?copy(intake[field]):null;
    return Object.freeze({
      entity,field,before,after:null,
      source_status:"LIVE_SELECTED_ROW_NOT_WRITE_LOCK",
      correction_policy:reason,
      decision:"OPERATOR_REVIEW_REQUIRED",
      source_evidence_confirmed:false,
      field_approved:false,
      write_authorized:false
    });
  });
  return Object.freeze({
    contract_version:R16I_R4_D4_VERSION,
    product_id:R16I_PRODUCT_ID,
    decision:"REVIEW_REQUIRED",
    reasons:Object.freeze([
      "LIVE_PRESTATE_MATCHES_FROZEN_CONTRACT",
      "EXTERNAL_LIVE_CHECKOUT_EVIDENCE_MISSING",
      "NO_FIELD_LEVEL_OPERATOR_APPROVAL_OR_WRITE_LOCK"
    ]),
    observed_at:snapshot.observed_at,
    product_revision:p.updated_at,
    live_read_verified:true,
    revision_matches:true,
    collision_free:true,
    reviewed_fields:Object.freeze(rows),
    missing_evidence:missingEvidence,
    suggested_option:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
    product_anchor_reused:true,
    single_presentation_ml:80,
    bundle_cream_ml:160,
    separate_serum_ml:10,
    proposed_offer:Object.freeze({
      seller_key:"hwahae",listing_id:"45194",listing_url:R16I_RETAIL_URL,
      product_id:R16I_PRODUCT_ID,
      price_amount:null,availability_state:"unknown",
      product_scope_state:"product_subject_unresolved",
      insert_authorized:false
    }),
    current_live_checkout_price:null,
    current_verified_review_count:null,
    selected_seller_option:null,
    operator_decision:null,
    approved_after_values:null,
    write_set:null,
    executable_sql:null,
    rollback_sql:null,
    release_ready:false,
    production_writes_authorized:false,
    offer_writes_authorized:false,
    subject_writes_authorized:false,
    ranking_writes_authorized:false
  });
}
