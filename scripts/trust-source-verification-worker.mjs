import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  digestOfficialClaimAsset,
  digestOfficialContent,
  fetchOfficialAssetBytes,
  fetchOfficialBytes,
} from "../lib/trust/official-source-fetch.mjs";

const WORKER_VERSION = "trust-source-verification-worker-v2";

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
  if (
    message === "SOURCE_BLOCKED:http_404"
    || message === "SOURCE_BLOCKED:http_410"
    || message === "SOURCE_BLOCKED:asset_http_404"
    || message === "SOURCE_BLOCKED:asset_http_410"
  ) {
    return { verificationResult: "unavailable", detail: message };
  }
  return { verificationResult: "ambiguous", detail: message };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    && normalizePath(a.pathname) === normalizePath(b.pathname)
    && a.search === b.search;
}

async function captureOfficialClaimAsset(target, fetchImpl = fetch) {
  const claimAssetUrl = String(target?.source_metadata?.direct_claim_asset_url || "");
  if (!claimAssetUrl.startsWith("https://")) {
    throw new Error("SOURCE_CLAIM_ASSET_METADATA_MISSING");
  }

  const page = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
  if (!sameReviewedResource(target.canonical_locator, page.finalUrl)) {
    throw new Error("SOURCE_LOCATOR_DRIFT:final_resource_changed");
  }

  const html = Buffer.from(page.bytes).toString("utf8");
  if (!html.includes(claimAssetUrl)) {
    throw new Error("SOURCE_CLAIM_ASSET_BINDING_MISSING");
  }

  const asset = await fetchOfficialAssetBytes(claimAssetUrl, fetchImpl);
  if (!sameReviewedResource(claimAssetUrl, asset.finalUrl)) {
    throw new Error("SOURCE_CLAIM_ASSET_LOCATOR_DRIFT");
  }
  const adapted = digestOfficialClaimAsset(asset.bytes);

  return {
    digest: adapted.digest,
    digestBasis: adapted.digestBasis,
    adapterKey: adapted.adapterKey,
    adapterVersion: adapted.adapterVersion,
    fetchedAt: new Date().toISOString(),
    pageFinalUrl: page.finalUrl,
    claimAssetUrl,
    assetFinalUrl: asset.finalUrl,
    assetContentType: asset.contentType,
    assetByteLength: asset.bytes.byteLength,
    pageAssetBindingPresent: true,
  };
}

async function qualifyOfficialClaimAssetTriplet(target, fetchImpl = fetch) {
  const captures = [];
  for (let index = 0; index < 3; index += 1) {
    if (index > 0) await sleep(2000);
    captures.push(await captureOfficialClaimAsset(target, fetchImpl));
  }
  const digests = new Set(captures.map((item) => item.digest));
  if (digests.size !== 1) throw new Error("SOURCE_CLAIM_ASSET_TRIPLET_UNSTABLE");
  return {
    observations: captures.length,
    digest: captures[0].digest,
  };
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
  const currentProfile = target.verification_profile || null;

  if (adapterKey === "official-claim-asset") {
    if (adapterVersion !== "v1") throw new Error("SOURCE_VERIFICATION_PROFILE_ADAPTER_UNSUPPORTED");
    const qualification = await qualifyOfficialClaimAssetTriplet(target, fetchImpl);
    await sleep(2000);
    const baseline = await captureOfficialClaimAsset(target, fetchImpl);
    if (baseline.digest !== qualification.digest) {
      throw new Error("SOURCE_CLAIM_ASSET_BASELINE_DRIFT_AFTER_QUALIFICATION");
    }

    return rpcOrThrow(client, "admin_register_product_evidence_source_verification_profile_v1", {
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_source_id: sourceId,
      p_supersedes_profile_id: currentProfile?.profile_id || null,
      p_baseline_content_digest: baseline.digest,
      p_digest_basis: baseline.digestBasis,
      p_adapter_key: baseline.adapterKey,
      p_adapter_version: baseline.adapterVersion,
      p_baseline_kind: "fresh_recovery",
      p_canonical_baseline: {
        final_url: baseline.assetFinalUrl,
        content_type: baseline.assetContentType,
        byte_length: baseline.assetByteLength,
        fetched_at: baseline.fetchedAt,
        page_final_url: baseline.pageFinalUrl,
        claim_asset_url: baseline.claimAssetUrl,
        asset_final_url: baseline.assetFinalUrl,
        asset_content_type: baseline.assetContentType,
        asset_byte_length: baseline.assetByteLength,
        page_asset_binding_present: baseline.pageAssetBindingPresent,
        qualification_observations: qualification.observations,
        qualification_asset_digest: qualification.digest,
      },
      p_profile_metadata: {
        worker_version: WORKER_VERSION,
        qualification_contract: "official-claim-asset-fresh-recovery-v1",
        recovery_reason: currentProfile ? "supersede_previous_profile" : "establish_first_comparable_profile",
      },
    });
  }

  const fetched = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
  const fetchedAt = new Date().toISOString();
  const adapted = digestOfficialContent(fetched.bytes, adapterKey, adapterVersion, {
    sourceMetadata: target.source_metadata || {},
    canonicalLocator: target.canonical_locator,
  });
  const digest = adapted.digest;

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
    if (profile.adapter_key === "official-claim-asset") {
      const observed = await captureOfficialClaimAsset(target, fetchImpl);
      if (observed.digestBasis !== profile.digest_basis) {
        throw new Error("SOURCE_VERIFICATION_PROFILE_DIGEST_BASIS_MISMATCH");
      }
      observedDigest = observed.digest;
      verificationResult = observedDigest === profile.baseline_content_digest ? "unchanged" : "changed";
      metadata = {
        worker_version: WORKER_VERSION,
        page_final_url: observed.pageFinalUrl,
        claim_asset_url: observed.claimAssetUrl,
        asset_final_url: observed.assetFinalUrl,
        asset_content_type: observed.assetContentType,
        asset_byte_length: observed.assetByteLength,
        page_asset_binding_present: observed.pageAssetBindingPresent,
      };
    } else {
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
    }
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
