import {
  preflightGroupedOfficialSourceRelocation,
} from "./official-source-grouped-relocation-preflight.mjs";
import {
  preflightOfficialSourceRelocation,
} from "./official-source-relocation-preflight.mjs";
import {
  buildOfficialSourceRelocationConfirmationRequest,
} from "./official-source-relocation-confirmation-request.mjs";

export const GROUPED_RELOCATION_PHASE8H_ANCHOR_BRIDGE_CONTRACT =
  "trust-phase8i4-phase8h-anchor-bridge-v1";

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}

function phase8hReviewedBinding(reviewed) {
  return {
    binding_id: reviewed.binding_id,
    review_id: reviewed.review_id,
    product_id: reviewed.product_id,
    source_name: reviewed.source_name,
    external_type: reviewed.external_type,
    source_url: reviewed.source_url,
    market_code: reviewed.market_code ?? null,
    locale: reviewed.locale ?? null,
    binding_state: reviewed.binding_state,
    binding_method: reviewed.binding_method,
    product_scope_state: reviewed.product_scope_state,
    review_subject_id: reviewed.subject_id,
    review_subject_market: reviewed.review_subject_market ?? null,
    review_source_market: reviewed.review_source_market ?? null,
    review_scope_relation: reviewed.review_scope_relation,
    review_variant_key: reviewed.review_variant_key ?? null,
    review_formulation_revision_key:
      reviewed.review_formulation_revision_key ?? null,
    review_source_kind: reviewed.review_source_kind,
    review_version: reviewed.review_version,
  };
}

function phase8hHistoricalSource(row) {
  return {
    source_id: row.source_id,
    canonical_locator: row.canonical_locator,
    publisher: row.publisher ?? null,
    source_kind: row.source_kind ?? null,
    market: row.market ?? null,
    locale: row.locale ?? null,
    content_digest: row.content_digest ?? null,
  };
}

function phase8hHistoricalSubjectBinding(row) {
  return {
    binding_id: row.source_subject_binding_id,
    source_id: row.source_id,
    product_id: row.product_id,
    subject_id: row.subject_id,
    binding_state: row.binding_state,
    scope_relation: row.scope_relation,
  };
}

export function buildGroupedRelocationPhase8hAnchorBridge(input) {
  const groupedPreflight =
    preflightGroupedOfficialSourceRelocation(input);

  requireCondition(
    groupedPreflight.status ===
      "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION",
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_GROUPED_PREFLIGHT_NOT_READY",
  );
  requireCondition(
    groupedPreflight.authority ===
      "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION",
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_GROUPED_AUTHORITY_INVALID",
  );

  const anchorId = groupedPreflight.qualified_historical_source_id;
  const anchorRow = input.historical_sources.find(
    (row) => String(row.source_id) === String(anchorId),
  );
  requireCondition(
    Boolean(anchorRow),
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_SOURCE_NOT_FOUND",
  );

  const exact = input.evaluation?.qualified_exact;
  requireCondition(
    exact?.historical_source_id === anchorId,
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_QUALIFICATION_SOURCE_MISMATCH",
  );

  const phase8hSource = {
    contract: "trust-phase8h-governed-relocation-preflight-v1",
    qualification: exact,
    historical_source: phase8hHistoricalSource(anchorRow),
    historical_subject_binding:
      phase8hHistoricalSubjectBinding(anchorRow),
    governed_subject: input.governed_subject,
    current_reviewed_binding:
      phase8hReviewedBinding(input.current_reviewed_binding),
    replacement: input.replacement,
  };

  const phase8hPreflight =
    preflightOfficialSourceRelocation(phase8hSource);

  requireCondition(
    phase8hPreflight.status ===
      "READY_FOR_ADMIN_RELOCATION_CONFIRMATION",
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_PHASE8H_PREFLIGHT_NOT_READY",
  );
  requireCondition(
    phase8hPreflight.historical_source_id === anchorId,
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_PHASE8H_SOURCE_MISMATCH",
  );
  requireCondition(
    phase8hPreflight.product_id === groupedPreflight.product_id &&
      phase8hPreflight.subject_id === groupedPreflight.subject_id,
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_PHASE8H_SCOPE_MISMATCH",
  );
  requireCondition(
    phase8hPreflight.old_binding_id ===
      groupedPreflight.old_binding_id &&
      phase8hPreflight.old_review_id ===
        groupedPreflight.old_review_id,
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_PHASE8H_BINDING_MISMATCH",
  );
  requireCondition(
    phase8hPreflight.replacement_locator ===
      groupedPreflight.replacement_locator &&
      phase8hPreflight.replacement_external_id ===
        groupedPreflight.replacement_external_id,
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_PHASE8H_REPLACEMENT_MISMATCH",
  );
  requireCondition(
    phase8hPreflight.qualification_digest ===
      groupedPreflight.qualification_digest,
    "TRUST_PHASE8I4_ANCHOR_BRIDGE_PHASE8H_QUALIFICATION_MISMATCH",
  );

  const phase8hConfirmationRequest =
    buildOfficialSourceRelocationConfirmationRequest(
      phase8hPreflight,
      phase8hSource,
    );

  return {
    contract: GROUPED_RELOCATION_PHASE8H_ANCHOR_BRIDGE_CONTRACT,
    grouped_preflight: groupedPreflight,
    qualified_historical_source_id: anchorId,
    phase8h_anchor_preflight: phase8hPreflight,
    phase8h_anchor_confirmation_request:
      phase8hConfirmationRequest,
    authority:
      "BRIDGE_ONLY_REQUIRES_FUTURE_DATABASE_GROUP_REVALIDATION",
  };
}
