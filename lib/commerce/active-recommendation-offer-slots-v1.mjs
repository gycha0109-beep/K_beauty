// D8K-4: source-specific inventory of *rendered* recommendation product identities.
// A UUID on a UI card is only a candidate for private admission/option attestation.
// NO database reads, seller prices, browser privileges, public-share hydration or CTA.
export const ACTIVE_RECOMMENDATION_OFFER_SLOTS_VERSION = "d8k4-active-recommendation-offer-slots-v1";
export const ACTIVE_RECOMMENDATION_SURFACES = Object.freeze([
  "F-01", "P-01", "P-02", "P-03", "P-04", "P-05", "S-01", "S-02"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 256;
function productId(item) {
  // A wrapper is permitted only at the explicitly mapped source slots.
  const product = item?.product || item;
  return typeof product?.id === "string" && UUID.test(product.id) ? product.id.toLowerCase() : null;
}
function bounded(items, max = MAX_ITEMS) {
  return Array.isArray(items) ? items.slice(0, max) : [];
}
function entries(out, slot, products, sourceState, reason = null) {
  for (let index = 0; index < products.length; index++) {
    const id = productId(products[index]);
    const held = sourceState !== "PRIVATE_RECOMMENDATION" || !id;
    out.push(Object.freeze({
      slot, index, productId: id,
      identityState: !id ? "HOLD_IDENTITY" :
        held ? "HOLD_EXPOSURE_AUTHORITY" : "CANDIDATE_ID_ONLY",
      reason: !id ? "CATALOG_UUID_NOT_PROVEN" :
        held ? (reason || "EXPOSURE_AUTHORITY_NOT_PROVEN") : "ADMISSION_AND_SELECTED_OPTION_NOT_ATTESTED",
      commerceReadAuthorized: false,
      comparisonAuthorized: false,
      directCtaAuthorized: false
    }));
  }
}
/**
 * Map only actual live recommendation slots:
 * freeResult.topPick; premium routinePlan morning/night step.product;
 * resolved functional display plan (primary/secondary/budget);
 * public result topPick/categoryPicks as *excluded from private Offer reads*.
 *
 * Fallback recommendation names, owned current products, Face Lab, legacy
 * dormant cards and result list navigation must never be promoted to Offer.
 * No generated/guessed Product ID, source inference or product re-ranking.
 */
export function collectActiveRecommendationOfferSlots({
  freeResult = null, premiumReport = null, functionalPlan = null,
  publicShare = null
} = {}) {
  const rows = [];
  if (freeResult?.topPick) entries(rows, "F-01", [freeResult.topPick], "PRIVATE_RECOMMENDATION");
  const routine = premiumReport?.routinePlan ||
    premiumReport?.decisionBundle?.routinePlan || null;
  entries(rows, "P-01", bounded(routine?.morningSteps).map(s => s?.product), "PRIVATE_RECOMMENDATION");
  entries(rows, "P-02", bounded(routine?.nightSteps).map(s => s?.product), "PRIVATE_RECOMMENDATION");
  const hold = functionalPlan?.planMode === "HOLD";
  const functionalSource = hold ? "HOLD_PLAN" : "PRIVATE_RECOMMENDATION";
  entries(rows, "P-03", bounded(functionalPlan?.productCandidates, 3), functionalSource,
    "FUNCTIONAL_PLAN_HOLD");
  entries(rows, "P-04", bounded(functionalPlan?.secondarySolution?.products, 3), functionalSource,
    "FUNCTIONAL_PLAN_HOLD");
  entries(rows, "P-05", bounded(functionalPlan?.budgetAlternatives, 3), functionalSource,
    "FUNCTIONAL_PLAN_HOLD");
  if (publicShare?.topPick) entries(rows, "S-01", [publicShare.topPick], "PUBLIC_SHARE",
    "PUBLIC_SHARE_AUTHORITY_REQUIRED");
  // ResultShareCard renders [topPick,...categoryPicks].slice(0, 5).
  entries(rows, "S-02", bounded(publicShare?.categoryPicks,
    publicShare?.topPick ? 4 : 5), "PUBLIC_SHARE",
    "PUBLIC_SHARE_AUTHORITY_REQUIRED");
  const candidateIds = [...new Set(rows.filter(row =>
    row.identityState === "CANDIDATE_ID_ONLY").map(row => row.productId))].sort();
  return {
    version: ACTIVE_RECOMMENDATION_OFFER_SLOTS_VERSION,
    slotKinds: [...ACTIVE_RECOMMENDATION_SURFACES], rows,
    candidateIdsForLaterPrivateAdmission: candidateIds,
    // A syntactically valid UUID is NOT an admission, a selected SKU or a
    // display authorization. No active UI is offered this untrusted output.
    identityEvidenceOnly: true, privateReadAuthorized: false,
    sellerPriceAuthority: false, selectedOptionAuthority: false,
    directCtaAuthority: false, publicShareReadAuthorized: false,
    rankingChanged: false, productionReleaseAuthorized: false
  };
}
