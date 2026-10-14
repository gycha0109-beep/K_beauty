// D8K-1: pure, read-only comparison of separately attested seller options.
// This is NOT an authority adapter: caller attestations cannot stand in for
// verified DB evidence, Product identity, or an approved direct-link policy.
import { resolveProductPurchaseLink } from "../product-purchase-link.js";

export const PRODUCT_OFFER_COMPARISON_VERSION = "d8k-seller-comparison-v1";
export const PREFERRED_SELLER_CHANNELS = Object.freeze([
  "official", "coupang", "oliveyoung", "hwahae"
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-z0-9][a-z0-9_:-]{0,95}$/;
const SELLER_KEY = /^[a-z][a-z0-9_-]{0,79}$/;
const CHANNELS = new Set([...PREFERRED_SELLER_CHANNELS, "other"]);
const KINDS = new Set(["single", "multipack", "kit"]);
const UNITS = new Set(["ml", "g", "ea"]);
const MAX_ROWS = 256;
const MAX_GIFTS = 12;

function text(value, max = 160) {
  return typeof value === "string" && value.trim() === value &&
    value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)
    ? value : null;
}
function token(value) {
  return text(value, 96) && TOKEN.test(value) ? value : null;
}
function uuid(value) {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}
function money(value, positive = true) {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= (positive ? 1 : 0) && value <= 1000000000 ? value : null;
}
function positiveInt(value, max = 10000) {
  return Number.isSafeInteger(value) && value >= 1 && value <= max ? value : null;
}
function timestamp(value) {
  const label = text(value, 40);
  if (!label || !/^\d{4}-\d{2}-\d{2}T/.test(label)) return null;
  const time = Date.parse(label);
  return Number.isFinite(time) ? time : null;
}
function compare(a, b) {
  return a.localeCompare(b, "en");
}
function normalizeComposition(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const unitSize = positiveInt(value.unitSize);
  const quantity = positiveInt(value.quantity);
  const sizeUnit = value.sizeUnit;
  if (!unitSize || !quantity || !UNITS.has(sizeUnit) ||
      !Array.isArray(value.gifts) || value.gifts.length > MAX_GIFTS) return null;
  const gifts = [];
  const known = new Set();
  for (const gift of value.gifts) {
    const skuId = token(gift?.skuId);
    const count = positiveInt(gift?.quantity);
    if (!skuId || !count || known.has(skuId)) return null;
    known.add(skuId);
    gifts.push({ skuId, quantity: count });
  }
  gifts.sort((a, b) => compare(a.skuId, b.skuId));
  return { unitSize, quantity, sizeUnit, gifts };
}
function comparisonIdentity(productId, variantId, kind, pack) {
  return JSON.stringify([
    productId, variantId, kind, pack.unitSize, pack.sizeUnit,
    pack.quantity, pack.gifts.map(g => [g.skuId, g.quantity])
  ]);
}
function expectedUrlSource(channel) {
  if (channel === "official") return "official:";
  if (channel === "oliveyoung") return "olive_young";
  if (channel === "hwahae") return "hwahae";
  if (channel === "coupang") return "coupang";
  return null;
}
function trustedLink(offer, product, priceFreshness) {
  if (offer.ctaAuthority !== "approved") return { href: null, reason: "CTA_NOT_APPROVED" };
  if (offer.link_health_state !== "healthy") return { href: null, reason: "LINK_HEALTH_NOT_VERIFIED" };
  if (offer.availability_state !== "in_stock") return { href: null, reason: "STOCK_NOT_VERIFIED" };
  if (offer.product_scope_state !== "product") return { href: null, reason: "PRODUCT_SCOPE_UNRESOLVED" };
  if (priceFreshness === "stale") return { href: null, reason: "STALE_PRICE" };
  const source = expectedUrlSource(offer.sellerChannel);
  if (!source) return { href: null, reason: "SELLER_LINK_POLICY_MISSING" };
  // Reuse the repository's existing tightly scoped URL resolver, never
  // substitute its generic Naver search fallback for a direct seller URL.
  const resolved = resolveProductPurchaseLink({
    buyLink: offer.listing_url,
    brand: product.brand,
    name: product.name
  });
  const sourceMatches = source === "official:"
    ? resolved.source?.startsWith(source)
    : resolved.source === source;
  if (resolved.kind !== "direct" || !sourceMatches) {
    return { href: null, reason: "DIRECT_LINK_NOT_TRUSTED" };
  }
  return { href: resolved.href, reason: null };
}
function prepare(offer, product, now, maxAgeMs) {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) {
    return { reason: "INVALID_OFFER" };
  }
  if (uuid(offer.product_id) !== product.id) return { reason: "PRODUCT_ID_MISMATCH" };
  if (offer.offer_state !== "current") return { reason: "OFFER_NOT_CURRENT" };
  if (offer.market_code !== "KR" || offer.currency_code !== "KRW") {
    return { reason: "MARKET_OR_CURRENCY_UNSUPPORTED" };
  }
  if (offer.product_scope_state !== "product") return { reason: "PRODUCT_SCOPE_UNRESOLVED" };
  if (offer.evidenceStatus !== "verified" ||
      offer.sellerIdentityVerified !== true ||
      offer.optionIdentityVerified !== true ||
      offer.compositionVerified !== true ||
      offer.priceVerified !== true) return { reason: "SELLER_OPTION_PRICE_EVIDENCE_MISSING" };

  const sellerKey = text(offer.seller_key, 80);
  const sellerName = text(offer.seller_name, 160);
  const listingId = text(offer.listing_id, 256);
  const optionIdentity = token(offer.optionIdentity);
  const variantId = token(offer.variantId);
  const optionKind = offer.optionKind;
  const sellerChannel = offer.sellerChannel;
  const pack = normalizeComposition(offer.packComposition);
  if (!sellerKey || !SELLER_KEY.test(sellerKey) || !sellerName || !listingId ||
      !optionIdentity || !variantId || !KINDS.has(optionKind) ||
      !CHANNELS.has(sellerChannel) || !pack) return { reason: "OPTION_IDENTITY_INCOMPLETE" };
  if ((optionKind === "single" && (pack.quantity !== 1 || pack.gifts.length)) ||
      (optionKind === "multipack" && (pack.quantity < 2 || pack.gifts.length)) ||
      (optionKind === "kit" && !pack.gifts.length)) {
    return { reason: "PACKAGE_KIND_CONFLICT" };
  }
  const observedPrice = money(offer.price_amount);
  if (observedPrice === null) return { reason: "PRICE_UNVERIFIED_OR_INVALID" };
  const when = timestamp(offer.last_observed_at);
  if (when === null || when > now) return { reason: "PRICE_TIME_INVALID" };
  const age = now - when;
  if (maxAgeMs !== null && age > maxAgeMs) return { reason: "PRICE_OBSERVATION_STALE" };
  const priceFreshness = maxAgeMs === null ? "not_assessed" : "within_configured_window";
  const shipping = offer.shippingAmount === null || offer.shippingAmount === undefined
    ? null : money(offer.shippingAmount, false);
  if (shipping === null && offer.shippingAmount != null) {
    return { reason: "SHIPPING_AMOUNT_INVALID" };
  }
  if (shipping !== null && offer.shippingVerified !== true) {
    return { reason: "SHIPPING_EVIDENCE_MISSING" };
  }
  const id = comparisonIdentity(product.id, variantId, optionKind, pack);
  const link = trustedLink(offer, product, priceFreshness);
  const offerId = uuid(offer.offer_id);
  if (!offerId) return { reason: "OFFER_ID_INVALID" };
  const listingUrl = typeof offer.listing_url === "string" ? offer.listing_url : "";
  return {
    candidate: {
      offerId, productId: product.id, sellerKey, sellerName,
      sellerChannel, listingId, optionIdentity, variantId,
      optionKind, packComposition: pack, comparisonGroup: id,
      observedPrice, shippingCost: shipping,
      totalPrice: shipping === null ? null : observedPrice + shipping,
      currency: "KRW", observedAt: offer.last_observed_at,
      availabilityState: offer.availability_state === "in_stock" ? "in_stock" :
        offer.availability_state === "out_of_stock" ? "out_of_stock" : "unknown",
      priceFreshness, ctaHref: link.href, ctaEnabled: Boolean(link.href),
      ctaBlockedReason: link.reason
    },
    duplicateKey: sellerKey + "::" + listingId + "::" + optionIdentity,
    listingUrl
  };
}
/**
 * Read-only UI projection. Requires an independently verified authority
 * adapter in a later phase; boolean assertions in raw DB rows are NOT proof.
 */
export function buildProductOfferComparison({
  product = null, admissionState = null, offers = [], nowIso = null,
  maxAgeMs = null
} = {}) {
  const id = uuid(product?.id);
  const empty = (status, excluded = []) => ({
    version: PRODUCT_OFFER_COMPARISON_VERSION, productId: id,
    status, groups: [], excluded, preferredSellerChannels: [...PREFERRED_SELLER_CHANNELS],
    rankingChanged: false, productWrites: 0, offerWrites: 0,
    productionReleaseAuthorized: false
  });
  if (!id || !text(product?.brand) || !text(product?.name) ||
      admissionState !== "admitted") return empty("hold");
  const now = timestamp(nowIso);
  if (now === null || (maxAgeMs !== null &&
    (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 2592000000)) ||
    !Array.isArray(offers) || offers.length > MAX_ROWS) return empty("hold");
  const fixedProduct = { id, brand: product.brand, name: product.name };
  const candidates = [];
  const excluded = [];
  for (let i = 0; i < offers.length; i++) {
    const row = prepare(offers[i], fixedProduct, now, maxAgeMs);
    if (row.reason) excluded.push({ index: i, reason: row.reason });
    else candidates.push({ ...row, index: i });
  }
  // Collisions deny *all* colliding rows; never arbitrarily select the first.
  const counts = new Map();
  const urls = new Map();
  for (const item of candidates) {
    counts.set(item.duplicateKey, (counts.get(item.duplicateKey) || 0) + 1);
    if (item.listingUrl) {
      urls.set(item.listingUrl, (urls.get(item.listingUrl) || 0) + 1);
    }
  }
  const valid = [];
  for (const item of candidates) {
    if (counts.get(item.duplicateKey) > 1 ||
        (item.listingUrl && urls.get(item.listingUrl) > 1)) {
      excluded.push({ index: item.index, reason: "DUPLICATE_LISTING_OR_OPTION" });
    } else {
      valid.push(item.candidate);
    }
  }
  const buckets = new Map();
  for (const row of valid) {
    if (!buckets.has(row.comparisonGroup)) buckets.set(row.comparisonGroup, []);
    buckets.get(row.comparisonGroup).push(row);
  }
  const groups = [...buckets.entries()].map(([key, entries]) => {
    const fullCheckoutKnown = entries.every(row => row.shippingCost !== null);
    const sorted = entries.sort((a, b) =>
      (fullCheckoutKnown ? a.totalPrice - b.totalPrice : a.observedPrice - b.observedPrice) ||
      compare(a.sellerKey, b.sellerKey) || compare(a.listingId, b.listingId));
    return {
      comparisonGroup: key,
      optionKind: sorted[0].optionKind,
      variantId: sorted[0].variantId,
      packComposition: sorted[0].packComposition,
      sortBasis: fullCheckoutKnown ? "known_total_checkout" : "observed_option_price",
      cheapestBadgeAuthorized: false,
      offers: sorted
    };
  }).sort((a, b) =>
    (["single", "multipack", "kit"].indexOf(a.optionKind) -
     ["single", "multipack", "kit"].indexOf(b.optionKind)) ||
    compare(a.comparisonGroup, b.comparisonGroup));
  return {
    ...empty(groups.length ? "options_observed" : "checking", excluded),
    groups
  };
}
