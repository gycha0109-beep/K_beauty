import {
  buildGroupedRelocationPhase8hAnchorBridge,
} from "./official-source-grouped-relocation-phase8h-anchor-bridge.mjs";

export const GROUPED_RELOCATION_CONFIRMATION_REQUEST_CONTRACT =
  "trust-phase8i4-grouped-relocation-confirmation-request-v1";

const MUTATION_SCOPE = [
  "CREATE_OR_REUSE_REPLACEMENT_PRODUCT_SOURCE_BINDING",
  "CREATE_OR_REUSE_REPLACEMENT_OFFICIAL_SOURCE_REVIEW",
  "RETIRE_OLD_REVIEWED_BINDING_ONCE",
  "APPEND_SINGLE_RELOCATION_AUTHORITY_ROW",
  "APPEND_GROUPED_RELOCATION_HEADER",
  "APPEND_COMPLETE_GROUPED_SOURCE_LINEAGE",
  "APPEND_COMPLETE_GROUPED_INCIDENT_LINEAGE",
  "APPEND_ADMIN_AUDIT_EVENT",
];

const FORBIDDEN_MUTATIONS = [
  "PRODUCT_EVIDENCE_SOURCE_CANONICAL_LOCATOR",
  "PRODUCT_EVIDENCE_SOURCE_CONTENT_DIGEST",
  "PRODUCT_EVIDENCE_SOURCE_SUBJECT_BINDING",
  "PRODUCT_FACT_INSTANCE",
  "PRODUCT_FACT_CURRENT",
  "PRODUCT_FACT_CONFIRMATION",
  "RECOMMENDATION_AUTHORITY",
  "RECOMMENDATION_LOG",
  "SEMANTIC_SAME_CHANGED_RESOLUTION",
];

export function buildGroupedOfficialSourceRelocationConfirmationRequest(input) {
  const bridge = buildGroupedRelocationPhase8hAnchorBridge(input);
  const preflight = bridge.grouped_preflight;

  if (
    preflight.status !== "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION" ||
    preflight.authority !==
      "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION" ||
    preflight.blockers.length !== 0
  ) {
    throw new Error(
      "TRUST_PHASE8I4_GROUPED_CONFIRMATION_REQUIRES_READY_PREFLIGHT",
    );
  }

  if (
    !preflight.qualified_historical_source_id ||
    !preflight.historical_source_ids.includes(
      preflight.qualified_historical_source_id,
    )
  ) {
    throw new Error(
      "TRUST_PHASE8I4_GROUPED_CONFIRMATION_QUALIFIED_SOURCE_INVALID",
    );
  }

  return {
    contract: GROUPED_RELOCATION_CONFIRMATION_REQUEST_CONTRACT,
    case_id: preflight.case_id,
    evaluation_id: preflight.evaluation_id,
    product_id: preflight.product_id,
    subject_id: preflight.subject_id,
    qualified_historical_source_id:
      preflight.qualified_historical_source_id,
    historical_source_ids: [...preflight.historical_source_ids],
    incident_ids: [...preflight.incident_ids],
    expected_group_prestate_digest: preflight.group_prestate_digest,
    group_plan_digest: preflight.group_plan_digest,
    qualification_contract: preflight.qualification_contract,
    qualification_digest: preflight.qualification_digest,
    old_binding_id: preflight.old_binding_id,
    old_review_id: preflight.old_review_id,
    old_locator: preflight.old_locator,
    replacement: {
      source_name: input.replacement.source_name,
      external_type: input.replacement.external_type,
      external_id: preflight.replacement_external_id,
      source_url: preflight.replacement_locator,
      market_code: input.replacement.market_code ?? null,
      locale: input.replacement.locale ?? null,
    },
    preflight_contract: preflight.contract,
    preflight_authority: preflight.authority,
    phase8h_anchor_prestate_digest:
      bridge.phase8h_anchor_preflight.prestate_digest,
    phase8h_anchor_relocation_plan_digest:
      bridge.phase8h_anchor_preflight.relocation_plan_digest,
    phase8h_anchor_confirmation_request:
      bridge.phase8h_anchor_confirmation_request,
    authority:
      "ADMIN_GROUPED_CONFIRMATION_REQUEST_REQUIRES_DATABASE_REVALIDATION",
    mutation_scope: [...MUTATION_SCOPE],
    forbidden_mutations: [...FORBIDDEN_MUTATIONS],
  };
}
