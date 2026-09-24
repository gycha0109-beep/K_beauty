#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { captureClaimAssetSource } from "./trust-source-claim-asset-controlled-batch-probe.mjs";

const TARGET_PATH =
  "tests/fixtures/trust-phase8g-semantic-adapter/production-asset-baseline-target-v1.json";
const BATCH_PATH =
  "tests/fixtures/trust-phase8g-semantic-adapter/controlled-expansion-asset-batch-v1.json";

export async function captureProductionAssetBaseline({ fetchImpl = fetch } = {}) {
  const [target, batch] = await Promise.all([
    readFile(TARGET_PATH, "utf8").then(JSON.parse),
    readFile(BATCH_PATH, "utf8").then(JSON.parse),
  ]);

  if (
    target?.contract !== "trust-phase8g-production-asset-baseline-target-v1"
    || target?.authority_mutation !== false
    || target?.adapter_key !== "official-claim-asset"
    || target?.adapter_version !== "v1"
    || target?.qualification_contract !== "trust-phase8g-controlled-expansion-asset-qualification-v1"
  ) {
    throw new Error("PRODUCTION_ASSET_BASELINE_TARGET_INVALID");
  }

  const source = batch.sources.find((item) => item.source_id === target.source_id);
  if (!source) throw new Error("PRODUCTION_ASSET_BASELINE_SOURCE_NOT_IN_REVIEWED_BATCH");

  const capture = await captureClaimAssetSource(source, "fresh_production_baseline", fetchImpl);
  return {
    contract: "trust-phase8g-production-asset-baseline-capture-v1",
    source_id: source.source_id,
    publisher: source.publisher,
    reviewed_anchor: source.reviewed_anchor,
    adapter_key: target.adapter_key,
    adapter_version: target.adapter_version,
    digest_basis: capture.digest_basis,
    baseline_content_digest: capture.asset_digest,
    canonical_baseline: {
      final_url: capture.page_final_url,
      content_type: capture.page_content_type,
      byte_length: capture.page_byte_length,
      canonical_length: capture.asset_byte_length,
      asset_url: capture.claim_asset_url,
      asset_final_url: capture.asset_final_url,
      asset_content_type: capture.asset_content_type,
      asset_byte_length: capture.asset_byte_length,
      fetched_at: capture.fetched_at,
    },
    authority_mutation: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await captureProductionAssetBaseline();
  console.log(`TRUST_PHASE8G_PRODUCTION_ASSET_BASELINE_JSON=${JSON.stringify(result)}`);
}
