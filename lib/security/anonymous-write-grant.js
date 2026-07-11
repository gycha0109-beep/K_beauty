import "server-only";

import {
  ANONYMOUS_RESULT_WRITE_OPERATION,
  ANONYMOUS_TRACK_WRITE_OPERATION,
  createAnonymousResultFingerprintHash,
  createAnonymousTrackEventFingerprintHash,
  createAnonymousWriteGrantTokens,
  createAnonymousWriteJtiHash,
  createAnonymousWritePrincipalHash,
  getAnonymousWriteGrantResultFingerprintInput,
  verifyAnonymousWriteGrantToken
} from "@/lib/security/anonymous-write-grant-core";
import { resolveExistingAnonymousCookiePayload } from "@/lib/security/analysis-request-guard";

export const ANONYMOUS_WRITE_GRANT_SECRET_ENV = "ANONYMOUS_WRITE_GRANT_SECRET";
export const ANONYMOUS_RESULT_WRITE_HEADER = "x-kbeauty-result-write-token";
export const ANONYMOUS_TRACK_WRITE_HEADER = "x-kbeauty-track-write-token";
export const LEGACY_ANONYMOUS_WRITE_HEADER = "x-kbeauty-write-token";

function getGrantSecret() {
  const secret = process.env[ANONYMOUS_WRITE_GRANT_SECRET_ENV];

  return typeof secret === "string" && secret.trim() ? secret.trim() : null;
}

function normalizeRpcJson(data) {
  if (!data) {
    return null;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data;
}

export async function issueAnonymousWriteGrants({ supabase, anonymousPayload, result, form, locale }) {
  const secret = getGrantSecret();

  if (!secret || !supabase || typeof anonymousPayload !== "string" || !anonymousPayload) {
    return { ok: false, code: "unavailable" };
  }

  let bundle = null;

  try {
    bundle = createAnonymousWriteGrantTokens({
      secret,
      anonymousPayload,
      result,
      form,
      locale
    });
  } catch {
    return { ok: false, code: "unavailable" };
  }

  try {
    const { data, error } = await supabase.rpc("create_anonymous_write_grants", {
      p_grants: bundle.grants.map((grant) => ({
        jti_hash: grant.jtiHash,
        version: grant.version,
        purpose: grant.purpose,
        resource_type: grant.resourceType,
        resource_id: grant.resourceId,
        operation: grant.operation,
        principal_hash: grant.principalHash,
        expected_fingerprint_hash: grant.expectedFingerprintHash,
        max_uses: grant.maxUses,
        issued_at: grant.issuedAt,
        expires_at: grant.expiresAt
      }))
    });

    if (error || normalizeRpcJson(data)?.created !== 2) {
      return { ok: false, code: "unavailable" };
    }
  } catch {
    return { ok: false, code: "unavailable" };
  }

  return {
    ok: true,
    analysisRunId: bundle.analysisRunId,
    resultToken: bundle.resultToken,
    trackToken: bundle.trackToken,
    expiresAt: bundle.expiresAt
  };
}

export function verifyAnonymousWriteGrantForRequest({ request, headerName, expectedOperation }) {
  const secret = getGrantSecret();
  const verification = verifyAnonymousWriteGrantToken({
    token: request.headers.get(headerName),
    secret,
    expectedOperation
  });

  if (!verification.ok) {
    return verification;
  }

  const anonymous = resolveExistingAnonymousCookiePayload(request);

  if (!anonymous.ok) {
    return { ok: false, code: anonymous.code === "unavailable" ? "unavailable" : "principal_missing" };
  }

  const principalHash = createAnonymousWritePrincipalHash({
    secret,
    anonymousPayload: anonymous.payload
  });

  if (principalHash !== verification.payload.principalHash) {
    return { ok: false, code: "principal_mismatch" };
  }

  return {
    ok: true,
    payload: verification.payload,
    principalHash,
    jtiHash: createAnonymousWriteJtiHash({ secret, jti: verification.payload.jti })
  };
}

export function createAnonymousResultRequestFingerprint({ result, submission, locale }) {
  const secret = getGrantSecret();

  if (!secret) {
    return null;
  }

  const input = getAnonymousWriteGrantResultFingerprintInput({ result, submission, locale });

  return createAnonymousResultFingerprintHash({
    secret,
    result: input.result,
    form: input.form,
    locale: input.locale
  });
}

export function createAnonymousTrackRequestFingerprint({ analysisRunId, payload }) {
  const secret = getGrantSecret();

  if (!secret) {
    return null;
  }

  return createAnonymousTrackEventFingerprintHash({
    secret,
    analysisRunId,
    payload
  });
}

export async function claimAnonymousWriteGrant({ supabase, grant, requestFingerprintHash }) {
  if (!supabase || !grant?.jtiHash || !grant?.principalHash || !requestFingerprintHash) {
    return { ok: false, code: "unavailable" };
  }

  try {
    const { data, error } = await supabase.rpc("claim_anonymous_write_grant", {
      p_jti_hash: grant.jtiHash,
      p_principal_hash: grant.principalHash,
      p_resource_type: grant.payload.resourceType,
      p_resource_id: grant.payload.resourceId,
      p_operation: grant.payload.operation,
      p_request_fingerprint_hash: requestFingerprintHash
    });

    if (error) {
      return { ok: false, code: "unavailable" };
    }

    const claim = normalizeRpcJson(data);

    return claim?.state ? { ok: true, claim } : { ok: false, code: "unavailable" };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}

export async function completeAnonymousWriteGrant({ supabase, grant, requestFingerprintHash, resultReference = null }) {
  if (!supabase || !grant?.jtiHash || !grant?.principalHash || !requestFingerprintHash) {
    return { ok: false };
  }

  try {
    const { data, error } = await supabase.rpc("complete_anonymous_write_grant", {
      p_jti_hash: grant.jtiHash,
      p_principal_hash: grant.principalHash,
      p_resource_type: grant.payload.resourceType,
      p_resource_id: grant.payload.resourceId,
      p_operation: grant.payload.operation,
      p_request_fingerprint_hash: requestFingerprintHash,
      p_result_reference: resultReference
    });

    return { ok: !error && normalizeRpcJson(data)?.updated === true };
  } catch {
    return { ok: false };
  }
}

export async function failAnonymousWriteGrant({ supabase, grant, requestFingerprintHash }) {
  if (!supabase || !grant?.jtiHash || !grant?.principalHash || !requestFingerprintHash) {
    return { ok: false };
  }

  try {
    const { data, error } = await supabase.rpc("fail_anonymous_write_grant", {
      p_jti_hash: grant.jtiHash,
      p_principal_hash: grant.principalHash,
      p_resource_type: grant.payload.resourceType,
      p_resource_id: grant.payload.resourceId,
      p_operation: grant.payload.operation,
      p_request_fingerprint_hash: requestFingerprintHash
    });

    return { ok: !error && normalizeRpcJson(data)?.updated === true };
  } catch {
    return { ok: false };
  }
}

export function isAnonymousResultWriteOperation(operation) {
  return operation === ANONYMOUS_RESULT_WRITE_OPERATION;
}

export function isAnonymousTrackWriteOperation(operation) {
  return operation === ANONYMOUS_TRACK_WRITE_OPERATION;
}
