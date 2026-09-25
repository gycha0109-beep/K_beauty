import { createHash } from "node:crypto";

export const RELOCATION_PREFLIGHT_CONTRACT = "trust-phase8h-governed-relocation-preflight-v1";
export const QUALIFICATION_CONTRACT = "trust-phase8h-source-identity-qualification-v1";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function same(left, right) {
  return left == null || right == null ? left == null && right == null : String(left) === String(right);
}

function httpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function add(blockers, condition, code) {
  if (!condition) blockers.push(code);
}

export function preflightOfficialSourceRelocation(input) {
  if (!input || input.contract !== RELOCATION_PREFLIGHT_CONTRACT) {
    throw new Error("TRUST_PHASE8H_RELOCATION_PREFLIGHT_CONTRACT_INVALID");
  }

  for (const key of [
    "qualification",
    "historical_source",
    "historical_subject_binding",
    "governed_subject",
    "current_reviewed_binding",
    "replacement",
  ]) {
    if (!input[key] || typeof input[key] !== "object") {
      throw new Error(`TRUST_PHASE8H_RELOCATION_PREFLIGHT_${key.toUpperCase()}_INVALID`);
    }
  }

  const q = input.qualification;
  const hs = input.historical_source;
  const hb = input.historical_subject_binding;
  const gs = input.governed_subject;
  const cb = input.current_reviewed_binding;
  const rp = input.replacement;
  const blockers = [];

  add(blockers, q.contract === QUALIFICATION_CONTRACT, "QUALIFICATION_CONTRACT_MISMATCH");
  add(blockers, q.disposition === "QUALIFIED_EXACT", "QUALIFICATION_NOT_EXACT");
  add(blockers, q.authority === "QUALIFICATION_EVIDENCE_ONLY_REQUIRES_GOVERNED_RELOCATION", "QUALIFICATION_AUTHORITY_MISMATCH");
  add(blockers, /^[0-9a-f]{64}$/.test(String(q.qualification_digest || "")), "QUALIFICATION_DIGEST_INVALID");

  add(blockers, q.historical_source_id === hs.source_id, "HISTORICAL_SOURCE_ID_MISMATCH");
  add(blockers, q.historical_locator === hs.canonical_locator, "HISTORICAL_LOCATOR_MISMATCH");
  add(blockers, q.product_id === gs.product_id, "QUALIFICATION_PRODUCT_MISMATCH");
  add(blockers, q.subject_id === gs.subject_id, "QUALIFICATION_SUBJECT_MISMATCH");

  add(blockers, hb.source_id === hs.source_id, "HISTORICAL_BINDING_SOURCE_MISMATCH");
  add(blockers, hb.product_id === gs.product_id, "HISTORICAL_BINDING_PRODUCT_MISMATCH");
  add(blockers, hb.subject_id === gs.subject_id, "HISTORICAL_BINDING_SUBJECT_MISMATCH");
  add(blockers, hb.binding_state === "exact_subject_match", "HISTORICAL_BINDING_NOT_EXACT");
  add(blockers, ["equivalent", "narrower"].includes(hb.scope_relation), "HISTORICAL_BINDING_SCOPE_INVALID");

  add(blockers, gs.identity_status === "resolved", "GOVERNED_SUBJECT_NOT_RESOLVED");
  add(blockers, gs.current_state === "current", "GOVERNED_SUBJECT_NOT_CURRENT");
  add(blockers, Boolean(gs.formulation_revision_key), "GOVERNED_FORMULATION_MISSING");

  add(blockers, cb.product_id === gs.product_id, "REVIEWED_BINDING_PRODUCT_MISMATCH");
  add(blockers, cb.source_url === hs.canonical_locator, "REVIEWED_BINDING_HISTORICAL_LOCATOR_MISMATCH");
  add(blockers, cb.binding_state === "resolved", "REVIEWED_BINDING_NOT_RESOLVED");
  add(blockers, cb.binding_method === "trust_official_source_review_v1", "REVIEWED_BINDING_METHOD_INVALID");
  add(blockers, cb.product_scope_state === "product", "REVIEWED_BINDING_SCOPE_INVALID");
  add(blockers, /^[a-z0-9][a-z0-9_-]{0,54}_official$/.test(String(cb.source_name || "")), "REVIEWED_BINDING_SOURCE_NAME_INVALID");
  add(blockers, cb.review_version === "trust-official-source-review-v1", "REVIEW_RECORD_VERSION_INVALID");
  add(blockers, cb.review_subject_id === gs.subject_id, "REVIEW_RECORD_SUBJECT_MISMATCH");
  add(blockers, same(cb.review_subject_market, gs.market_applicability), "REVIEW_RECORD_SUBJECT_MARKET_MISMATCH");
  add(blockers, same(cb.review_source_market, cb.market_code), "REVIEW_RECORD_SOURCE_MARKET_MISMATCH");
  add(blockers, ["equivalent", "narrower"].includes(cb.review_scope_relation), "REVIEW_RECORD_SCOPE_INVALID");
  add(blockers, same(cb.review_variant_key, gs.variant_key), "REVIEW_RECORD_VARIANT_MISMATCH");
  add(blockers, same(cb.review_formulation_revision_key, gs.formulation_revision_key), "REVIEW_RECORD_FORMULATION_MISMATCH");
  add(blockers, cb.review_source_kind === cb.external_type, "REVIEW_RECORD_SOURCE_KIND_MISMATCH");

  add(blockers, httpsUrl(rp.source_url), "REPLACEMENT_HTTPS_REQUIRED");
  add(blockers, rp.source_url !== hs.canonical_locator, "REPLACEMENT_LOCATOR_UNCHANGED");
  add(blockers, rp.source_url === q.candidate_locator, "REPLACEMENT_CANDIDATE_MISMATCH");
  add(blockers, rp.source_name === cb.source_name, "REPLACEMENT_SOURCE_NAME_MISMATCH");
  add(blockers, rp.external_type === cb.external_type, "REPLACEMENT_SOURCE_KIND_MISMATCH");
  add(blockers, q.candidate_source_kind === rp.external_type, "QUALIFICATION_SOURCE_KIND_MISMATCH");
  add(blockers, same(rp.market_code, cb.market_code), "REPLACEMENT_MARKET_MISMATCH");
  add(blockers, same(rp.locale, cb.locale), "REPLACEMENT_LOCALE_MISMATCH");

  const prestate = {
    qualification_digest: q.qualification_digest,
    historical_source: hs,
    historical_subject_binding: hb,
    governed_subject: gs,
    current_reviewed_binding: cb,
  };
  const prestateDigest = digest(prestate);
  const replacementExternalId = httpsUrl(rp.source_url)
    ? `official-url-sha256:${createHash("sha256").update(rp.source_url).digest("hex")}`
    : null;

  const result = {
    contract: RELOCATION_PREFLIGHT_CONTRACT,
    status: blockers.length === 0 ? "READY_FOR_ADMIN_RELOCATION_CONFIRMATION" : "HOLD",
    blockers,
    historical_source_id: hs.source_id,
    product_id: gs.product_id,
    subject_id: gs.subject_id,
    old_binding_id: cb.binding_id,
    old_review_id: cb.review_id,
    old_locator: hs.canonical_locator,
    replacement_locator: rp.source_url,
    replacement_external_id: replacementExternalId,
    qualification_contract: q.contract,
    qualification_digest: q.qualification_digest,
    prestate_digest: prestateDigest,
    mutation_policy: "READ_ONLY_PREFLIGHT_NO_PRODUCTION_WRITE",
    authority: blockers.length === 0
      ? "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION"
      : "NON_AUTHORITATIVE_HOLD",
  };

  return {
    ...result,
    relocation_plan_digest: digest(result),
  };
}
