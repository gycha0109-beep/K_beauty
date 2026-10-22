/**
 * Cleansing-product recommendation admission preflight (read-only, fail closed).
 * This evaluates independently sourced evidence, NOT a production grant.
 * A future governed grant producer must revalidate the inputs under its own authority.
 */
export const CLEANSER_ADMISSION_PREFLIGHT_VERSION = "cleanser-initial-admission-preflight-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const VALID_SOURCE_KINDS = new Set([
  "brand_official_product_page", "manufacturer_official_document", "official_market_sales_page",
]);
const MAX_AGE_DAYS = 180;
const record = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const int = (value) => Number.isSafeInteger(value) && value >= 0;
const code = (value) => typeof value === "string" ? value.trim().normalize("NFKC").toLowerCase().replace(/\s+/g, " ") : "";

function safeHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && nonempty(url.hostname);
  } catch {
    return false;
  }
}
function isHwahaePage(value) {
  if (!safeHttps(value)) return false;
  const url = new URL(value);
  return ["hwahae.co.kr", "www.hwahae.co.kr", "hwahae.com", "www.hwahae.com"].includes(url.hostname.toLowerCase()) &&
    /^\/(products|goods)\/\d+\/?$/.test(url.pathname);
}
function samePage(a, b) {
  if (!safeHttps(a) || !safeHttps(b)) return false;
  const x = new URL(a); const y = new URL(b);
  return x.hostname.toLowerCase().replace(/^www\./, "") === y.hostname.toLowerCase().replace(/^www\./, "") &&
    x.pathname.replace(/\/$/, "") === y.pathname.replace(/\/$/, "");
}
function recent(value, now) {
  if (!nonempty(value)) return false;
  const date = Date.parse(value);
  if (!Number.isFinite(date) || date > now.getTime() + 86400000) return false;
  return now.getTime() - date <= MAX_AGE_DAYS * 86400000;
}
function riskValid(signals) {
  const count = signals?.total_ingredients;
  const risk = signals?.risk;
  if (!int(count) || count === 0 || !record(risk)) return false;
  const values = [risk.low, risk.medium, risk.high, risk.unknown];
  if (!values.every(int) || values.reduce((sum, number) => sum + number, 0) !== count) return false;
  if (!record(signals.skin_type)) return false;
  return ["dry", "oily", "sensitive"].every((key) =>
    record(signals.skin_type[key]) && int(signals.skin_type[key].positive) && int(signals.skin_type[key].negative));
}
function reviewValid(review) {
  if (!record(review) || review.source !== "hwahae_ai_review") return false;
  if (!Array.isArray(review.positive) || !Array.isArray(review.negative)) return false;
  return [...review.positive, ...review.negative].every((item) =>
    record(item) && nonempty(item.label) && int(item.count) && item.count > 0 &&
    Array.isArray(item.mapped) && item.mapped.every((tag) => nonempty(tag)));
}
function marketValid(market) {
  if (!record(market) || market.source !== "hwahae_visible_page") return false;
  if (!int(market.review_count)) return false;
  if (market.rating != null && (!Number.isFinite(market.rating) || market.rating < 1 || market.rating > 5)) return false;
  return true;
}
function uniqueCodes(codes) { return [...new Set(codes)].sort(); }
const CLEANSER_REQUIRED_FACT_KEYS = Object.freeze(["low_ph","deep_cleansing"]);
const CLEANSER_FACT_KEYS = new Set(CLEANSER_REQUIRED_FACT_KEYS);
const TRUSTED_REGISTRIES = new Set(["product-fact-registry-cross-category-v1", "product-fact-registry-cross-category-v2"]);
function currentConfirmedCleanserFact(fact, subjectId, now) {
  if (!record(fact) || !record(fact.confirmation)) return false;
  if (!UUID.test(String(fact.fact_instance_id || "")) || !UUID.test(String(fact.confirmation_id || ""))) return false;
  if (fact.subject_id !== subjectId || !CLEANSER_FACT_KEYS.has(fact.fact_key) ||
      fact.semantic_status !== "supported" || fact.authority_ceiling !== "product_specific_primary" ||
      !["high", "medium"].includes(fact.fused_confidence) ||
      !TRUSTED_REGISTRIES.has(fact.registry_version) ||
      !/^[0-9a-f]{64}$/i.test(String(fact.proposition_key || ""))) return false;
  const today = now.toISOString().slice(0, 10);
  if (fact.valid_from && fact.valid_from > today) return false;
  if (fact.valid_to && fact.valid_to <= today) return false;
  const confirmation = fact.confirmation;
  return confirmation.status === "confirmed" &&
    confirmation.confirmation_id === fact.confirmation_id &&
    confirmation.fact_instance_id === fact.fact_instance_id &&
    confirmation.subject_id === fact.subject_id &&
    confirmation.proposition_key === fact.proposition_key &&
    confirmation.fact_key === fact.fact_key &&
    confirmation.registry_version === fact.registry_version &&
    confirmation.semantic_status === fact.semantic_status &&
    confirmation.authority_ceiling === fact.authority_ceiling &&
    confirmation.fused_confidence === fact.fused_confidence;
}


/**
 * evidence is an observation-only snapshot prepared by a trusted reader.
 * Never pass unvalidated client-provided authority flags to a grant producer.
 */
export function evaluateCleanserInitialAdmissionPreflight({ product, subject, officialBindings = [], observations = [], confirmedFacts = [], catalogProducts = [], now = new Date() } = {}) {
  const blockers = [];
  const conflicts = [];
  if (!record(product) || !UUID.test(String(product.id || "")) || product.category !== "cleanser" ||
      !nonempty(product.brand) || !nonempty(product.name) || !nonempty(product.normalized_brand) || !nonempty(product.normalized_name)) {
    blockers.push("CANONICAL_PRODUCT_INVALID");
  }
  if (!record(product) || !safeHttps(product.source_url)) blockers.push("PRODUCT_SOURCE_URL_MISSING_OR_UNSAFE");

  const sameCanonical = catalogProducts.filter((row) =>
    row?.id !== product?.id && code(row?.normalized_brand) === code(product?.normalized_brand) &&
    code(row?.normalized_name) === code(product?.normalized_name));
  if (sameCanonical.length) conflicts.push("CANONICAL_DUPLICATE_OR_VARIANT_COLLISION");

  const subjectOk = record(subject) && UUID.test(String(subject.subject_id || "")) &&
    subject.product_id === product?.id && subject.identity_status === "resolved" &&
    subject.current_state === "current" && subject.market_applicability === "KR" &&
    nonempty(subject.formulation_revision_key);
  if (!subjectOk) blockers.push("CURRENT_EXACT_SUBJECT_REQUIRED");

  const resolvedOfficial = officialBindings.filter((binding) =>
    binding?.product_id === product?.id && binding.binding_state === "resolved" &&
    binding.product_scope_state === "product" && safeHttps(binding.source_url) &&
    typeof binding.source_name === "string" && /^[a-z0-9_]+_official$/.test(binding.source_name));
  if (!resolvedOfficial.length) blockers.push("RESOLVED_OFFICIAL_SOURCE_BINDING_REQUIRED");

  const authoritativeObservations = observations.filter((row) =>
    row?.product_id === product?.id && row.subject_id === subject?.subject_id &&
    resolvedOfficial.some((binding) => binding.binding_id === row.source_binding_id &&
      samePage(binding.source_url, row.canonical_locator)) &&
    VALID_SOURCE_KINDS.has(row.source_kind) && row.market === "KR" &&
    SHA256.test(String(row.source_content_digest || "")) &&
    recent(row.fetched_at, now) &&
    record(row.product_identity_observation) &&
    row.product_identity_observation.exact_catalog_product_binding === true &&
    row.product_identity_observation.product_id === product?.id &&
    row.product_identity_observation.subject_id === subject?.subject_id);
  if (!authoritativeObservations.length) blockers.push("CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED");
  // Capacity must be part of the exact official observation, not inferred from the URL.
  const nameGrams = /(?:^|\s)(\d+(?:\.\d+)?)\s*g(?:$|\s)/i.exec(product?.name || "");
  const expectedCapacity = product?.size_ml != null && Number(product.size_ml) > 0
    ? { amount: Number(product.size_ml), unit: "ml" }
    : nameGrams ? { amount: Number(nameGrams[1]), unit: "g" } : null;
  const capacityMatched = expectedCapacity && authoritativeObservations.some((row) => {
    const identity = row.product_identity_observation;
    return identity?.verified_variant_state === "exact" &&
      Number(identity.verified_capacity_amount) === expectedCapacity.amount &&
      String(identity.verified_capacity_unit || "").toLowerCase() === expectedCapacity.unit;
  });
  if (!capacityMatched) blockers.push("VERIFIED_EXACT_CAPACITY_REQUIRED");

  // The Hwahae page and the catalog product must be explicitly linked by the capture.
  const market = product?.market_signals;
  const review = product?.review_signals;
  const ingredients = product?.ingredient_signals;
  const capturedPage = market?.hwahae_review_page;
  if (!isHwahaePage(product?.hwahae_url) || !isHwahaePage(capturedPage) ||
      !samePage(product.hwahae_url, capturedPage)) {
    blockers.push("HWAHAE_PRODUCT_CAPTURE_BINDING_REQUIRED");
  }
  if (!marketValid(market) || !recent(market.updated_at, now)) blockers.push("CURRENT_MARKET_SIGNALS_REQUIRED");
  if (!reviewValid(review) || !recent(review?.updated_at, now)) blockers.push("CURRENT_REVIEW_SIGNALS_REQUIRED");
  if (!record(ingredients) || ingredients.source !== "hwahae_visible_page" ||
      !recent(ingredients.updated_at, now) || !riskValid(ingredients)) {
    blockers.push("VALID_CURRENT_INGREDIENT_SIGNALS_REQUIRED");
  }
  if (!Array.isArray(product?.skin_types) || !product.skin_types.length ||
      !Array.isArray(product?.concerns) || !product.concerns.length) {
    blockers.push("VERIFIED_RECOMMENDATION_SEMANTICS_REQUIRED");
  }
  // Official evidence in source_url or text claims is not a governed Current Fact.
  if (!Array.isArray(confirmedFacts) || !CLEANSER_REQUIRED_FACT_KEYS.every((key) =>
    confirmedFacts.some((fact) => fact?.fact_key === key &&
      currentConfirmedCleanserFact(fact, subject?.subject_id, now)))) {
    blockers.push("GOVERNED_CURRENT_FACT_REQUIRED");
  }

  const allBlockers = uniqueCodes(blockers);
  const allConflicts = uniqueCodes(conflicts);
  const ready = allBlockers.length === 0 && allConflicts.length === 0;
  return Object.freeze({
    version: CLEANSER_ADMISSION_PREFLIGHT_VERSION,
    productId: UUID.test(String(product?.id || "")) ? product.id : null,
    state: ready ? "AUTO_ADMISSION_PREFLIGHT_PASS" : allConflicts.length ? "MANUAL_REVIEW_REQUIRED" : "RESEARCH_OR_EVIDENCE_REQUIRED",
    blockers: Object.freeze(allBlockers),
    conflicts: Object.freeze(allConflicts),
    reviewConfidence: int(market?.review_count) && market.review_count >= 30 ? "standard" : "limited",
    // Preflight is never the recommendation admission authority.
    admissionGranted: false,
    recommendationRuntimeActivated: false,
    requiresGovernedInitialAdmissionGrant: true,
  });
}
