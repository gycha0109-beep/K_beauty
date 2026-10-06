import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

const TARGET = Object.freeze({
  productId: "888eca86-af25-4a12-b9ea-47922d83f520",
  subjectId: "994d7edb-7432-40c3-b09f-08cd59f91627",
  sourceCandidateId: "ce1653d4-5ea2-47a0-bf79-d39f9fb72ae6",
  reviewedIdentity: Object.freeze({
    variant_key: null,
    variant_key_reviewed_as_null: true,
    formulation_revision_key:
      "official-snapshot:c0ea336524925d3d493d73c43e49207e",
    formulation_label:
      "Initial official product snapshot from GPT catalog intake",
    market_applicability: "KR",
    region_applicability: null,
    valid_from: null,
    valid_to: null
  })
});

export class SubjectAuthorityUpgradeError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "SubjectAuthorityUpgradeError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 500) {
  throw new SubjectAuthorityUpgradeError(code, status);
}

function normalizeUuid(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeHash(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return HASH_PATTERN.test(normalized) ? normalized : null;
}

function normalizeRequestId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : null;
}

function client() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    fail("subject_authority_upgrade_service_unavailable", 503);
  }
  return supabase;
}

function assertTarget(result) {
  if (
    normalizeUuid(result?.subject_id) !== TARGET.subjectId ||
    normalizeUuid(result?.product_id) !== TARGET.productId ||
    normalizeUuid(result?.source_candidate_id) !== TARGET.sourceCandidateId
  ) {
    fail("subject_authority_upgrade_boundary_mismatch", 409);
  }
  return result;
}

function mapRpcError(error, fallback) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");

  if (
    message.includes("capability_required") ||
    message.includes("access_required") ||
    code === "42501"
  ) {
    fail("subject_authority_upgrade_forbidden", 403);
  }
  if (
    message.includes("stale_preflight") ||
    message.includes("mismatch") ||
    message.includes("conflict") ||
    code === "55000"
  ) {
    fail("subject_authority_upgrade_conflict", 409);
  }
  if (message.includes("invalid") || code === "22023") {
    fail("subject_authority_upgrade_invalid_request", 400);
  }
  fail(fallback, 503);
}

export async function runCosrxAuthorityPreflight(actorUserId) {
  const actorId = normalizeUuid(actorUserId);
  if (!actorId) {
    fail("subject_authority_upgrade_invalid_request", 400);
  }

  const supabase = client();
  const { data, error } = await supabase.rpc(
    "admin_preflight_subject_identity_authority_upgrade_v1",
    {
      p_actor_user_id: actorId,
      p_subject_id: TARGET.subjectId,
      p_source_candidate_id: TARGET.sourceCandidateId,
      p_reviewed_identity: TARGET.reviewedIdentity
    }
  );

  if (error) {
    mapRpcError(error, "subject_authority_upgrade_preflight_failed");
  }

  const result = assertTarget(data);
  return {
    status: result.status,
    subjectId: result.subject_id,
    currentAuthority: result.current_identity_resolution_version,
    targetAuthority: result.target_identity_resolution_version,
    payloadDigest: result.payload_digest,
    prestateDigest: result.prestate_digest,
    dependentCounts: result.dependent_counts,
    plannedWrites: result.planned_writes,
    requiresExplicitConfirmation:
      result.requires_explicit_confirmation === true
  };
}

export async function confirmCosrxAuthorityUpgrade({
  actorUserId,
  requestId,
  payloadDigest,
  prestateDigest
}) {
  const actorId = normalizeUuid(actorUserId);
  const normalizedRequestId = normalizeRequestId(requestId);
  const normalizedPayloadDigest = normalizeHash(payloadDigest);
  const normalizedPrestateDigest = normalizeHash(prestateDigest);

  if (
    !actorId ||
    !normalizedRequestId ||
    !normalizedPayloadDigest ||
    !normalizedPrestateDigest
  ) {
    fail("subject_authority_upgrade_invalid_request", 400);
  }

  const supabase = client();
  const { data: current, error: preflightError } = await supabase.rpc(
    "admin_preflight_subject_identity_authority_upgrade_v1",
    {
      p_actor_user_id: actorId,
      p_subject_id: TARGET.subjectId,
      p_source_candidate_id: TARGET.sourceCandidateId,
      p_reviewed_identity: TARGET.reviewedIdentity
    }
  );

  if (preflightError) {
    mapRpcError(preflightError, "subject_authority_upgrade_preflight_failed");
  }

  assertTarget(current);

  if (current?.status === "already_upgraded") {
    return {
      status: "already_upgraded",
      idempotent: true,
      subjectId: current.subject_id,
      authority: current.current_identity_resolution_version
    };
  }

  if (
    current?.status !== "ready" ||
    current?.payload_digest !== normalizedPayloadDigest ||
    current?.prestate_digest !== normalizedPrestateDigest ||
    current?.requires_explicit_confirmation !== true
  ) {
    fail("subject_authority_upgrade_stale_preflight", 409);
  }

  const { data, error } = await supabase.rpc(
    "admin_upgrade_product_fact_subject_identity_authority_v1",
    {
      p_actor_user_id: actorId,
      p_request_id: normalizedRequestId,
      p_payload: current.payload,
      p_expected_payload_digest: normalizedPayloadDigest,
      p_expected_prestate_digest: normalizedPrestateDigest
    }
  );

  if (error) {
    mapRpcError(error, "subject_authority_upgrade_confirmation_failed");
  }

  const result = assertTarget(data);
  return {
    status: result.status,
    idempotent: result.idempotent === true,
    subjectId: result.subject_id,
    authority: result.identity_resolution_version
  };
}
