/**
 * R16I-R4-D1 offline source-index reconciliation only.
 * Search engine index != raw source, checkout authority, Product Fact or review attribution.
 */
import { evaluateR16IR4Preflight } from "./product-offer-r16i-r4-readonly-preflight.mjs";
export const R16I_R4_D1_VERSION = "r16i-r4-d1-indexed-source-reconciliation-v1";

const PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const BRAND_URL = "https://www.snature.kr/product/detail.html?product_no=151";
const RETAIL_URL = "https://www.hwahae.co.kr/goods/45194";
const INDEXED_RETAIL_URL = "https://www.hwahae.co.kr/goods/45194?af_siteid=940056100";

function locked(result, reasons, snapshot) {
  return Object.freeze({
    contract_version: R16I_R4_D1_VERSION,
    product_id: PRODUCT_ID,
    decision: result,
    reasons: Object.freeze(reasons),
    source_authority: "SEARCH_INDEX_DISPLAY_ONLY",
    catalog_legacy_price_krw: snapshot?.product?.price_min ?? null,
    catalog_legacy_review_count: snapshot?.product?.market_signals?.review_count ?? null,
    indexed_brand_single_list_price_krw: null,
    indexed_brand_single_member_price_krw: null,
    indexed_retail_bundle_display_price_krw: null,
    indexed_retail_review_count: null,
    indexed_review_count_delta: null,
    single_list_price_per_10ml_display_only: null,
    single_member_price_per_10ml_display_only: null,
    bundle_price_per_10ml_display_only: null,
    checkout_price_krw: null,
    approved_catalog_price_krw: null,
    approved_catalog_volume_ml: null,
    review_signal_projection: null,
    approved_offer_id: null,
    subject_id: null,
    evidence_is_raw_html: false,
    checkout_verified: false,
    operator_approved: false,
    production_writes_authorized: false,
    ranking_writes_authorized: false,
    auto_price_projection_authorized: false,
    auto_review_projection_authorized: false
  });
}

const isExactInt = (v) => Number.isSafeInteger(v) && v >= 0;

export function evaluateR16IR4IndexedSourceReconciliation(snapshot, composition, sourceIndex) {
  const pre = evaluateR16IR4Preflight(snapshot, composition);
  if (pre.decision !== "REVIEW_REQUIRED")
    return locked("BLOCKED", ["PRESTATE_OR_BUNDLE_SHADOW_INVALID", ...pre.reasons], snapshot);

  if (!sourceIndex || typeof sourceIndex !== "object" || Array.isArray(sourceIndex) ||
    sourceIndex.contract_version !== R16I_R4_D1_VERSION ||
    sourceIndex.observation_channel !== "SEARCH_ENGINE_INDEX_NOT_RAW_OR_CHECKOUT" ||
    sourceIndex.evidence_authority !== "SEARCH_INDEX_DISPLAY_ONLY" ||
    sourceIndex.raw_html_captured !== false ||
    sourceIndex.actual_checkout_verified !== false ||
    sourceIndex.current_price_authorized !== false ||
    sourceIndex.review_subject_attribution_verified !== false ||
    sourceIndex.approval_payload !== null ||
    sourceIndex.producer !== "R16I_R4_D1_READ_ONLY_SOURCE_RESEARCH" ||
    sourceIndex.research_date_kr !== "2026-10-10")
    return locked("BLOCKED", ["INVALID_SEARCH_INDEX_AUTHORITY_CONTRACT"], snapshot);

  const b = sourceIndex.official_single;
  const r = sourceIndex.retailer_bundle;
  if (!b || !r ||
    b.canonical_url !== BRAND_URL || b.source !== "MANUFACTURER_STORE_SEARCH_INDEX" ||
    b.source_crawl_label !== "3_WEEKS_BEFORE_RESEARCH_APPROXIMATE" ||
    b.product_no !== "151" || b.name !== "아쿠아 스쿠알란 수분크림 80ml" ||
    b.presentation !== "SINGLE_80ML" || b.unit_volume_ml !== 80 ||
    b.catalog_list_price_krw !== 35000 || b.member_display_price_krw !== 24500 ||
    b.availability_authorized !== false || b.formulation_identity_verified !== false ||
    r.canonical_url !== RETAIL_URL || r.indexed_url !== INDEXED_RETAIL_URL ||
    r.source !== "RETAILER_LISTING_SEARCH_INDEX" ||
    r.source_crawl_label !== "LAST_WEEK_BEFORE_RESEARCH_APPROXIMATE" ||
    r.listing_id !== "45194" ||
    r.name !== "[only화해] 아쿠아 스쿠알란 수분크림 80ml 더블+세럼 10ml 세트" ||
    r.presentation !== "CREAM_80ML_X2_PLUS_SERUM_10ML" ||
    r.cream_unit_ml !== 80 || r.cream_quantity !== 2 || r.gift_serum_ml !== 10 ||
    r.indexed_listing_price_krw !== 29900 ||
    r.indexed_review_count !== 43482 || r.indexed_rating !== 4.58 ||
    r.multiple_sale_options_observed !== true ||
    r.selected_checkout_option_verified !== false ||
    r.gift_sku_verified !== false ||
    r.review_single_product_attribution_verified !== false ||
    !isExactInt(r.indexed_review_count) || !isExactInt(b.catalog_list_price_krw) ||
    !isExactInt(b.member_display_price_krw) || !isExactInt(r.indexed_listing_price_krw))
    return locked("BLOCKED", ["PRESENTATION_SOURCE_OR_INDEXED_VALUES_MISMATCH"], snapshot);
  if (!Array.isArray(sourceIndex.citations) || sourceIndex.citations.length !== 2 ||
      sourceIndex.citations[0]?.scope !== "BRAND_SINGLE" ||
      sourceIndex.citations[0]?.url !== BRAND_URL ||
      sourceIndex.citations[1]?.scope !== "RETAIL_BUNDLE" ||
      sourceIndex.citations[1]?.url !== INDEXED_RETAIL_URL ||
      !Array.isArray(sourceIndex.caveats) || sourceIndex.caveats.length < 4)
    return locked("BLOCKED", ["UNSCOPED_INDEX_CITATIONS_OR_CAVEATS"], snapshot);

  const result = locked("REVIEW_REQUIRED", [
    "INDEXED_PRICE_NOT_CHECKOUT_AUTHORITY",
    "DIFFERENT_PRESENTATIONS_HAVE_DIFFERENT_PRICE_SCOPE",
    "LEGACY_MARKET_REVIEW_COUNT_STALE_RELATIVE_TO_INDEX",
    "REVIEW_COHORT_AND_FORMULATION_UNVERIFIED",
    "NO_OPERATOR_APPROVAL_OR_PRODUCT_MUTATION"
  ], snapshot);
  return Object.freeze({
    ...result,
    indexed_brand_single_list_price_krw: b.catalog_list_price_krw,
    indexed_brand_single_member_price_krw: b.member_display_price_krw,
    indexed_retail_bundle_display_price_krw: r.indexed_listing_price_krw,
    indexed_retail_review_count: r.indexed_review_count,
    indexed_review_count_delta: r.indexed_review_count - snapshot.product.market_signals.review_count,
    single_list_price_per_10ml_display_only: b.catalog_list_price_krw / b.unit_volume_ml * 10,
    single_member_price_per_10ml_display_only: b.member_display_price_krw / b.unit_volume_ml * 10,
    bundle_price_per_10ml_display_only: r.indexed_listing_price_krw / (r.cream_unit_ml * r.cream_quantity) * 10
  });
}
