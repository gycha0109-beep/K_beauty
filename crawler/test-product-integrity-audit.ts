import assert from "node:assert/strict";

import {
  auditProductIntegrity,
  type IntegrityCurrentFact,
  type IntegrityLegacyOfferClassification,
  type IntegrityOffer,
  type IntegrityProduct,
  type IntegritySourceBinding,
  type IntegritySubject,
} from "./lib/product-integrity-audit.js";

function product(overrides: Partial<IntegrityProduct> = {}): IntegrityProduct {
  return {
    id: "p1",
    brand: "Brand",
    name: "Sun",
    normalized_brand: "brand",
    normalized_name: "sun",
    buy_link: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A1",
    price_min: 20000,
    price_max: 20000,
    external_source: "hwahae",
    external_type: "product",
    external_id: "1",
    spf_value: "SPF50+",
    uva_label: "PA++++",
    uv_filter_type: "mineral",
    ...overrides,
  };
}

function classification(
  overrides: Partial<IntegrityLegacyOfferClassification> = {},
): IntegrityLegacyOfferClassification {
  return {
    productId: "p1",
    migrationDecision: "LINK_ONLY_READY",
    linkRole: "seller_page",
    linkState: "verified",
    sellerKey: "oliveyoung",
    listingId: "A1",
    canonicalListingUrl: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A1",
    reasons: ["known_seller_product_route"],
    ...overrides,
  };
}

function binding(overrides: Partial<IntegritySourceBinding> = {}): IntegritySourceBinding {
  return {
    product_id: "p1",
    source_name: "hwahae",
    external_type: "product",
    external_id: "1",
    binding_state: "resolved",
    product_scope_state: "product_subject_unresolved",
    ...overrides,
  };
}

function offer(overrides: Partial<IntegrityOffer> = {}): IntegrityOffer {
  return {
    offer_id: "o1",
    product_id: "p1",
    seller_key: "oliveyoung",
    listing_id: "A1",
    listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A1",
    offer_state: "current",
    availability_state: "unknown",
    product_scope_state: "product_subject_unresolved",
    ...overrides,
  };
}

function subject(overrides: Partial<IntegritySubject> = {}): IntegritySubject {
  return {
    subject_id: "s1",
    product_id: "p1",
    identity_status: "resolved",
    current_state: "current",
    market_applicability: "KR",
    variant_key: "SUN_KR",
    formulation_revision_key: "v1",
    ...overrides,
  };
}

function fact(overrides: Partial<IntegrityCurrentFact> = {}): IntegrityCurrentFact {
  return {
    product_id: "p1",
    subject_id: "s1",
    fact_key: "spf_value",
    semantic_status: "supported",
    market: "KR",
    value_number: 50,
    value_enum: null,
    ...overrides,
  };
}

{
  const audit = auditProductIntegrity({
    products: [product()],
    sourceBindings: [binding()],
    offers: [offer()],
    subjects: [subject()],
    currentFacts: [
      fact(),
      fact({ fact_key: "uva_label", value_number: null, value_enum: "PA++++" }),
      fact({ fact_key: "uv_filter_type", value_number: null, value_enum: "mineral" }),
    ],
    legacyOfferClassifications: [classification()],
  });
  assert.equal(audit.severityCounts.blocker, 0);
  assert.equal(audit.issueCounts.LEGACY_FACT_VALUE_DIVERGENCE ?? 0, 0);
  assert.equal(audit.rows[0]?.commerceStatus, "offer_ready");
}

{
  const audit = auditProductIntegrity({
    products: [product()],
    sourceBindings: [],
    offers: [],
    subjects: [subject()],
    currentFacts: [fact()],
    legacyOfferClassifications: [
      classification({ migrationDecision: "REVIEW_REQUIRED", linkState: "unknown" }),
    ],
  });
  assert.equal(audit.issueCounts.LEGACY_EXTERNAL_BINDING_MISSING, 1);
  assert.equal(audit.issueCounts.CURRENT_OFFER_MISSING, 1);
  assert.equal(audit.issueCounts.LEGACY_BUY_LINK_REVIEW_REQUIRED, 1);
  assert.equal(audit.rows[0]?.identityStatus, "review");
  assert.equal(audit.rows[0]?.commerceStatus, "review");
}

{
  const audit = auditProductIntegrity({
    products: [product({ uva_label: "Broad Spectrum" })],
    sourceBindings: [binding()],
    offers: [offer()],
    subjects: [subject()],
    currentFacts: [fact({ fact_key: "uva_label", value_number: null, value_enum: "PA++++" })],
    legacyOfferClassifications: [classification()],
  });
  const divergence = audit.rows[0]?.issues.find(
    (issue) => issue.code === "LEGACY_FACT_VALUE_DIVERGENCE",
  );
  assert.ok(divergence);
  assert.equal(divergence.comparisonAuthority, false);
  assert.equal(divergence.severity, "review");
}

{
  const audit = auditProductIntegrity({
    products: [product({ spf_value: null })],
    sourceBindings: [binding()],
    offers: [offer()],
    subjects: [subject()],
    currentFacts: [fact()],
    legacyOfferClassifications: [classification()],
  });
  assert.equal(audit.issueCounts.CURRENT_FACT_LEGACY_MISSING, 1);
}

{
  const p2 = product({ id: "p2", external_id: "2", normalized_name: "sun2" });
  const audit = auditProductIntegrity({
    products: [product(), p2],
    sourceBindings: [binding(), binding({ product_id: "p2", external_id: "2" })],
    offers: [offer(), offer({ offer_id: "o2", product_id: "p2" })],
    subjects: [],
    currentFacts: [],
    legacyOfferClassifications: [classification(), classification({ productId: "p2" })],
  });
  assert.equal(audit.issueCounts.CURRENT_OFFER_DUPLICATE_SELLER_LISTING, 2);
  assert.equal(audit.severityCounts.blocker, 2);
}

console.log("Product integrity audit verifier: PASS");
