import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { digestOfficialContent, fetchOfficialBytes } from "../lib/trust/official-source-fetch.mjs";

const WORKER_VERSION = "trust-source-verification-worker-v1";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

async function rpcOrThrow(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}:${error.code || "RPC_ERROR"}:${error.message}`);
  return data;
}

function classifyFetchFailure(error) {
  const message = String(error?.message || error);
  if (message === "SOURCE_BLOCKED:http_404" || message === "SOURCE_BLOCKED:http_410") {
    return { verificationResult: "unavailable", detail: message };
  }
  return { verificationResult: "ambiguous", detail: message };
}

async function loadTarget(client, sourceId) {
  return rpcOrThrow(client, "get_product_evidence_source_verification_target_v1", {
    p_source_id: sourceId,
  });
}

export async function establishFreshBaseline(client, {
  sourceId,
  actorUserId,
  requestId,
  adapterKey = "official-product-semantic",
  adapterVersion = "v1",
  fetchImpl = fetch,
} = {}) {
  if (!sourceId || !actorUserId || !requestId) throw new Error("sourceId, actorUserId and requestId are required");
  const target = await loadTarget(client, sourceId);
  const fetched = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
  const fetchedAt = new Date().toISOString();
  const adapted = digestOfficialContent(fetched.bytes, adapterKey, adapterVersion, {
    sourceMetadata: target.source_metadata || {},
    canonicalLocator: target.canonical_locator,
  });
  const digest = adapted.digest;
  const currentProfile = target.verification_profile || null;

  return rpcOrThrow(client, "admin_register_product_evidence_source_verification_profile_v1", {
    p_actor_user_id: actorUserId,
    p_request_id: requestId,
    p_source_id: sourceId,
    p_supersedes_profile_id: currentProfile?.profile_id || null,
    p_baseline_content_digest: digest,
    p_digest_basis: adapted.digestBasis,
    p_adapter_key: adapted.adapterKey,
    p_adapter_version: adapted.adapterVersion,
    p_baseline_kind: "fresh_recovery",
    p_canonical_baseline: {
      final_url: fetched.finalUrl,
      content_type: fetched.contentType,
      byte_length: fetched.bytes.byteLength,
      canonical_length: adapted.canonicalLength,
      fetched_at: fetchedAt,
    },
    p_profile_metadata: {
      worker_version: WORKER_VERSION,
      recovery_reason: currentProfile ? "supersede_previous_profile" : "establish_first_comparable_profile",
    },
  });
}

export async function verifySource(client, {
  sourceId,
  requestId,
  triggerKind = "manual",
  fetchImpl = fetch,
} = {}) {
  if (!sourceId || !requestId) throw new Error("sourceId and requestId are required");
  const target = await loadTarget(client, sourceId);
  const profile = target.verification_profile;

  if (!profile || profile.comparability_state !== "COMPARABLE") {
    throw new Error("SOURCE_VERIFICATION_PROFILE_NOT_COMPARABLE");
  }
  const expectedDigestBasis = profile.adapter_key === "official-product-semantic" && profile.adapter_version === "v1"
    ? "canonical-official-product-semantics-v1"
    : profile.adapter_key === "canonical-html-text" && profile.adapter_version === "v1"
      ? "canonical-html-text-v1"
      : profile.adapter_key === "live-page-bytes" && profile.adapter_version === "v1"
        ? "live-page-bytes-v1"
        : null;
  if (!expectedDigestBasis) throw new Error("SOURCE_VERIFICATION_PROFILE_ADAPTER_UNSUPPORTED");
  if (expectedDigestBasis !== profile.digest_basis) {
    throw new Error("SOURCE_VERIFICATION_PROFILE_DIGEST_BASIS_MISMATCH");
  }
  const checkedAt = new Date().toISOString();
  let observedDigest = null;
  let verificationResult;
  let metadata;

  try {
    const fetched = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
    const adapted = digestOfficialContent(fetched.bytes, profile.adapter_key, profile.adapter_version, {
      sourceMetadata: target.source_metadata || {},
      canonicalLocator: target.canonical_locator,
    });
    if (adapted.digestBasis !== profile.digest_basis) {
      throw new Error("SOURCE_VERIFICATION_PROFILE_DIGEST_BASIS_MISMATCH");
    }
    observedDigest = adapted.digest;
    verificationResult = observedDigest === profile.baseline_content_digest ? "unchanged" : "changed";
    metadata = {
      worker_version: WORKER_VERSION,
      final_url: fetched.finalUrl,
      content_type: fetched.contentType,
      byte_length: fetched.bytes.byteLength,
      canonical_length: adapted.canonicalLength,
    };
  } catch (error) {
    const classified = classifyFetchFailure(error);
    verificationResult = classified.verificationResult;
    metadata = {
      worker_version: WORKER_VERSION,
      fetch_outcome: classified.detail,
    };
  }

  return rpcOrThrow(client, "record_product_evidence_source_verification_v2", {
    p_request_id: requestId,
    p_verification_profile_id: profile.profile_id,
    p_observed_content_digest: observedDigest,
    p_verification_result: verificationResult,
    p_trigger_kind: triggerKind,
    p_checked_at: checkedAt,
    p_verification_metadata: metadata,
  });
}

export async function runSourceVerificationWorker({
  mode,
  sourceId,
  actorUserId,
  requestId,
  triggerKind = "manual",
  adapterKey = "official-product-semantic",
  adapterVersion = "v1",
  fetchImpl = fetch,
} = {}) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (mode === "baseline") {
    return establishFreshBaseline(client, { sourceId, actorUserId, requestId, adapterKey, adapterVersion, fetchImpl });
  }
  if (mode === "verify") {
    return verifySource(client, { sourceId, requestId, triggerKind, fetchImpl });
  }
  throw new Error("mode must be baseline or verify");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runSourceVerificationWorker({
    mode: argValue("mode"),
    sourceId: argValue("source-id"),
    actorUserId: argValue("actor-user-id"),
    requestId: argValue("request-id"),
    triggerKind: argValue("trigger-kind") || "manual",
    adapterKey: argValue("adapter-key") || "official-product-semantic",
    adapterVersion: argValue("adapter-version") || "v1",
  });
  console.log(JSON.stringify({
    status: "OK",
    mode: argValue("mode"),
    source_id: argValue("source-id"),
    result,
  }));
}
