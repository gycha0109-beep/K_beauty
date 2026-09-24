import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  digestOfficialClaimAsset,
  digestOfficialContent,
  fetchOfficialAssetBytes,
  fetchOfficialBytes,
} from "../lib/trust/official-source-fetch.mjs";

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

function normalizePath(value) {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function sameReviewedResource(expected, actual) {
  const a = new URL(expected);
  const b = new URL(actual);
  return a.protocol === "https:"
    && b.protocol === "https:"
    && a.hostname.toLowerCase() === b.hostname.toLowerCase()
    && normalizePath(a.pathname) === normalizePath(b.pathname);
}

function claimAssetUrlFromTarget(target) {
  const value = String(target?.source_metadata?.direct_claim_asset_url || "");
  if (!value.startsWith("https://")) throw new Error("SOURCE_CLAIM_ASSET_URL_REQUIRED");
  return value;
}

async function fetchBoundClaimAsset(target, fetchImpl) {
  const assetUrl = claimAssetUrlFromTarget(target);
  const page = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
  if (!sameReviewedResource(target.canonical_locator, page.finalUrl)) {
    throw new Error("SOURCE_LOCATOR_DRIFT:final_path_changed");
  }
  const html = Buffer.from(page.bytes).toString("utf8");
  if (!html.includes(assetUrl)) throw new Error("SOURCE_CLAIM_ASSET_BINDING_MISSING");

  const asset = await fetchOfficialAssetBytes(assetUrl, fetchImpl);
  if (!sameReviewedResource(assetUrl, asset.finalUrl)) {
    throw new Error("SOURCE_CLAIM_ASSET_LOCATOR_DRIFT");
  }
  return { page, asset, assetUrl };
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
  const fetchedAt = new Date().toISOString();
  let fetched;
  let adapted;
  let canonicalBaseline;

  if (adapterKey === "official-claim-asset" && adapterVersion === "v1") {
    const bound = await fetchBoundClaimAsset(target, fetchImpl);
    fetched = bound.page;
    adapted = digestOfficialClaimAsset(bound.asset.bytes);
    canonicalBaseline = {
      final_url: bound.page.finalUrl,
      content_type: bound.page.contentType,
      byte_length: bound.page.bytes.byteLength,
      canonical_length: adapted.canonicalLength,
      asset_url: bound.assetUrl,
      asset_final_url: bound.asset.finalUrl,
      asset_content_type: bound.asset.contentType,
      asset_byte_length: bound.asset.bytes.byteLength,
      fetched_at: fetchedAt,
    };
  } else {
    fetched = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
    adapted = digestOfficialContent(fetched.bytes, adapterKey, adapterVersion, {
      sourceMetadata: target.source_metadata || {},
      canonicalLocator: target.canonical_locator,
    });
    canonicalBaseline = {
      final_url: fetched.finalUrl,
      content_type: fetched.contentType,
      byte_length: fetched.bytes.byteLength,
      canonical_length: adapted.canonicalLength,
      fetched_at: fetchedAt,
    };
  }

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
    p_canonical_baseline: canonicalBaseline,
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
    : profile.adapter_key === "official-claim-asset" && profile.adapter_version === "v1"
      ? "official-claim-asset-bytes-v1"
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
    let adapted;
    if (profile.adapter_key === "official-claim-asset" && profile.adapter_version === "v1") {
      const bound = await fetchBoundClaimAsset(target, fetchImpl);
      const baselineAssetUrl = String(profile?.canonical_baseline?.asset_url || "");
      if (baselineAssetUrl !== bound.assetUrl) throw new Error("SOURCE_CLAIM_ASSET_PROFILE_BINDING_MISMATCH");
      adapted = digestOfficialClaimAsset(bound.asset.bytes);
      metadata = {
        worker_version: WORKER_VERSION,
        final_url: bound.page.finalUrl,
        content_type: bound.page.contentType,
        byte_length: bound.page.bytes.byteLength,
        canonical_length: adapted.canonicalLength,
        asset_url: bound.assetUrl,
        asset_final_url: bound.asset.finalUrl,
        asset_content_type: bound.asset.contentType,
        asset_byte_length: bound.asset.bytes.byteLength,
      };
    } else {
      const fetched = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
      adapted = digestOfficialContent(fetched.bytes, profile.adapter_key, profile.adapter_version, {
        sourceMetadata: target.source_metadata || {},
        canonicalLocator: target.canonical_locator,
      });
      metadata = {
        worker_version: WORKER_VERSION,
        final_url: fetched.finalUrl,
        content_type: fetched.contentType,
        byte_length: fetched.bytes.byteLength,
        canonical_length: adapted.canonicalLength,
      };
    }
    if (adapted.digestBasis !== profile.digest_basis) {
      throw new Error("SOURCE_VERIFICATION_PROFILE_DIGEST_BASIS_MISMATCH");
    }
    observedDigest = adapted.digest;
    verificationResult = observedDigest === profile.baseline_content_digest ? "unchanged" : "changed";
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
