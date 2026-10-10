/**
 * R16I-R4-D0: operator REVIEW PACKET ONLY.
 * This module cannot collect/issue approvals, authorize SQL or call any DB/client.
 * R4-D (real approval) and R4-E (execution) remain out of scope.
 */
import { evaluateR16IR4Preflight } from "./product-offer-r16i-r4-readonly-preflight.mjs";

export const R16I_R4_D0_PACKET_VERSION = "r16i-r4-d0-operator-review-packet-v1";

const REQUIREMENTS = Object.freeze([
  "OFFICIAL_SINGLE_PRODUCT_80ML_SOURCE",
  "RETAILER_EXACT_BUNDLE_COMPOSITION_RAW_SOURCE",
  "GIFT_SERUM_OFFICIAL_NAME_AND_SKU",
  "CURRENT_CHECKOUT_PRICE_PER_PRESENTATION",
  "RETAILER_OPTION_AND_AVAILABILITY_SCOPE",
  "REVIEW_AND_MARKET_SIGNAL_ATTRIBUTION",
  "CATALOG_PRODUCT_ANCHOR_OWNER_DECISION",
  "SOURCE_BINDING_AUTHORITY_REVIEW",
  "OFFERS_LINK_SOURCE_POLICY_REVIEW",
  "EXACT_FUTURE_PRODUCTION_READBACK_AND_CONCURRENCY",
  "FIELD_LEVEL_APPROVAL_WITH_IDENTITY_AND_AUDIT",
  "ROLLBACK_AND_IDEMPOTENCY_PLAN",
  "PDA_164_X_12_RECOMMENDATION_INVARIANCE",
  "SUPPLY_CHAIN_SECURITY_ISSUE_1208_CLOSED"
]);

const FIELD_POLICY = Object.freeze([
  ["products", "size_ml", "ONE_NUMBER_MUST_NOT_REPRESENT_TWO_CONTAINERS"],
  ["products", "price_min", "KIT_PRICE_IS_NOT_SINGLE_PRICE"],
  ["products", "price_max", "KIT_PRICE_IS_NOT_SINGLE_PRICE"],
  ["products", "unit_price_per_10ml", "KEEP_RETAILER_PRICE_DENOMINATOR"],
  ["products", "buy_link", "RETAILER_OFFER_LINK_NOT_SINGLE_PRESENTATION"],
  ["products", "hwahae_url", "RETAILER_LISTING_ONLY"],
  ["products", "source_url", "RETAILER_LISTING_ONLY"],
  ["products", "external_source", "SOURCE_SCOPE_APPROVAL_REQUIRED"],
  ["products", "external_type", "SOURCE_SCOPE_APPROVAL_REQUIRED"],
  ["products", "external_id", "SOURCE_SCOPE_APPROVAL_REQUIRED"],
  ["products", "market_signals", "REVIEWS_MUST_NOT_BE_REATTRIBUTED"],
  ["product_source_bindings", "source_url", "BINDING_IDENTITY_REQUIRED"],
  ["product_source_bindings", "binding_state", "AUTHORITY_MUST_NOT_UPGRADE"],
  ["product_source_bindings", "product_scope_state", "FORMULATION_SCOPE_UNRESOLVED"],
  ["catalog_trust_intake", "trust_state", "REVIEW_STATE_HOLD"],
  ["catalog_trust_intake", "identity_state", "SUBJECT_IDENTITY_NOT_ESTABLISHED"],
  ["product_offers", "new_offer", "SELLER_LISTING_IDENTITY_COLLISION_CHECK"],
  ["product_fact_subjects", "new_subject", "FORMULATION_EVIDENCE_ABSENT"],
  ["recommendation", "ranking", "NO_RUNTIME_ADOPTION_BEFORE_INVARIANCE"]
]);

function immutable(value) {
  if (Array.isArray(value)) {
    value.forEach(immutable);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(immutable);
    return Object.freeze(value);
  }
  return value;
}

function baselineValue(snapshot, entity, field) {
  let value = null;
  if (entity === "products") value = snapshot?.product?.[field] ?? null;
  if (entity === "product_source_bindings") value = snapshot?.bindings?.[0]?.[field] ?? null;
  if (entity === "catalog_trust_intake") value = snapshot?.intakes?.[0]?.[field] ?? null;
  // Never freeze caller-owned SELECT evidence when deep-freezing the returned packet.
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function reviewRows(snapshot) {
  return FIELD_POLICY.map(([entity, field, reason]) => ({
    entity,
    field,
    before: baselineValue(snapshot, entity, field),
    after: null, // NEVER synthesize a new canonical value or an executable diff.
    proposed_operation: null,
    review_reason: reason,
    owner_confirmed: false,
    source_authority_confirmed: false,
    write_authorized: false
  }));
}

/**
 * @param {object} snapshot The pinned R4-A selected-field, read-only SELECT evidence.
 * @param {object} composition The R16I-R3 composition shadow result, never a DB offer.
 */
export function buildR16IR4OperatorReviewPacket(snapshot, composition) {
  const preflight = evaluateR16IR4Preflight(snapshot, composition);
  const valid = preflight.decision === "REVIEW_REQUIRED";
  const unsafeExtraFields = Boolean(snapshot && typeof snapshot === "object" && [
    "approved_changes",
    "operator_approval",
    "approval_signature",
    "execution_plan",
    "write_set",
    "approved_after"
  ].some((key) => Object.prototype.hasOwnProperty.call(snapshot, key)));
  const decision = valid && !unsafeExtraFields ? "REVIEW_REQUIRED" : "BLOCKED";
  const reasons = unsafeExtraFields
    ? [...preflight.reasons, "UNTRUSTED_APPROVAL_OR_EXECUTION_PAYLOAD"]
    : [...preflight.reasons];

  return immutable({
    contract_version: R16I_R4_D0_PACKET_VERSION,
    decision,
    reasons,
    product_id: preflight.product_id,
    prestate_sha256: preflight.prestate_sha256,
    observed_at: typeof snapshot?.observed_at === "string" ? snapshot.observed_at : null,
    source_kind: "HISTORICAL_READ_ONLY_OBSERVATION",
    presentation: {
      official_single: { source: "https://www.snature.kr/product/detail.html?product_no=151", size_ml: 80, unit_price_krw: null },
      retailer_bundle: { source: "https://www.hwahae.co.kr/goods/45194", primary_unit_ml: 80, primary_quantity: 2, cream_total_ml: 160, gift_serum_ml: 10, currently_verified_price_krw: null }
    },
    correction_options: preflight.options.map(({ option, status, requires }) => ({
      option,
      status,
      requires: [...requires],
      selected_by_operator: false,
      option_approved: false,
      write_set: null
    })),
    fields_requiring_separate_approval: valid && !unsafeExtraFields ? reviewRows(snapshot) : [],
    unresolved_requirements: [...REQUIREMENTS],
    operator_review: {
      owner_identity: null,
      reviewer_identity: null,
      selected_option: null,
      field_level_decisions: null,
      approval_event_id: null,
      approval_signed_at: null,
      decision: "NOT_REQUESTED",
      can_approve_in_packet: false
    },
    execution: {
      sql: null,
      transaction_plan: null,
      rollback_sql: null,
      retry_idempotency_key: null,
      optimistic_lock: null,
      fresh_readback: false,
      authorized: false
    },
    assessment: {
      product_id_preserved: true,
      kit_price_not_single_price: true,
      serum_volume_excluded_from_cream: true,
      formulation_identity_unverified: true,
      review_scope_unresolved: true,
      option_a_preferred_not_approved: true,
      operator_decision_pending: true
    },
    production_writes_authorized: false,
    offer_writes_authorized: false,
    subject_writes_authorized: false,
    recommendation_adoption_authorized: false,
    release_ready: false
  });
}
