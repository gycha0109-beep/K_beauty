import "server-only";
import {
  createHash,
  createHmac,
  timingSafeEqual
} from "node:crypto";
import neutralAuthority from "@/evidence/facelab/face-count-neutral-review-authority-20260905-v2.json";
import {
  NEUTRAL_FACE_COUNT_ACCESS_MODE,
  NEUTRAL_FACE_COUNT_TABLE,
  getNeutralFaceCountPublicModel,
  stableStringifyNeutralFaceCountValue,
  validateNeutralFaceCountSubmission
} from "@/lib/face-lab-neutral-face-count-contract.mjs";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const NEUTRAL_FACE_COUNT_RECEIPT_COOKIE =
  "facelab_neutral_receipt_v1";

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const RECEIPT_PATTERN = /^v1\.([0-9a-f-]{36})\.(hsi_[0-9a-f-]{36})\.([0-9a-f]{64})\.([A-Za-z0-9_-]{43})$/i;

export class NeutralFaceCountIntakeError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "NeutralFaceCountIntakeError";
    this.code = code;
    this.status = status;
  }
}

function getReceiptSigningKey() {
  const secret = process.env.FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN || "";
  if (!ACCESS_TOKEN_PATTERN.test(secret)) {
    throw new NeutralFaceCountIntakeError("neutral_receipt_unavailable", 503);
  }
  return createHash("sha256")
    .update(`face-count-neutral-receipt-v1\0${secret}`, "utf8")
    .digest();
}

function signReceiptMaterial(material) {
  return createHmac("sha256", getReceiptSigningKey())
    .update(material, "utf8")
    .digest("base64url");
}

function issueReceiptValue({ id, sessionId, responsePayloadSha256 }) {
  const material = `v1.${id}.${sessionId}.${responsePayloadSha256}`;
  return `${material}.${signReceiptMaterial(material)}`;
}

function parseVerifiedReceiptValue(value) {
  if (typeof value !== "string") return null;
  const match = value.match(RECEIPT_PATTERN);
  if (!match) return null;
  const [, id, sessionId, responsePayloadSha256, signature] = match;
  const material = `v1.${id}.${sessionId}.${responsePayloadSha256}`;
  let expected;
  try {
    expected = signReceiptMaterial(material);
  } catch {
    return null;
  }
  const actualBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }
  return { id, sessionId, responsePayloadSha256 };
}

export function getNeutralFaceCountAuthority() {
  return neutralAuthority;
}

export function getNeutralFaceCountReviewerModel(receiptState = null) {
  return getNeutralFaceCountPublicModel(neutralAuthority, receiptState);
}

export async function persistNeutralFaceCountSubmission({
  payload,
  testSubmission = false
}) {
  const validation = validateNeutralFaceCountSubmission(
    payload,
    neutralAuthority
  );
  if (!validation.ok) {
    throw new NeutralFaceCountIntakeError("neutral_submission_invalid", 400);
  }

  if (!testSubmission) getReceiptSigningKey();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new NeutralFaceCountIntakeError("neutral_intake_unavailable", 503);
  }

  const submittedAt = new Date().toISOString();
  const responsePayloadSha256 = createHash("sha256")
    .update(stableStringifyNeutralFaceCountValue(payload), "utf8")
    .digest("hex");
  const row = {
    campaign_key: neutralAuthority.campaignKey,
    access_mode: NEUTRAL_FACE_COUNT_ACCESS_MODE,
    intake_version: neutralAuthority.intakeVersion,
    authority_digest: neutralAuthority.authorityDigest,
    submission_status: testSubmission ? "test" : "submitted",
    session_id: payload.sessionId,
    started_at: payload.startedAt,
    submitted_at: submittedAt,
    client_submitted_at: payload.clientSubmittedAt,
    response_payload_json: payload,
    response_payload_sha256: responsePayloadSha256,
    storage_schema_version: neutralAuthority.storageSchemaVersion
  };

  const { data, error } = await supabase
    .from(NEUTRAL_FACE_COUNT_TABLE)
    .insert(row)
    .select("id, session_id, submission_status, submitted_at")
    .single();

  let persisted = data;
  if (error) {
    if (error.code !== "23505") {
      throw new NeutralFaceCountIntakeError("neutral_intake_write_failed", 503);
    }
    const expectedStatus = testSubmission ? "test" : "submitted";
    const { data: existing, error: existingError } = await supabase
      .from(NEUTRAL_FACE_COUNT_TABLE)
      .select("id, session_id, submission_status, submitted_at, authority_digest, response_payload_sha256")
      .eq("campaign_key", neutralAuthority.campaignKey)
      .eq("session_id", payload.sessionId)
      .single();
    if (
      existingError ||
      !existing ||
      existing.submission_status !== expectedStatus ||
      existing.authority_digest !== neutralAuthority.authorityDigest ||
      existing.response_payload_sha256 !== responsePayloadSha256
    ) {
      throw new NeutralFaceCountIntakeError("neutral_submission_duplicate", 409);
    }
    persisted = existing;
  }

  return {
    id: persisted.id,
    sessionId: persisted.session_id,
    status: persisted.submission_status,
    submittedAt: persisted.submitted_at,
    responsePayloadSha256,
    receiptValue: testSubmission
      ? null
      : issueReceiptValue({
          id: persisted.id,
          sessionId: persisted.session_id,
          responsePayloadSha256
        })
  };
}

function readReceiptValue(request) {
  return request.cookies?.get?.(NEUTRAL_FACE_COUNT_RECEIPT_COOKIE)?.value || "";
}

export async function getVerifiedNeutralFaceCountReceiptState(request) {
  const parsed = parseVerifiedReceiptValue(readReceiptValue(request));
  if (!parsed) return { accepted: false, hostedSessionId: null };

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { accepted: false, hostedSessionId: null };

  const { data, error } = await supabase
    .from(NEUTRAL_FACE_COUNT_TABLE)
    .select("id, session_id, submission_status, authority_digest, response_payload_sha256")
    .eq("id", parsed.id)
    .eq("session_id", parsed.sessionId)
    .eq("submission_status", "submitted")
    .eq("authority_digest", neutralAuthority.authorityDigest)
    .eq("response_payload_sha256", parsed.responsePayloadSha256)
    .single();

  if (error || !data) return { accepted: false, hostedSessionId: null };
  return { accepted: true, hostedSessionId: data.session_id };
}

export async function requireVerifiedNeutralFaceCountReceipt(
  request,
  hostedSessionId
) {
  const state = await getVerifiedNeutralFaceCountReceiptState(request);
  if (!state.accepted || state.hostedSessionId !== hostedSessionId) {
    throw new NeutralFaceCountIntakeError("neutral_receipt_required", 428);
  }
  return state;
}

export function setNeutralFaceCountReceiptCookie(response, receiptValue) {
  if (!receiptValue) return response;
  response.cookies.set(NEUTRAL_FACE_COUNT_RECEIPT_COOKIE, receiptValue, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6
  });
  return response;
}

export function clearNeutralFaceCountReceiptCookie(response) {
  response.cookies.set(NEUTRAL_FACE_COUNT_RECEIPT_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
