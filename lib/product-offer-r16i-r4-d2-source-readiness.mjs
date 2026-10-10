/**
 * R16I-R4-D2: classify actual evidence provenance and missing operating prerequisites.
 * This offline reviewer never creates an approval, checkout price, Offer, Subject,
 * database write, or source-derived recommendation override.
 */
import { evaluateR16IR4IndexedSourceReconciliation } from "./product-offer-r16i-r4-indexed-source-reconciliation.mjs";

export const R16I_R4_D2_VERSION = "r16i-r4-d2-evidence-readiness-v1";
const PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const BRAND_URL = "https://snature.kr/product/detail.html?cate_no=1&display_group=3&product_no=151";
const RETAIL_URL = "https://www.hwahae.co.kr/goods/45194";
const BASE_READBACK_TIME = "2026-10-11T00:44:59.236503+09:00";
const EXPECTED_REVIEW_SAMPLES = Object.freeze([
  ["https://www.hwahae.co.kr/goods/45194?goods_tab=review_ingredients", 43222, "CRAWLED_4_WEEKS_APPROXIMATE"],
  [RETAIL_URL, 43257, "CRAWLED_3_WEEKS_APPROXIMATE"],
  ["https://www.hwahae.co.kr/goods/45194?goods_tab=goods_info", 43269, "CRAWLED_3_WEEKS_APPROXIMATE"],
  ["https://www.hwahae.co.kr/goods/45194?af_siteid=940056100", 43482, "CRAWLED_LAST_WEEK_APPROXIMATE"]
]);
const MISSING = Object.freeze([
  "CURRENT_BRAND_STORE_CHECKOUT_PRICE_AND_STOCK",
  "CURRENT_RETAILER_RAW_LISTING_AND_SELECTED_OPTION",
  "RETAILER_CHECKOUT_PRICE_BY_SELECTED_PRESENTATION",
  "GIFT_SERUM_EXACT_SKU_AND_CONTENT_CONFIRMATION",
  "REVIEW_COHORT_PRODUCT_SUBJECT_ATTRIBUTION",
  "CURRENT_PROMOTIONAL_GIFT_TERMS",
  "FIELD_LEVEL_OPERATOR_DECISION_AND_APPROVAL",
  "TRANSACTION_CONCURRENCY_ROLLBACK_AND_POST_READBACK",
  "SUPPLY_CHAIN_SECURITY_ISSUE_1208"
]);

const timeMatches = (x,y) => typeof x === "string" && Date.parse(x) === Date.parse(y);
const REQUIRED_DENIALS = Object.freeze(["brand_text_is_live", "retailer_text_is_live", "display_price_is_checkout_price", "review_count_is_latest_live", "review_scope_is_product_fact_subject", "product_offer_subject_binding_approved", "fresh_transactional_lock", "automatic_field_mutation"]);
const noAuthority = obj => obj && typeof obj === "object" && !Array.isArray(obj) &&
  Object.keys(obj).length === REQUIRED_DENIALS.length &&
  REQUIRED_DENIALS.every(key => Object.hasOwn(obj,key) && obj[key] === false);

function output(decision, reasons, extra = {}) {
  return Object.freeze({
    contract_version: R16I_R4_D2_VERSION,
    product_id: PRODUCT_ID,
    decision,
    reasons: Object.freeze([...reasons]),
    brand_source_tier: "HISTORICAL_FIRST_PARTY_CACHE_TEXT",
    retailer_source_tier: "SEARCH_ENGINE_INDEX_VARIANTS",
    brand_single_size_ml: 80,
    retailer_cream_total_ml: 160,
    retailer_gift_serum_ml: 10,
    latest_checkout_price_krw: null,
    approved_single_price_krw: null,
    approved_bundle_price_krw: null,
    current_review_count: null,
    approved_review_count: null,
    new_offer_id: null,
    new_subject_id: null,
    approved_after_values: null,
    selected_checkout_option_id: null,
    review_sample_range: null,
    raw_source_digest: null,
    operator_approval: null,
    production_writes_authorized: false,
    source_binding_writes_authorized: false,
    offer_writes_authorized: false,
    ranking_writes_authorized: false,
    price_projection_authorized: false,
    review_projection_authorized: false,
    release_ready: false,
    missing_evidence: Object.freeze([...MISSING]),
    ...extra
  });
}
export function evaluateR16IR4D2SourceReadiness(snapshot, composition, d1, d2) {
  const prev = evaluateR16IR4IndexedSourceReconciliation(snapshot, composition, d1);
  if (prev.decision !== "REVIEW_REQUIRED") {
    return output("BLOCKED", ["R4_D1_OR_PRESTATE_INVALID", ...prev.reasons]);
  }
  if (!d2 || typeof d2 !== "object" || Array.isArray(d2) ||
    d2.contract_version !== R16I_R4_D2_VERSION ||
    d2.product_id !== PRODUCT_ID ||
    d2.research_date_kr !== "2026-10-11" ||
    d2.authority !== "READ_ONLY_HISTORICAL_AND_INDEXED_EVIDENCE" ||
    !noAuthority(d2.evidence_constraints)) {
    return output("BLOCKED", ["INVALID_D2_EVIDENCE_AUTHORITY"]);
  }
  const p = d2.production_select;
  if (!p || p.source !== "SUPABASE_PRODUCTION_SELECT_ONLY" ||
    !timeMatches(p.observed_at, BASE_READBACK_TIME) ||
    !timeMatches(p.product_updated_at, snapshot.product.updated_at) ||
    p.size_ml !== snapshot.product.size_ml ||
    p.price_min !== snapshot.product.price_min ||
    p.price_max !== snapshot.product.price_max ||
    p.unit_price_per_10ml !== snapshot.product.unit_price_per_10ml ||
    p.market_review_count !== snapshot.product.market_signals.review_count ||
    p.linked_offers !== 0 || p.subjects !== 0 || p.bindings !== 1 || p.intakes !== 1 ||
    p.write_lock !== false || p.operator_approval !== false) {
    return output("BLOCKED", ["D2_PRODUCTION_READBACK_DRIFT_OR_FALSE_LOCK"]);
  }
  const b = d2.brand_page;
  if (!b || b.source_url !== BRAND_URL ||
    b.source_origin !== "FIRST_PARTY_DOMAIN_HISTORICAL_WEB_CACHE_TEXT" ||
    b.cache_age_label !== "ABOUT_9_MONTHS_AT_RESEARCH" ||
    b.raw_html_archived !== false || b.raw_html_digest !== null ||
    b.live_checkout_verified !== false ||
    b.product_no !== "151" || b.presentation !== "SINGLE_80ML" ||
    b.cream_unit_ml !== 80 ||
    b.visible_list_price_krw !== prev.indexed_brand_single_list_price_krw ||
    b.visible_member_price_krw !== prev.indexed_brand_single_member_price_krw ||
    b.visible_text_has_checkout_caveat !== true ||
    b.selected_option_verified !== false || b.current_stock_verified !== false ||
    b.gift_serum_10ml_sku_verified !== false) {
    return output("BLOCKED", ["HISTORICAL_BRAND_TEXT_NOT_TRUSTWORTHY_FOR_SCOPE"]);
  }
  const r = d2.retailer_page;
  if (!r || r.source_url !== RETAIL_URL ||
    r.source_origin !== "RETAILER_SEARCH_INDEX_VARIANTS" ||
    r.direct_page_status !== "JAVASCRIPT_BOT_VERIFICATION_NO_RAW_PAGE" ||
    r.raw_html_archived !== false || r.raw_html_digest !== null ||
    r.live_checkout_verified !== false ||
    r.listing_id !== "45194" ||
    r.presentation !== "CREAM_80ML_X2_PLUS_SERUM_10ML" ||
    r.cream_unit_ml !== 80 || r.cream_units !== 2 || r.gift_serum_ml !== 10 ||
    r.indexed_listing_price_krw !== prev.indexed_retail_bundle_display_price_krw ||
    r.other_options_mentioned !== true || r.selected_option_verified !== false ||
    r.gift_serum_sku_verified !== false || r.review_single_subject_attributed !== false ||
    r.promotional_gift_claims_vary_across_index !== true ||
    r.current_promotional_gift_verified !== false ||
    !Array.isArray(r.review_index_samples) ||
    r.review_index_samples.length !== EXPECTED_REVIEW_SAMPLES.length) {
    return output("BLOCKED", ["RETAILER_OPTION_REVIEW_OR_PRICE_SCOPE_INVALID"]);
  }
  for (let i=0; i<EXPECTED_REVIEW_SAMPLES.length; i++) {
    const [url, count, freshness] = EXPECTED_REVIEW_SAMPLES[i];
    const sample = r.review_index_samples[i];
    if (!sample || sample.url !== url || sample.review_count !== count ||
      sample.source_freshness_label !== freshness) {
      return output("BLOCKED", ["INDEXED_REVIEW_SAMPLES_TAMPERED_OR_CONFLATED"]);
    }
  }
  if (!Array.isArray(d2.notes) || d2.notes.length < 5) {
    return output("BLOCKED", ["MISSING_EVIDENCE_LIMITATIONS"]);
  }
  const counts = r.review_index_samples.map(s => s.review_count);
  const min = Math.min(...counts), max = Math.max(...counts);
  return output("REVIEW_REQUIRED", [
    "BRAND_FIRST_PARTY_CACHED_TEXT_IS_NOT_LIVE_CHECKOUT",
    "RETAILER_SEARCH_INDEX_NOT_SELECTED_OPTION",
    "INDEXED_REVIEW_COUNTS_DIVERGE",
    "PRODUCT_AND_OFFER_PRESENTATIONS_MUST_STAY_SEPARATE",
    "OPERATOR_AND_SECURITY_REMEDIATION_PENDING"
  ],{
    review_sample_range: Object.freeze({
      min_indexed: min,
      max_indexed: max,
      sample_count: counts.length,
      dispersion: max-min,
      delta_vs_legacy_min: min-snapshot.product.market_signals.review_count,
      delta_vs_legacy_max: max-snapshot.product.market_signals.review_count,
      reliable_live_total: false
    })
  });
}
