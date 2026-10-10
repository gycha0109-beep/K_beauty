/**
 * R16I-R4 A-C: deterministic, offline, read-only Product/Offer correction preflight.
 * Historical SELECT snapshots are evidence, NOT write authorization or live locks.
 * No runtime/DB client, migrations, RPC, network, SQL executor or product mutations.
 */
import { createHash } from "node:crypto";

export const R16I_R4_VERSION = "r16i-r4-readonly-preflight-v1";
const PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const LISTING = "https://www.hwahae.co.kr/goods/45194";
const BINDING_ID = "53155404-5518-4130-825a-8c918588f37a";
const INTAKE_ID = "ee3b675d-1b92-4144-88e0-2a984b3d7cec";
const SOURCE_PRODUCT_UPDATED = "2026-09-10T09:32:38.713599+09:00";
const SOURCE_BINDING_UPDATED = "2026-09-10T10:10:29.03509+09:00";
const SOURCE_INTAKE_UPDATED = "2026-09-21T00:53:57.499289+09:00";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  }
  return value;
}

export function digestR16IR4Prestate(snapshot) {
  const scope = {
    product: snapshot?.product ?? null,
    bindings: snapshot?.bindings ?? null,
    conflicting_offers: snapshot?.conflicting_offers ?? null,
    subjects: snapshot?.subjects ?? null,
    intakes: snapshot?.intakes ?? null
  };
  return createHash("sha256").update(JSON.stringify(stable(scope))).digest("hex");
}

const OPTIONS = Object.freeze([
  Object.freeze({
    option: "A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
    status: "PREFERRED_DESIGN_ONLY",
    product_id_preserved: true,
    before_after_fields_approved: false,
    requires: ["EXACT_LIVE_ORIGINAL_LISTING", "COMPONENT_SKU_AND_PRICE_SCOPE", "REVIEW_AND_SOURCE_BINDING_OWNERSHIP", "OPERATOR_FIELD_APPROVAL"],
    write_set: null
  }),
  Object.freeze({
    option: "B_SINGLE_PRESENTATION_CATALOG_CORRECTION",
    status: "HOLD_PRICE_LINK_REVIEW_SCOPE",
    product_id_preserved: true,
    before_after_fields_approved: false,
    requires: ["INDEPENDENT_SINGLE_PRICE", "ATOMIC_UNIT_PRICE_AND_LINK_RESCOPE", "RECOMMENDATION_REPLAY", "OPERATOR_FIELD_APPROVAL"],
    write_set: null
  }),
  Object.freeze({
    option: "C_RETAIN_LEGACY_BUNDLE_MEANING",
    status: "HOLD_CATALOG_IDENTITY_BOUNDARY",
    product_id_preserved: true,
    before_after_fields_approved: false,
    requires: ["BUNDLE_PRODUCT_IDENTITY_DECISION", "SINGLE_PRESENTATION_ASSOCIATION", "REVIEW_AND_PRICE_SCOPE", "OPERATOR_FIELD_APPROVAL"],
    write_set: null
  })
]);

function result(decision, reasons, snapshot) {
  return Object.freeze({
    contract_version: R16I_R4_VERSION,
    product_id: PRODUCT_ID,
    decision,
    reasons: Object.freeze(reasons),
    prestate_sha256: snapshot ? digestR16IR4Prestate(snapshot) : null,
    options: OPTIONS,
    proposed_product_size_ml: null,
    proposed_product_price_krw: null,
    proposed_buy_link: null,
    proposed_offer_id: null,
    proposed_subject_id: null,
    planned_sql: null,
    rollback_sql: null,
    approval_token: null,
    optimistic_write_lock: null,
    live_readback_verified: false,
    production_writes_authorized: false,
    offer_writes_authorized: false,
    subject_writes_authorized: false,
    ranking_writes_authorized: false,
    recommendation_delta_authorized: false
  });
}

const matchesTime = (actual, expected) =>
  typeof actual === "string" && Number.isFinite(Date.parse(actual)) &&
  Date.parse(actual) === Date.parse(expected);

function productMatches(p) {
  return p?.id === PRODUCT_ID && p.name === "아쿠아 스쿠알란 수분크림" &&
    p.brand === "에스네이처" && p.category === "moisturizer_cream" &&
    p.normalized_brand === "에스네이처" &&
    p.normalized_name === "아쿠아 스쿠알란 수분크림" &&
    p.size_ml === 160 && p.price_min === 29900 && p.price_max === 29900 &&
    p.unit_price_per_10ml === 1868.75 &&
    p.buy_link === LISTING && p.hwahae_url === LISTING &&
    p.source_url === LISTING && p.external_source === "hwahae" &&
    p.external_type === "goods" && p.external_id === "45194" &&
    matchesTime(p.updated_at, SOURCE_PRODUCT_UPDATED) &&
    p.market_signals?.source === "hwahae_visible_page" &&
    p.market_signals?.rating === 4.58 &&
    p.market_signals?.review_count === 41475 &&
    p.market_signals?.updated_at === "2026-05-26" &&
    p.market_signals?.rating_distribution != null &&
    Object.keys(p.market_signals.rating_distribution).length === 0;
}

function bindingMatches(bindings) {
  return Array.isArray(bindings) && bindings.length === 1 &&
    bindings[0].binding_id === BINDING_ID &&
    bindings[0].product_id === PRODUCT_ID &&
    bindings[0].source_name === "hwahae" &&
    bindings[0].external_type === "goods" &&
    bindings[0].external_id === "45194" &&
    bindings[0].source_url === LISTING &&
    bindings[0].binding_state === "resolved" &&
    bindings[0].product_scope_state === "product_subject_unresolved" &&
    matchesTime(bindings[0].updated_at, SOURCE_BINDING_UPDATED);
}

function intakeMatches(intakes) {
  return Array.isArray(intakes) && intakes.length === 1 &&
    intakes[0].id === INTAKE_ID &&
    intakes[0].product_id === PRODUCT_ID &&
    intakes[0].subject_id === null &&
    intakes[0].identity_state === "SUBJECT_CREATION_REQUIRED" &&
    intakes[0].trust_state === "REVIEW_REQUIRED" &&
    matchesTime(intakes[0].updated_at, SOURCE_INTAKE_UPDATED);
}

export function evaluateR16IR4Preflight(snapshot, compositionDecision) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
      snapshot.contract_version !== R16I_R4_VERSION ||
      snapshot.source_kind !== "PRODUCTION_READ_ONLY_SELECT" ||
      snapshot.allow_production_write !== false ||
      snapshot.operator_approval_granted !== false ||
      snapshot.current_price_verified !== false ||
      snapshot.physical_components_verified !== false ||
      snapshot.write_commands !== null ||
      !Number.isFinite(Date.parse(snapshot.observed_at || ""))) {
    return result("BLOCKED", ["INVALID_READ_ONLY_SNAPSHOT_CONTRACT"], snapshot);
  }
  const reasons = [];
  if (!productMatches(snapshot.product)) reasons.push("PRODUCT_IDENTITY_PRICE_OR_REVISION_DRIFT");
  if (!bindingMatches(snapshot.bindings)) reasons.push("SOURCE_BINDING_REVISION_OR_SCOPE_DRIFT");
  if (!intakeMatches(snapshot.intakes)) reasons.push("INTAKE_REVISION_OR_REVIEW_SCOPE_DRIFT");
  if (!Array.isArray(snapshot.conflicting_offers) || snapshot.conflicting_offers.length !== 0)
    reasons.push("TARGET_OFFER_OR_SELLER_LISTING_COLLISION");
  if (!Array.isArray(snapshot.subjects) || snapshot.subjects.length !== 0)
    reasons.push("UNAPPROVED_PRODUCT_FACT_SUBJECT");
  // An unrelated Offer insertion must not invalidate this Product's exact read-only guard.
  if (!Number.isSafeInteger(snapshot.total_offer_count) || snapshot.total_offer_count < 0)
    reasons.push("INVALID_GLOBAL_OFFER_OBSERVATION");
  if (compositionDecision?.decision !== "REVIEW_REQUIRED" ||
      compositionDecision?.product_id !== PRODUCT_ID ||
      compositionDecision?.listing_id !== "45194" ||
      compositionDecision?.primary_single_unit_ml !== 80 ||
      compositionDecision?.primary_units !== 2 ||
      compositionDecision?.primary_total_ml !== 160 ||
      compositionDecision?.gift_total_ml !== 10 ||
      compositionDecision?.historical_kit_unit_price_per_10ml !== 1868.75 ||
      compositionDecision?.display_price_krw !== null ||
      compositionDecision?.normalized_product_size_ml !== null ||
      compositionDecision?.catalog_writes_authorized !== false ||
      compositionDecision?.offer_writes_authorized !== false ||
      compositionDecision?.subject_writes_authorized !== false ||
      compositionDecision?.ranking_writes_authorized !== false)
    reasons.push("COMPOSITION_SHADOW_NOT_SAFE_FOR_REVIEW");
  if (reasons.length) return result("BLOCKED", reasons, snapshot);
  return result("REVIEW_REQUIRED", [
    "HISTORICAL_SNAPSHOT_ONLY_NOT_LIVE_WRITE_LOCK",
    "CURRENT_CHECKOUT_PRICE_AND_COMPONENT_SKU_UNVERIFIED",
    "REVIEW_LINK_AND_MARKET_SIGNALS_NOT_RESCOPE_APPROVED",
    "EXPLICIT_OPERATOR_APPROVAL_NOT_GRANTED",
    "SUPPLY_CHAIN_SECURITY_ISSUE_1208_UNRESOLVED"
  ], snapshot);
}
