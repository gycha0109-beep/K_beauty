import assert from "node:assert/strict";
import fs from "node:fs";
import { probeOfficialTransport } from "../lib/trust/official-source-transport-fetch.mjs";
import { runOfficialSourceTransportWorker } from "./trust-official-source-transport-worker.mjs";

const blueprint = fs.readFileSync(
  "docs/evidence/trust-phase8i2-transport-foundation-db-blueprint-v1.sql",
  "utf8",
);
const dryRun = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i2-transport-foundation-dry-run-v1.json",
    "utf8",
  ),
);

function mockResponse(status, headers = {}) {
  return new Response(null, { status, headers });
}

function sequenceFetch(steps) {
  let index = 0;
  return async (url, options) => {
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    const step = steps[index++];
    assert.ok(step, `unexpected fetch at ${url}`);
    if (step.throw) throw step.throw;
    return mockResponse(step.status, step.headers);
  };
}

async function verifyProbeClassification() {
  let result = await probeOfficialTransport(
    "https://1.1.1.1/html",
    sequenceFetch([{ status: 200, headers: { "content-type": "text/html" } }]),
  );
  assert.equal(result.transportResult, "HEALTHY");
  assert.equal(result.httpStatus, 200);
  assert.deepEqual(result.redirectChain, []);

  result = await probeOfficialTransport(
    "https://1.1.1.1/document.pdf",
    sequenceFetch([{ status: 200, headers: { "content-type": "application/pdf" } }]),
  );
  assert.equal(result.transportResult, "HEALTHY");
  assert.equal(result.contentType, "application/pdf");

  result = await probeOfficialTransport(
    "https://1.1.1.1/old",
    sequenceFetch([
      { status: 301, headers: { location: "https://1.1.1.1/new" } },
      { status: 200, headers: { "content-type": "text/html" } },
    ]),
  );
  assert.equal(result.transportResult, "REDIRECTED");
  assert.equal(result.finalUrl, "https://1.1.1.1/new");
  assert.equal(result.redirectChain.length, 1);
  assert.equal(result.redirectChain[0].status, 301);

  for (const status of [404, 410]) {
    result = await probeOfficialTransport(
      "https://1.1.1.1/missing",
      sequenceFetch([{ status }]),
    );
    assert.equal(result.transportResult, "MISSING");
    assert.equal(result.httpStatus, status);
  }

  for (const status of [429, 503]) {
    result = await probeOfficialTransport(
      "https://1.1.1.1/transient",
      sequenceFetch([{ status }]),
    );
    assert.equal(result.transportResult, "TRANSIENT");
  }

  result = await probeOfficialTransport(
    "https://1.1.1.1/network",
    sequenceFetch([{ throw: new Error("socket reset") }]),
  );
  assert.equal(result.transportResult, "TRANSIENT");
  assert.equal(result.detail, "TRANSIENT_FAILURE:fetch_error");

  result = await probeOfficialTransport(
    "https://1.1.1.1/forbidden",
    sequenceFetch([{ status: 403 }]),
  );
  assert.equal(result.transportResult, "BLOCKED");
  assert.equal(result.httpStatus, 403);

  result = await probeOfficialTransport(
    "https://1.1.1.1/private-redirect",
    sequenceFetch([
      { status: 302, headers: { location: "https://127.0.0.1/private" } },
    ]),
  );
  assert.equal(result.transportResult, "BLOCKED");
  assert.match(result.detail, /^SOURCE_BLOCKED:private_ip$/);

  result = await probeOfficialTransport(
    "https://1.1.1.1/loop-0",
    sequenceFetch([
      { status: 301, headers: { location: "https://1.1.1.1/loop-1" } },
      { status: 301, headers: { location: "https://1.1.1.1/loop-2" } },
      { status: 301, headers: { location: "https://1.1.1.1/loop-3" } },
      { status: 301, headers: { location: "https://1.1.1.1/loop-4" } },
    ]),
  );
  assert.equal(result.transportResult, "BLOCKED");
  assert.equal(result.detail, "SOURCE_BLOCKED:redirect_limit");
  assert.equal(result.redirectChain.length, 3);
}

async function verifyWorkerDedupeFanout() {
  const keyA = `official-transport-url-sha256:${"a".repeat(64)}`;
  const keyB = `official-transport-url-sha256:${"b".repeat(64)}`;
  const keyC = `official-transport-url-sha256:${"c".repeat(64)}`;
  const keyD = `official-transport-url-sha256:${"d".repeat(64)}`;

  const targets = [
    ["tor-1", keyA, "https://1.1.1.1/torriden", "READY"],
    ["tor-2", keyA, "https://1.1.1.1/torriden", "READY"],
    ["boj-1", keyB, "https://8.8.8.8/boj", "READY"],
    ["boj-2", keyB, "https://8.8.8.8/boj", "READY"],
    ["boj-3", keyB, "https://8.8.8.8/boj", "READY"],
    ["drg-1", keyC, "https://1.1.1.1/drg", "READY"],
    ["blocked-1", keyD, "https://8.8.8.8/blocked", "DB_INVARIANT_BLOCKED"],
  ].map(([sourceId, targetKey, effectiveLocator, targetStatus]) => ({
    source_id: sourceId,
    target_key: targetKey,
    effective_locator: effectiveLocator,
    historical_locator: effectiveLocator,
    target_status: targetStatus,
    publisher: sourceId.startsWith("tor")
      ? "Torriden"
      : sourceId.startsWith("boj")
        ? "Beauty of Joseon"
        : "Dr.G",
    source_kind: "official_product_page",
    relocation_id: null,
    replacement_binding_id: null,
  }));

  const recordCalls = [];
  const client = {
    async rpc(fn, args = {}) {
      if (fn === "get_trust_official_source_transport_targets_v1") {
        return {
          data: {
            contract: "trust-official-source-transport-targets-v1",
            source_count: 7,
            ready_source_count: 6,
            blocked_source_count: 1,
            unique_ready_target_count: 3,
            targets,
          },
          error: null,
        };
      }

      if (fn === "record_trust_official_source_transport_observation_v1") {
        recordCalls.push(args);
        return {
          data: {
            status: "recorded",
            idempotent: false,
            observation_id: `obs-${recordCalls.length}`,
            incident_created: false,
            incident_id: null,
            transport_result: args.p_transport_result,
          },
          error: null,
        };
      }

      throw new Error(`unexpected rpc ${fn}`);
    },
  };

  const activeByHost = new Map();
  const maxByHost = new Map();
  const fetchCalls = [];

  const fetchImpl = async (url, options) => {
    assert.equal(options.method, "GET");
    const parsed = new URL(url);
    const host = parsed.hostname;
    fetchCalls.push(parsed.toString());
    const active = (activeByHost.get(host) || 0) + 1;
    activeByHost.set(host, active);
    maxByHost.set(host, Math.max(maxByHost.get(host) || 0, active));
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeByHost.set(host, active - 1);
    return mockResponse(200, { "content-type": "application/pdf" });
  };

  const result = await runOfficialSourceTransportWorker({
    client,
    fetchImpl,
    concurrency: 3,
    record: true,
    runId: "phase8i2-mock-run",
    checkedAtFactory: () => "2026-09-28T00:00:00.000Z",
  });

  assert.equal(result.sourceCount, 7);
  assert.equal(result.readySourceCount, 6);
  assert.equal(result.blockedSourceCount, 1);
  assert.equal(result.uniqueReadyTargetCount, 3);
  assert.equal(result.networkProbeCount, 3);
  assert.equal(result.observationCount, 6);
  assert.equal(result.incidentCount, 0);
  assert.equal(result.resultCounts.HEALTHY, 3);
  assert.equal(fetchCalls.length, 3);
  assert.equal(recordCalls.length, 6);
  assert.ok([...maxByHost.values()].every((value) => value === 1));

  const torridenCalls = recordCalls.filter((call) =>
    ["tor-1", "tor-2"].includes(call.p_source_id)
  );
  assert.equal(torridenCalls.length, 2);
  assert.equal(torridenCalls[0].p_probe_group_id, torridenCalls[1].p_probe_group_id);
  assert.equal(torridenCalls[0].p_target_key, torridenCalls[1].p_target_key);
  assert.ok(!recordCalls.some((call) => call.p_source_id === "blocked-1"));
}

function verifySqlContract() {
  assert.ok(blueprint.includes("create table public.trust_official_source_transport_observations"));
  assert.ok(blueprint.includes("create table public.trust_official_source_transport_incidents"));
  assert.ok(blueprint.includes("alter table public.trust_official_source_transport_observations enable row level security"));
  assert.ok(blueprint.includes("alter table public.trust_official_source_transport_incidents enable row level security"));

  assert.match(blueprint, /(?:from|join)\s+public\.product_fact_current\s+c/i);
  assert.ok(blueprint.includes("e.support_direction='supports'"));
  assert.ok(!blueprint.includes("catalog_trust_intake"));
  assert.ok(blueprint.includes("'official_product_page'"));
  assert.ok(blueprint.includes("'brand_official_product_page'"));
  assert.ok(blueprint.includes("'brand_official_technical_document'"));
  assert.ok(blueprint.includes("'manufacturer_official_document'"));
  assert.ok(blueprint.includes("'official_market_sales_page'"));

  assert.ok(blueprint.includes("public.trust_official_source_transport_targets_v1()"));
  assert.ok(blueprint.includes("public.get_trust_official_source_transport_targets_v1()"));
  assert.ok(blueprint.includes("public.record_trust_official_source_transport_observation_v1("));
  assert.ok(blueprint.includes("set search_path = ''"));

  assert.ok(
    blueprint.includes(
      "revoke all on function public.trust_official_source_transport_targets_v1()\n  from public, anon, authenticated, service_role;",
    ),
  );
  assert.ok(
    blueprint.includes(
      "grant execute on function public.get_trust_official_source_transport_targets_v1()\n  to service_role;",
    ),
  );
  assert.ok(
    blueprint.includes(
      "grant execute on function public.record_trust_official_source_transport_observation_v1(",
    ),
  );

  assert.ok(blueprint.includes("interval '30 minutes'"));
  assert.ok(blueprint.includes("'CONFIRMED_REDIRECT'"));
  assert.ok(blueprint.includes("'CONFIRMED_MISSING'"));
  assert.ok(blueprint.includes("'DB_INVARIANT_BLOCKED'"));
  assert.ok(blueprint.includes("rel.replacement_locator"));
  assert.ok(blueprint.includes("src.canonical_locator as historical_locator"));

  for (const forbidden of [
    "update public.product_fact_current",
    "insert into public.product_fact_current",
    "delete from public.product_fact_current",
    "update public.product_evidence_sources",
    "delete from public.product_evidence_sources",
    "update public.product_source_bindings",
    "insert into public.product_source_bindings",
    "admin_confirm_trust_official_source_relocation_v1",
    "admin_reaffirm_product_fact_revalidation_v1",
  ]) {
    assert.ok(
      !blueprint.toLowerCase().includes(forbidden.toLowerCase()),
      `forbidden authority mutation found: ${forbidden}`,
    );
  }
}

function verifyDryRunEvidence() {
  assert.equal(dryRun.contract, "trust-phase8i2-transport-foundation-dry-run-v1");
  assert.equal(dryRun.result, "PASS");
  assert.equal(dryRun.production_transaction_rolled_back, true);
  assert.equal(dryRun.resolver.source_count, 35);
  assert.equal(dryRun.resolver.ready_source_count, 35);
  assert.equal(dryRun.resolver.blocked_source_count, 0);
  assert.equal(dryRun.resolver.unique_ready_target_count, 25);
  assert.equal(dryRun.resolver.torriden_intake_zero_sources_present, 2);
  assert.equal(dryRun.resolver.drg_equivalent_presentation_source_present, true);
  assert.notEqual(
    dryRun.resolver.derma.historical_locator,
    dryRun.resolver.derma.effective_locator,
  );
  assert.equal(dryRun.observation_incident_runtime.incidents_recorded, 3);
  assert.equal(dryRun.observation_incident_runtime.redirect_episode_1.incident_count, 1);
  assert.equal(dryRun.observation_incident_runtime.healthy_break_then_redirect_episode_2.incident_count, 1);
  assert.equal(dryRun.observation_incident_runtime.missing_episode.incident_count, 1);
  assert.equal(dryRun.observation_incident_runtime.transient_episode.incident_count, 0);
  assert.equal(dryRun.security.direct_observation_incident_role_grants, 0);
  assert.equal(dryRun.rollback_readback.observation_table_persisted, false);
  assert.equal(dryRun.rollback_readback.incident_table_persisted, false);
  assert.equal(dryRun.rollback_readback.resolver_persisted, false);
  assert.equal(dryRun.rollback_readback.recorder_persisted, false);
  assert.equal(dryRun.authority_invariants.product_fact_current_rows, 71);
  assert.equal(dryRun.authority_invariants.product_evidence_source_rows, 40);
  assert.equal(dryRun.authority_invariants.confirmed_relocations, 1);
}

await verifyProbeClassification();
await verifyWorkerDedupeFanout();
verifySqlContract();
verifyDryRunEvidence();

console.log("TRUST_PHASE8I2_TRANSPORT_FOUNDATION_VERIFIED");
