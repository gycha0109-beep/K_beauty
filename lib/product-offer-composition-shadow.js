/**
 * R16I-R3: bounded, read-only commercial bundle composition shadow.
 * This module never imports a DB client or writes Product/Offer/Subject state.
 */
export const OFFER_COMPOSITION_SHADOW_VERSION = "retailer-offer-composition-review-v1";
// R16I is a frozen exact-listing review, not a general bundle identity resolver.
const R16I_PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const R16I_LISTING_ID = "45194";
const R16I_HISTORICAL_PRICE_KRW = 29900;
const R16I_PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const R16I_LISTING_ID = "45194";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_STATES = new Set(["REVIEW_REQUIRED"]);
const ROLES = new Set(["PRIMARY_PRODUCT", "GIFT_OTHER_PRODUCT"]);
const integer = (x) => Number.isSafeInteger(x) && x > 0 && x <= 10000;

function parseListing(e) {
  if (e?.seller_key !== "hwahae" || e?.listing_id !== R16I_LISTING_ID) return false;
  try {
    const url = new URL(e.listing_url);
    return url.protocol === "https:" && url.hostname === "www.hwahae.co.kr" &&
      url.pathname === "/goods/" + e.listing_id && !url.search && !url.hash &&
      !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function reject(reason, identity) {
  return Object.freeze({
    contract_version: OFFER_COMPOSITION_SHADOW_VERSION,
    product_id: identity || null,
    decision: "BLOCKED",
    reasons: Object.freeze([reason]),
    primary_single_unit_ml: null,
    primary_units: null,
    primary_total_ml: null,
    gift_total_ml: null,
    historical_kit_unit_price_per_10ml: null,
    display_price_krw: null,
    normalized_product_size_ml: null,
    catalog_writes_authorized: false,
    offer_writes_authorized: false,
    subject_writes_authorized: false,
    ranking_writes_authorized: false
  });
}

export function evaluateOfferCompositionShadow(input) {
  const identity = typeof input?.product_id === "string" ? input.product_id : null;
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      input.contract_version !== OFFER_COMPOSITION_SHADOW_VERSION ||
      !UUID.test(identity || "") || identity !== R16I_PRODUCT_ID)
    return reject("INVALID_CONTRACT_OR_PRODUCT", identity);
  if (!parseListing(input.source) ||
      input.source.authority !== "RETAILER_TITLE_ONLY" ||
      input.source.raw_html_archived !== false ||
      input.source.components_physically_verified !== false)
    return reject("SOURCE_SCOPE_NOT_ATTESTED", identity);
  if (!REVIEW_STATES.has(input.review_state) ||
      input.formulation_revision_key !== null ||
      input.subject_semantic_key !== null ||
      input.offer_id !== null ||
      input.authorize_offer_write !== false ||
      input.authorize_price_projection !== false ||
      input.authorize_catalog_write !== false ||
      input.authorize_subject_write === true ||
      input.authorize_ranking_write === true)
    return reject("REVIEW_AND_WRITE_GATE_REQUIRED", identity);
  if (!Array.isArray(input.components) ||
      input.components.length !== 2 ||
      input.components.some(x => !x || !ROLES.has(x.role) ||
        !integer(x.unit_volume_ml) || !integer(x.quantity) ||
        x.physically_verified !== false))
    return reject("COMPONENTS_UNVERIFIED_OR_INVALID", identity);

  const primary = input.components.filter(x => x.role === "PRIMARY_PRODUCT");
  const gifts = input.components.filter(x => x.role === "GIFT_OTHER_PRODUCT");
  if (primary.length !== 1 || gifts.length !== 1 ||
      primary[0].product_id !== identity ||
      gifts[0].product_id !== null ||
      !integer(input.claimed_primary_total_ml) ||
      !integer(input.legacy_catalog_volume_ml))
    return reject("PRIMARY_GIFT_IDENTITY_MISMATCH", identity);
  // An equal aggregate (40ml x 4, 160ml x 1, 5ml x 2 gift, etc.) is NOT the observed 80ml x 2 + 10ml x 1 listing.
  if (primary[0].unit_volume_ml !== 80 || primary[0].quantity !== 2 ||
      gifts[0].unit_volume_ml !== 10 || gifts[0].quantity !== 1)
    return reject("EXACT_LISTING_COMPONENTS_MISMATCH", identity);
  // Equal aggregate volumes do not establish the exact observed kit composition.
  if (primary[0].unit_volume_ml !== 80 || primary[0].quantity !== 2 ||
      gifts[0].unit_volume_ml !== 10 || gifts[0].quantity !== 1)
    return reject("EXACT_LISTING_COMPONENTS_MISMATCH", identity);
  const primaryTotal = primary[0].unit_volume_ml * primary[0].quantity;
  const giftTotal = gifts[0].unit_volume_ml * gifts[0].quantity;
  if (!Number.isSafeInteger(primaryTotal) || !Number.isSafeInteger(giftTotal) ||
      primaryTotal !== input.claimed_primary_total_ml ||
      primaryTotal !== input.legacy_catalog_volume_ml)
    return reject("PACK_VOLUME_SCOPE_CONFLICT", identity);
  if (!Number.isSafeInteger(input.historical_kit_price_krw) ||
      input.historical_kit_price_krw !== R16I_HISTORICAL_PRICE_KRW ||
      input.historical_price_is_current !== false)
    return reject("PRICE_AUTHORITY_NOT_VERIFIED", identity);

  return Object.freeze({
    contract_version: OFFER_COMPOSITION_SHADOW_VERSION,
    product_id: identity,
    listing_id: input.source.listing_id,
    decision: "REVIEW_REQUIRED",
    reasons: Object.freeze([
      "RETAILER_TITLE_COMPONENTS_NOT_PHYSICALLY_VERIFIED",
      "NO_CURRENT_PRICE_AUTHORITY",
      "NO_SUBJECT_FORMULATION_AUTHORITY"
    ]),
    primary_single_unit_ml: primary[0].unit_volume_ml,
    primary_units: primary[0].quantity,
    primary_total_ml: primaryTotal,
    gift_total_ml: giftTotal,
    historical_kit_unit_price_per_10ml: Math.round(input.historical_kit_price_krw /
      primaryTotal * 1000) / 100,
    display_price_krw: null,
    normalized_product_size_ml: null,
    catalog_writes_authorized: false,
    offer_writes_authorized: false,
    subject_writes_authorized: false,
    ranking_writes_authorized: false
  });
}
