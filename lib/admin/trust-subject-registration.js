import "server-only";

import {
  buildTrustSubjectIdentityProposal,
  canonicalTrustSubjectJson,
  TrustSubjectIdentityError
} from "@/lib/admin/trust-subject-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeSafeLog } from "@/lib/security/error-redaction";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

export class TrustSubjectRegistrationError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "TrustSubjectRegistrationError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 500) {
  throw new TrustSubjectRegistrationError(code, status);
}

function normalizeUuid(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function logFailure(operation, category) {
  writeSafeLog("warn", {
    event: "admin_trust_subject_registration_failed",
    operation,
    category,
    dependency:
      category === "configuration_unavailable" ? "application" : "supabase",
    retryable: category === "database_unavailable"
  });
}

function getAdminClient(operation) {
  const client = createSupabaseAdminClient();
  if (!client) {
    logFailure(operation, "configuration_unavailable");
    fail("trust_subject_registration_service_unavailable", 503);
  }
  return client;
}

function mapIdentityError(error) {
  if (!(error instanceof TrustSubjectIdentityError)) {
    throw error;
  }

  const conflictCodes = new Set([
    "trust_subject_registration_state_not_reviewable",
    "trust_subject_registration_lineage_mismatch",
    "trust_subject_identity_catalog_authority_boundary_invalid",
    "trust_subject_identity_market_mismatch"
  ]);

  fail(error.code, conflictCodes.has(error.code) ? 409 : 400);
}

function mapRpcError(error, fallbackCode) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");

  if (message.includes("product_fact_subject_semantic_key_conflict") || code === "23505") {
    fail("trust_subject_registration_semantic_key_conflict", 409);
  }
  if (
    message.includes("capability_required") ||
    message.includes("access_required") ||
    message.includes("admin_membership")
  ) {
    fail("trust_subject_registration_forbidden", 403);
  }
  if (message.includes("not_found") || code === "P0002") {
    fail("trust_subject_registration_not_found", 404);
  }
  if (
    message.includes("invalid") ||
    code === "22023" ||
    code === "23514"
  ) {
    fail("trust_subject_registration_invalid_request", 400);
  }

  logFailure(fallbackCode, "database_unavailable");
  fail(fallbackCode, 503);
}

async function maybeSingle(client, table, columns, column, value, operation) {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq(column, value)
    .maybeSingle();

  if (error) {
    logFailure(operation, "database_unavailable");
    fail("trust_subject_registration_data_unavailable", 503);
  }

  return data ?? null;
}

async function loadSnapshot(client, taskId) {
  const task = await maybeSingle(
    client,
    "product_fact_research_tasks",
    "id, intake_id, product_id, subject_id, fact_key, registry_version, state, blocker_code, blocker_detail, updated_at",
    "id",
    taskId,
    "load_task"
  );

  if (!task) {
    fail("trust_subject_registration_task_not_found", 404);
  }

  const intake = await maybeSingle(
    client,
    "catalog_trust_intake",
    "id, product_id, source_candidate_id, category, market, subject_id, identity_state, trust_state, identity_resolution_version, identity_resolution_detail, updated_at",
    "id",
    task.intake_id,
    "load_intake"
  );

  if (!intake) {
    fail("trust_subject_registration_intake_not_found", 409);
  }

  const [product, candidate, tasksResult] = await Promise.all([
    maybeSingle(
      client,
      "products",
      "id, brand, name, category, product_form",
      "id",
      task.product_id,
      "load_product"
    ),
    intake.source_candidate_id
      ? maybeSingle(
          client,
          "product_candidates",
          "id, matched_product_id, source_name, source_url, review_status, reviewed_at, reviewed_by, promotion_payload, identity_resolution_state, identity_resolution_version, identity_resolution_evidence, updated_at",
          "id",
          intake.source_candidate_id,
          "load_source_candidate"
        )
      : Promise.resolve(null),
    client
      .from("product_fact_research_tasks")
      .select(
        "id, intake_id, product_id, subject_id, fact_key, registry_version, state, blocker_code, updated_at"
      )
      .eq("intake_id", intake.id)
      .order("priority", { ascending: true })
      .order("fact_key", { ascending: true })
  ]);

  if (tasksResult.error) {
    logFailure("load_intake_tasks", "database_unavailable");
    fail("trust_subject_registration_data_unavailable", 503);
  }

  if (!product || !candidate) {
    fail("trust_subject_registration_identity_source_missing", 409);
  }

  return {
    task,
    intake,
    product,
    candidate,
    tasks: tasksResult.data ?? []
  };
}

function subjectPayloadFromRow(row) {
  if (!row) {
    return null;
  }

  return {
    product_id: row.product_id,
    subject_semantic_key: row.subject_semantic_key,
    subject_identity_serializer_version:
      row.subject_identity_serializer_version,
    variant_key: row.variant_key,
    formulation_revision_key: row.formulation_revision_key,
    formulation_label: row.formulation_label,
    identity_status: row.identity_status,
    identity_resolution_version: row.identity_resolution_version,
    current_state: row.current_state,
    market_applicability: row.market_applicability,
    region_applicability: row.region_applicability,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    predecessor_subject_id: row.predecessor_subject_id,
    supersession_kind: row.supersession_kind
  };
}

async function loadExistingSubject(client, proposal) {
  const row = await maybeSingle(
    client,
    "product_fact_subjects",
    "subject_id, product_id, subject_semantic_key, subject_identity_serializer_version, variant_key, formulation_revision_key, formulation_label, identity_status, identity_resolution_version, current_state, market_applicability, region_applicability, valid_from, valid_to, predecessor_subject_id, supersession_kind",
    "subject_semantic_key",
    proposal.payload.subject_semantic_key,
    "load_existing_subject"
  );

  if (!row) {
    return null;
  }

  if (
    canonicalTrustSubjectJson(subjectPayloadFromRow(row)) !==
    canonicalTrustSubjectJson(proposal.payload)
  ) {
    fail("trust_subject_registration_semantic_key_conflict", 409);
  }

  return row;
}

async function loadCurrentMarketSubjects(client, proposal) {
  const { data, error } = await client
    .from("product_fact_subjects")
    .select(
      "subject_id, subject_semantic_key, variant_key, formulation_revision_key, market_applicability"
    )
    .eq("product_id", proposal.productId)
    .eq("identity_status", "resolved")
    .eq("current_state", "current")
    .eq("market_applicability", proposal.payload.market_applicability)
    .limit(10);

  if (error) {
    logFailure("load_current_market_subjects", "database_unavailable");
    fail("trust_subject_registration_data_unavailable", 503);
  }

  return data ?? [];
}

async function buildCurrentPreflight(client, taskId, reviewedIdentity) {
  const snapshot = await loadSnapshot(client, taskId);
  let proposal;

  try {
    proposal = buildTrustSubjectIdentityProposal(
      snapshot,
      reviewedIdentity,
      { requireInitialReviewState: false }
    );
  } catch (error) {
    mapIdentityError(error);
  }

  const existingSubject = await loadExistingSubject(client, proposal);
  const currentMarketSubjects = await loadCurrentMarketSubjects(
    client,
    proposal
  );
  const competingSubject = currentMarketSubjects.find(
    (subject) =>
      subject.subject_semantic_key !== proposal.payload.subject_semantic_key
  );

  if (competingSubject) {
    fail("trust_subject_registration_competing_subject_detected", 409);
  }

  if (!existingSubject) {
    try {
      proposal = buildTrustSubjectIdentityProposal(
        snapshot,
        reviewedIdentity,
        { requireInitialReviewState: true }
      );
    } catch (error) {
      mapIdentityError(error);
    }
  }

  return {
    snapshot,
    proposal,
    existingSubject,
    alreadyRegistered: Boolean(existingSubject),
    currentMarketSubjectCount: currentMarketSubjects.length
  };
}

function publicPreflight(current) {
  const { snapshot, proposal, existingSubject, alreadyRegistered } = current;
  const authorityBoundary =
    snapshot.candidate?.identity_resolution_evidence?.authority_boundary ?? {};

  return {
    status: alreadyRegistered
      ? "subject_already_registered"
      : "ready_for_subject_registration",
    taskId: proposal.taskId,
    intakeId: proposal.intakeId,
    productId: proposal.productId,
    reviewedIdentity: proposal.reviewedIdentity,
    proposal: {
      subject_semantic_key: proposal.payload.subject_semantic_key,
      subject_identity_serializer_version:
        proposal.payload.subject_identity_serializer_version,
      variant_key: proposal.payload.variant_key,
      formulation_revision_key:
        proposal.payload.formulation_revision_key,
      formulation_label: proposal.payload.formulation_label,
      identity_status: proposal.payload.identity_status,
      identity_resolution_version:
        proposal.payload.identity_resolution_version,
      current_state: proposal.payload.current_state,
      market_applicability: proposal.payload.market_applicability,
      region_applicability: proposal.payload.region_applicability,
      valid_from: proposal.payload.valid_from,
      valid_to: proposal.payload.valid_to
    },
    catalogContext: {
      identityState: snapshot.candidate.identity_resolution_state,
      identityVersion: snapshot.candidate.identity_resolution_version,
      productFactWriteAllowed:
        authorityBoundary.product_fact_write_allowed === true,
      treatedAsProductFactAuthority: false
    },
    proposalDigest: proposal.proposalDigest,
    stateDigest: proposal.stateDigest,
    preflightHash: proposal.preflightHash,
    existingSubjectId: existingSubject?.subject_id ?? null,
    plannedWrites: {
      productFactSubjects: alreadyRegistered ? 0 : 1,
      evidence: 0,
      confirmations: 0,
      recommendations: 0
    },
    requiresExplicitConfirmation: true,
    automaticEvidenceAdoption: false,
    automaticFactConfirmation: false,
    recommendationMutation: false
  };
}

export async function runTrustSubjectRegistrationPreflight({
  taskId,
  reviewedIdentity
}) {
  const normalizedTaskId = normalizeUuid(taskId);
  if (!normalizedTaskId) {
    fail("trust_subject_registration_invalid_request", 400);
  }

  const client = getAdminClient("preflight");
  const current = await buildCurrentPreflight(
    client,
    normalizedTaskId,
    reviewedIdentity
  );
  return publicPreflight(current);
}

async function readPoststate(client, intakeId) {
  const intake = await maybeSingle(
    client,
    "catalog_trust_intake",
    "id, product_id, subject_id, identity_state, trust_state, identity_resolution_version, identity_resolution_detail, updated_at",
    "id",
    intakeId,
    "read_poststate_intake"
  );

  const { data: tasks, error } = await client
    .from("product_fact_research_tasks")
    .select(
      "id, fact_key, subject_id, state, blocker_code, blocker_detail, updated_at"
    )
    .eq("intake_id", intakeId)
    .order("priority", { ascending: true })
    .order("fact_key", { ascending: true });

  if (error) {
    logFailure("read_poststate_tasks", "database_unavailable");
    fail("trust_subject_registration_data_unavailable", 503);
  }

  return { intake, tasks: tasks ?? [] };
}

export async function confirmTrustSubjectRegistration({
  actorUserId,
  taskId,
  reviewedIdentity,
  preflightHash,
  proposalDigest,
  requestId
}) {
  const normalizedActorId = normalizeUuid(actorUserId);
  const normalizedTaskId = normalizeUuid(taskId);
  const normalizedPreflightHash =
    typeof preflightHash === "string"
      ? preflightHash.trim().toLowerCase()
      : "";
  const normalizedProposalDigest =
    typeof proposalDigest === "string"
      ? proposalDigest.trim().toLowerCase()
      : "";
  const normalizedRequestId =
    typeof requestId === "string" ? requestId.trim() : "";

  if (
    !normalizedActorId ||
    !normalizedTaskId ||
    !HASH_PATTERN.test(normalizedPreflightHash) ||
    !HASH_PATTERN.test(normalizedProposalDigest) ||
    !REQUEST_ID_PATTERN.test(normalizedRequestId)
  ) {
    fail("trust_subject_registration_invalid_request", 400);
  }

  const client = getAdminClient("confirm");
  const current = await buildCurrentPreflight(
    client,
    normalizedTaskId,
    reviewedIdentity
  );

  if (current.proposal.proposalDigest !== normalizedProposalDigest) {
    fail("trust_subject_registration_stale_proposal", 409);
  }

  if (
    !current.alreadyRegistered &&
    current.proposal.preflightHash !== normalizedPreflightHash
  ) {
    fail("trust_subject_registration_stale_preflight", 409);
  }

  const { data: registration, error: registrationError } = await client.rpc(
    "admin_register_product_fact_subject_v1",
    {
      p_actor_user_id: normalizedActorId,
      p_request_id: normalizedRequestId,
      p_payload: current.proposal.payload
    }
  );

  if (registrationError) {
    mapRpcError(
      registrationError,
      "trust_subject_registration_rpc_failed"
    );
  }

  const registeredSubjectId = normalizeUuid(registration?.subject_id);
  if (!registeredSubjectId) {
    fail("trust_subject_registration_invalid_rpc_result", 503);
  }

  const { error: processError } = await client.rpc(
    "process_catalog_trust_product_v1",
    { p_product_id: current.proposal.productId }
  );

  if (processError) {
    mapRpcError(
      processError,
      "trust_subject_registration_resolution_refresh_failed"
    );
  }

  const poststate = await readPoststate(client, current.proposal.intakeId);

  if (
    normalizeUuid(poststate.intake?.subject_id) !== registeredSubjectId ||
    poststate.intake?.identity_state !== "EXACT_SUBJECT_FOUND" ||
    poststate.tasks.some(
      (task) =>
        normalizeUuid(task.subject_id) !== registeredSubjectId ||
        task.blocker_code === "SUBJECT_CREATION_REQUIRED"
    )
  ) {
    fail("trust_subject_registration_postcondition_failed", 409);
  }

  return {
    status: "registered_and_resolved",
    idempotent:
      registration?.idempotent === true || current.alreadyRegistered,
    subjectId: registeredSubjectId,
    productId: current.proposal.productId,
    subjectSemanticKey:
      current.proposal.payload.subject_semantic_key,
    formulationRevisionKey:
      current.proposal.payload.formulation_revision_key,
    intake: poststate.intake,
    tasks: poststate.tasks,
    automaticEvidenceAdoption: false,
    automaticFactConfirmation: false,
    recommendationMutation: false
  };
}
