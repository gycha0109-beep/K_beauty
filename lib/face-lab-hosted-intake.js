import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import hostedSetAuthority from "@/evidence/facelab/face-lab-independent-human-cue-single-hosted-set-20260815-v1.json";
import {
  HOSTED_HUMAN_CUE_ACCESS_MODE,
  HOSTED_HUMAN_CUE_STORAGE_SCHEMA_VERSION,
  stableStringifyHostedHumanCueValue,
  validateHostedHumanCueSubmission
} from "@bejewely/face-contracts";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const HOSTED_HUMAN_CUE_TABLE =
  "tmp_face_lab_independent_human_cue_submissions";

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export class HostedHumanCueIntakeError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "HostedHumanCueIntakeError";
    this.code = code;
    this.status = status;
  }
}

const digest = (value) => createHash("sha256").update(value).digest();

export function isValidHostedHumanCueAccessToken(candidate) {
  const expected = process.env.FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN || "";
  if (
    typeof candidate !== "string" ||
    !ACCESS_TOKEN_PATTERN.test(candidate) ||
    !ACCESS_TOKEN_PATTERN.test(expected)
  ) {
    return false;
  }
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function getHostedHumanCueAuthority() {
  return hostedSetAuthority;
}

export async function persistHostedHumanCueSubmission({
  payload,
  testSubmission = false
}) {
  const validation = validateHostedHumanCueSubmission(
    payload,
    hostedSetAuthority
  );
  if (!validation.ok) {
    throw new HostedHumanCueIntakeError("hosted_submission_invalid", 400);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new HostedHumanCueIntakeError("hosted_intake_unavailable", 503);
  }

  const submittedAt = new Date().toISOString();
  const responsePayloadSha256 = createHash("sha256")
    .update(stableStringifyHostedHumanCueValue(payload), "utf8")
    .digest("hex");
  const row = {
    campaign_key: payload.campaignKey,
    access_mode: HOSTED_HUMAN_CUE_ACCESS_MODE,
    intake_version: payload.intakeVersion,
    protocol_version: payload.protocolVersion,
    ui_version: payload.uiVersion,
    source_authority_digest: payload.sourceAuthorityDigest,
    target_axis_definition_digest: payload.targetAxisDefinitionDigest,
    packet_authority_digest: payload.hostedSetAuthorityDigest,
    distribution_mode: payload.distributionMode,
    submission_status: testSubmission ? "test" : "submitted",
    session_id: payload.sessionId,
    started_at: payload.startedAt,
    submitted_at: submittedAt,
    client_submitted_at: payload.clientSubmittedAt,
    response_payload_json: payload,
    response_payload_sha256: responsePayloadSha256,
    completion_summary_json: payload.completion,
    reviewer_attestations_json: payload.independenceAttestation,
    storage_schema_version: HOSTED_HUMAN_CUE_STORAGE_SCHEMA_VERSION
  };

  const { data, error } = await supabase
    .from(HOSTED_HUMAN_CUE_TABLE)
    .insert(row)
    .select("id, submission_status, submitted_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HostedHumanCueIntakeError("hosted_submission_duplicate", 409);
    }
    throw new HostedHumanCueIntakeError("hosted_intake_write_failed", 503);
  }

  return {
    id: data.id,
    status: data.submission_status,
    submittedAt: data.submitted_at,
    responsePayloadSha256
  };
}
