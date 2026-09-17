import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeSafeLog } from "@/lib/security/error-redaction";

export const TRUST_QUEUE_BLOCKERS = Object.freeze([
  "SUBJECT_CREATION_REQUIRED",
  "SUBJECT_CANDIDATE_FOUND",
  "IDENTITY_BLOCKED",
  "VARIANT_CONFLICT",
  "FORMULATION_CONFLICT",
  "MARKET_CONFLICT",
  "REGISTRY_GAP",
  "EVIDENCE_CONFLICT"
]);

const TRUST_QUEUE_BLOCKER_SET = new Set(TRUST_QUEUE_BLOCKERS);
const LIST_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TrustQueueOperationError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "TrustQueueOperationError";
    this.code = code;
    this.status = status;
  }
}

function logTrustQueueFailure(operation, category) {
  writeSafeLog("warn", {
    event: "admin_trust_queue_failed",
    category,
    operation,
    dependency: "supabase",
    retryable: category === "database_unavailable"
  });
}

function getAdminClient(operation) {
  const client = createSupabaseAdminClient();

  if (!client) {
    logTrustQueueFailure(operation, "configuration_unavailable");
    throw new TrustQueueOperationError("trust_queue_service_unavailable", 503);
  }

  return client;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNullableText(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeUuid(value) {
  const normalized = normalizeNullableText(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 50;
  }
  return Math.min(parsed, LIST_LIMIT);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function safeJsonObject(value) {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeTask(row) {
  return {
    id: String(row.id),
    intakeId: normalizeUuid(row.intake_id),
    productId: normalizeUuid(row.product_id),
    subjectId: normalizeUuid(row.subject_id),
    factKey: normalizeNullableText(row.fact_key),
    registryVersion: normalizeNullableText(row.registry_version),
    researchPolicyVersion: normalizeNullableText(row.research_policy_version),
    state: normalizeNullableText(row.state),
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : null,
    blockerCode: normalizeNullableText(row.blocker_code),
    blockerDetail: safeJsonObject(row.blocker_detail),
    sourceObservationId: normalizeUuid(row.source_observation_id),
    evidenceCandidateId: normalizeUuid(row.evidence_candidate_id),
    evidenceId: normalizeUuid(row.evidence_id),
    attemptCount: Number.isInteger(row.attempt_count) ? row.attempt_count : 0,
    nextRetryAt: normalizeNullableText(row.next_retry_at),
    lastResearchAt: normalizeNullableText(row.last_research_at),
    createdAt: normalizeNullableText(row.created_at),
    updatedAt: normalizeNullableText(row.updated_at),
    completedAt: normalizeNullableText(row.completed_at)
  };
}

function normalizeIntake(row) {
  return {
    id: String(row.id),
    productId: normalizeUuid(row.product_id),
    sourceCandidateId: normalizeUuid(row.source_candidate_id),
    catalogRevision: normalizeNullableText(row.catalog_revision),
    category: normalizeNullableText(row.category),
    market: normalizeNullableText(row.market),
    subjectId: normalizeUuid(row.subject_id),
    identityState: normalizeNullableText(row.identity_state),
    trustState: normalizeNullableText(row.trust_state),
    requiredFactPolicyVersion: normalizeNullableText(row.required_fact_policy_version),
    identityResolutionVersion: normalizeNullableText(row.identity_resolution_version),
    identityResolutionDetail: safeJsonObject(row.identity_resolution_detail),
    createdAt: normalizeNullableText(row.created_at),
    updatedAt: normalizeNullableText(row.updated_at),
    lastCheckedAt: normalizeNullableText(row.last_checked_at)
  };
}

function normalizeProduct(row) {
  return row
    ? {
        id: String(row.id),
        brand: normalizeNullableText(row.brand),
        name: normalizeNullableText(row.name),
        category: normalizeNullableText(row.category),
        productForm: normalizeNullableText(row.product_form),
        imageUrl: normalizeNullableText(row.image_url)
      }
    : null;
}

function normalizeCatalogCandidate(row) {
  if (!row) {
    return null;
  }

  const evidence = safeJsonObject(row.identity_resolution_evidence);
  const providers = Array.isArray(evidence.providers)
    ? evidence.providers
        .filter(isRecord)
        .map((provider) => ({
          provider: normalizeNullableText(provider.provider),
          locator: normalizeNullableText(provider.locator),
          externalId: normalizeNullableText(provider.external_id),
          externalType: normalizeNullableText(provider.external_type),
          presentation: normalizeNullableText(provider.presentation)
        }))
    : [];

  return {
    id: String(row.id),
    sourceName: normalizeNullableText(row.source_name),
    sourceUrl: normalizeNullableText(row.source_url),
    identityState: normalizeNullableText(row.identity_resolution_state),
    identityVersion: normalizeNullableText(row.identity_resolution_version),
    providers
  };
}

function normalizeObservation(row) {
  return row
    ? {
        id: String(row.observation_id),
        sourceBindingId: normalizeUuid(row.source_binding_id),
        canonicalLocator: normalizeNullableText(row.canonical_locator),
        publisher: normalizeNullableText(row.publisher),
        sourceKind: normalizeNullableText(row.source_kind),
        market: normalizeNullableText(row.market),
        region: normalizeNullableText(row.region),
        locale: normalizeNullableText(row.locale),
        observedClaim: isRecord(row.observed_claim) ? row.observed_claim : row.observed_claim,
        productIdentityObservation: isRecord(row.product_identity_observation)
          ? row.product_identity_observation
          : row.product_identity_observation,
        observationVersion: normalizeNullableText(row.observation_version),
        digestBasis: normalizeNullableText(row.digest_basis),
        sourceContentDigest: normalizeNullableText(row.source_content_digest),
        observedAt: normalizeNullableText(row.observed_at),
        fetchedAt: normalizeNullableText(row.fetched_at)
      }
    : null;
}

function normalizeEvidenceCandidate(row) {
  return row
    ? {
        id: String(row.candidate_id),
        normalizedValue: row.normalized_value ?? null,
        evidenceClass: normalizeNullableText(row.evidence_class),
        evidenceAuthority: normalizeNullableText(row.evidence_authority),
        confidence: normalizeNullableText(row.confidence),
        supportDirection: normalizeNullableText(row.support_direction),
        negativeAdmissibility: normalizeNullableText(row.negative_admissibility),
        market: normalizeNullableText(row.market),
        region: normalizeNullableText(row.region),
        locale: normalizeNullableText(row.locale),
        qualifier: isRecord(row.qualifier) ? row.qualifier : {},
        candidateState: normalizeNullableText(row.candidate_state),
        canonicalEvidenceDigest: normalizeNullableText(row.canonical_evidence_digest),
        createdAt: normalizeNullableText(row.created_at)
      }
    : null;
}

function normalizeSourceBinding(row) {
  return row
    ? {
        id: String(row.binding_id),
        sourceName: normalizeNullableText(row.source_name),
        sourceUrl: normalizeNullableText(row.source_url),
        marketCode: normalizeNullableText(row.market_code),
        locale: normalizeNullableText(row.locale),
        bindingState: normalizeNullableText(row.binding_state),
        productScopeState: normalizeNullableText(row.product_scope_state),
        lastObservedAt: normalizeNullableText(row.last_observed_at)
      }
    : null;
}

function normalizeCurrentFact(current, instance) {
  if (!current || !instance) {
    return null;
  }

  return {
    propositionKey: normalizeNullableText(current.proposition_key),
    factInstanceId: normalizeUuid(current.fact_instance_id),
    confirmationId: normalizeUuid(current.confirmation_id),
    factKey: normalizeNullableText(instance.fact_key),
    semanticStatus: normalizeNullableText(instance.semantic_status),
    valueType: normalizeNullableText(instance.value_type),
    valueBoolean:
      typeof instance.value_boolean === "boolean" ? instance.value_boolean : null,
    valueEnum: normalizeNullableText(instance.value_enum),
    valueNumber:
      instance.value_number === null || instance.value_number === undefined
        ? null
        : Number(instance.value_number),
    valueUnit: normalizeNullableText(instance.value_unit),
    valueRangeMin:
      instance.value_range_min === null || instance.value_range_min === undefined
        ? null
        : Number(instance.value_range_min),
    valueRangeMax:
      instance.value_range_max === null || instance.value_range_max === undefined
        ? null
        : Number(instance.value_range_max),
    valueEntityIdentifier: normalizeNullableText(instance.value_entity_identifier),
    market: normalizeNullableText(instance.market),
    authorityCeiling: normalizeNullableText(instance.authority_ceiling),
    fusedConfidence: normalizeNullableText(instance.fused_confidence),
    updatedAt: normalizeNullableText(current.updated_at)
  };
}

function normalizeAssignment(row) {
  return {
    id: String(row.assignment_id),
    subjectId: normalizeUuid(row.subject_id),
    registryVersion: normalizeNullableText(row.registry_version),
    factKey: normalizeNullableText(row.fact_key),
    propositionKey: normalizeNullableText(row.proposition_key),
    operationalState: normalizeNullableText(row.operational_state),
    assignedTo: normalizeUuid(row.assigned_to),
    reviewPolicyVersion: normalizeNullableText(row.review_policy_version),
    updatedAt: normalizeNullableText(row.updated_at)
  };
}

function isQueueTask(task) {
  return (
    task.state === "REVIEW_REQUIRED" ||
    TRUST_QUEUE_BLOCKER_SET.has(task.blockerCode)
  );
}

export function normalizeTrustQueueFilter(value) {
  const normalized = String(value ?? "all").trim().toUpperCase();
  return TRUST_QUEUE_BLOCKER_SET.has(normalized) ? normalized : "all";
}

async function selectByIds(client, table, columns, idColumn, ids, operation) {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from(table)
    .select(columns)
    .in(idColumn, ids);

  if (error) {
    logTrustQueueFailure(operation, "database_unavailable");
    throw new TrustQueueOperationError("trust_queue_data_unavailable", 503);
  }

  return data ?? [];
}

function groupBy(rows, keyBuilder) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyBuilder(row);
    if (!key) {
      continue;
    }
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }
  return grouped;
}

export async function loadTrustAdminQueue({
  filter = "all",
  taskId = null,
  limit = 50
} = {}) {
  const client = getAdminClient("load_queue");
  const normalizedFilter = normalizeTrustQueueFilter(filter);
  const boundedLimit = normalizeLimit(limit);
  const blockerList = TRUST_QUEUE_BLOCKERS.join(",");

  let query = client
    .from("product_fact_research_tasks")
    .select(
      "id, intake_id, product_id, subject_id, fact_key, registry_version, research_policy_version, state, priority, blocker_code, blocker_detail, source_observation_id, evidence_candidate_id, evidence_id, attempt_count, next_retry_at, last_research_at, created_at, updated_at, completed_at"
    )
    .or(`state.eq.REVIEW_REQUIRED,blocker_code.in.(${blockerList})`)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);

  if (normalizedFilter !== "all") {
    query = query.eq("blocker_code", normalizedFilter);
  }

  const { data: taskRows, error: taskError } = await query;

  if (taskError) {
    logTrustQueueFailure("load_tasks", "database_unavailable");
    throw new TrustQueueOperationError("trust_queue_data_unavailable", 503);
  }

  const tasks = (taskRows ?? []).map(normalizeTask).filter(isQueueTask);
  const intakeIds = unique(tasks.map((task) => task.intakeId));
  const productIds = unique(tasks.map((task) => task.productId));
  const subjectIds = unique(tasks.map((task) => task.subjectId));
  const observationIds = unique(tasks.map((task) => task.sourceObservationId));
  const evidenceCandidateIds = unique(tasks.map((task) => task.evidenceCandidateId));

  const [intakeRows, productRows, observationRows, evidenceRows, sourceBindingRows] =
    await Promise.all([
      selectByIds(
        client,
        "catalog_trust_intake",
        "id, product_id, source_candidate_id, catalog_revision, category, market, subject_id, identity_state, trust_state, required_fact_policy_version, identity_resolution_version, identity_resolution_detail, created_at, updated_at, last_checked_at",
        "id",
        intakeIds,
        "load_intakes"
      ),
      selectByIds(
        client,
        "products",
        "id, brand, name, category, product_form, image_url",
        "id",
        productIds,
        "load_products"
      ),
      selectByIds(
        client,
        "trust_source_observations",
        "observation_id, source_binding_id, canonical_locator, publisher, source_kind, market, region, locale, observed_claim, product_identity_observation, observation_version, digest_basis, source_content_digest, observed_at, fetched_at",
        "observation_id",
        observationIds,
        "load_observations"
      ),
      selectByIds(
        client,
        "trust_evidence_candidates",
        "candidate_id, normalized_value, evidence_class, evidence_authority, confidence, support_direction, negative_admissibility, market, region, locale, qualifier, candidate_state, canonical_evidence_digest, created_at",
        "candidate_id",
        evidenceCandidateIds,
        "load_evidence_candidates"
      ),
      productIds.length === 0
        ? Promise.resolve([])
        : client
            .from("product_source_bindings")
            .select(
              "binding_id, product_id, source_name, source_url, market_code, locale, binding_state, product_scope_state, last_observed_at"
            )
            .in("product_id", productIds)
            .like("source_name", "%_official")
            .then(({ data, error }) => {
              if (error) {
                logTrustQueueFailure("load_source_bindings", "database_unavailable");
                throw new TrustQueueOperationError("trust_queue_data_unavailable", 503);
              }
              return data ?? [];
            })
    ]);

  const intakes = intakeRows.map(normalizeIntake);
  const intakeMap = new Map(intakes.map((intake) => [intake.id, intake]));
  const productMap = new Map(
    productRows.map((row) => {
      const product = normalizeProduct(row);
      return [product.id, product];
    })
  );
  const observationMap = new Map(
    observationRows.map((row) => {
      const observation = normalizeObservation(row);
      return [observation.id, observation];
    })
  );
  const evidenceMap = new Map(
    evidenceRows.map((row) => {
      const candidate = normalizeEvidenceCandidate(row);
      return [candidate.id, candidate];
    })
  );
  const sourceBindingsByProduct = groupBy(sourceBindingRows, (row) => row.product_id);

  const sourceCandidateIds = unique(intakes.map((intake) => intake.sourceCandidateId));
  const catalogCandidateRows = await selectByIds(
    client,
    "product_candidates",
    "id, source_name, source_url, identity_resolution_state, identity_resolution_version, identity_resolution_evidence",
    "id",
    sourceCandidateIds,
    "load_catalog_candidates"
  );
  const catalogCandidateMap = new Map(
    catalogCandidateRows.map((row) => {
      const candidate = normalizeCatalogCandidate(row);
      return [candidate.id, candidate];
    })
  );

  let currentRows = [];
  let assignmentRows = [];

  if (subjectIds.length > 0) {
    const [currentResult, assignmentResult] = await Promise.all([
      client
        .from("product_fact_current")
        .select("proposition_key, fact_instance_id, subject_id, confirmation_id, updated_at")
        .in("subject_id", subjectIds),
      client
        .from("product_fact_review_assignments")
        .select(
          "assignment_id, subject_id, registry_version, fact_key, proposition_key, operational_state, assigned_to, review_policy_version, updated_at"
        )
        .in("subject_id", subjectIds)
    ]);

    if (currentResult.error || assignmentResult.error) {
      logTrustQueueFailure("load_governed_state", "database_unavailable");
      throw new TrustQueueOperationError("trust_queue_data_unavailable", 503);
    }

    currentRows = currentResult.data ?? [];
    assignmentRows = assignmentResult.data ?? [];
  }

  const factInstanceIds = unique(currentRows.map((row) => row.fact_instance_id));
  const instanceRows = await selectByIds(
    client,
    "product_fact_instances",
    "fact_instance_id, fact_key, semantic_status, value_type, value_boolean, value_enum, value_number, value_unit, value_range_min, value_range_max, value_entity_identifier, market, authority_ceiling, fused_confidence",
    "fact_instance_id",
    factInstanceIds,
    "load_current_instances"
  );
  const instanceMap = new Map(instanceRows.map((row) => [row.fact_instance_id, row]));

  const currentFacts = currentRows
    .map((row) => normalizeCurrentFact(row, instanceMap.get(row.fact_instance_id)))
    .filter(Boolean);
  const currentBySubjectFact = groupBy(
    currentFacts,
    (fact) => `${currentRows.find((row) => row.fact_instance_id === fact.factInstanceId)?.subject_id ?? ""}:${fact.factKey ?? ""}`
  );
  const assignments = assignmentRows.map(normalizeAssignment);
  const assignmentsBySubjectFact = groupBy(
    assignments,
    (assignment) => `${assignment.subjectId ?? ""}:${assignment.factKey ?? ""}`
  );

  const items = tasks.map((task) => {
    const intake = task.intakeId ? intakeMap.get(task.intakeId) ?? null : null;
    const product = task.productId ? productMap.get(task.productId) ?? null : null;
    const catalogCandidate = intake?.sourceCandidateId
      ? catalogCandidateMap.get(intake.sourceCandidateId) ?? null
      : null;
    const sourceBindingRow = task.productId
      ? (sourceBindingsByProduct.get(task.productId) ?? [])[0] ?? null
      : null;
    const subjectFactKey = `${task.subjectId ?? ""}:${task.factKey ?? ""}`;

    return {
      task,
      intake,
      product,
      catalogCandidate,
      sourceBinding: normalizeSourceBinding(sourceBindingRow),
      observation: task.sourceObservationId
        ? observationMap.get(task.sourceObservationId) ?? null
        : null,
      evidenceCandidate: task.evidenceCandidateId
        ? evidenceMap.get(task.evidenceCandidateId) ?? null
        : null,
      currentFacts: currentBySubjectFact.get(subjectFactKey) ?? [],
      reviewAssignments: assignmentsBySubjectFact.get(subjectFactKey) ?? []
    };
  });

  const requestedTaskId = normalizeUuid(taskId);
  const selected =
    items.find((item) => item.task.id === requestedTaskId) ?? items[0] ?? null;
  const blockerCounts = Object.fromEntries(
    TRUST_QUEUE_BLOCKERS.map((blocker) => [
      blocker,
      items.filter((item) => item.task.blockerCode === blocker).length
    ])
  );

  return {
    filter: normalizedFilter,
    visibleBlockers: [...TRUST_QUEUE_BLOCKERS],
    blockerCounts,
    items,
    selected
  };
}
