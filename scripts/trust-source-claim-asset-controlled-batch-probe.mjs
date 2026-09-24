#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  digestOfficialClaimAsset,
  fetchOfficialAssetBytes,
  fetchOfficialBytes,
  sha256Hex,
} from "../lib/trust/official-source-fetch.mjs";

const DEFAULT_MANIFEST =
  "tests/fixtures/trust-phase8g-semantic-adapter/controlled-expansion-asset-batch-v1.json";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
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
    && normalizePath(a.pathname) === normalizePath(b.pathname);
}

function classifyExpectedFailure(error) {
  const status = String(error?.assetStatus || "");
  if (status === "LOCATOR_DRIFT" || status === "ASSET_BINDING_MISSING") return status;
  const message = String(error?.message || error);
  if (message.startsWith("TRANSIENT_FAILURE:")) return "TRANSIENT_FAILURE";
  if (message.startsWith("SOURCE_BLOCKED:")) return "SOURCE_BLOCKED";
  return null;
}

export async function captureClaimAssetSource(source, label, fetchImpl = fetch) {
  const page = await fetchOfficialBytes(source.canonical_locator, fetchImpl);
  if (!sameReviewedResource(source.canonical_locator, page.finalUrl)) {
    const error = new Error("SOURCE_LOCATOR_DRIFT:final_path_changed");
    error.assetStatus = "LOCATOR_DRIFT";
    throw error;
  }

  const html = Buffer.from(page.bytes).toString("utf8");
  if (!html.includes(source.claim_asset_url)) {
    const error = new Error("SOURCE_CLAIM_ASSET_BINDING_MISSING");
    error.assetStatus = "ASSET_BINDING_MISSING";
    throw error;
  }

  const asset = await fetchOfficialAssetBytes(source.claim_asset_url, fetchImpl);
  if (!sameReviewedResource(source.claim_asset_url, asset.finalUrl)) {
    const error = new Error("SOURCE_CLAIM_ASSET_LOCATOR_DRIFT");
    error.assetStatus = "LOCATOR_DRIFT";
    throw error;
  }
  const adapted = digestOfficialClaimAsset(asset.bytes);

  return {
    label,
    fetched_at: new Date().toISOString(),
    page_final_url: page.finalUrl,
    page_content_type: page.contentType,
    page_raw_digest: sha256Hex(page.bytes),
    page_byte_length: page.bytes.byteLength,
    claim_asset_url: source.claim_asset_url,
    asset_final_url: asset.finalUrl,
    asset_content_type: asset.contentType,
    asset_byte_length: asset.bytes.byteLength,
    asset_digest: adapted.digest,
    digest_basis: adapted.digestBasis,
    adapter_key: adapted.adapterKey,
    adapter_version: adapted.adapterVersion,
    page_asset_binding_present: true,
  };
}

export async function qualifyControlledAssetBatch({
  manifestPath = DEFAULT_MANIFEST,
  fetchImpl = fetch,
  delayMs = 2000,
} = {}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest?.contract !== "trust-phase8g-controlled-expansion-asset-batch-v1"
    || manifest?.authority_mutation !== false
    || manifest?.required_observations !== 3
    || manifest?.adapter_key !== "official-claim-asset"
    || manifest?.adapter_version !== "v1"
    || !Array.isArray(manifest?.sources)
    || manifest.sources.length < 1
    || manifest.sources.length > 3
  ) {
    throw new Error("CONTROLLED_ASSET_BATCH_MANIFEST_INVALID");
  }

  const results = [];
  for (const source of manifest.sources) {
    try {
      if (
        !String(source.source_id || "")
        || !String(source.canonical_locator || "").startsWith("https://")
        || !String(source.claim_asset_url || "").startsWith("https://")
        || !String(source.reviewed_anchor || "").trim()
        || source.binding_basis !== "product_evidence_sources.source_metadata.direct_claim_asset_url"
      ) {
        throw new Error("CONTROLLED_ASSET_BATCH_SOURCE_INVALID");
      }

      const captures = [];
      for (let index = 0; index < manifest.required_observations; index += 1) {
        if (index > 0) await sleep(delayMs);
        captures.push(await captureClaimAssetSource(source, `capture_${index + 1}`, fetchImpl));
      }

      const assetDigests = new Set(captures.map((item) => item.asset_digest));
      const contractStable = captures.every((item) =>
        item.digest_basis === "official-claim-asset-bytes-v1"
        && item.adapter_key === manifest.adapter_key
        && item.adapter_version === manifest.adapter_version
        && item.asset_byte_length > 0
        && item.asset_content_type.startsWith("image/")
        && item.page_asset_binding_present
      );
      const stable = assetDigests.size === 1 && contractStable;

      results.push({
        source_id: source.source_id,
        publisher: source.publisher,
        canonical_locator: source.canonical_locator,
        reviewed_anchor: source.reviewed_anchor,
        claim_asset_url: source.claim_asset_url,
        status: stable ? "SUPPORTED_STABLE_ASSET" : "AMBIGUOUS",
        stable,
        captures,
      });
    } catch (error) {
      const classified = classifyExpectedFailure(error);
      if (!classified) throw error;
      results.push({
        source_id: source.source_id,
        publisher: source.publisher,
        canonical_locator: source.canonical_locator,
        reviewed_anchor: source.reviewed_anchor,
        claim_asset_url: source.claim_asset_url,
        status: classified,
        stable: false,
        captures: [],
        detail: String(error?.message || error),
      });
    }
  }

  return {
    contract: "trust-phase8g-controlled-expansion-asset-qualification-v1",
    manifest_contract: manifest.contract,
    required_observations: manifest.required_observations,
    adapter_key: manifest.adapter_key,
    adapter_version: manifest.adapter_version,
    eligible_source_ids: results
      .filter((item) => item.status === "SUPPORTED_STABLE_ASSET")
      .map((item) => item.source_id),
    results,
    authority_mutation: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await qualifyControlledAssetBatch({
    manifestPath: argValue("manifest") || DEFAULT_MANIFEST,
  });
  console.log(`TRUST_PHASE8G_CONTROLLED_ASSET_BATCH_JSON=${JSON.stringify(result)}`);
}
