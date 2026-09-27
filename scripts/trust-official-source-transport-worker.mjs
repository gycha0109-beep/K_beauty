import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { probeOfficialTransport } from "../lib/trust/official-source-transport-fetch.mjs";

const WORKER_VERSION = "trust-official-source-transport-worker-v1";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

async function rpcOrThrow(client, fn, args = {}) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}:${error.code || "RPC_ERROR"}:${error.message}`);
  return data;
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

async function probeHostGroup(hostGroup, {
  client,
  fetchImpl,
  record,
  runId,
  checkedAtFactory,
}) {
  const output = [];

  for (const target of hostGroup.targets) {
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
  record = true,
  runId = randomUUID(),
  checkedAtFactory = () => new Date().toISOString(),
} = {}) {
  if (!client) throw new Error("client is required");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error("concurrency must be an integer between 1 and 8");
  }

  const resolver = await rpcOrThrow(
    client,
    "get_trust_official_source_transport_targets_v1",
  );
  const targets = Array.isArray(resolver?.targets) ? resolver.targets : [];
  const readyGroups = groupReadyTargets(targets);

  const byHost = new Map();
  for (const target of readyGroups) {
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
    record,
    sourceCount: Number(resolver?.source_count || targets.length),
    readySourceCount: Number(resolver?.ready_source_count || targets.filter((x) => x.target_status === "READY").length),
    blockedSourceCount: Number(resolver?.blocked_source_count || targets.filter((x) => x.target_status !== "READY").length),
    uniqueReadyTargetCount: readyGroups.length,
    networkProbeCount: probes.length,
    observationCount,
    incidentCount,
    resultCounts,
    blockedTargets: targets
      .filter((target) => target.target_status !== "READY")
      .map((target) => ({
        sourceId: target.source_id,
        targetStatus: target.target_status,
        historicalLocator: target.historical_locator,
        effectiveLocator: target.effective_locator,
      })),
    probes,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await runOfficialSourceTransportWorker({
    client,
    concurrency: Number(argValue("concurrency") || 3),
    record: argValue("record") !== "false",
    runId: argValue("run-id") || randomUUID(),
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
