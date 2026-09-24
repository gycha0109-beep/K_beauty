import fs from "node:fs";
import {
  digestOfficialClaimAsset,
  fetchOfficialAssetBytes,
  fetchOfficialBytes,
} from "../lib/trust/official-source-fetch.mjs";

const MANIFEST_PATH = "tests/fixtures/trust-phase8g-semantic-adapter/controlled-expansion-asset-batch-v1.json";
const CONTRACT = "trust-phase8g-independent-claim-asset-verification-capture-v1";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
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

const sourceId = argValue("source-id");
if (!sourceId) throw new Error("source-id is required");

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const target = manifest.sources.find((item) => item.source_id === sourceId);
if (!target) throw new Error("SOURCE_NOT_IN_CONTROLLED_ASSET_MANIFEST");

const page = await fetchOfficialBytes(target.canonical_locator);
if (!sameReviewedResource(target.canonical_locator, page.finalUrl)) {
  throw new Error("SOURCE_LOCATOR_DRIFT:final_resource_changed");
}

const pageHtml = Buffer.from(page.bytes).toString("utf8");
if (!pageHtml.includes(target.claim_asset_url)) {
  throw new Error("SOURCE_CLAIM_ASSET_BINDING_MISSING");
}

const asset = await fetchOfficialAssetBytes(target.claim_asset_url);
if (!sameReviewedResource(target.claim_asset_url, asset.finalUrl)) {
  throw new Error("SOURCE_CLAIM_ASSET_LOCATOR_DRIFT");
}

const adapted = digestOfficialClaimAsset(asset.bytes);
const result = {
  contract: CONTRACT,
  independent_verification_capture: true,
  authority_mutation: false,
  source_id: target.source_id,
  publisher: target.publisher,
  canonical_locator: target.canonical_locator,
  reviewed_anchor: target.reviewed_anchor,
  fetched_at: new Date().toISOString(),
  page_final_url: page.finalUrl,
  page_byte_length: page.bytes.byteLength,
  claim_asset_url: target.claim_asset_url,
  asset_final_url: asset.finalUrl,
  asset_content_type: asset.contentType,
  asset_byte_length: asset.bytes.byteLength,
  observed_content_digest: adapted.digest,
  digest_basis: adapted.digestBasis,
  adapter_key: adapted.adapterKey,
  adapter_version: adapted.adapterVersion,
  page_asset_binding_present: true,
};

console.log(`TRUST_PHASE8G_INDEPENDENT_ASSET_VERIFICATION_JSON=${JSON.stringify(result)}`);
