import { getTrustedDirectPurchaseUrl } from "@/lib/product-purchase-link";

export const PRODUCT_OFFER_READ_PATH_VERSION = "product-offer-read-v1";

const DEFAULT_MARKET_CODE = "KR";
const TRUSTED_LINK_SOURCES = new Map([
  ["legacy_product_buy_link_v1::oliveyoung", "olive_young"]
]);
const LINKABLE_AVAILABILITY = new Set(["in_stock", "unknown"]);
const AVAILABILITY_PRIORITY = Object.freeze({
  in_stock: 2,
  unknown: 1
});
const PRODUCT_SCOPE_PRIORITY = Object.freeze({
  product: 2,
  product_subject_unresolved: 1
});
const MAX_TRAVERSAL_DEPTH = 24;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMarketCode(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function timestampValue(value) {
  if (typeof value !== "string" || !value.trim()) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function compareText(left, right) {
  return normalizeString(left).localeCompare(normalizeString(right), "en");
}

function mapPriceRange(priceMin, priceMax, fallback = "$$") {
  const ceiling = Number(priceMax || priceMin || 0);

  if (!ceiling) {
    return fallback;
  }

  if (ceiling < 20000) {
    return "$";
  }

  if (ceiling < 40000) {
    return "$$";
  }

  return "$$$";
}

function resolveTrustedLinkSourceHint(offer) {
  return TRUSTED_LINK_SOURCES.get(
    `${normalizeString(offer?.source_name)}::${normalizeString(offer?.seller_key).toLowerCase()}`
  ) || "";
}

function buildAdmissibleOfferCandidate(offer, product, marketCode) {
  if (!offer || !product) {
    return null;
  }

  const productId = normalizeString(product.id);
  if (!productId || normalizeString(offer.product_id) !== productId) {
    return null;
  }

  if (normalizeString(offer.offer_state) !== "current") {
    return null;
  }

  if (normalizeMarketCode(offer.market_code) !== normalizeMarketCode(marketCode)) {
    return null;
  }

  const availabilityState = normalizeString(offer.availability_state);
  if (!LINKABLE_AVAILABILITY.has(availabilityState)) {
    return null;
  }

  const sourceHint = resolveTrustedLinkSourceHint(offer);
  if (!sourceHint) {
    return null;
  }

  const trustedListingUrl = getTrustedDirectPurchaseUrl({
    buyLink: offer.listing_url,
    brand: product.brand,
    name: product.name,
    sourceHint
  });

  if (!trustedListingUrl) {
    return null;
  }

  return {
    offer,
    trustedListingUrl,
    availabilityPriority: AVAILABILITY_PRIORITY[availabilityState] || 0,
    productScopePriority: PRODUCT_SCOPE_PRIORITY[normalizeString(offer.product_scope_state)] || 0,
    lastObservedAt: timestampValue(offer.last_observed_at),
    createdAt: timestampValue(offer.created_at)
  };
}

function compareOfferCandidates(left, right) {
  if (left.availabilityPriority !== right.availabilityPriority) {
    return right.availabilityPriority - left.availabilityPriority;
  }

  if (left.productScopePriority !== right.productScopePriority) {
    return right.productScopePriority - left.productScopePriority;
  }

  if (left.lastObservedAt !== right.lastObservedAt) {
    return right.lastObservedAt - left.lastObservedAt;
  }

  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }

  const sellerKeyOrder = compareText(left.offer?.seller_key, right.offer?.seller_key);
  if (sellerKeyOrder) {
    return sellerKeyOrder;
  }

  const listingIdOrder = compareText(left.offer?.listing_id, right.offer?.listing_id);
  if (listingIdOrder) {
    return listingIdOrder;
  }

  const listingUrlOrder = compareText(left.offer?.listing_url, right.offer?.listing_url);
  if (listingUrlOrder) {
    return listingUrlOrder;
  }

  return compareText(left.offer?.offer_id, right.offer?.offer_id);
}

function resolveOfferPriceProjection(candidate, product) {
  const offer = candidate?.offer;
  const amount = normalizeMoney(offer?.price_amount);
  const observedAt = timestampValue(offer?.last_observed_at);
  const currencyCode = normalizeString(offer?.currency_code).toUpperCase();
  const availabilityState = normalizeString(offer?.availability_state);

  if (
    amount === null ||
    currencyCode !== "KRW" ||
    availabilityState !== "in_stock" ||
    !Number.isFinite(observedAt) ||
    observedAt === Number.NEGATIVE_INFINITY
  ) {
    return {
      price_min: product.price_min,
      price_max: product.price_max,
      price_range: product.price_range
    };
  }

  return {
    price_min: amount,
    price_max: amount,
    price_range: mapPriceRange(amount, amount, product.price_range || "$$")
  };
}

export function selectCurrentProductOffer(product, offers = [], options = {}) {
  const marketCode = options.marketCode || DEFAULT_MARKET_CODE;
  const candidates = (Array.isArray(offers) ? offers : [])
    .map((offer) => buildAdmissibleOfferCandidate(offer, product, marketCode))
    .filter(Boolean)
    .sort(compareOfferCandidates);

  return candidates[0] || null;
}

export function projectProductWithOfferAuthority(product, offers = [], options = {}) {
  if (!product || typeof product !== "object") {
    return product;
  }

  const productId = normalizeString(product.id);
  if (!productId) {
    return product;
  }

  const exactProductOffers = (Array.isArray(offers) ? offers : []).filter(
    (offer) => normalizeString(offer?.product_id) === productId
  );

  if (!exactProductOffers.length) {
    return product;
  }

  const selected = selectCurrentProductOffer(product, exactProductOffers, options);
  if (!selected) {
    return {
      ...product,
      buy_link: ""
    };
  }

  return {
    ...product,
    buy_link: selected.trustedListingUrl,
    ...resolveOfferPriceProjection(selected, product)
  };
}

function isRecommendationProductNode(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const id = normalizeString(value.id);
  const name = normalizeString(value.name);
  const brand = normalizeString(value.brand);
  const hasCommerceField =
    Object.prototype.hasOwnProperty.call(value, "buy_link") ||
    Object.prototype.hasOwnProperty.call(value, "price_min") ||
    Object.prototype.hasOwnProperty.call(value, "price_range");

  return Boolean(id && name && brand && hasCommerceField);
}

export function collectRecommendationProductIds(value) {
  const ids = new Set();
  const seen = new WeakSet();

  const visit = (current, depth = 0, key = "") => {
    if (
      current === null ||
      typeof current !== "object" ||
      depth > MAX_TRAVERSAL_DEPTH ||
      seen.has(current) ||
      key === "diagnostics"
    ) {
      return;
    }

    seen.add(current);

    if (isRecommendationProductNode(current)) {
      ids.add(normalizeString(current.id));
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, depth + 1));
      return;
    }

    Object.entries(current).forEach(([childKey, childValue]) => {
      visit(childValue, depth + 1, childKey);
    });
  };

  visit(value);
  return Array.from(ids).sort();
}

export function projectRecommendationDecisionWithOffers(decision, offers = [], options = {}) {
  const seen = new WeakMap();

  const visit = (current, depth = 0, key = "") => {
    if (current === null || typeof current !== "object") {
      return current;
    }

    if (depth > MAX_TRAVERSAL_DEPTH || key === "diagnostics") {
      return current;
    }

    if (seen.has(current)) {
      return seen.get(current);
    }

    if (Array.isArray(current)) {
      const nextArray = [];
      seen.set(current, nextArray);
      current.forEach((item) => nextArray.push(visit(item, depth + 1)));
      return nextArray;
    }

    if (isRecommendationProductNode(current)) {
      const projectedProduct = projectProductWithOfferAuthority(current, offers, options);
      seen.set(current, projectedProduct);
      return projectedProduct;
    }

    const nextObject = {};
    seen.set(current, nextObject);
    Object.entries(current).forEach(([childKey, childValue]) => {
      nextObject[childKey] = visit(childValue, depth + 1, childKey);
    });
    return nextObject;
  };

  return visit(decision);
}

export async function applyProductOfferReadPath(decision, loadOffers, options = {}) {
  if (typeof loadOffers !== "function") {
    return decision;
  }

  const productIds = collectRecommendationProductIds(decision);
  if (!productIds.length) {
    return decision;
  }

  try {
    const offers = await loadOffers(productIds);
    if (!Array.isArray(offers)) {
      return decision;
    }

    return projectRecommendationDecisionWithOffers(decision, offers, options);
  } catch {
    return decision;
  }
}
