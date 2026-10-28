/**
 * R16I D8I: pure policy-A/two-Offer PREVIEW contract, never an APPLY or grant.
 * Even an owner-choice signal is not an operational approval for schema/RPC,
 * seller CTA, evidence binding, Production or release-gate execution.
 */
export const R16I_D8I_CUTOVER_PREVIEW_VERSION = "r16i-d8i-dual-offer-cutover-preview-v1";
export const R16I_D8I_RECOMMENDED_PRICE_POLICY = "A_PRODUCT_PRICE_NULL_SELLER_OFFERS_ONLY";
const TARGET = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const OFFICIAL = "https://www.snature.kr/product/detail.html?product_no=151";
const HWAHAE = "https://www.hwahae.co.kr/goods/45194";
const EXPECTED = Object.freeze({
  official_single: Object.freeze({
    sellerKey: "snature", sellerName: "에스네이처 공식몰", sourceName: "official_single",
    listingId: "151", listingUrl: OFFICIAL,
    selectedOption: "수분크림 80ml 1개", creamUnitMl: 80, creamQuantity: 1, giftSerumMl: 0
  }),
  hwahae_bundle: Object.freeze({
    sellerKey: "hwahae", sellerName: "화해", sourceName: "hwahae_bundle",
    listingId: "45194", listingUrl: HWAHAE,
    selectedOption: "수분크림 80ml×2 + 세럼 10ml", creamUnitMl: 80,
    creamQuantity: 2, giftSerumMl: 10
  })
});
const beforeFields = Object.freeze({
  size_ml: 160, price_min: 29900, price_max: 29900,
  unit_price_per_10ml: 1868.75, buy_link: HWAHAE
});
const afterFields = Object.freeze({
  size_ml: 80, price_min: null, price_max: null,
  unit_price_per_10ml: null, buy_link: null
});
const invalid = (reason) => Object.freeze({
  version: R16I_D8I_CUTOVER_PREVIEW_VERSION,
  status: "BLOCKED", reason, recommendedPolicy: R16I_D8I_RECOMMENDED_PRICE_POLICY,
  afterCandidate: null, offersCandidate: Object.freeze([]),
  executableSql: null, migrationAuthorized: false, ownerPricePolicyApproved: false,
  productionWritesAuthorized: false, productWrites: 0, offerWrites: 0,
  releaseAuthorized: false
});
const exactPositiveKrw = value => Number.isSafeInteger(value)
  && value > 0 && value <= 100000000;
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (a, b) => Object.is(a, b);
const normalizeRevision = value => typeof value === "string"
  && Number.isFinite(Date.parse(value)) ? value : null;

/**
 * The "review" must be the already independently guarded D8F price review.
 * It attests selected checkout observations, NOT Product SKU/review bindings.
 * A policyChoice argument is explicitly only a design signal.
 */
export function buildR16ID8IDualOfferCutoverPreview({
  review, liveView, policyChoice = null
} = {}) {
  if (!plain(review) || review.status !== "REVIEW_REQUIRED"
    || review.product?.id !== TARGET
    || review.reason !== "CANONICAL_PRODUCT_PRICE_AND_CTA_POLICY_UNRESOLVED"
    || review.canonicalPriceAuthority !== false
    || review.ownerPricePolicyApproved !== false
    || review.productionWritesAuthorized !== false
    || review.executableSql !== null) {
    return invalid("UNVERIFIED_PRICE_SCOPE_REVIEW");
  }
  if (!plain(liveView) || liveView.product_id !== TARGET
    || liveView.decision !== "REVIEW_REQUIRED"
    || liveView.live_read_verified !== true
    || liveView.revision_matches !== true || liveView.collision_free !== true
    || !normalizeRevision(liveView.product_revision)
    || !Array.isArray(liveView.reviewed_fields)
    || liveView.production_writes_authorized !== false) {
    return invalid("UNVERIFIED_OR_STALE_PRODUCT_PRESTATE");
  }
  const original = new Map(liveView.reviewed_fields
    .filter(row => row?.entity === "products")
    .map(row => [row.field, row.before]));
  if (Object.entries(beforeFields).some(([key, value]) =>
    !original.has(key) || !same(original.get(key), value))) {
    return invalid("PRODUCT_PRESTATE_DRIFT");
  }
  const sourceKeys = Object.keys(EXPECTED);
  if (!Array.isArray(review.offerCandidates)
    || review.offerCandidates.length !== sourceKeys.length
    || new Set(review.offerCandidates.map(row => row?.sourceKey)).size !== sourceKeys.length) {
    return invalid("EXACT_TWO_DISTINCT_SELLER_OPTIONS_REQUIRED");
  }
  const offers = [];
  for (const sourceKey of sourceKeys) {
    const row = review.offerCandidates.find(x => x?.sourceKey === sourceKey);
    const expected = EXPECTED[sourceKey];
    if (!row || row.sourceKey !== sourceKey
      || row.listingUrl !== expected.listingUrl
      || row.selectedOption !== expected.selectedOption
      || row.creamUnitMl !== expected.creamUnitMl
      || row.creamQuantity !== expected.creamQuantity
      || row.creamAggregateMl !== expected.creamUnitMl * expected.creamQuantity
      || row.giftSerumMl !== expected.giftSerumMl
      || row.checkoutPriceScope !== "SELLER_SELECTED_OPTION_CHECKOUT_ONLY"
      || row.offerPriceCandidateKrW !== row.checkoutAmountKrW
      || !exactPositiveKrw(row.checkoutAmountKrW)
      || row.offerInsertAuthorized !== false
      || row.purchaseLinkTrusted !== false) {
      return invalid("SELLER_OPTION_OR_CHECKOUT_SCOPE_DRIFT");
    }
    offers.push(Object.freeze({
      product_id: TARGET,
      seller_key: expected.sellerKey,
      seller_name: expected.sellerName,
      source_name: expected.sourceName,
      listing_id: expected.listingId,
      listing_url: expected.listingUrl,
      price_amount: row.checkoutAmountKrW,
      currency_code: "KRW", market_code: "KR",
      availability_state: "unknown", offer_state: "current",
      product_scope_state: "product_subject_unresolved",
      link_health_state: "unchecked",
      selectedOption: expected.selectedOption,
      creamUnitMl: expected.creamUnitMl,
      creamQuantity: expected.creamQuantity,
      giftSerumMl: expected.giftSerumMl,
      // Exact capturedAt/evidence ID must be fetched and bound by a future
      // approved D8D revision; this normalized review does not return them.
      immutableEvidenceBinding: "REQUIRED_NOT_IN_PRICE_REVIEW",
      offerInsertAuthorized: false, purchaseLinkTrusted: false
    }));
  }
  if (offers[0].price_amount !== 24500 || offers[1].price_amount !== 29900) {
    return invalid("PRICE_OBSERVATIONS_DIFFER_FROM_FROZEN_REVIEW");
  }
  if (review.sourceUrlReattestedInThisModel !== false
    || review.bundleComponentsAuthority !== "SELECTED_OPTION_LABEL_ONLY_NOT_INDEPENDENT_SKU"
    || review.product?.creamSizeCanBeAppliedIndependently !== false) {
    return invalid("UNATTESTED_SOURCE_OR_PRODUCT_SCOPE_PROMOTION");
  }
  if (policyChoice !== null && policyChoice !== R16I_D8I_RECOMMENDED_PRICE_POLICY) {
    return invalid("UNSUPPORTED_OR_UNAPPROVED_CANONICAL_PRICE_POLICY");
  }
  const blockers = Object.freeze([
    "OWNER_CANONICAL_PRICE_POLICY_APPROVAL_MISSING",
    "PRODUCT_80ML_IDENTITY_AND_REVIEW_POPULATION_UNATTESTED",
    "SELLER_LISTING_URL_NOT_REATTESTED_IN_NORMALIZED_REVIEW",
    "IMMUTABLE_EVIDENCE_IDS_AND_TIMESTAMPS_MUST_BIND_AT_APPLY",
    "OFFICIAL_SERUM_GIFT_SKU_UNVERIFIED",
    "PRODUCT_SOURCE_BINDING_MUST_NOT_BE_SILENTLY_REASSIGNED",
    "NEW_DUAL_OFFER_D8D_RPC_AND_TWO_ID_ROLLBACK_NOT_APPROVED",
    "PRODUCTION_DB_IDENTITY_UNATTESTED",
    "SUPPLY_CHAIN_SECURITY_1208_UNRESOLVED"
  ]);
  return Object.freeze({
    version: R16I_D8I_CUTOVER_PREVIEW_VERSION,
    status: "DESIGN_READY_OWNER_AND_RELEASE_HOLD",
    recommendedPolicy: R16I_D8I_RECOMMENDED_PRICE_POLICY,
    policyChoiceRecordedForDesignOnly: policyChoice,
    productId: TARGET,
    productBeforeExpected: beforeFields,
    productRevisionExpected: liveView.product_revision,
    afterCandidate: afterFields,
    offersCandidate: Object.freeze(offers),
    expectedNewOfferCount: 2,
    reviewPopulationAction: "NO_CHANGE",
    sourceBindingsAction: "NO_CHANGE_PENDING_SEPARATE_DECISION",
    factSubjectsAction: "NO_CHANGE",
    recommendationRankingAction: "NO_CHANGE",
    consumerBudgetAlternativeU10: "KNOWN_ONE_SCENARIO_CHANGE",
    blockers,
    approvedWriteSet: null,
    executableSql: null,
    migrationAuthorized: false,
    ownerPricePolicyApproved: false,
    offerInsertAuthorized: false,
    purchaseLinkTrusted: false,
    productionWritesAuthorized: false,
    productWrites: 0,
    offerWrites: 0,
    releaseAuthorized: false
  });
}
