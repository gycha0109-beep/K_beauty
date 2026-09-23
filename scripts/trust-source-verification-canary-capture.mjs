import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fetchOfficialBytes, sha256Hex } from "../lib/trust/official-source-fetch.mjs";

const DEFAULT_TARGET = "docs/evidence/trust-phase8g-production-canary-target-v1.json";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(url, label, fetchImpl = fetch) {
  const fetched = await fetchOfficialBytes(url, fetchImpl);
  return {
    label,
    fetched_at: new Date().toISOString(),
    digest: sha256Hex(fetched.bytes),
    final_url: fetched.finalUrl,
    content_type: fetched.contentType,
    byte_length: fetched.bytes.byteLength,
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

  const baseline = await capture(target.canonical_locator, "baseline", fetchImpl);
  await sleep(delayMs);
  const verification = await capture(target.canonical_locator, "verification", fetchImpl);

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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await captureProductionCanaryPair({
    targetPath: argValue("target") || DEFAULT_TARGET,
  });
  console.log(`TRUST_PHASE8G_CANARY_CAPTURE_JSON=${JSON.stringify(result)}`);
}
