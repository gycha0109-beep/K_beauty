import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fetchOfficialBytes } from "../lib/trust/official-source-fetch.mjs";

export const FRONTIER_CONTRACT = "trust-phase8h-source-frontier-audit-v1";
export const INVENTORY_CONTRACT = "trust-phase8h-source-frontier-inventory-v1";

export const FRONTIER_STATES = Object.freeze([
  "HEALTHY_SAME_LOCATOR",
  "REDIRECTED",
  "TERMINAL_MISSING",
  "TRANSIENT_FAILURE",
  "SOURCE_BLOCKED",
]);

function comparableUrl(raw) {
  const url = new URL(raw);
  url.hash = "";
  return url.toString();
}

function errorMessage(error) {
  return String(error?.message || error || "unknown_error");
}

export function classifyFrontierOutcome(source, probeResult) {
  if (!probeResult || probeResult.ok !== true) {
    const message = errorMessage(probeResult?.error);
    if (message.startsWith("TRANSIENT_FAILURE:")) {
      return { state: "TRANSIENT_FAILURE", reason: message };
    }
    if (message === "SOURCE_BLOCKED:http_404" || message === "SOURCE_BLOCKED:http_410") {
      return { state: "TERMINAL_MISSING", reason: message };
    }
    return { state: "SOURCE_BLOCKED", reason: message };
  }

  const original = comparableUrl(source.canonical_locator);
  const finalUrl = comparableUrl(probeResult.finalUrl);
  if (original !== finalUrl) {
    return { state: "REDIRECTED", reason: "official_fetch_final_url_changed", final_url: probeResult.finalUrl };
  }
  return { state: "HEALTHY_SAME_LOCATOR", reason: "official_fetch_same_locator", final_url: probeResult.finalUrl };
}

export async function probeFrontierSource(source, fetchImpl = fetch) {
  try {
    const fetched = await fetchOfficialBytes(source.canonical_locator, fetchImpl);
    return { ok: true, finalUrl: fetched.finalUrl, contentType: fetched.contentType };
  } catch (error) {
    return { ok: false, error };
  }
}

function validateInventory(inventory) {
  if (!inventory || inventory.contract !== INVENTORY_CONTRACT || !Array.isArray(inventory.sources)) {
    throw new Error("TRUST_PHASE8H_FRONTIER_INVENTORY_INVALID");
  }
  if (inventory.source_count !== inventory.sources.length) {
    throw new Error("TRUST_PHASE8H_FRONTIER_INVENTORY_COUNT_MISMATCH");
  }
  const seen = new Set();
  for (const source of inventory.sources) {
    if (!source?.source_id || !String(source.canonical_locator || "").startsWith("https://")) {
      throw new Error("TRUST_PHASE8H_FRONTIER_SOURCE_INVALID");
    }
    if (seen.has(source.source_id)) throw new Error("TRUST_PHASE8H_FRONTIER_SOURCE_DUPLICATE");
    seen.add(source.source_id);
  }
}

export async function auditSourceFrontier(inventory, {
  probe = probeFrontierSource,
  concurrency = 4,
  observedAt = () => new Date().toISOString(),
} = {}) {
  validateInventory(inventory);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error("TRUST_PHASE8H_FRONTIER_CONCURRENCY_INVALID");
  }

  const results = new Array(inventory.sources.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= inventory.sources.length) return;
      const source = inventory.sources[index];
      let probeResult;
      try {
        probeResult = await probe(source);
      } catch (error) {
        probeResult = { ok: false, error };
      }
      const classification = classifyFrontierOutcome(source, probeResult);
      results[index] = {
        source_id: source.source_id,
        publisher: source.publisher,
        source_kind: source.source_kind,
        market: source.market ?? null,
        locale: source.locale ?? null,
        canonical_locator: source.canonical_locator,
        state: classification.state,
        reason: classification.reason,
        final_url: classification.final_url ?? null,
      };
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inventory.sources.length || 1) }, () => worker()));
  const counts = Object.fromEntries(FRONTIER_STATES.map((state) => [state, 0]));
  for (const row of results) counts[row.state] += 1;

  return {
    contract: FRONTIER_CONTRACT,
    inventory_contract: inventory.contract,
    inventory_snapshot_at: inventory.snapshot_at ?? null,
    observed_at: observedAt(),
    source_count: results.length,
    counts,
    sources: results,
    mutation_policy: "READ_ONLY_NO_PRODUCTION_WRITE",
    authority: "TRANSPORT_FRONTIER_ONLY_NOT_RELOCATION_AUTHORITY",
  };
}

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const input = argValue("input");
  const output = argValue("output");
  const concurrency = Number(argValue("concurrency") || "4");
  if (!input) throw new Error("Usage: node scripts/trust-source-frontier-audit.mjs --input=<inventory.json> [--output=<audit.json>] [--concurrency=4]");
  const inventory = JSON.parse(await fs.readFile(input, "utf8"));
  const audit = await auditSourceFrontier(inventory, { concurrency });
  const serialized = JSON.stringify(audit, null, 2) + "\n";
  if (output) await fs.writeFile(output, serialized, "utf8");
  else process.stdout.write(serialized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
