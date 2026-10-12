/**
 * D3 — source-bound, exact R16I in-memory Product/Offer separation simulation.
 * Never executes SQL, mints approvals/identities, or produces executable mutations.
 */
import { evaluateR16IR4D2SourceReadiness } from "./product-offer-r16i-r4-d2-source-readiness.mjs";

export const R16I_R4_D3_VERSION = "r16i-r4-d3-correction-dryrun-v1";
const PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const RETAILER = "https://www.hwahae.co.kr/goods/45194";
const BRAND = "https://m.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=151";
const NEW_SEARCH_URL = "https://www.hwahae.co.kr/goods/%EC%97%90%EC%8A%A4%EB%84%A4%EC%9D%B4%EC%B2%98-%5Bonly%ED%99%94%ED%95%B4%5D-%EC%95%84%EC%BF%A0%EC%95%84-%EC%8A%A4%EC%BF%A0%EC%95%8C%EB%9E%80-%EC%88%98%EB%B6%84%ED%81%AC%EB%A6%BC-80ml-%EB%8D%94%EB%B8%94%2B%EC%84%B8%EB%9F%BC-10ml-%EC%84%B8%ED%8A%B8/45194";
const MISSING = Object.freeze([
  "RETAILER_SELECTED_OPTION_AND_CHECKOUT_PRICE",
  "BRAND_CURRENT_CHECKOUT_PRICE_AND_STOCK",
  "RETAILER_RAW_ORIGIN_AND_EXACT_PHYSICAL_COMPONENT_SKUS",
  "REVIEW_TO_SINGLE_FORMULATION_OR_PRODUCT_SCOPE",
  "PRODUCT_PRICE_AND_LINK_POLICY_FIELD_APPROVAL",
  "FRESH_TRANSACTIONAL_READBACK_AND_COLLISION_GUARD",
  "ROLLBACK_AND_RECOMMENDATION_164_X_12_REPLAY",
  "SUPPLY_CHAIN_SECURITY_ISSUE_1208"
]);
const SCHEMA_FLAGS = Object.freeze([
  "product_offers_table_exists","offer_product_fk","unique_seller_listing_id",
  "unique_seller_listing_url","nullable_price_amount",
  "allowed_availability_unknown","allowed_product_scope_unresolved",
  "source_binding_resolved_identity_unique","product_id_preservation_required"
]);
const AUTHORITY_DENIALS = Object.freeze([
  "actual_checkout_captured","operator_field_level_approval",
  "transactional_concurrency_guard","rollback_proven",
  "recommendation_release_approved","production_mutation_allowed"
]);
const EXACT_TOP = Object.freeze([
  "contract_version","source_kind","product_id","observed_at_kr","product_revision",
  "production_readback","seller_source","brand_source","verified_schema",
  "authority","source_caveats"
]);
const eqSet = (obj, keys) => obj && typeof obj === "object" && !Array.isArray(obj) &&
  Object.keys(obj).length === keys.length && keys.every(key=>Object.hasOwn(obj,key));
const exactlyTrue = (obj, keys) => eqSet(obj, keys) && keys.every(key => obj[key] === true);
const exactlyFalse = (obj, keys) => eqSet(obj, keys) && keys.every(key => obj[key] === false);
const sameTime = (a,b) => typeof a === "string" && typeof b === "string" &&
  Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b);
const validNoSQL = ["production_writes_authorized","offer_writes_authorized",
  "subject_writes_authorized","source_binding_writes_authorized",
  "ranking_writes_authorized","release_ready"];

function result(decision, reasons, options = null) {
  return Object.freeze({
    contract_version:R16I_R4_D3_VERSION,
    product_id:PRODUCT_ID,
    decision,
    reasons:Object.freeze([...reasons]),
    preferred_strategy:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
    staged_product_id:PRODUCT_ID,
    immutable_existing_product:true,
    option_comparisons:options,
    selected_operator_option:null,
    approved_field_changes:null,
    selected_checkout_option_id:null,
    new_offer_id:null,
    new_subject_id:null,
    price_projection:null,
    review_projection:null,
    executable_sql:null,
    rollback_sql:null,
    optimistic_lock:null,
    transaction_id:null,
    writes:Object.freeze([]),
    missing_requirements:MISSING,
    ...Object.fromEntries(validNoSQL.map(k=>[k,false]))
  });
}

export function simulateR16IR4D3Correction(snapshot, composition, d1, d2, d3) {
  const earlier=evaluateR16IR4D2SourceReadiness(snapshot,composition,d1,d2);
  if (earlier.decision !== "REVIEW_REQUIRED")
    return result("BLOCKED",["UPSTREAM_R4_A_D2_PRESTATE_INVALID"]);
  if (!eqSet(d3,EXACT_TOP) || d3.contract_version !== R16I_R4_D3_VERSION ||
    d3.source_kind !== "READ_ONLY_PRODUCTION_AND_PUBLIC_INDEX_EVIDENCE" ||
    d3.product_id !== PRODUCT_ID || !exactlyTrue(d3.verified_schema,SCHEMA_FLAGS) ||
    !exactlyFalse(d3.authority,AUTHORITY_DENIALS) ||
    !Array.isArray(d3.source_caveats) || d3.source_caveats.length !== 6 ||
    !sameTime(d3.observed_at_kr,"2026-10-11T06:04:51.876455+09:00") ||
    !sameTime(d3.product_revision,snapshot.product.updated_at))
    return result("BLOCKED",["D3_EVIDENCE_OR_AUTHORITY_CONTRACT_INVALID"]);

  const p=d3.production_readback;
  if (!p || p.size_ml !== snapshot.product.size_ml ||
    p.price_min !== snapshot.product.price_min ||
    p.price_max !== snapshot.product.price_max ||
    p.unit_price_per_10ml !== snapshot.product.unit_price_per_10ml ||
    p.buy_link !== snapshot.product.buy_link ||
    p.source_url !== snapshot.product.source_url ||
    p.hwahae_url !== snapshot.product.hwahae_url ||
    p.review_count !== snapshot.product.market_signals.review_count ||
    p.in_scope_offer_count !== 0 || p.in_scope_subject_count !== 0 ||
    p.in_scope_binding_count !== 1 ||
    p.transaction_lock !== false || p.operator_approval !== false)
    return result("BLOCKED",["TARGET_PRODUCT_READBACK_OR_COLLISION_DRIFT"]);

  const r=d3.seller_source;
  if (!r || r.seller_key !== "hwahae" || r.seller_name !== "화해" ||
    r.source_name !== "hwahae" || r.listing_id !== "45194" ||
    r.listing_url !== RETAILER ||
    r.indexed_cream_unit_ml !== 80 || r.indexed_cream_quantity !== 2 ||
    r.indexed_serum_gift_ml !== 10 ||
    r.indexed_display_price_krw !== 29900 ||
    r.indexed_display_rating !== 4.58 ||
    !r.newly_discovered_search_result ||
    r.newly_discovered_search_result.source_kind !== "SEARCH_ENGINE_INDEX_NOT_RAW_OR_CHECKOUT" ||
    r.newly_discovered_search_result.source_url !== NEW_SEARCH_URL ||
    r.newly_discovered_search_result.crawl_label !== "CRAWLED_TODAY_PER_SEARCH_RESULT" ||
    r.newly_discovered_search_result.review_count !== 43612 ||
    r.newly_discovered_search_result.search_page_says_more_than_one_option !== true ||
    r.live_option_selection_verified !== false || r.checkout_price_verified !== false ||
    r.raw_page_archived !== false || r.component_sku_verified !== false ||
    r.review_subject_attribution_verified !== false)
    return result("BLOCKED",["RETAILER_OPTION_OR_SEARCH_INDEX_AUTHORITY_INVALID"]);

  const b=d3.brand_source;
  if (!b || b.product_no !== "151" || b.url !== BRAND ||
    b.indexed_single_ml !== 80 || b.indexed_list_price_krw !== 35000 ||
    b.indexed_member_price_krw !== 24500 ||
    b.source_kind !== "OFFICIAL_MOBILE_STORE_SEARCH_CACHE" ||
    b.crawl_label !== "CRAWLED_3_WEEKS_AGO_PER_SEARCH_RESULT" ||
    b.live_checkout_verified !== false || b.stock_verified !== false ||
    b.sku_verified !== false)
    return result("BLOCKED",["BRAND_SINGLE_PRESENTATION_AUTHORITY_INVALID"]);

  // Table-shaped PREVIEW ONLY. Required source/approval fields remain absent.
  // Do not silently take historical Product price into a retailer Offer.
  const offerPreview = Object.freeze({
    table:"product_offers",product_id:PRODUCT_ID,
    seller_key:"hwahae",seller_name:"화해",source_name:"hwahae",
    listing_id:"45194",listing_url:RETAILER,
    price_amount:null,currency_code:"KRW",availability_state:"unknown",
    market_code:"KR",offer_state:"current",
    product_scope_state:"product_subject_unresolved",
    selected_seller_option_id:null,
    verified_component_sku:null,
    approved_for_insert:false
  });
  const productBefore = Object.freeze({
    id:PRODUCT_ID,size_ml:p.size_ml,price_min:p.price_min,
    price_max:p.price_max,unit_price_per_10ml:p.unit_price_per_10ml,
    buy_link:p.buy_link,review_count:p.review_count
  });
  const optionA=Object.freeze({
    option:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
    status:"SCHEMA_FITS_READ_ONLY_NOT_WRITE_READY",
    product_before:productBefore,
    product_after_preview:productBefore,
    physical_presentation_preview:Object.freeze({
      brand_single_cream_ml:80,
      retailer_cream_units:2,retailer_cream_total_ml:160,
      serum_gift_separate_ml:10,formulation_identity:null
    }),
    offer_preview:offerPreview,
    approved_offer_price:null,
    approved_offer_availability:null,
    approved_product_price:null,
    approved_product_size_ml:null,
    approved_review_count:null,
    pending_product_scope_correction:true,
    source_binding_state_stays:"product_subject_unresolved",
    actual_offer_insert_approved:false,
    catalog_correction_complete:false
  });
  const optionB=Object.freeze({
    option:"B_SINGLE_PRESENTATION_CATALOG_CORRECTION",
    status:"BLOCKED_WITHOUT_80ML_PRICE_LINK_AND_REVIEW_SCOPE",
    hypothetical_wrong_unit_price_if_kit_price_reused:p.price_min / b.indexed_single_ml * 10,
    hypothetical_wrong_price_is_authoritative:false,
    approved_size_ml:null,approved_price_krw:null,
    approved_buy_link:null,approved_unit_price_per_10ml:null
  });
  const optionC=Object.freeze({
    option:"C_RETAIN_LEGACY_BUNDLE_MEANING",
    status:"HOLD_MIXED_PRODUCT_AND_OFFER_IDENTITY",
    product_id:PRODUCT_ID,
    approved_new_single_product_id:null,
    approved_new_subject_id:null
  });
  return result("REVIEW_REQUIRED",[
    "OPTION_A_SCHEMATIC_DRY_RUN_ONLY",
    "PRODUCT_RECORD_STILL_LEGACY_PRESENTATION_NOT_RESOLVED",
    "SELLER_OPTION_AND_CURRENT_CHECKOUT_PRICE_MISSING",
    "R4_D_FIELD_APPROVAL_AND_R4_E_TRANSACTION_NOT_AUTHORIZED",
    "SOURCE_BINDING_AND_REVIEW_COHORT_UNVERIFIED"
  ],Object.freeze([optionA,optionB,optionC]));
}
