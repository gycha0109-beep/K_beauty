import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { probeOfficialTransport } from "../lib/trust/official-source-transport-fetch.mjs";

const WORKER_VERSION = "trust-official-source-transport-worker-v1";
const VALID_SCOPES = new Set(["canary", "full"]);

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

function parseRequiredBooleanArg(name) {
  const raw = argValue(name);
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`--${name}=true|false is required`);
}

function parseRequiredPositiveIntArg(name) {
  const raw = argValue(name);
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value < 1) {
    throw new Error(`--${name}=<positive integer> is required`);
  }
  return value;
}

function parseOptionalNonNegativeIntArg(name, fallback) {
  const raw = argValue(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return value;
}

async function rpcOrThrow(client, fn, args = {}) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}:${error.code || "RPC_ERROR"}:${error.message}`);
  return data;
}

function canonicalFleetRows(targets) {
  return [...(targets || [])]
    .map((target) => ({
      source_id: String(target.source_id || ""),
      target_key: String(target.target_key || ""),
      effective_locator: String(target.effective_locator || ""),
      target_status: String(target.target_status || ""),
    }))
    .sort((a, b) =>
      a.source_id.localeCompare(b.source_id) ||
      a.target_key.localeCompare(b.target_key) ||
      a.effective_locator.localeCompare(b.effective_locator) ||
      a.target_status.localeCompare(b.target_status)
    );
}

export function computeTransportFleetSnapshotDigest(targets) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalFleetRows(targets)))
    .digest("hex");
}

function groupReadyTargets(targets) {
  const groups = new Map();

  for (const target of targets || []) {
    if (target.target_status !== "READY") continue;
    const key = String(target.target_key || "");
    const locator = String(target.effective_locator || "");
    if (!key || !locator) throw new Error("TRANSPORT_TARGET_INVALID");

    const existing = groups.get(key);
    if (existing) {
      if (existing.effectiveLocator !== locator) {
        throw new Error("TRANSPORT_TARGET_KEY_COLLISION");
      }
      existing.sources.push(target);
      continue;
    }

    groups.set(key, {
      targetKey: key,
      effectiveLocator: locator,
      hostname: new URL(locator).hostname.toLowerCase(),
      sources: [target],
    });
  }

  return [...groups.values()];
}

function assertExpectedFleetCounts({ targets, readyGroups, expectedSourceCount, expectedTargetCount }) {
  if (!Number.isInteger(expectedSourceCount) || expectedSourceCount < 1) {
    throw new Error("expectedSourceCount must be a positive integer");
  }
  if (!Number.isInteger(expectedTargetCount) || expectedTargetCount < 1) {
    throw new Error("expectedTargetCount must be a positive integer");
  }
  if (targets.length !== expectedSourceCount) {
    throw new Error(
      `TRANSPORT_FLEET_SOURCE_COUNT_MISMATCH:expected=${expectedSourceCount}:actual=${targets.length}`,
    );
  }
  if (readyGroups.length !== expectedTargetCount) {
    throw new Error(
      `TRANSPORT_FLEET_TARGET_COUNT_MISMATCH:expected=${expectedTargetCount}:actual=${readyGroups.length}`,
    );
  }
}

function selectCanaryGroups(readyGroups, manifest) {
  if (!manifest || manifest.contract !== "trust-phase8i2-live-canary-targets-v1") {
    throw new Error("TRANSPORT_CANARY_MANIFEST_INVALID");
  }
  if (!Array.isArray(manifest.targets) || manifest.targets.length < 1) {
    throw new Error("TRANSPORT_CANARY_MANIFEST_EMPTY");
  }

  const byKey = new Map(readyGroups.map((group) => [group.targetKey, group]));
  const selected = [];
  let sourceCount = 0;

  for (const expected of manifest.targets) {
    const group = byKey.get(String(expected.target_key || ""));
    if (!group) {
      throw new Error(`TRANSPORT_CANARY_MANIFEST_STALE:missing_target:${expected.target_key}`);
    }

    const expectedLocator = String(expected.expected_effective_locator || "");
    if (group.effectiveLocator !== expectedLocator) {
      throw new Error(
        `TRANSPORT_CANARY_MANIFEST_STALE:locator:${expected.target_key}`,
      );
    }

    const actualSourceIds = group.sources.map((source) => String(source.source_id)).sort();
    const expectedSourceIds = [...(expected.expected_source_ids || [])].map(String).sort();
    if (JSON.stringify(actualSourceIds) !== JSON.stringify(expectedSourceIds)) {
      throw new Error(
        `TRANSPORT_CANARY_MANIFEST_STALE:sources:${expected.target_key}`,
      );
    }

    if (Number(expected.expected_source_count) !== actualSourceIds.length) {
      throw new Error(
        `TRANSPORT_CANARY_MANIFEST_STALE:source_count:${expected.target_key}`,
      );
    }

    sourceCount += actualSourceIds.length;
    selected.push(group);
  }

  if (Number(manifest.expected_target_count) !== selected.length) {
    throw new Error("TRANSPORT_CANARY_MANIFEST_STALE:target_count");
  }
  if (Number(manifest.expected_source_count) !== sourceCount) {
    throw new Error("TRANSPORT_CANARY_MANIFEST_STALE:total_source_count");
  }

  return selected;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length || 1)) },
    () => runner(),
  );
  await Promise.all(workers);
  return results;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeHostGroup(hostGroup, {
  client,
  fetchImpl,
  record,
  runId,
  checkedAtFactory,
  perHostDelayMs,
}) {
  const output = [];

  for (let index = 0; index < hostGroup.targets.length; index += 1) {
    if (index > 0) await sleep(perHostDelayMs);

    const target = hostGroup.targets[index];
    const checkedAt = checkedAtFactory();
    const probeGroupId = `${runId}:${target.targetKey}`;
    const probe = await probeOfficialTransport(target.effectiveLocator, fetchImpl);

    const sourceResults = [];
    for (const source of target.sources) {
      const observation = {
        sourceId: source.source_id,
        targetKey: target.targetKey,
        historicalLocator: source.historical_locator,
        effectiveLocator: target.effectiveLocator,
        relocationId: source.relocation_id || null,
        replacementBindingId: source.replacement_binding_id || null,
        transportResult: probe.transportResult,
        httpStatus: probe.httpStatus,
        finalLocator: probe.finalUrl,
        redirectChain: probe.redirectChain,
        checkedAt,
        workerVersion: WORKER_VERSION,
        transportMetadata: {
          detail: probe.detail,
          content_type: probe.contentType,
          retry_after_seconds: probe.retryAfterSeconds,
          publisher: source.publisher || null,
          source_kind: source.source_kind || null,
        },
      };

      let recorderResult = null;
      if (record) {
        recorderResult = await rpcOrThrow(
          client,
          "record_trust_official_source_transport_observation_v1",
          {
            p_request_id: `${runId}:${source.source_id}`,
            p_probe_group_id: probeGroupId,
            p_source_id: source.source_id,
            p_target_key: target.targetKey,
            p_transport_result: probe.transportResult,
            p_http_status: probe.httpStatus,
            p_final_locator: probe.finalUrl,
            p_redirect_chain: probe.redirectChain,
            p_checked_at: checkedAt,
            p_worker_version: WORKER_VERSION,
            p_transport_metadata: observation.transportMetadata,
          },
        );
      }

      sourceResults.push({
        observation,
        recorderResult,
      });
    }

    output.push({
      targetKey: target.targetKey,
      effectiveLocator: target.effectiveLocator,
      hostname: target.hostname,
      sourceCount: target.sources.length,
      probe,
      sourceResults,
    });
  }

  return output;
}

export async function runOfficialSourceTransportWorker({
  client,
  fetchImpl = fetch,
  concurrency = 3,
  record,
  runId = randomUUID(),
  checkedAtFactory = () => new Date().toISOString(),
  scope,
  manifest = null,
  expectedSourceCount,
  expectedTargetCount,
  expectedFleetDigest = null,
  perHostDelayMs = 1_000,
} = {}) {
  if (!client) throw new Error("client is required");
  if (!VALID_SCOPES.has(scope)) {
    throw new Error("scope must be explicitly set to canary or full");
  }
  if (typeof record !== "boolean") {
    throw new Error("record must be explicitly set to true or false");
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error("concurrency must be an integer between 1 and 8");
  }
  if (!Number.isInteger(perHostDelayMs) || perHostDelayMs < 0 || perHostDelayMs > 10_000) {
    throw new Error("perHostDelayMs must be an integer between 0 and 10000");
  }

  const resolver = await rpcOrThrow(
    client,
    "get_trust_official_source_transport_targets_v1",
  );
  const targets = Array.isArray(resolver?.targets) ? resolver.targets : [];
  const blockedTargets = targets.filter((target) => target.target_status !== "READY");
  if (blockedTargets.length > 0) {
    throw new Error(
      `TRANSPORT_FLEET_DB_INVARIANT_BLOCKED:count=${blockedTargets.length}`,
    );
  }

  const allReadyGroups = groupReadyTargets(targets);
  const fleetSnapshotDigest = computeTransportFleetSnapshotDigest(targets);

  if (expectedFleetDigest !== null) {
    if (!/^[0-9a-f]{64}$/.test(String(expectedFleetDigest))) {
      throw new Error("expectedFleetDigest must be a lowercase SHA-256 hex digest");
    }
    if (fleetSnapshotDigest !== expectedFleetDigest) {
      throw new Error(
        `TRANSPORT_FLEET_CHANGED_DURING_ROLLOUT:expected=${expectedFleetDigest}:actual=${fleetSnapshotDigest}`,
      );
    }
  }

  let selectedGroups;
  let selectedSourceCount;

  if (scope === "canary") {
    selectedGroups = selectCanaryGroups(allReadyGroups, manifest);
    selectedSourceCount = selectedGroups.reduce(
      (total, group) => total + group.sources.length,
      0,
    );

    if (selectedSourceCount !== expectedSourceCount) {
      throw new Error(
        `TRANSPORT_CANARY_SOURCE_COUNT_MISMATCH:expected=${expectedSourceCount}:actual=${selectedSourceCount}`,
      );
    }
    if (selectedGroups.length !== expectedTargetCount) {
      throw new Error(
        `TRANSPORT_CANARY_TARGET_COUNT_MISMATCH:expected=${expectedTargetCount}:actual=${selectedGroups.length}`,
      );
    }
  } else {
    assertExpectedFleetCounts({
      targets,
      readyGroups: allReadyGroups,
      expectedSourceCount,
      expectedTargetCount,
    });
    selectedGroups = allReadyGroups;
    selectedSourceCount = targets.length;
  }

  const selectedTargetKeys = new Set(selectedGroups.map((group) => group.targetKey));
  const selectedTargets = targets.filter((target) => selectedTargetKeys.has(target.target_key));
  const scopeSnapshotDigest = computeTransportFleetSnapshotDigest(selectedTargets);

  const byHost = new Map();
  for (const target of selectedGroups) {
    const existing = byHost.get(target.hostname) || [];
    existing.push(target);
    byHost.set(target.hostname, existing);
  }

  const hostGroups = [...byHost.entries()].map(([hostname, hostTargets]) => ({
    hostname,
    targets: hostTargets,
  }));

  const nested = await mapWithConcurrency(
    hostGroups,
    concurrency,
    (group) => probeHostGroup(group, {
      client,
      fetchImpl,
      record,
      runId,
      checkedAtFactory,
      perHostDelayMs,
    }),
  );
  const probes = nested.flat();

  const resultCounts = {};
  let incidentCount = 0;
  let observationCount = 0;

  for (const probe of probes) {
    resultCounts[probe.probe.transportResult] =
      (resultCounts[probe.probe.transportResult] || 0) + 1;
    observationCount += probe.sourceResults.length;
    incidentCount += probe.sourceResults.filter(
      (item) => item.recorderResult?.incident_created === true,
    ).length;
  }

  return {
    contract: "trust-official-source-transport-worker-result-v1",
    workerVersion: WORKER_VERSION,
    runId,
    scope,
    record,
    fleetSnapshotDigest,
    scopeSnapshotDigest,
    sourceCount: Number(resolver?.source_count || targets.length),
    readySourceCount: Number(resolver?.ready_source_count || targets.length),
    blockedSourceCount: Number(resolver?.blocked_source_count || 0),
    uniqueReadyTargetCount: allReadyGroups.length,
    selectedSourceCount,
    selectedTargetCount: selectedGroups.length,
    networkProbeCount: probes.length,
    observationCount,
    incidentCount,
    resultCounts,
    blockedTargets: [],
    probes,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const scope = argValue("scope");
  if (!VALID_SCOPES.has(scope)) {
    throw new Error("--scope=canary|full is required");
  }
  const record = parseRequiredBooleanArg("record");
  const expectedSourceCount = parseRequiredPositiveIntArg("expected-source-count");
  const expectedTargetCount = parseRequiredPositiveIntArg("expected-target-count");
  const manifestPath = argValue("manifest");
  let manifest = null;

  if (scope === "canary") {
    if (!manifestPath) throw new Error("--manifest=<path> is required for canary scope");
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } else if (manifestPath) {
    throw new Error("--manifest is only valid for canary scope");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await runOfficialSourceTransportWorker({
    client,
    concurrency: Number(argValue("concurrency") || 3),
    record,
    runId: argValue("run-id") || randomUUID(),
    scope,
    manifest,
    expectedSourceCount,
    expectedTargetCount,
    expectedFleetDigest: argValue("expected-fleet-digest"),
    perHostDelayMs: parseOptionalNonNegativeIntArg("per-host-delay-ms", 1_000),
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
