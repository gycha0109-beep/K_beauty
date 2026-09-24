#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  digestOfficialContent,
  fetchOfficialBytes,
  sha256Hex,
} from "../lib/trust/official-source-fetch.mjs";
import {
  buildOfficialProductSemanticObservationV1,
  normalizeSemanticTextV1,
} from "../lib/trust/official-source-semantic-adapter.mjs";

const DEFAULT_MANIFEST =
  "tests/fixtures/trust-phase8g-semantic-adapter/controlled-expansion-batch-v1.json";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyExpectedFailure(error) {
  const status = String(error?.semanticStatus || "");
  if (status === "AMBIGUOUS" || status === "UNSUPPORTED") return status;

  const message = String(error?.message || error);
  if (message.startsWith("TRANSIENT_FAILURE:")) return "TRANSIENT_FAILURE";
  if (message.startsWith("SOURCE_BLOCKED:")) return "SOURCE_BLOCKED";
  return null;
}

function reviewedAnchorPresent(observation, reviewedAnchor) {
  const expected = normalizeSemanticTextV1(reviewedAnchor || "");
  if (!expected) return false;
  const observed = observation?.evidence_anchors?.claims || [];
  return observed.some((item) => {
    if (!item?.present) return false;
    const value = normalizeSemanticTextV1(item.value || "");
    return value === expected || value.includes(expected) || expected.includes(value);
  });
}

async function captureSource(source, label, adapterKey, adapterVersion, fetchImpl = fetch) {
  const fetched = await fetchOfficialBytes(source.canonical_locator, fetchImpl);
  const adapted = digestOfficialContent(fetched.bytes, adapterKey, adapterVersion, {
    sourceMetadata: source.source_metadata || {},
    canonicalLocator: source.canonical_locator,
  });
  const observation = buildOfficialProductSemanticObservationV1(fetched.bytes, {
    sourceMetadata: source.source_metadata || {},
    canonicalLocator: source.canonical_locator,
  });

  const canonicalUrl = new URL(source.canonical_locator);
  const finalUrl = new URL(fetched.finalUrl);

  return {
    label,
    fetched_at: new Date().toISOString(),
    raw_digest: sha256Hex(fetched.bytes),
    semantic_digest: adapted.digest,
    digest_basis: adapted.digestBasis,
    adapter_key: adapted.adapterKey,
    adapter_version: adapted.adapterVersion,
    final_url: fetched.finalUrl,
    content_type: fetched.contentType,
    byte_length: fetched.bytes.byteLength,
    canonical_length: adapted.canonicalLength,
    reviewed_anchor_present: reviewedAnchorPresent(observation, source.reviewed_anchor),
    https_final_url: finalUrl.protocol === "https:",
    same_final_hostname: finalUrl.hostname.toLowerCase() === canonicalUrl.hostname.toLowerCase(),
  };
}

export async function qualifyControlledExpansionBatch({
  manifestPath = DEFAULT_MANIFEST,
  fetchImpl = fetch,
  delayMs = 2000,
} = {}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest?.contract !== "trust-phase8g-controlled-expansion-batch-v1"
    || manifest?.authority_mutation !== false
    || manifest?.required_observations !== 3
    || manifest?.adapter_key !== "official-product-semantic"
    || manifest?.adapter_version !== "v1"
    || !Array.isArray(manifest?.sources)
    || manifest.sources.length !== 3
  ) {
    throw new Error("CONTROLLED_BATCH_MANIFEST_INVALID");
  }

  const results = [];

  for (const source of manifest.sources) {
    try {
      const captures = [];
      for (let index = 0; index < manifest.required_observations; index += 1) {
        if (index > 0) await sleep(delayMs);
        captures.push(
          await captureSource(
            source,
            `capture_${index + 1}`,
            manifest.adapter_key,
            manifest.adapter_version,
            fetchImpl
          )
        );
      }

      const semanticDigests = new Set(captures.map((item) => item.semantic_digest));
      const contractStable = captures.every((item) =>
        item.digest_basis === "canonical-official-product-semantics-v1"
        && item.adapter_key === manifest.adapter_key
        && item.adapter_version === manifest.adapter_version
        && item.canonical_length > 0
        && item.reviewed_anchor_present
        && item.https_final_url
        && item.same_final_hostname
      );
      const stable = semanticDigests.size === 1 && contractStable;

      results.push({
        source_id: source.source_id,
        publisher: source.publisher,
        canonical_locator: source.canonical_locator,
        reviewed_anchor: source.reviewed_anchor,
        status: stable ? "SUPPORTED_STABLE" : "AMBIGUOUS",
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
        status: classified,
        stable: false,
        captures: [],
        detail: String(error?.message || error),
      });
    }
  }

  return {
    contract: "trust-phase8g-controlled-expansion-qualification-v1",
    manifest_contract: manifest.contract,
    required_observations: manifest.required_observations,
    adapter_key: manifest.adapter_key,
    adapter_version: manifest.adapter_version,
    eligible_source_ids: results
      .filter((item) => item.status === "SUPPORTED_STABLE")
      .map((item) => item.source_id),
    results,
    authority_mutation: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await qualifyControlledExpansionBatch({
    manifestPath: argValue("manifest") || DEFAULT_MANIFEST,
  });
  console.log(`TRUST_PHASE8G_CONTROLLED_BATCH_JSON=${JSON.stringify(result)}`);
}
