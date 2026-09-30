import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeSafeLog } from "@/lib/security/error-redaction";
import {
  preflightGroupedOfficialSourceRelocation,
} from "@/lib/trust/official-source-grouped-relocation-preflight.mjs";
import {
  buildGroupedOfficialSourceRelocationConfirmationRequest,
} from "@/lib/trust/official-source-grouped-relocation-confirmation-request.mjs";
import {
  assertGroupedRelocationOperatorParity,
  buildGroupedRelocationOperatorPreflightHash,
} from "@/lib/trust/official-source-grouped-relocation-operator-contract.mjs";
import {
  classifyRealCanaryProvenance,
} from "@/lib/trust/official-source-grouped-relocation-canary.mjs";
import {
  captureFirstRealCanaryAuthoritySnapshot,
  loadFirstRealCanaryClosureState,
  recordFirstRealCanaryClosureAudit,
  verifyFirstRealCanaryClosure,
} from "@/lib/admin/trust-grouped-relocation-canary";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MAX_QUEUE = 50;

export class TrustGroupedRelocationError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "TrustGroupedRelocationError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 500) {
  throw new TrustGroupedRelocationError(code, status);
}

function normalizeUuid(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizeHash(value) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  return HASH_PATTERN.test(normalized) ? normalized : null;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 20;
  }
  return Math.min(parsed, MAX_QUEUE);
}

function getAdminClient(operation) {
  const client = createSupabaseAdminClient();
  if (!client) {
    writeSafeLog("warn", {
      event: "admin_trust_grouped_relocation_failed",
      operation,
      category: "configuration_unavailable",
    });
    fail("trust_grouped_relocation_service_unavailable", 503);
  }
  return client;
}

function logFailure(operation, category) {
  writeSafeLog("warn", {
    event: "admin_trust_grouped_relocation_failed",
    operation,
    category,
    dependency: "supabase",
    retryable: category === "database_unavailable",
  });
}

function mapRpcError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");

  if (message.includes("not_found") || code === "P0002" || code === "23503") {
    fail("trust_grouped_relocation_not_found", 404);
  }
  if (
    message.includes("stale") ||
    message.includes("latest") ||
    code === "40001"
  ) {
    fail("trust_grouped_relocation_stale_preflight", 409);
  }
  if (
    message.includes("invalid") ||
    message.includes("mismatch") ||
    message.includes("not_ready") ||
    code === "22023" ||
    code === "23514"
  ) {
    fail("trust_grouped_relocation_invalid_request", 400);
  }
  if (
    message.includes("conflict") ||
    message.includes("collision") ||
    code === "23505"
  ) {
    fail("trust_grouped_relocation_conflict", 409);
  }

  logFailure("rpc", "database_unavailable");
  fail("trust_grouped_relocation_rpc_failed", 503);
}

async function rows(client, table, columns, configure, operation) {
  let query = client.from(table).select(columns);
  query = configure ? configure(query) : query;
  const { data, error } = await query;
  if (error) {
    logFailure(operation, "database_unavailable");
    fail("trust_grouped_relocation_data_unavailable", 503);
  }
  return data ?? [];
}

async function one(client, table, columns, configure, operation) {
  const result = await rows(
    client,
    table,
    columns,
    (query) => configure(query).limit(2),
    operation,
  );
  if (result.length !== 1) {
    fail(
      result.length === 0
        ? "trust_grouped_relocation_not_found"
        : "trust_grouped_relocation_lineage_ambiguous",
      result.length === 0 ? 404 : 409,
    );
  }
  return result[0];
}

function sortedUnique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort();
}

function requestIdFor(preflightHash) {
  return `trust-group-relocation-${preflightHash.slice(0, 32)}`;
}

async function loadGovernedDriftCase(client, caseId) {
  const { data, error } = await client.rpc(
    "get_trust_official_source_transport_drift_case_v1",
    { p_case_id: caseId },
  );
  if (error) {
    mapRpcError(error);
  }
  if (
    !data ||
    data.contract !== "trust-phase8i3-drift-case-v1" ||
    String(data.case_id) !== String(caseId)
  ) {
    fail("trust_grouped_relocation_data_unavailable", 503);
  }
  return data;
}

async function loadGovernedReadyEvaluations(client, limit = MAX_QUEUE) {
  const { data, error } = await client.rpc(
    "get_trust_official_source_transport_drift_cases_v1",
    { p_limit: 1000 },
  );
  if (error) {
    mapRpcError(error);
  }
  if (
    !data ||
    data.contract !== "trust-phase8i3-drift-case-list-v1" ||
    !Array.isArray(data.cases)
  ) {
    fail("trust_grouped_relocation_data_unavailable", 503);
  }

  return data.cases
    .map((driftCase) => {
      const evaluation = driftCase?.latest_evaluation;
      if (!evaluation || evaluation.result_kind !== "READY_FOR_8I4") {
        return null;
      }
      return {
        ...evaluation,
        case_id: driftCase.case_id,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftAt = Date.parse(left.created_at || "");
      const rightAt = Date.parse(right.created_at || "");
      if (
        Number.isFinite(leftAt) &&
        Number.isFinite(rightAt) &&
        leftAt !== rightAt
      ) {
        return leftAt - rightAt;
      }
      return String(left.evaluation_id).localeCompare(
        String(right.evaluation_id),
      );
    })
    .slice(0, normalizeLimit(limit));
}

async function loadLatestEvaluationForCase(client, caseId) {
  const driftCase = await loadGovernedDriftCase(client, caseId);
  return driftCase.latest_evaluation
    ? {
        ...driftCase.latest_evaluation,
        case_id: driftCase.case_id,
      }
    : null;
}

async function verifyCurrentReadyEvaluation(client, caseId, evaluationId) {
  const latest = await loadLatestEvaluationForCase(client, caseId);
  const current =
    latest &&
    String(latest.evaluation_id) === String(evaluationId) &&
    latest.result_kind === "READY_FOR_8I4";

  return {
    current,
    latest,
    hold: current
      ? null
      : {
          status: "HOLD_STALE_EVALUATION_NOT_LATEST",
          case_id: caseId,
          evaluation_id: evaluationId,
          blockers: [
            "STALE_REAL_CANARY_REQUIRES_REEVALUATION",
            latest
              ? `LATEST_EVALUATION_${latest.result_kind || "UNKNOWN"}`
              : "LATEST_EVALUATION_MISSING",
          ],
        },
  };
}

async function loadFirstEligibleRealCanaryEvaluationId(
  client,
  actorUserId,
) {
  const readyEvaluations = await loadGovernedReadyEvaluations(
    client,
    MAX_QUEUE,
  );

  for (const evaluation of readyEvaluations) {
    if (!classifyRealCanaryProvenance(evaluation).eligible) continue;
    const existing = await loadExistingGroup(
      client,
      evaluation.case_id,
      evaluation.evaluation_id,
    );
    if (existing) continue;
    const prepared = await prepare(
      client,
      actorUserId,
      evaluation.case_id,
      evaluation.evaluation_id,
    );
    if (prepared.ready) {
      return evaluation.evaluation_id;
    }
  }
  return null;
}

async function loadExistingGroup(client, caseId, evaluationId) {
  const result = await rows(
    client,
    "trust_official_source_relocation_groups",
    "group_id,case_id,evaluation_id,qualified_historical_source_id,relocation_id,product_id,subject_id,old_binding_id,old_review_id,replacement_binding_id,replacement_review_id,qualification_digest,group_prestate_digest,group_plan_digest,phase8h_anchor_prestate_digest,phase8h_anchor_relocation_plan_digest,actor_user_id,request_id,result,created_at",
    (query) =>
      query.eq("case_id", caseId).eq("evaluation_id", evaluationId),
    "load_existing_group",
  );
  if (result.length > 1) {
    fail("trust_grouped_relocation_lineage_ambiguous", 409);
  }
  return result[0] ?? null;
}

function tokenSourceFromGroup(group, lineage = null) {
  return {
    case_id: group.case_id,
    evaluation_id: group.evaluation_id,
    product_id: group.product_id,
    subject_id: group.subject_id,
    qualified_historical_source_id:
      group.qualified_historical_source_id,
    historical_source_ids:
      lineage?.sources?.map((row) => row.source_id) ?? [],
    incident_ids:
      lineage?.incidents?.map((row) => row.incident_id) ?? [],
    old_binding_id: group.old_binding_id,
    old_review_id: group.old_review_id,
    qualification_digest: group.qualification_digest,
    group_prestate_digest: group.group_prestate_digest,
    group_plan_digest: group.group_plan_digest,
    phase8h_anchor_prestate_digest:
      group.phase8h_anchor_prestate_digest,
    phase8h_anchor_relocation_plan_digest:
      group.phase8h_anchor_relocation_plan_digest,
  };
}

async function loadExistingGroupLineage(client, group) {
  const { data, error } = await client.rpc(
    "get_trust_official_source_grouped_relocation_lineage_v1",
    {
      p_group_id: group.group_id,
      p_relocation_id: null,
    },
  );
  if (error) {
    mapRpcError(error);
  }
  if (!data?.found) {
    fail("trust_grouped_relocation_lineage_missing", 409);
  }
  return data;
}

async function loadSnapshot(client, caseId, evaluationId) {
  const driftCase = await loadGovernedDriftCase(client, caseId);
  const latestEvaluation = driftCase.latest_evaluation;
  if (
    !latestEvaluation ||
    String(latestEvaluation.evaluation_id) !== String(evaluationId)
  ) {
    fail("trust_grouped_relocation_stale_preflight", 409);
  }
  const evaluation = {
    ...latestEvaluation,
    case_id: driftCase.case_id,
  };
  const sourceIds = sortedUnique(driftCase.source_ids);
  const incidentIds = sortedUnique(driftCase.incident_ids);

  if (sourceIds.length === 0 || incidentIds.length === 0) {
    fail("trust_grouped_relocation_lineage_incomplete", 409);
  }

  const [
    subject,
    product,
    sourceRows,
    sourceBindingRows,
    incidentRows,
  ] = await Promise.all([
    one(
      client,
      "product_fact_subjects",
      "subject_id,product_id,variant_key,formulation_revision_key,identity_status,current_state,market_applicability,region_applicability",
      (query) =>
        query
          .eq("subject_id", driftCase.subject_id)
          .eq("product_id", driftCase.product_id),
      "load_subject",
    ),
    one(
      client,
      "products",
      "id,brand,name,category,image_url",
      (query) => query.eq("id", driftCase.product_id),
      "load_product",
    ),
    rows(
      client,
      "product_evidence_sources",
      "source_id,canonical_locator,publisher,source_kind,content_digest,market,region,locale,created_at",
      (query) => query.in("source_id", sourceIds),
      "load_historical_sources",
    ),
    rows(
      client,
      "product_evidence_source_subject_bindings",
      "binding_id,source_id,product_id,subject_id,binding_state,scope_relation,identity_resolution_version,reviewed_at,created_at",
      (query) =>
        query
          .in("source_id", sourceIds)
          .eq("product_id", driftCase.product_id)
          .eq("subject_id", driftCase.subject_id)
          .eq("binding_state", "exact_subject_match")
          .in("scope_relation", ["equivalent", "narrower"]),
      "load_historical_source_bindings",
    ),
    rows(
      client,
      "trust_official_source_transport_incidents",
      "incident_id,source_id,target_key,incident_kind,effective_locator,confirmed_final_locator,episode_started_at,confirmed_at,incident_digest,created_at",
      (query) => query.in("incident_id", incidentIds),
      "load_transport_incidents",
    ),
  ]);

  if (
    sourceRows.length !== sourceIds.length ||
    sourceBindingRows.length !== sourceIds.length ||
    incidentRows.length !== incidentIds.length
  ) {
    fail("trust_grouped_relocation_lineage_incomplete", 409);
  }

  const oldBindings = await rows(
    client,
    "product_source_bindings",
    "binding_id,product_id,source_name,external_type,external_id,source_url,market_code,locale,binding_state,binding_method,product_scope_state,created_at,updated_at",
    (query) =>
      query
        .eq("product_id", driftCase.product_id)
        .eq("source_url", driftCase.effective_locator)
        .eq("binding_state", "resolved")
        .eq("binding_method", "trust_official_source_review_v1")
        .eq("product_scope_state", "product"),
    "load_reviewed_old_binding",
  );
  if (oldBindings.length !== 1) {
    fail("trust_grouped_relocation_old_binding_not_unique", 409);
  }
  const oldBinding = oldBindings[0];

  const reviews = await rows(
    client,
    "trust_official_source_binding_reviews",
    "review_id,binding_id,product_id,subject_id,subject_market,source_market,scope_relation,variant_key,formulation_revision_key,source_kind,review_version,created_at",
    (query) =>
      query
        .eq("binding_id", oldBinding.binding_id)
        .eq("product_id", driftCase.product_id)
        .eq("subject_id", driftCase.subject_id)
        .eq("review_version", "trust-official-source-review-v1"),
    "load_reviewed_old_review",
  );
  if (reviews.length !== 1) {
    fail("trust_grouped_relocation_old_review_not_unique", 409);
  }
  const review = reviews[0];

  const sourceMap = new Map(
    sourceRows.map((row) => [String(row.source_id), row]),
  );
  const sourceBindingMap = new Map();
  for (const binding of sourceBindingRows) {
    const key = String(binding.source_id);
    if (sourceBindingMap.has(key)) {
      fail("trust_grouped_relocation_source_binding_ambiguous", 409);
    }
    sourceBindingMap.set(key, binding);
  }

  const historicalSources = sourceIds.map((sourceId) => {
    const source = sourceMap.get(sourceId);
    const binding = sourceBindingMap.get(sourceId);
    if (!source || !binding) {
      fail("trust_grouped_relocation_lineage_incomplete", 409);
    }
    return {
      source_id: source.source_id,
      canonical_locator: source.canonical_locator,
      publisher: source.publisher,
      source_kind: source.source_kind,
      market: source.market,
      locale: source.locale,
      content_digest: source.content_digest,
      product_id: binding.product_id,
      subject_id: binding.subject_id,
      source_subject_binding_id: binding.binding_id,
      binding_state: binding.binding_state,
      scope_relation: binding.scope_relation,
      reviewed_binding_id: oldBinding.binding_id,
      reviewed_review_id: review.review_id,
    };
  });

  const resultPayload =
    evaluation.result_payload &&
    typeof evaluation.result_payload === "object" &&
    !Array.isArray(evaluation.result_payload)
      ? evaluation.result_payload
      : {};
  const qualifiedExact =
    resultPayload.qualified_exact &&
    typeof resultPayload.qualified_exact === "object" &&
    !Array.isArray(resultPayload.qualified_exact)
      ? resultPayload.qualified_exact
      : null;

  const input = {
    contract: "trust-phase8i4-grouped-relocation-preflight-input-v1",
    case: {
      case_id: driftCase.case_id,
      product_id: driftCase.product_id,
      subject_id: driftCase.subject_id,
      case_digest: driftCase.case_digest,
      historical_source_ids: sourceIds,
      incident_ids: incidentIds,
    },
    evaluation: {
      evaluation_id: evaluation.evaluation_id,
      case_id: evaluation.case_id,
      policy_version: evaluation.policy_version,
      result_kind: evaluation.result_kind,
      candidate_locator: evaluation.candidate_locator,
      qualified_historical_source_id:
        resultPayload.qualified_historical_source_id ?? null,
      qualified_exact: qualifiedExact,
      qualification_contract: qualifiedExact?.contract ?? null,
      qualification_digest: evaluation.qualification_digest,
      input_digest: evaluation.input_digest,
      result_digest: evaluation.result_digest,
    },
    governed_subject: {
      product_id: subject.product_id,
      subject_id: subject.subject_id,
      market_applicability: subject.market_applicability,
      variant_key: subject.variant_key,
      formulation_revision_key: subject.formulation_revision_key,
      identity_status: subject.identity_status,
      current_state: subject.current_state,
    },
    current_reviewed_binding: {
      binding_id: oldBinding.binding_id,
      review_id: review.review_id,
      product_id: oldBinding.product_id,
      subject_id: review.subject_id,
      source_name: oldBinding.source_name,
      external_type: oldBinding.external_type,
      source_url: oldBinding.source_url,
      market_code: oldBinding.market_code,
      locale: oldBinding.locale,
      binding_state: oldBinding.binding_state,
      binding_method: oldBinding.binding_method,
      product_scope_state: oldBinding.product_scope_state,
      review_version: review.review_version,
      review_subject_market: review.subject_market,
      review_source_market: review.source_market,
      review_scope_relation: review.scope_relation,
      review_variant_key: review.variant_key,
      review_formulation_revision_key:
        review.formulation_revision_key,
      review_source_kind: review.source_kind,
    },
    historical_sources: historicalSources,
    replacement: {
      source_name: oldBinding.source_name,
      external_type: oldBinding.external_type,
      source_url: evaluation.candidate_locator,
      market_code: oldBinding.market_code,
      locale: oldBinding.locale,
    },
  };

  return {
    input,
    driftCase,
    evaluation,
    product,
    historicalSources,
    incidents: [...incidentRows].sort((a, b) =>
      String(a.incident_id).localeCompare(String(b.incident_id)),
    ),
  };
}

async function runDatabasePreflight(client, actorUserId, caseId, evaluationId) {
  const { data, error } = await client.rpc(
    "admin_preflight_trust_official_source_grouped_relocation_v1",
    {
      p_actor_user_id: actorUserId,
      p_case_id: caseId,
      p_evaluation_id: evaluationId,
    },
  );
  if (error) {
    mapRpcError(error);
  }
  if (!data || typeof data !== "object") {
    fail("trust_grouped_relocation_invalid_rpc_result", 503);
  }
  return data;
}

async function prepare(client, actorUserId, caseId, evaluationId) {
  const freshness = await verifyCurrentReadyEvaluation(
    client,
    caseId,
    evaluationId,
  );
  if (!freshness.current) {
    return {
      ready: false,
      dbPreflight: freshness.hold,
      freshness,
    };
  }

  const dbPreflight = await runDatabasePreflight(
    client,
    actorUserId,
    caseId,
    evaluationId,
  );

  if (
    dbPreflight.status !==
    "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION"
  ) {
    return {
      ready: false,
      dbPreflight,
    };
  }

  const snapshot = await loadSnapshot(client, caseId, evaluationId);
  const jsPreflight =
    preflightGroupedOfficialSourceRelocation(snapshot.input);
  const confirmationRequest =
    buildGroupedOfficialSourceRelocationConfirmationRequest(
      snapshot.input,
    );

  let parity;
  try {
    parity = assertGroupedRelocationOperatorParity({
      dbPreflight,
      jsPreflight,
      confirmationRequest,
    });
  } catch (error) {
    writeSafeLog("error", {
      event: "admin_trust_grouped_relocation_parity_failed",
      category: "contract_mismatch",
      caseId,
      evaluationId,
    });
    fail("trust_grouped_relocation_preflight_parity_mismatch", 409);
  }

  const preflightHash =
    buildGroupedRelocationOperatorPreflightHash(dbPreflight);

  return {
    ready: true,
    dbPreflight,
    jsPreflight,
    confirmationRequest,
    preflightHash,
    parity,
    snapshot,
    freshness,
  };
}

function publicReady(prepared) {
  const { dbPreflight, preflightHash, snapshot } = prepared;
  const canaryProvenance = classifyRealCanaryProvenance(
    snapshot.evaluation,
  );
  return {
    status: "ready_for_explicit_admin_confirmation",
    caseId: dbPreflight.case_id,
    evaluationId: dbPreflight.evaluation_id,
    productId: dbPreflight.product_id,
    subjectId: dbPreflight.subject_id,
    product: {
      brand: snapshot.product.brand,
      name: snapshot.product.name,
      category: snapshot.product.category,
      imageUrl: snapshot.product.image_url,
    },
    evaluationRequestId: snapshot.evaluation.request_id,
    evaluationCreatedAt: snapshot.evaluation.created_at,
    canaryProvenance,
    oldLocator: dbPreflight.old_locator,
    replacementLocator: dbPreflight.replacement_locator,
    qualifiedHistoricalSourceId:
      dbPreflight.qualified_historical_source_id,
    historicalSourceIds: [...dbPreflight.historical_source_ids],
    incidentIds: [...dbPreflight.incident_ids],
    historicalSources: snapshot.historicalSources.map((row) => ({
      sourceId: row.source_id,
      publisher: row.publisher,
      sourceKind: row.source_kind,
      canonicalLocator: row.canonical_locator,
    })),
    incidents: snapshot.incidents.map((row) => ({
      incidentId: row.incident_id,
      sourceId: row.source_id,
      incidentKind: row.incident_kind,
      effectiveLocator: row.effective_locator,
      confirmedFinalLocator: row.confirmed_final_locator,
      confirmedAt: row.confirmed_at,
    })),
    qualificationDigest: dbPreflight.qualification_digest,
    groupPrestateDigest: dbPreflight.group_prestate_digest,
    groupPlanDigest: dbPreflight.group_plan_digest,
    phase8hAnchorPrestateDigest:
      dbPreflight.phase8h_anchor_prestate_digest,
    phase8hAnchorRelocationPlanDigest:
      dbPreflight.phase8h_anchor_relocation_plan_digest,
    preflightHash,
    plannedMutation: {
      oldBinding: "resolved_to_retired",
      replacementBinding: "create_or_reuse_resolved",
      groupedLineage: "append_only",
      productFactCurrent: "unchanged",
      productFactInstance: "unchanged",
      productFactConfirmation: "unchanged",
      historicalEvidenceSource: "unchanged",
      recommendationAuthority: "unchanged",
      semanticSameChanged: "not_resolved",
    },
  };
}

function publicHold(dbPreflight) {
  return {
    status: "hold",
    caseId: dbPreflight.case_id ?? null,
    evaluationId: dbPreflight.evaluation_id ?? null,
    blockers: Array.isArray(dbPreflight.blockers)
      ? [...dbPreflight.blockers]
      : [],
    preflightHash: null,
  };
}

export async function loadTrustGroupedRelocationQueue({
  actorUserId,
  limit = 20,
} = {}) {
  const actorId = normalizeUuid(actorUserId);
  if (!actorId) {
    fail("trust_grouped_relocation_invalid_actor", 400);
  }

  const client = getAdminClient("load_queue");
  const evaluations = await loadGovernedReadyEvaluations(
    client,
    normalizeLimit(limit),
  );

  const existingAnyGroup = await rows(
    client,
    "trust_official_source_relocation_groups",
    "group_id",
    (query) => query.limit(1),
    "load_canary_group_state",
  );
  const firstCanaryOpen = existingAnyGroup.length === 0;
  const firstCanaryClosure = firstCanaryOpen
    ? null
    : await loadFirstRealCanaryClosureState(client);
  const laterConfirmationAllowed =
    firstCanaryOpen || firstCanaryClosure?.pass === true;

  const items = [];
  for (const evaluation of evaluations) {
    const existing = await loadExistingGroup(
      client,
      evaluation.case_id,
      evaluation.evaluation_id,
    );
    if (existing) {
      continue;
    }

    const prepared = await prepare(
      client,
      actorId,
      evaluation.case_id,
      evaluation.evaluation_id,
    );
    if (prepared.ready) {
      const item = publicReady(prepared);
      delete item.preflightHash;
      items.push(item);
    }
  }

  items.sort((left, right) => {
    const leftAt = Date.parse(left.evaluationCreatedAt || "");
    const rightAt = Date.parse(right.evaluationCreatedAt || "");
    if (Number.isFinite(leftAt) && Number.isFinite(rightAt) && leftAt !== rightAt) {
      return leftAt - rightAt;
    }
    return String(left.evaluationId).localeCompare(String(right.evaluationId));
  });

  const firstReal = firstCanaryOpen
    ? items.find((item) => item.canaryProvenance?.eligible === true) ?? null
    : null;

  for (const item of items) {
    const real = item.canaryProvenance?.eligible === true;
    item.canary = {
      phase: "8I-4G",
      firstCanaryOpen,
      eligibleRealScheduled: real,
      isFirstRealCanary:
        firstCanaryOpen &&
        real &&
        item.evaluationId === firstReal?.evaluationId,
      confirmationAllowed:
        firstCanaryOpen
          ? real && item.evaluationId === firstReal?.evaluationId
          : laterConfirmationAllowed,
      closurePass: firstCanaryClosure?.pass ?? null,
      closureFailWithoutPass:
        firstCanaryClosure?.failWithoutPass ?? false,
      state: !firstCanaryOpen
        ? firstCanaryClosure?.pass
          ? "FIRST_REAL_CANARY_CLOSED_PASS"
          : "FIRST_REAL_CANARY_HALTED_REVIEW_REQUIRED"
        : !real
          ? "NOT_REAL_SCHEDULED_CANARY_BLOCKED_FOR_FIRST_GROUP"
          : item.evaluationId === firstReal?.evaluationId
            ? "FIRST_REAL_CANARY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION"
            : "QUEUED_BEHIND_FIRST_REAL_CANARY",
    };
  }

  return {
    contract: "trust-phase8i4f-admin-grouped-relocation-queue-v1",
    canary: {
      contract: "trust-phase8i4g-admin-canary-queue-v1",
      firstCanaryOpen,
      closurePass: firstCanaryClosure?.pass ?? null,
      closureFailWithoutPass:
        firstCanaryClosure?.failWithoutPass ?? false,
      closurePassAuditId: firstCanaryClosure?.passAuditId ?? null,
      state: !firstCanaryOpen
        ? firstCanaryClosure?.pass
          ? "FIRST_REAL_CANARY_CLOSED_PASS"
          : "FIRST_REAL_CANARY_HALTED_REVIEW_REQUIRED"
        : firstReal
          ? "FIRST_REAL_CANARY_READY_FOR_ADMIN_PREFLIGHT"
          : "WAITING_FOR_REAL_READY_FOR_8I4",
      firstCandidateEvaluationId: firstReal?.evaluationId ?? null,
    },
    count: items.length,
    items,
  };
}

export async function runTrustGroupedRelocationPreflight({
  actorUserId,
  caseId,
  evaluationId,
}) {
  const actorId = normalizeUuid(actorUserId);
  const normalizedCaseId = normalizeUuid(caseId);
  const normalizedEvaluationId = normalizeUuid(evaluationId);
  if (!actorId || !normalizedCaseId || !normalizedEvaluationId) {
    fail("trust_grouped_relocation_invalid_request", 400);
  }

  const client = getAdminClient("preflight");
  const existing = await loadExistingGroup(
    client,
    normalizedCaseId,
    normalizedEvaluationId,
  );
  if (existing) {
    const lineage = await loadExistingGroupLineage(client, existing);
    return {
      status: "already_confirmed",
      caseId: existing.case_id,
      evaluationId: existing.evaluation_id,
      groupId: existing.group_id,
      relocationId: existing.relocation_id,
      preflightHash: buildGroupedRelocationOperatorPreflightHash(
        tokenSourceFromGroup(existing, lineage),
      ),
      historicalSourceCount: lineage.sources?.length ?? 0,
      incidentCount: lineage.incidents?.length ?? 0,
    };
  }

  const prepared = await prepare(
    client,
    actorId,
    normalizedCaseId,
    normalizedEvaluationId,
  );
  if (!prepared.ready) {
    return publicHold(prepared.dbPreflight);
  }

  const anyConfirmedGroup = await rows(
    client,
    "trust_official_source_relocation_groups",
    "group_id",
    (query) => query.limit(1),
    "preflight_canary_group_state",
  );
  if (anyConfirmedGroup.length === 0) {
    const provenance = classifyRealCanaryProvenance(
      prepared.snapshot.evaluation,
    );
    if (!provenance.eligible) {
      return publicHold({
        case_id: normalizedCaseId,
        evaluation_id: normalizedEvaluationId,
        blockers: ["FIRST_REAL_CANARY_REQUIRES_SCHEDULED_PROVENANCE"],
      });
    }

    const firstEligibleEvaluationId =
      await loadFirstEligibleRealCanaryEvaluationId(client, actorId);
    if (
      !firstEligibleEvaluationId ||
      String(firstEligibleEvaluationId) !== normalizedEvaluationId
    ) {
      return publicHold({
        case_id: normalizedCaseId,
        evaluation_id: normalizedEvaluationId,
        blockers: ["FIRST_REAL_CANARY_CANDIDATE_NOT_FIRST"],
      });
    }
  }

  return publicReady(prepared);
}

export async function confirmTrustGroupedRelocation({
  actorUserId,
  caseId,
  evaluationId,
  preflightHash,
}) {
  const actorId = normalizeUuid(actorUserId);
  const normalizedCaseId = normalizeUuid(caseId);
  const normalizedEvaluationId = normalizeUuid(evaluationId);
  const normalizedPreflightHash = normalizeHash(preflightHash);
  if (
    !actorId ||
    !normalizedCaseId ||
    !normalizedEvaluationId ||
    !normalizedPreflightHash
  ) {
    fail("trust_grouped_relocation_invalid_request", 400);
  }

  const client = getAdminClient("confirm");
  const existing = await loadExistingGroup(
    client,
    normalizedCaseId,
    normalizedEvaluationId,
  );
  if (existing) {
    const lineage = await loadExistingGroupLineage(client, existing);
    const persistedHash =
      buildGroupedRelocationOperatorPreflightHash(
        tokenSourceFromGroup(existing, lineage),
      );
    if (persistedHash !== normalizedPreflightHash) {
      fail("trust_grouped_relocation_stale_preflight", 409);
    }
    return {
      status: "confirmed",
      idempotent: true,
      groupId: existing.group_id,
      relocationId: existing.relocation_id,
      replacementBindingId: existing.replacement_binding_id,
      replacementReviewId: existing.replacement_review_id,
      historicalSourceCount: lineage.sources?.length ?? 0,
      incidentCount: lineage.incidents?.length ?? 0,
      productFactWrites: 0,
      evidenceSourceWrites: 0,
      recommendationWrites: 0,
      semanticResolutionWrites: 0,
    };
  }

  const prepared = await prepare(
    client,
    actorId,
    normalizedCaseId,
    normalizedEvaluationId,
  );
  if (!prepared.ready) {
    fail("trust_grouped_relocation_stale_preflight", 409);
  }
  if (prepared.preflightHash !== normalizedPreflightHash) {
    fail("trust_grouped_relocation_stale_preflight", 409);
  }

  const anyConfirmedGroup = await rows(
    client,
    "trust_official_source_relocation_groups",
    "group_id",
    (query) => query.limit(1),
    "confirm_canary_group_state",
  );
  const firstCanary = anyConfirmedGroup.length === 0;
  const canaryClosure = firstCanary
    ? null
    : await loadFirstRealCanaryClosureState(client);

  if (!firstCanary && !canaryClosure?.pass) {
    fail("trust_grouped_relocation_canary_closure_required", 409);
  }

  if (firstCanary) {
    const provenance = classifyRealCanaryProvenance(
      prepared.snapshot.evaluation,
    );
    if (!provenance.eligible) {
      fail("trust_grouped_relocation_canary_real_candidate_required", 409);
    }

    const firstEligibleEvaluationId =
      await loadFirstEligibleRealCanaryEvaluationId(client, actorId);

    if (
      !firstEligibleEvaluationId ||
      String(firstEligibleEvaluationId) !== normalizedEvaluationId
    ) {
      fail("trust_grouped_relocation_canary_candidate_not_first", 409);
    }
  }

  let canaryBefore = null;
  if (firstCanary) {
    try {
      canaryBefore = await captureFirstRealCanaryAuthoritySnapshot({
        client,
        prepared,
      });
    } catch (error) {
      writeSafeLog("error", {
        event: "admin_trust_grouped_relocation_canary_snapshot_failed",
        category: "preconfirm_snapshot_failed",
        caseId: normalizedCaseId,
        evaluationId: normalizedEvaluationId,
      });
      fail("trust_grouped_relocation_canary_snapshot_failed", 503);
    }
  }

  const { data, error } = await client.rpc(
    "admin_confirm_trust_official_source_grouped_relocation_v1",
    {
      p_actor_user_id: actorId,
      p_request_id: requestIdFor(normalizedPreflightHash),
      p_payload: prepared.confirmationRequest,
    },
  );
  if (error) {
    mapRpcError(error);
  }
  if (
    data?.status !== "confirmed" ||
    !normalizeUuid(data?.group_id) ||
    !normalizeUuid(data?.relocation_id)
  ) {
    fail("trust_grouped_relocation_invalid_rpc_result", 503);
  }

  const { data: lineage, error: lineageError } = await client.rpc(
    "get_trust_official_source_grouped_relocation_lineage_v1",
    {
      p_group_id: data.group_id,
      p_relocation_id: null,
    },
  );
  if (lineageError) {
    mapRpcError(lineageError);
  }
  if (!lineage?.found) {
    fail("trust_grouped_relocation_lineage_missing", 409);
  }

  let canaryVerification = null;
  if (firstCanary) {
    let afterFirst = null;
    let replayData = null;
    let replayError = null;
    let afterReplay = null;

    try {
      afterFirst = await captureFirstRealCanaryAuthoritySnapshot({
        client,
        prepared,
        confirmed: data,
      });

      const replay = await client.rpc(
        "admin_confirm_trust_official_source_grouped_relocation_v1",
        {
          p_actor_user_id: actorId,
          p_request_id: requestIdFor(normalizedPreflightHash),
          p_payload: prepared.confirmationRequest,
        },
      );
      replayData = replay.data;
      replayError = replay.error ?? null;

      afterReplay = await captureFirstRealCanaryAuthoritySnapshot({
        client,
        prepared,
        confirmed: data,
      });

      canaryVerification = verifyFirstRealCanaryClosure({
        prepared,
        firstResult: data,
        replayResult:
          replayError || !replayData
            ? {
                status: "error",
                idempotent: false,
                group_id: data.group_id,
                relocation_id: data.relocation_id,
                replacement_binding_id: data.replacement_binding_id,
                replacement_review_id: data.replacement_review_id,
              }
            : replayData,
        before: canaryBefore,
        afterFirst,
        afterReplay,
        lineage,
      });

      if (replayError) {
        canaryVerification = {
          ...canaryVerification,
          result: "FAIL",
          next_state: "HALT_FURTHER_GROUPED_CONFIRMATIONS",
          replay_error_code: replayError.code ?? "RPC_ERROR",
        };
      }

      try {
        const canaryAuditId = await recordFirstRealCanaryClosureAudit({
          client,
          actorUserId: actorId,
          requestId: requestIdFor(normalizedPreflightHash),
          groupId: data.group_id,
          relocationId: data.relocation_id,
          evaluationId: normalizedEvaluationId,
          before: canaryBefore,
          after: afterReplay,
          verification: canaryVerification,
        });
        canaryVerification = {
          ...canaryVerification,
          audit_id: canaryAuditId,
          audit_recorded: true,
        };
      } catch (auditError) {
        writeSafeLog("error", {
          event: "admin_trust_grouped_relocation_canary_audit_failed",
          category: "closure_audit_failed",
          caseId: normalizedCaseId,
          evaluationId: normalizedEvaluationId,
        });
        canaryVerification = {
          ...canaryVerification,
          result: "FAIL",
          next_state: "HALT_FURTHER_GROUPED_CONFIRMATIONS",
          audit_recorded: false,
        };
      }
    } catch (verificationError) {
      writeSafeLog("error", {
        event: "admin_trust_grouped_relocation_canary_verification_failed",
        category: "postconfirm_verification_failed",
        caseId: normalizedCaseId,
        evaluationId: normalizedEvaluationId,
      });
      canaryVerification = {
        contract: "trust-phase8i4g-first-real-canary-closure-v1",
        result: "FAIL",
        checks: null,
        automatic_semantic_authority: false,
        next_state: "HALT_FURTHER_GROUPED_CONFIRMATIONS",
        audit_recorded: false,
      };
    }
  }

  const canaryClosurePack =
    firstCanary && canaryVerification
      ? {
          contract: "trust-phase8i4g-first-real-canary-closure-pack-v1",
          state:
            canaryVerification.result === "PASS" &&
            canaryVerification.audit_recorded === true
              ? "FIRST_REAL_CANARY_CLOSED_PASS"
              : "FIRST_REAL_CANARY_HALTED_REVIEW_REQUIRED",
          result: canaryVerification.result,
          groupId: data.group_id,
          relocationId: data.relocation_id,
          evaluationId: normalizedEvaluationId,
          authorityInvariant:
            canaryVerification.checks?.authority?.result ?? "FAIL",
          groupedLineage:
            canaryVerification.checks?.groupedLineage?.result ?? "FAIL",
          idempotentReplay:
            canaryVerification.checks?.replay?.result ?? "FAIL",
          phase8h3Handoff:
            canaryVerification.checks?.downstream?.result ?? "FAIL",
          closureAudit:
            canaryVerification.audit_recorded === true ? "PASS" : "FAIL",
          nextGroupedConfirmationAllowed:
            canaryVerification.result === "PASS" &&
            canaryVerification.audit_recorded === true,
          automaticSemanticAuthority: false,
        }
      : null;

  return {
    status: "confirmed",
    idempotent: data.idempotent === true,
    groupId: data.group_id,
    relocationId: data.relocation_id,
    replacementBindingId: data.replacement_binding_id,
    replacementReviewId: data.replacement_review_id,
    historicalSourceCount: lineage.sources?.length ?? 0,
    incidentCount: lineage.incidents?.length ?? 0,
    auditId: data.audit_id ?? null,
    canaryVerification,
    canaryClosurePack,
    canaryClosureGate:
      firstCanary
        ? canaryClosurePack?.nextGroupedConfirmationAllowed === true
          ? "OPEN_AFTER_FIRST_REAL_CANARY_PASS"
          : "HALTED_AFTER_FIRST_REAL_CANARY"
        : canaryClosure?.pass
          ? "OPEN_AFTER_FIRST_REAL_CANARY_PASS"
          : "NOT_APPLICABLE",
    productFactWrites: 0,
    evidenceSourceWrites: 0,
    recommendationWrites: 0,
    semanticResolutionWrites: 0,
  };
}
