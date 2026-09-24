import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { digestOfficialContent, fetchOfficialBytes, sha256Hex } from "../lib/trust/official-source-fetch.mjs";

const DEFAULT_TARGET = "docs/evidence/trust-phase8g-production-canary-target-v1.json";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(url, label, adapterKey, adapterVersion, sourceMetadata, fetchImpl = fetch) {
  const fetched = await fetchOfficialBytes(url, fetchImpl);
  const adapted = digestOfficialContent(fetched.bytes, adapterKey, adapterVersion, {
    sourceMetadata: sourceMetadata || {},
    canonicalLocator: url,
  });
  return {
    label,
    fetched_at: new Date().toISOString(),
    digest: adapted.digest,
    digest_basis: adapted.digestBasis,
    adapter_key: adapted.adapterKey,
    adapter_version: adapted.adapterVersion,
    final_url: fetched.finalUrl,
    content_type: fetched.contentType,
    byte_length: fetched.bytes.byteLength,
    canonical_length: adapted.canonicalLength,
    raw_digest: sha256Hex(fetched.bytes),
  };
}

export async function captureProductionCanaryPair({
  targetPath = DEFAULT_TARGET,
  fetchImpl = fetch,
  delayMs = 2000,
} = {}) {
  const target = JSON.parse(await readFile(targetPath, "utf8"));
  if (!target?.source_id || !target?.canonical_locator) {
    throw new Error("CANARY_TARGET_INVALID");
  }

  const adapterKey = target.adapter_key || "live-page-bytes";
  const adapterVersion = target.adapter_version || "v1";
  const baseline = await capture(target.canonical_locator, "baseline", adapterKey, adapterVersion, target.source_metadata, fetchImpl);
  await sleep(delayMs);
  const verification = await capture(target.canonical_locator, "verification", adapterKey, adapterVersion, target.source_metadata, fetchImpl);

  return {
    contract: "trust-phase8g-production-canary-capture-v1",
    source_id: target.source_id,
    publisher: target.publisher || null,
    canonical_locator: target.canonical_locator,
    baseline,
    verification,
    stable: baseline.digest === verification.digest,
    authority_mutation: false,
  };
}

export async function captureProductionCanaryOutcome(options = {}) {
  try {
    return await captureProductionCanaryPair(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith("TRANSIENT_FAILURE:") && !message.startsWith("SOURCE_BLOCKED:")) {
      throw error;
    }
    const targetPath = options.targetPath || DEFAULT_TARGET;
    const target = JSON.parse(await readFile(targetPath, "utf8"));
    return {
      contract: "trust-phase8g-production-canary-capture-v1",
      source_id: target.source_id,
      publisher: target.publisher || null,
      canonical_locator: target.canonical_locator,
      baseline: null,
      verification: null,
      stable: false,
      capture_status: message,
      retry_after_seconds: Number.isFinite(error?.retryAfterSeconds) ? error.retryAfterSeconds : null,
      authority_mutation: false,
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await captureProductionCanaryOutcome({
    targetPath: argValue("target") || DEFAULT_TARGET,
  });
  console.log(`TRUST_PHASE8G_CANARY_CAPTURE_JSON=${JSON.stringify(result)}`);
}
