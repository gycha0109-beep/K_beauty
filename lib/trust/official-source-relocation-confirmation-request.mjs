import { createHash } from "node:crypto";

export const RELOCATION_CONFIRMATION_REQUEST_CONTRACT =
  "trust-phase8h-governed-relocation-confirmation-request-v1";

const SHA256 = /^[0-9a-f]{64}$/;
const OFFICIAL_EXTERNAL_ID = /^official-url-sha256:[0-9a-f]{64}$/;

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}

function same(left, right) {
  return left == null || right == null
    ? left == null && right == null
    : String(left) === String(right);
}

export function buildOfficialSourceRelocationConfirmationRequest(preflight, source) {
  requireCondition(
    preflight?.contract === "trust-phase8h-governed-relocation-preflight-v1",
    "TRUST_PHASE8H_CONFIRMATION_PREFLIGHT_CONTRACT_INVALID",
  );
  requireCondition(
    preflight.status === "READY_FOR_ADMIN_RELOCATION_CONFIRMATION",
    "TRUST_PHASE8H_CONFIRMATION_PREFLIGHT_NOT_READY",
  );
  requireCondition(
    preflight.authority === "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION",
    "TRUST_PHASE8H_CONFIRMATION_PREFLIGHT_AUTHORITY_INVALID",
  );
  requireCondition(
    preflight.mutation_policy === "READ_ONLY_PREFLIGHT_NO_PRODUCTION_WRITE",
    "TRUST_PHASE8H_CONFIRMATION_PREFLIGHT_MUTATION_POLICY_INVALID",
  );
  requireCondition(SHA256.test(String(preflight.prestate_digest || "")), "TRUST_PHASE8H_CONFIRMATION_PRESTATE_DIGEST_INVALID");
  requireCondition(SHA256.test(String(preflight.relocation_plan_digest || "")), "TRUST_PHASE8H_CONFIRMATION_PLAN_DIGEST_INVALID");
  requireCondition(SHA256.test(String(preflight.qualification_digest || "")), "TRUST_PHASE8H_CONFIRMATION_QUALIFICATION_DIGEST_INVALID");
  requireCondition(OFFICIAL_EXTERNAL_ID.test(String(preflight.replacement_external_id || "")), "TRUST_PHASE8H_CONFIRMATION_EXTERNAL_ID_INVALID");

  const current = source?.current_reviewed_binding;
  const replacement = source?.replacement;
  const historical = source?.historical_source;
  const governed = source?.governed_subject;

  requireCondition(current && replacement && historical && governed, "TRUST_PHASE8H_CONFIRMATION_SOURCE_PRESTATE_INVALID");
  requireCondition(preflight.historical_source_id === historical.source_id, "TRUST_PHASE8H_CONFIRMATION_HISTORICAL_SOURCE_MISMATCH");
  requireCondition(preflight.product_id === governed.product_id, "TRUST_PHASE8H_CONFIRMATION_PRODUCT_MISMATCH");
  requireCondition(preflight.subject_id === governed.subject_id, "TRUST_PHASE8H_CONFIRMATION_SUBJECT_MISMATCH");
  requireCondition(preflight.old_binding_id === current.binding_id, "TRUST_PHASE8H_CONFIRMATION_OLD_BINDING_MISMATCH");
  requireCondition(preflight.old_review_id === current.review_id, "TRUST_PHASE8H_CONFIRMATION_OLD_REVIEW_MISMATCH");
  requireCondition(preflight.old_locator === historical.canonical_locator, "TRUST_PHASE8H_CONFIRMATION_OLD_LOCATOR_MISMATCH");
  requireCondition(preflight.replacement_locator === replacement.source_url, "TRUST_PHASE8H_CONFIRMATION_REPLACEMENT_LOCATOR_MISMATCH");

  const expectedExternalId =
    "official-url-sha256:" +
    createHash("sha256").update(replacement.source_url).digest("hex");
  requireCondition(
    preflight.replacement_external_id === expectedExternalId,
    "TRUST_PHASE8H_CONFIRMATION_EXTERNAL_ID_DIGEST_MISMATCH",
  );

  requireCondition(replacement.source_name === current.source_name, "TRUST_PHASE8H_CONFIRMATION_SOURCE_NAME_MISMATCH");
  requireCondition(replacement.external_type === current.external_type, "TRUST_PHASE8H_CONFIRMATION_SOURCE_KIND_MISMATCH");
  requireCondition(same(replacement.market_code, current.market_code), "TRUST_PHASE8H_CONFIRMATION_MARKET_MISMATCH");
  requireCondition(same(replacement.locale, current.locale), "TRUST_PHASE8H_CONFIRMATION_LOCALE_MISMATCH");

  return {
    contract: RELOCATION_CONFIRMATION_REQUEST_CONTRACT,
    expected_prestate_digest: preflight.prestate_digest,
    relocation_plan_digest: preflight.relocation_plan_digest,
    qualification_contract: preflight.qualification_contract,
    qualification_digest: preflight.qualification_digest,
    historical_source_id: preflight.historical_source_id,
    product_id: preflight.product_id,
    subject_id: preflight.subject_id,
    old_binding_id: preflight.old_binding_id,
    old_review_id: preflight.old_review_id,
    old_locator: preflight.old_locator,
    replacement: {
      source_name: replacement.source_name,
      external_type: replacement.external_type,
      external_id: expectedExternalId,
      source_url: replacement.source_url,
      market_code: replacement.market_code ?? null,
      locale: replacement.locale ?? null,
    },
    authority: "ADMIN_CONFIRMATION_REQUEST_REQUIRES_DATABASE_PRESTATE_REVALIDATION",
    mutation_scope: [
      "CREATE_OR_REUSE_REPLACEMENT_PRODUCT_SOURCE_BINDING",
      "CREATE_OR_REUSE_REPLACEMENT_OFFICIAL_SOURCE_REVIEW",
      "RETIRE_OLD_REVIEWED_BINDING_IN_SAME_TRANSACTION",
      "APPEND_IMMUTABLE_RELOCATION_LEDGER",
    ],
    forbidden_mutations: [
      "PRODUCT_EVIDENCE_SOURCE_CANONICAL_LOCATOR",
      "PRODUCT_EVIDENCE_SOURCE_CONTENT_DIGEST",
      "PRODUCT_EVIDENCE_SOURCE_SUBJECT_BINDING",
      "PRODUCT_FACT",
      "PRODUCT_FACT_CURRENT",
      "PRODUCT_FACT_CONFIRMATION",
      "RECOMMENDATION_AUTHORITY",
      "RECOMMENDATION_LOG",
    ],
  };
}
