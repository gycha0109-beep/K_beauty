// D8K-2: bounded transport of the existing private presentation RPC.
// This module has NO database client, privilege grant, price/option authority or CTA.
// The injected reader must run in an already-authorized server-side context.
export const PRODUCT_OFFER_AUTHORITY_READ_VERSION = 'd8k2-offer-authority-read-v1';
export const EXISTING_OFFER_RPC_VERSION = 'product-offer-presentation-authority-read-v2';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS_PER_CALL = 64;
const MAX_OFFERS_PER_CALL = 256;
const MAX_IDS_PER_REQUEST = 512;
const MAX_ROWS_FOR_COMPARISON = 256;

const blocked = (reason, requestedProductCount = 0) => ({
  version: PRODUCT_OFFER_AUTHORITY_READ_VERSION,
  status: 'HOLD', reason, requestedProductCount,
  offersByProduct: {}, offerRowCount: 0, rpcCalls: 0,
  selectedOptionAuthority: false, priceAuthority: false,
  directCtaAuthority: false, productionReleaseAuthorized: false
});

/** Build a deterministic bounded plan; only caller-attested recommended IDs belong here. */
export function planProductOfferAuthorityReads(productIds) {
  if (!Array.isArray(productIds) || productIds.length > MAX_IDS_PER_REQUEST) {
    return { status: 'HOLD', reason: 'INVALID_PRODUCT_ID_REQUEST', batches: [] };
  }
  const normalized = [];
  for (const value of productIds) {
    if (typeof value !== 'string' || !UUID.test(value)) {
      return { status: 'HOLD', reason: 'MALFORMED_PRODUCT_ID', batches: [] };
    }
    normalized.push(value.toLowerCase());
  }
  const ids = [...new Set(normalized)].sort();
  const batches = [];
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
    batches.push(ids.slice(i, i + MAX_IDS_PER_CALL));
  }
  return { status: 'READY', reason: null, productIds: ids, batches };
}

function safeText(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function inspectResponse(response, requestedIds) {
  if (!response || typeof response !== 'object' || Array.isArray(response) ||
      response.read_contract_version !== EXISTING_OFFER_RPC_VERSION) {
    return { reason: 'READ_CONTRACT_MISMATCH' };
  }
  if (response.status !== 'AUTHORITY_RESOLVED') {
    return { reason: 'RPC_NO_AUTHORITY' };
  }
  const rows = response.offers;
  if (!Array.isArray(rows) || rows.length > MAX_OFFERS_PER_CALL) {
    return { reason: 'RPC_OFFER_LIMIT_OR_SHAPE_INVALID' };
  }
  const allowed = new Set(requestedIds);
  const offerIds = new Set();
  const sellerListingIds = new Set();
  const sellerUrls = new Set();
  const sanitized = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        typeof row.offer_id !== 'string' || !UUID.test(row.offer_id) ||
        typeof row.product_id !== 'string' || !UUID.test(row.product_id) ||
        !allowed.has(row.product_id.toLowerCase()) ||
        !safeText(row.seller_key, 80) || !safeText(row.seller_name, 160) ||
        !safeText(row.listing_url, 2048)) {
      return { reason: 'RPC_ROW_IDENTITY_INVALID' };
    }
    const offerId = row.offer_id.toLowerCase();
    const listingId = row.listing_id == null ? null : safeText(row.listing_id, 256);
    if (row.listing_id != null && !listingId) return { reason: 'RPC_ROW_IDENTITY_INVALID' };
    const listingKey = listingId == null ? null : JSON.stringify([row.seller_key, listingId]);
    const urlKey = JSON.stringify([row.seller_key, row.listing_url]);
    if (offerIds.has(offerId) || (listingKey && sellerListingIds.has(listingKey)) ||
        sellerUrls.has(urlKey)) return { reason: 'RPC_DUPLICATE_OFFER_IDENTITY' };
    offerIds.add(offerId);
    if (listingKey) sellerListingIds.add(listingKey);
    sellerUrls.add(urlKey);
    // Intentionally DO NOT forward listing_url, observed amount or raw seller flags.
    // Existing schema lacks independent selected option/composition/shipping evidence.
    sanitized.push(Object.freeze({
      offerId, productId: row.product_id.toLowerCase(),
      sellerKey: row.seller_key, sellerName: row.seller_name,
      optionEvidenceState: 'UNATTESTED',
      comparisonEligible: false, ctaEnabled: false
    }));
  }
  return { rows: sanitized };
}

/**
 * Offline/testable reader boundary for the already-private RPC.
 * No service_role fallback, no browser grants and no real endpoint is defined here.
 * Any batch error denies the WHOLE read rather than publishing partial prices.
 */
export async function readProductOfferAuthorityTransport({ productIds, invokeAuthorizedRead } = {}) {
  const plan = planProductOfferAuthorityReads(productIds);
  if (plan.status !== 'READY') return blocked(plan.reason);
  if (typeof invokeAuthorizedRead !== 'function') {
    return blocked('AUTHORIZED_READER_NOT_PROVIDED', plan.productIds.length);
  }
  if (!plan.productIds.length) {
    return { ...blocked('NO_RECOMMENDED_PRODUCTS'), status: 'EMPTY' };
  }
  const offersByProduct = Object.fromEntries(plan.productIds.map(id => [id, []]));
  let count = 0;
  let calls = 0;
  for (const batch of plan.batches) {
    let response;
    try {
      calls++;
      response = await invokeAuthorizedRead([...batch]);
    } catch {
      return blocked('RPC_READ_FAILED', plan.productIds.length);
    }
    const checked = inspectResponse(response, batch);
    if (checked.reason) return blocked(checked.reason, plan.productIds.length);
    count += checked.rows.length;
    if (count > MAX_ROWS_FOR_COMPARISON) {
      return blocked('COMPARISON_CAPACITY_EXCEEDED', plan.productIds.length);
    }
    for (const row of checked.rows) offersByProduct[row.productId].push(row);
  }
  return {
    version: PRODUCT_OFFER_AUTHORITY_READ_VERSION,
    status: 'READ_WITH_EVIDENCE_HOLD',
    reason: 'SELECTED_OPTION_COMPOSITION_SHIPPING_NOT_ATTESTED',
    requestedProductCount: plan.productIds.length,
    offersByProduct, offerRowCount: count, rpcCalls: calls,
    selectedOptionAuthority: false, priceAuthority: false,
    directCtaAuthority: false, productionReleaseAuthorized: false
  };
}
