import { createHash } from "node:crypto";

export const REAL_CANARY_CONTRACT =
  "trust-phase8i4g-first-real-ready-for-8i4-canary-v1";
export const READ_ONLY_SNAPSHOT_CONTRACT =
  "trust-phase8i4g-read-only-canary-snapshot-v1";

const SCHEDULED_REQUEST =
  /^phase8i3:phase8i3e-scheduled-([0-9]+)-([0-9]+):([0-9a-f-]{36})$/i;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableCanaryDigest(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

export function sortedUnique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort();
}

export function classifyRealCanaryProvenance(evaluation) {
  const requestId = String(evaluation?.request_id || "");
  const match = requestId.match(SCHEDULED_REQUEST);
  if (!match) {
    return {
      kind: "NOT_REAL_SCHEDULED_CANARY",
      eligible: false,
      request_id: requestId || null,
      github_run_id: null,
      run_attempt: null,
      case_id: evaluation?.case_id ?? null,
    };
  }

  const [, runId, attempt, requestCaseId] = match;
  if (
    String(evaluation?.case_id || "").toLowerCase() !==
    requestCaseId.toLowerCase()
  ) {
    return {
      kind: "SCHEDULED_REQUEST_CASE_MISMATCH",
      eligible: false,
      request_id: requestId,
      github_run_id: runId,
      run_attempt: Number(attempt),
      case_id: evaluation?.case_id ?? null,
    };
  }

  return {
    kind: "PHASE8I3E_SCHEDULED_REAL",
    eligible: true,
    request_id: requestId,
    github_run_id: runId,
    run_attempt: Number(attempt),
    case_id: requestCaseId.toLowerCase(),
  };
}

export function isRealReadyFor8I4(evaluation) {
  return (
    evaluation?.result_kind === "READY_FOR_8I4" &&
    classifyRealCanaryProvenance(evaluation).eligible
  );
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function selectFirstRealCanaryCandidate(
  evaluations,
  {
    groupedEvaluationIds = [],
    preflightReadyEvaluationIds = null,
  } = {},
) {
  const grouped = new Set(groupedEvaluationIds.map(String));
  const ready =
    preflightReadyEvaluationIds == null
      ? null
      : new Set(preflightReadyEvaluationIds.map(String));

  const candidates = (evaluations || [])
    .filter(isRealReadyFor8I4)
    .filter((row) => !grouped.has(String(row.evaluation_id)))
    .filter(
      (row) => ready == null || ready.has(String(row.evaluation_id)),
    )
    .sort((left, right) => {
      const byTime = timestamp(left.created_at) - timestamp(right.created_at);
      if (byTime !== 0) return byTime;
      return String(left.evaluation_id).localeCompare(
        String(right.evaluation_id),
      );
    });

  return candidates[0] ?? null;
}

export function buildReadOnlyCanarySnapshot({
  capturedAt,
  evaluations,
  groupedRelocations,
  caseLineage = {},
  counts = {},
}) {
  const groupedEvaluationIds = (groupedRelocations || []).map(
    (row) => row.evaluation_id,
  );
  const first = selectFirstRealCanaryCandidate(evaluations, {
    groupedEvaluationIds,
  });

  const candidates = (evaluations || [])
    .filter(isRealReadyFor8I4)
    .filter(
      (row) => !groupedEvaluationIds.map(String).includes(String(row.evaluation_id)),
    )
    .sort((left, right) => timestamp(left.created_at) - timestamp(right.created_at))
    .map((row, index) => {
      const lineage = caseLineage[String(row.case_id)] || {};
      const provenance = classifyRealCanaryProvenance(row);
      return {
        case_id: row.case_id,
        evaluation_id: row.evaluation_id,
        created_at: row.created_at,
        product_id: lineage.product_id ?? null,
        subject_id: lineage.subject_id ?? null,
        candidate_locator: row.candidate_locator ?? null,
        qualified_historical_source_id:
          row.result_payload?.qualified_historical_source_id ?? null,
        historical_source_ids: sortedUnique(lineage.source_ids),
        incident_ids: sortedUnique(lineage.incident_ids),
        provenance,
        canary_rank: index + 1,
        state:
          index === 0
            ? "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT"
            : "QUEUED_BEHIND_FIRST_REAL_CANARY",
      };
    });

  const snapshot = {
    contract: READ_ONLY_SNAPSHOT_CONTRACT,
    phase: "8I-4G",
    captured_at: capturedAt,
    state:
      candidates.length === 0
        ? "WAITING_FOR_REAL_READY_FOR_8I4"
        : "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT",
    authority: "READ_ONLY_DETECTION_NO_CONFIRMATION",
    automatic_confirmation: false,
    candidate_count: candidates.length,
    first_candidate_evaluation_id: first?.evaluation_id ?? null,
    candidates,
    counts,
  };

  return {
    ...snapshot,
    snapshot_digest: stableCanaryDigest(snapshot),
  };
}

export function verifyCanaryProtectedAuthorityInvariant(before, after) {
  const protectedKeys = [
    "product_fact_instances",
    "product_fact_current",
    "product_fact_confirmations",
    "evidence_sources",
    "evidence_subject_bindings",
    "recommendation_logs",
  ];
  const violations = [];

  for (const key of protectedKeys) {
    if (before?.protected?.[key] !== after?.protected?.[key]) {
      violations.push(`PROTECTED_${key.toUpperCase()}_CHANGED`);
    }
  }

  for (const key of [
    "historical_evidence_source_digest",
    "historical_evidence_binding_digest",
    "product_fact_scope_digest",
    "recommendation_scope_digest",
  ]) {
    if (before?.protected?.[key] !== after?.protected?.[key]) {
      violations.push(`PROTECTED_${key.toUpperCase()}_CHANGED`);
    }
  }

  const expectedSourceCount = Number(before?.candidate?.historical_source_count);
  const expectedIncidentCount = Number(before?.candidate?.incident_count);

  if (after?.authority?.relocation_count !== before?.authority?.relocation_count + 1) {
    violations.push("RELOCATION_COUNT_DELTA_INVALID");
  }
  if (
    after?.authority?.grouped_relocation_count !==
    before?.authority?.grouped_relocation_count + 1
  ) {
    violations.push("GROUPED_RELOCATION_COUNT_DELTA_INVALID");
  }
  if (
    Number.isInteger(expectedSourceCount) &&
    after?.authority?.grouped_source_count !==
      before?.authority?.grouped_source_count + expectedSourceCount
  ) {
    violations.push("GROUPED_SOURCE_COUNT_DELTA_INVALID");
  }
  if (
    Number.isInteger(expectedIncidentCount) &&
    after?.authority?.grouped_incident_count !==
      before?.authority?.grouped_incident_count + expectedIncidentCount
  ) {
    violations.push("GROUPED_INCIDENT_COUNT_DELTA_INVALID");
  }

  if (before?.candidate?.old_binding_state !== "resolved") {
    violations.push("OLD_BINDING_PRESTATE_NOT_RESOLVED");
  }
  if (after?.candidate?.old_binding_state !== "retired") {
    violations.push("OLD_BINDING_POSTSTATE_NOT_RETIRED");
  }
  if (after?.candidate?.replacement_binding_state !== "resolved") {
    violations.push("REPLACEMENT_BINDING_POSTSTATE_NOT_RESOLVED");
  }

  return {
    contract: "trust-phase8i4g-authority-invariant-verification-v1",
    result: violations.length === 0 ? "PASS" : "FAIL",
    violations,
  };
}

export function verifyCanaryGroupedLineage({
  expectedSourceIds,
  expectedIncidentIds,
  lineage,
}) {
  const expectedSources = sortedUnique(expectedSourceIds);
  const expectedIncidents = sortedUnique(expectedIncidentIds);
  const actualSources = sortedUnique(
    lineage?.sources?.map((row) => row.source_id),
  );
  const actualIncidents = sortedUnique(
    lineage?.incidents?.map((row) => row.incident_id),
  );
  const violations = [];

  if (JSON.stringify(expectedSources) !== JSON.stringify(actualSources)) {
    violations.push("GROUPED_SOURCE_SET_MISMATCH");
  }
  if (JSON.stringify(expectedIncidents) !== JSON.stringify(actualIncidents)) {
    violations.push("GROUPED_INCIDENT_SET_MISMATCH");
  }
  for (const incident of lineage?.incidents || []) {
    if (!actualSources.includes(String(incident.source_id))) {
      violations.push("GROUPED_INCIDENT_SOURCE_NOT_IN_GROUP");
      break;
    }
  }

  return {
    contract: "trust-phase8i4g-grouped-lineage-verification-v1",
    result: violations.length === 0 ? "PASS" : "FAIL",
    violations,
    expected_source_ids: expectedSources,
    actual_source_ids: actualSources,
    expected_incident_ids: expectedIncidents,
    actual_incident_ids: actualIncidents,
  };
}

export function verifyCanaryIdempotentReplay({
  firstResult,
  replayResult,
  beforeReplay,
  afterReplay,
}) {
  const violations = [];
  if (firstResult?.status !== "confirmed") {
    violations.push("FIRST_CONFIRMATION_NOT_CONFIRMED");
  }
  if (replayResult?.status !== "confirmed" || replayResult?.idempotent !== true) {
    violations.push("REPLAY_NOT_IDEMPOTENT_CONFIRMED");
  }
  for (const key of ["groupId", "relocationId", "replacementBindingId", "replacementReviewId"]) {
    if (String(firstResult?.[key] ?? "") !== String(replayResult?.[key] ?? "")) {
      violations.push(`REPLAY_${key.toUpperCase()}_MISMATCH`);
    }
  }

  const stableKeys = [
    "relocation_count",
    "grouped_relocation_count",
    "grouped_source_count",
    "grouped_incident_count",
    "product_source_binding_count",
    "official_source_review_count",
    "product_fact_instances",
    "product_fact_current",
    "product_fact_confirmations",
    "evidence_sources",
    "evidence_subject_bindings",
    "recommendation_logs",
  ];
  for (const key of stableKeys) {
    if (beforeReplay?.[key] !== afterReplay?.[key]) {
      violations.push(`REPLAY_${key.toUpperCase()}_CHANGED`);
    }
  }

  return {
    contract: "trust-phase8i4g-idempotent-replay-verification-v1",
    result: violations.length === 0 ? "PASS" : "FAIL",
    violations,
  };
}

export function verifyPhase8h3CanaryHandoff({ relocation, downstream }) {
  const violations = [];
  if (relocation?.status !== "confirmed") {
    violations.push("GROUPED_RELOCATION_NOT_CONFIRMED");
  }
  if (!relocation?.relocation_id) {
    violations.push("RELOCATION_ID_REQUIRED");
  }
  if (
    String(relocation?.relocation_id ?? "") !==
    String(downstream?.relocation_id ?? "")
  ) {
    violations.push("DOWNSTREAM_RELOCATION_ID_MISMATCH");
  }
  if (
    String(relocation?.product_id ?? "") !==
    String(downstream?.product_id ?? "")
  ) {
    violations.push("DOWNSTREAM_PRODUCT_ID_MISMATCH");
  }
  if (
    String(relocation?.subject_id ?? "") !==
    String(downstream?.subject_id ?? "")
  ) {
    violations.push("DOWNSTREAM_SUBJECT_ID_MISMATCH");
  }
  if (
    ![
      "READY_FOR_REVALIDATION",
      "REVALIDATION_OBSERVED",
      "NO_FACT_SCOPE",
    ].includes(downstream?.state)
  ) {
    violations.push("DOWNSTREAM_STATE_INVALID");
  }
  if (downstream?.automatic_semantic_authority !== false) {
    violations.push("DOWNSTREAM_AUTOMATIC_SEMANTIC_AUTHORITY_FORBIDDEN");
  }

  return {
    contract: "trust-phase8i4g-phase8h3-handoff-verification-v1",
    result: violations.length === 0 ? "PASS" : "FAIL",
    violations,
    authority: "HANDOFF_ONLY_PHASE8H3_OWNS_REVALIDATION",
  };
}
