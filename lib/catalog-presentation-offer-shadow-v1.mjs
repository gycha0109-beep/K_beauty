/**
 * R1/C1: pure, non-authoritative read model of physical units and seller bundles.
 * Catalog Product, PF-1 Subject, and existing Offer/Observation remain the owners.
 * This parser NEVER authorizes Product/Subject/Fact/Offer writes or Fact reuse.
 */
import { createHash } from "node:crypto";

export const PRESENTATION_OFFER_SHADOW_VERSION = "catalog-presentation-offer-shadow-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
const ROLES = new Set(["PRIMARY", "ADDITIONAL_SAME_PRODUCT", "GIFT", "OTHER_PRODUCT", "UNKNOWN"]);
const UNITS = new Map([
  ["ml", "ml"], ["mℓ", "ml"], ["밀리리터", "ml"], ["g", "g"],
  ["그램", "g"], ["매", "sheet"], ["장", "sheet"], ["sheet", "sheet"],
  ["개", "item"], ["ea", "item"], ["pcs", "item"]
]);
const PACKAGING = new Set(["bottle", "tube", "jar", "pouch", "refill", "pad_pack", "other", "unknown"]);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const str = value => typeof value === "string" && value.trim() ? value.trim() : null;
const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1000000;
const integer = value => Number.isSafeInteger(value) && value > 0 && value <= 10000;

export class PresentationOfferContractError extends TypeError {
  constructor(reason) {
    super(reason);
    this.name = "PresentationOfferContractError";
    this.code = reason;
  }
}
const invalid = reason => { throw new PresentationOfferContractError(reason); };
function httpsUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password || u.hash) invalid("INVALID_LISTING_URL");
    return u.href;
  } catch {
    invalid("INVALID_LISTING_URL");
  }
}
function unit(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("INVALID_PHYSICAL_UNIT");
  const amount = value.amount;
  const family = UNITS.get(String(value.unit || "").normalize("NFKC").toLowerCase());
  if (!positive(amount) || !family || !PACKAGING.has(value.packaging)) invalid("INVALID_PHYSICAL_UNIT");
  const revision = value.packaging_revision === null ? null : str(value.packaging_revision);
  if (value.packaging_revision !== null && !revision) invalid("INVALID_PACKAGE_REVISION");
  return Object.freeze({
    amount, unit: family, packaging: value.packaging,
    packaging_revision: revision
  });
}
function component(raw, productId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !ROLES.has(raw.role)) invalid("INVALID_COMPONENT_ROLE");
  if (!integer(raw.quantity)) invalid("INVALID_COMPONENT_QUANTITY");
  const id = raw.product_id === null ? null : str(raw.product_id);
  if (id !== null && !UUID.test(id)) invalid("INVALID_COMPONENT_PRODUCT_ID");
  if (raw.role === "PRIMARY" && id !== productId) invalid("PRIMARY_PRODUCT_MISMATCH");
  if (raw.role === "ADDITIONAL_SAME_PRODUCT" && id !== productId) invalid("ADDITIONAL_PRODUCT_MISMATCH");
  if ((raw.role === "GIFT" || raw.role === "OTHER_PRODUCT") && id === productId) invalid("COMPONENT_ROLE_MISMATCH");
  const physical = raw.unit === null ? null : unit(raw.unit);
  if (raw.role !== "UNKNOWN" && !physical) invalid("PHYSICAL_UNIT_REQUIRED");
  const refs = raw.evidence_refs === undefined ? [] : raw.evidence_refs;
  if (!Array.isArray(refs) || refs.some(r => !str(r))) invalid("INVALID_EVIDENCE_REFS");
  const evidenceRefs = [...new Set(refs.map(x => x.trim()))].sort();
  // A component without a known Product may be described but cannot acquire Product Fact authority.
  const presentationKey = id && physical ? digest([id, physical.unit, physical.amount,
    physical.packaging, physical.packaging_revision]) : null;
  return Object.freeze({
    role: raw.role,
    product_id: id,
    sku: str(raw.sku),
    quantity: raw.quantity,
    unit: physical,
    evidence_refs: Object.freeze(evidenceRefs),
    presentation_key: presentationKey,
    presentation_provisional: physical?.packaging_revision === null
  });
}
function keyOf(row) {
  return JSON.stringify([row.role, row.product_id, row.sku, row.quantity,
    row.unit, row.evidence_refs]);
}
/**
 * The input is a classified observation, NOT a verified manufacturer's declaration.
 * Source review/approval, formula equivalence and unit-price authority live elsewhere.
 * prior_listing is only a comparison hint; never creates a redirect/alias authority.
 */
export function classifyPresentationOfferShadowV1({
  product, listing, components, prior_listing = null
} = {}) {
  if (!UUID.test(String(product?.id || "")) || !str(product?.normalized_brand) ||
      !str(product?.normalized_name)) invalid("INVALID_CATALOG_ANCHOR");
  if (!listing || typeof listing !== "object" || Array.isArray(listing) ||
      !str(listing.seller_key)) invalid("INVALID_SELLER");
  const seller = listing.seller_key.trim();
  const listingId = listing.listing_id === null ? null : str(listing.listing_id);
  if (listing.listing_id !== null && !listingId) invalid("INVALID_LISTING_ID");
  const url = httpsUrl(listing.listing_url);
  if (!listingId && !url) invalid("NO_LISTING_IDENTITY");
  const observedAt = listing.observed_at;
  if (typeof observedAt !== "string" || !TIMESTAMP.test(observedAt) ||
      !Number.isFinite(Date.parse(observedAt))) invalid("INVALID_OBSERVED_AT");
  const amount = listing.price_amount;
  if (amount !== null && !(typeof amount === "number" && Number.isFinite(amount) && amount >= 0))
    invalid("INVALID_PRICE");
  if (!/^[A-Z]{3}$/.test(listing.currency_code || "")) invalid("INVALID_CURRENCY");
  if (!Array.isArray(components) || components.length === 0 || components.length > 64)
    invalid("INVALID_COMPONENT_LIST");
  const normalized = components.map(c => component(c, product.id)).sort((a,b)=> keyOf(a).localeCompare(keyOf(b),"en"));
  if (normalized.filter(c => c.role === "PRIMARY").length !== 1) invalid("SINGLE_PRIMARY_REQUIRED");

  const reasons = new Set();
  if (normalized.some(c => c.role === "UNKNOWN" || c.unit === null)) reasons.add("COMPONENT_IDENTITY_UNRESOLVED");
  if (normalized.some(c => c.product_id === null && c.role !== "UNKNOWN")) reasons.add("SECONDARY_PRODUCT_UNRESOLVED");
  if (normalized.some(c => !c.evidence_refs.length)) reasons.add("COMPONENT_EVIDENCE_REQUIRED");
  if (normalized.some(c => c.unit?.packaging_revision === null)) reasons.add("PACKAGING_REVISION_UNRESOLVED");
  if (normalized.some(c => c.unit?.packaging === "unknown")) reasons.add("PACKAGING_KIND_UNRESOLVED");
  if (prior_listing !== null) {
    const priorId = prior_listing.listing_id === null ? null : str(prior_listing.listing_id);
    if (!str(prior_listing.seller_key) || !str(prior_listing.listing_url)) invalid("INVALID_PRIOR_LISTING");
    const priorUrl = httpsUrl(prior_listing.listing_url);
    if (seller === prior_listing.seller_key && listingId && priorId && listingId !== priorId)
      reasons.add("LISTING_ID_CHANGED_REVIEW_REQUIRED");
    if (seller === prior_listing.seller_key && (!listingId || !priorId) && url !== priorUrl)
      reasons.add("URL_CHANGE_WITHOUT_STABLE_SKU_REVIEW_REQUIRED");
  }
  // Stable listing ID survives a URL move. Never merge different IDs using a claimed redirect.
  const offerKey = digest(["seller-offer-v1", seller, listingId ? ["id", listingId] : ["url", url]]);
  const composition = normalized.map(c => [c.role,c.product_id,c.sku,c.quantity,c.unit,c.evidence_refs]);
  // Includes temporal price and URL: same SKU can retain distinct historical observations.
  const observationKey = digest(["offer-observation-v1",offerKey,observedAt,url,amount,
    listing.currency_code,composition]);
  return Object.freeze({
    version: PRESENTATION_OFFER_SHADOW_VERSION,
    catalog_product_id: product.id,
    catalog_anchor_key: [product.normalized_brand,product.normalized_name],
    offer_key: offerKey,
    observation_key: observationKey,
    observed_at: observedAt,
    seller_key: seller,
    listing_id: listingId,
    listing_url: url,
    observed_price: Object.freeze({amount, currency:listing.currency_code}),
    components: Object.freeze(normalized),
    component_count: normalized.length,
    classification: reasons.size ? "REVIEW_REQUIRED" : "SHADOW_CLASSIFIED",
    reasons: Object.freeze([...reasons].sort()),
    formulation_identity: "FORMULA_UNRESOLVED",
    subject_id: null,
    comparable_unit_price: null,
    catalog_product_creation_authorized: false,
    offer_write_authorized: false,
    subject_write_authorized: false,
    fact_reuse_authorized: false,
    recommendation_change_authorized: false
  });
}

/**
 * Compare two separately frozen shadow observations without treating a
 * retailer redirect, changed gift or unchanged catalog ID as formula evidence.
 */
export function comparePresentationOfferObservationsV1(previous, next) {
  if (previous?.version !== PRESENTATION_OFFER_SHADOW_VERSION ||
      next?.version !== PRESENTATION_OFFER_SHADOW_VERSION) invalid("INVALID_SHADOW_COMPARISON");
  const reasons = [];
  const sameOffer = previous.offer_key === next.offer_key;
  const physical = value => JSON.stringify(value.components.map(c => [
    c.role,c.product_id,c.sku,c.quantity,c.unit
  ]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),"en")));
  if (sameOffer) {
    if (previous.catalog_product_id !== next.catalog_product_id)
      reasons.push("LISTING_PRODUCT_ANCHOR_CHANGED_REVIEW_REQUIRED");
    if (physical(previous) !== physical(next))
      reasons.push("SAME_LISTING_COMPOSITION_CHANGED_REVIEW_REQUIRED");
    if (previous.listing_url !== next.listing_url)
      reasons.push("LISTING_URL_CHANGED_REVALIDATION_REQUIRED");
  } else if (previous.seller_key === next.seller_key &&
             previous.listing_url === next.listing_url &&
             previous.listing_id !== next.listing_id) {
    reasons.push("LISTING_ID_ALIAS_REVIEW_REQUIRED");
  }
  return Object.freeze({
    version: PRESENTATION_OFFER_SHADOW_VERSION,
    same_offer_key: sameOffer,
    classification: reasons.length ? "REVIEW_REQUIRED" : "NO_ADDITIONAL_CONFLICT",
    reasons: Object.freeze(reasons.sort()),
    fact_reuse_authorized: false,
    offer_write_authorized: false
  });
}
