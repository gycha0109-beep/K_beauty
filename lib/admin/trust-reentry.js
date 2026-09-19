import "server-only";

import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeSafeLog } from "@/lib/security/error-redaction";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

const RETRYABLE_RESEARCH_BLOCKERS = new Set([
  "SOURCE_BLOCKED",
  "EVIDENCE_INSUFFICIENT"
]);

const PRESERVED_STATES = new Set([
  "EVIDENCE_CANDIDATE",
  "PREFLIGHT_READY",
  "CONFIRMED",
  "ALREADY_COVERED"
]);

export class TrustReentryError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "TrustReentryError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 500) {
  throw new TrustReentryError(code, status);
}

function normalizeUuid(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function getAdminClient(operation) {
  const client = createSupabaseAdminClient();
  if (!client) {
    writeSafeLog("warn", {
      event: "admin_trust_reentry_failed",
      operation,
      category: "configuration_unavailable"
    });
    fail("trust_reentry_service_unavailable", 503);
  }
  return client;
}

function digest(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

async function maybeSingle(client, table, columns, column, value) {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq(column, value)
    .maybeSingle();

  if (error) {
    fail("trust_reentry_data_unavailable", 503);
  }
  return data ?? null;
}

async function loadSnapshot(client, taskId) {
  const task = await maybeSingle(
    client,
    "product_fact_research_tasks",
    "id,intake_id,product_id,subject_id,fact_key,registry_version,research_policy_version,state,blocker_code,blocker_detail,attempt_count,next_retry_at,source_observation_id,evidence_candidate_id,updated_at",
    "id",
    taskId
  );
  if (!task) {
    fail("trust_reentry_task_not_found", 404);
  }

  const intake = await maybeSingle(
    client,
    "catalog_trust_intake",
    "id,product_id,source_candidate_id,category,market,subject_id,identity_state,trust_state,required_fact_policy_version,identity_resolution_version,identity_resolution_detail,updated_at",
    "id",
    task.intake_id
  );
  if (!intake || normalizeUuid(intake.product_id) !== normalizeUuid(task.product_id)) {
    fail("trust_reentry_lineage_mismatch", 409);
  }

  return { task, intake };
}

function classify(snapshot) {
  const { task, intake } = snapshot;

  if (PRESERVED_STATES.has(task.state)) {
    return {
      action: "NOOP",
      reasonCode: "GOVERNED_OR_COVERED_STATE_PRESERVED"
    };
  }

  if (intake.identity_state !== "EXACT_SUBJECT_FOUND" || !task.subject_id) {
    return {
      action: "IDENTITY_REVALIDATION",
      reasonCode: task.blocker_code || intake.identity_state || "IDENTITY_REVALIDATION_REQUIRED"
    };
  }

  if (
    (task.state === "BLOCKED" || task.state === "REVIEW_REQUIRED") &&
    RETRYABLE_RESEARCH_BLOCKERS.has(task.blocker_code)
  ) {
    return {
      action: "RESEARCH_REQUEUE",
      reasonCode: "MANUAL_RETRY_ELIGIBLE_RESEARCH_BLOCKER"
    };
  }

  return {
    action: "NOOP",
    reasonCode: "MANUAL_RETRY_NOT_ELIGIBLE_FOR_FORCE_RESET"
  };
}

function snapshotDigest(snapshot) {
  return digest(
    JSON.stringify({
      task: {
        id: snapshot.task.id,
        intake_id: snapshot.task.intake_id,
        product_id: snapshot.task.product_id,
        subject_id: snapshot.task.subject_id,
        fact_key: snapshot.task.fact_key,
        registry_version: snapshot.task.registry_version,
        research_policy_version: snapshot.task.research_policy_version,
        state: snapshot.task.state,
        blocker_code: snapshot.task.blocker_code,
        attempt_count: snapshot.task.attempt_count,
        source_observation_id: snapshot.task.source_observation_id,
        evidence_candidate_id: snapshot.task.evidence_candidate_id,
        updated_at: snapshot.task.updated_at
      },
      intake: {
        id: snapshot.intake.id,
        product_id: snapshot.intake.product_id,
        subject_id: snapshot.intake.subject_id,
        identity_state: snapshot.intake.identity_state,
        trust_state: snapshot.intake.trust_state,
        required_fact_policy_version:
          snapshot.intake.required_fact_policy_version,
        identity_resolution_version:
          snapshot.intake.identity_resolution_version,
        updated_at: snapshot.intake.updated_at
      }
    })
  );
}

export async function runTrustReentryPreflight({ taskId }) {
  const normalizedTaskId = normalizeUuid(taskId);
  if (!normalizedTaskId) {
    fail("trust_reentry_invalid_request", 400);
  }

  const client = getAdminClient("preflight");
  const snapshot = await loadSnapshot(client, normalizedTaskId);
  const classification = classify(snapshot);
  const stateDigest = snapshotDigest(snapshot);
  const preflightHash = digest(
    `trust-reentry-preflight-v1|MANUAL_RETRY|${normalizedTaskId}|${stateDigest}`
  );

  return {
    status: "ready_for_manual_revalidation",
    eventType: "MANUAL_RETRY",
    taskId: normalizedTaskId,
    intakeId: snapshot.intake.id,
    productId: snapshot.task.product_id,
    factKey: snapshot.task.fact_key,
    taskState: snapshot.task.state,
    blockerCode: snapshot.task.blocker_code,
    identityState: snapshot.intake.identity_state,
    trustState: snapshot.intake.trust_state,
    plannedAction: classification.action,
    reasonCode: classification.reasonCode,
    stateDigest,
    preflightHash,
    productFactWrites: 0,
    subjectWrites: 0,
    recommendationWrites: 0,
    currentInvalidation: false
  };
}

function mapRpcError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");

  if (message.includes("not_found") || code === "P0002") {
    fail("trust_reentry_not_found", 404);
  }
  if (
    message.includes("invalid") ||
    message.includes("mismatch") ||
    code === "22023" ||
    code === "23514"
  ) {
    fail("trust_reentry_invalid_request", 400);
  }
  if (message.includes("collision") || code === "23505") {
    fail("trust_reentry_collision", 409);
  }
  fail("trust_reentry_rpc_failed", 503);
}

export async function confirmTrustManualReentry({
  actorUserId,
  taskId,
  preflightHash,
  requestId
}) {
  const actorId = normalizeUuid(actorUserId);
  const normalizedTaskId = normalizeUuid(taskId);
  const normalizedHash =
    typeof preflightHash === "string" ? preflightHash.trim().toLowerCase() : "";
  const normalizedRequestId =
    typeof requestId === "string" ? requestId.trim() : "";

  if (
    !actorId ||
    !normalizedTaskId ||
    !HASH_PATTERN.test(normalizedHash) ||
    !REQUEST_ID_PATTERN.test(normalizedRequestId)
  ) {
    fail("trust_reentry_invalid_request", 400);
  }

  const client = getAdminClient("confirm");
  const current = await runTrustReentryPreflight({ taskId: normalizedTaskId });
  if (current.preflightHash !== normalizedHash) {
    fail("trust_reentry_stale_preflight", 409);
  }

  const triggerFingerprint = digest(
    `trust-manual-retry-v1|${normalizedTaskId}|${normalizedRequestId}`
  );

  const { data: requested, error: requestError } = await client.rpc(
    "request_trust_reentry_v1",
    {
      p_event_type: "MANUAL_RETRY",
      p_product_id: current.productId,
      p_intake_id: current.intakeId,
      p_research_task_id: normalizedTaskId,
      p_trigger_fingerprint: triggerFingerprint,
      p_actor_user_id: actorId,
      p_request_id: normalizedRequestId,
      p_event_payload: {
        preflight_hash: normalizedHash,
        state_digest: current.stateDigest,
        planned_action: current.plannedAction,
        reason_code: current.reasonCode
      }
    }
  );
  if (requestError) {
    mapRpcError(requestError);
  }

  const eventId = normalizeUuid(requested?.event_id);
  if (!eventId) {
    fail("trust_reentry_invalid_rpc_result", 503);
  }

  const { data: processed, error: processError } = await client.rpc(
    "process_trust_reentry_event_v1",
    { p_event_id: eventId }
  );
  if (processError) {
    mapRpcError(processError);
  }

  const poststate = await loadSnapshot(client, normalizedTaskId);

  return {
    status: "revalidated",
    eventId,
    eventKey: requested.event_key,
    requestId: normalizedRequestId,
    requestIdempotent: requested.idempotent === true,
    processIdempotent: processed?.idempotent === true,
    disposition: processed?.disposition ?? null,
    reasonCode: processed?.reason_code ?? processed?.detail?.reason_code ?? null,
    task: poststate.task,
    intake: poststate.intake,
    productFactWrites: 0,
    subjectWrites: 0,
    recommendationWrites: 0,
    currentInvalidation: false
  };
}
