import assert from "node:assert/strict";
import fs from "node:fs";
import {
  computeTransportFleetSnapshotDigest,
  runOfficialSourceTransportWorker,
} from "./trust-official-source-transport-worker.mjs";

const workerSource = fs.readFileSync(
  "scripts/trust-official-source-transport-worker.mjs",
  "utf8",
);
const workflowSource = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);
const liveResultVerifierSource = fs.readFileSync(
  "scripts/verify-trust-phase8i2b-live-result.mjs",
  "utf8",
);
const manifest = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i2-live-canary-targets-v1.json",
    "utf8",
  ),
);
const foundationClosure = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i2-transport-foundation-production-closure-v1.json",
    "utf8",
  ),
);

function target(sourceId, targetKey, locator, status = "READY") {
  return {
    source_id: sourceId,
    target_key: targetKey,
    effective_locator: locator,
    historical_locator: locator,
    target_status: status,
    publisher: "fixture",
    source_kind: "official_product_page",
    relocation_id: null,
    replacement_binding_id: null,
  };
}

function makeClient(targets, recordCalls = []) {
  return {
    async rpc(fn, args = {}) {
      if (fn === "get_trust_official_source_transport_targets_v1") {
        const ready = targets.filter((item) => item.target_status === "READY");
        return {
          data: {
            contract: "trust-official-source-transport-targets-v1",
            source_count: targets.length,
            ready_source_count: ready.length,
            blocked_source_count: targets.length - ready.length,
            unique_ready_target_count: new Set(ready.map((item) => item.target_key)).size,
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
      throw new Error(`unexpected rpc: ${fn}`);
    },
  };
}

function okFetchCounter(counter) {
  return async (url, options) => {
    counter.count += 1;
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    return new Response(null, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
}

async function expectRejectWithoutFetch(promiseFactory, pattern) {
  const counter = { count: 0 };
  await assert.rejects(
    () => promiseFactory(counter),
    pattern,
  );
  assert.equal(counter.count, 0, "preflight failures must happen before network access");
}

function verifyCheckedInManifest() {
  assert.equal(manifest.contract, "trust-phase8i2-live-canary-targets-v1");
  assert.equal(manifest.expected_target_count, 5);
  assert.equal(manifest.expected_source_count, 10);
  assert.equal(manifest.targets.length, 5);

  const expectedKeys = new Set([
    "official-transport-url-sha256:fd53d973c3e55d592b6244c2770c715196991b3105d1bfd1d88c656eab6b29d9",
    "official-transport-url-sha256:76fab84182f159357f5965a01ca9e51fe82bfb7140ee27512b952da3a921f2e1",
    "official-transport-url-sha256:1d399d803aee71761004ed719f0eb66d4935ff46852de04637135bb8250b8ab1",
    "official-transport-url-sha256:c316675db2dadd2c27ceb1649c071495216471f15620a765159a95d6911981c2",
    "official-transport-url-sha256:cbc11adb615fb2040e65f668119235c72e9015623afcf948a5fced785fe395a5",
  ]);
  assert.deepEqual(
    new Set(manifest.targets.map((item) => item.target_key)),
    expectedKeys,
  );

  const sourceIds = manifest.targets.flatMap((item) => item.expected_source_ids);
  assert.equal(sourceIds.length, 10);
  assert.equal(new Set(sourceIds).size, 10);
  assert.equal(
    manifest.targets.reduce((sum, item) => sum + item.expected_source_count, 0),
    10,
  );

  assert.equal(manifest.authority_basis.source_count, 35);
  assert.equal(manifest.authority_basis.ready_source_count, 35);
  assert.equal(manifest.authority_basis.blocked_source_count, 0);
  assert.equal(manifest.authority_basis.unique_ready_target_count, 25);
  assert.equal(
    manifest.authority_basis.foundation_merge_sha,
    "2c918e95f76c1b334b9d2b573b0f64186707a343",
  );

  assert.equal(foundationClosure.resolver.source_count, 35);
  assert.equal(foundationClosure.resolver.unique_ready_target_count, 25);
}

function verifyDigestDeterminism() {
  const a = [
    target("b", `official-transport-url-sha256:${"b".repeat(64)}`, "https://1.1.1.1/b"),
    target("a", `official-transport-url-sha256:${"a".repeat(64)}`, "https://8.8.8.8/a"),
  ];
  const b = [...a].reverse();
  assert.equal(
    computeTransportFleetSnapshotDigest(a),
    computeTransportFleetSnapshotDigest(b),
  );
  assert.match(computeTransportFleetSnapshotDigest(a), /^[0-9a-f]{64}$/);
}

async function verifyFailClosedPreflight() {
  const keyA = `official-transport-url-sha256:${"a".repeat(64)}`;
  const ready = [target("source-a", keyA, "https://1.1.1.1/a")];

  await expectRejectWithoutFetch(
    (counter) => runOfficialSourceTransportWorker({
      client: makeClient(ready),
      fetchImpl: okFetchCounter(counter),
      record: true,
      expectedSourceCount: 1,
      expectedTargetCount: 1,
      perHostDelayMs: 0,
    }),
    /scope must be explicitly set/,
  );

  await expectRejectWithoutFetch(
    (counter) => runOfficialSourceTransportWorker({
      client: makeClient(ready),
      fetchImpl: okFetchCounter(counter),
      scope: "full",
      expectedSourceCount: 1,
      expectedTargetCount: 1,
      perHostDelayMs: 0,
    }),
    /record must be explicitly set/,
  );

  const blocked = [
    target("source-a", keyA, "https://1.1.1.1/a", "DB_INVARIANT_BLOCKED"),
  ];
  await expectRejectWithoutFetch(
    (counter) => runOfficialSourceTransportWorker({
      client: makeClient(blocked),
      fetchImpl: okFetchCounter(counter),
      scope: "full",
      record: true,
      expectedSourceCount: 1,
      expectedTargetCount: 1,
      perHostDelayMs: 0,
    }),
    /TRANSPORT_FLEET_DB_INVARIANT_BLOCKED/,
  );

  await expectRejectWithoutFetch(
    (counter) => runOfficialSourceTransportWorker({
      client: makeClient(ready),
      fetchImpl: okFetchCounter(counter),
      scope: "full",
      record: true,
      expectedSourceCount: 2,
      expectedTargetCount: 1,
      perHostDelayMs: 0,
    }),
    /TRANSPORT_FLEET_SOURCE_COUNT_MISMATCH/,
  );

  const digest = computeTransportFleetSnapshotDigest(ready);
  await expectRejectWithoutFetch(
    (counter) => runOfficialSourceTransportWorker({
      client: makeClient(ready),
      fetchImpl: okFetchCounter(counter),
      scope: "full",
      record: true,
      expectedSourceCount: 1,
      expectedTargetCount: 1,
      expectedFleetDigest: digest.replace(/^./, digest[0] === "0" ? "1" : "0"),
      perHostDelayMs: 0,
    }),
    /TRANSPORT_FLEET_CHANGED_DURING_ROLLOUT/,
  );

  const staleManifest = {
    contract: "trust-phase8i2-live-canary-targets-v1",
    expected_target_count: 1,
    expected_source_count: 1,
    targets: [{
      target_key: keyA,
      expected_effective_locator: "https://1.1.1.1/stale",
      expected_source_count: 1,
      expected_source_ids: ["source-a"],
    }],
  };
  await expectRejectWithoutFetch(
    (counter) => runOfficialSourceTransportWorker({
      client: makeClient(ready),
      fetchImpl: okFetchCounter(counter),
      scope: "canary",
      manifest: staleManifest,
      record: true,
      expectedSourceCount: 1,
      expectedTargetCount: 1,
      perHostDelayMs: 0,
    }),
    /TRANSPORT_CANARY_MANIFEST_STALE:locator/,
  );
}

async function verifySelectedCanaryAndRecordFalse() {
  const keyA = `official-transport-url-sha256:${"a".repeat(64)}`;
  const keyB = `official-transport-url-sha256:${"b".repeat(64)}`;
  const keyC = `official-transport-url-sha256:${"c".repeat(64)}`;
  const targets = [
    target("a1", keyA, "https://1.1.1.1/a"),
    target("a2", keyA, "https://1.1.1.1/a"),
    target("b1", keyB, "https://8.8.8.8/b"),
    target("c1", keyC, "https://9.9.9.9/c"),
  ];
  const syntheticManifest = {
    contract: "trust-phase8i2-live-canary-targets-v1",
    expected_target_count: 2,
    expected_source_count: 3,
    targets: [
      {
        target_key: keyA,
        expected_effective_locator: "https://1.1.1.1/a",
        expected_source_count: 2,
        expected_source_ids: ["a1", "a2"],
      },
      {
        target_key: keyB,
        expected_effective_locator: "https://8.8.8.8/b",
        expected_source_count: 1,
        expected_source_ids: ["b1"],
      },
    ],
  };

  const fetchCounter = { count: 0 };
  const recordCalls = [];
  const result = await runOfficialSourceTransportWorker({
    client: makeClient(targets, recordCalls),
    fetchImpl: okFetchCounter(fetchCounter),
    scope: "canary",
    manifest: syntheticManifest,
    record: false,
    expectedSourceCount: 3,
    expectedTargetCount: 2,
    perHostDelayMs: 0,
    runId: "phase8i2b-canary-fixture",
    checkedAtFactory: () => "2026-09-28T00:00:00.000Z",
  });

  assert.equal(result.scope, "canary");
  assert.equal(result.record, false);
  assert.equal(result.sourceCount, 4);
  assert.equal(result.uniqueReadyTargetCount, 3);
  assert.equal(result.selectedSourceCount, 3);
  assert.equal(result.selectedTargetCount, 2);
  assert.equal(result.networkProbeCount, 2);
  assert.equal(result.observationCount, 3);
  assert.equal(fetchCounter.count, 2);
  assert.equal(recordCalls.length, 0);
  assert.match(result.fleetSnapshotDigest, /^[0-9a-f]{64}$/);
  assert.match(result.scopeSnapshotDigest, /^[0-9a-f]{64}$/);
}

function verifyCliSafetyContract() {
  assert.ok(workerSource.includes("--scope=canary|full is required"));
  assert.ok(workerSource.includes('parseRequiredBooleanArg("record")'));
  assert.ok(workerSource.includes("=true|false is required"));
  assert.ok(workerSource.includes("--manifest=<path> is required for canary scope"));
  assert.ok(workerSource.includes("--expected-source-count=<positive integer> is required"));
  assert.ok(workerSource.includes("--expected-target-count=<positive integer> is required"));
  assert.ok(workerSource.includes("TRANSPORT_FLEET_CHANGED_DURING_ROLLOUT"));
  assert.ok(workerSource.includes("TRANSPORT_CANARY_MANIFEST_STALE"));
  assert.ok(workerSource.includes("TRANSPORT_FLEET_DB_INVARIANT_BLOCKED"));
  assert.ok(workerSource.includes("perHostDelayMs = 1_000"));
}

function verifyWorkflowBoundary() {
  assert.ok(workflowSource.includes("transport_mode:"));
  assert.ok(workflowSource.includes("transport_expected_fleet_digest:"));
  assert.ok(
    workflowSource.includes(
      "if: github.event_name == 'workflow_dispatch' && inputs.transport_mode != 'none'",
    ),
  );
  assert.equal(
    (
      workflowSource.match(
        /if: github\.event_name == 'workflow_dispatch' && inputs\.transport_mode == 'none'/g,
      ) || []
    ).length,
    2,
  );
  assert.ok(workflowSource.includes('test "$GITHUB_REF" = "refs/heads/main"'));
  assert.ok(workflowSource.includes('"--record=true"'));
  assert.ok(workflowSource.includes('"--per-host-delay-ms=1000"'));
  assert.ok(workflowSource.includes('"--expected-source-count=10"'));
  assert.ok(workflowSource.includes('"--expected-target-count=5"'));
  assert.ok(workflowSource.includes('"--expected-source-count=35"'));
  assert.ok(workflowSource.includes('"--expected-target-count=25"'));
  assert.ok(workflowSource.includes("--expected-fleet-digest="));
  assert.ok(workflowSource.includes("actions/upload-artifact@v7"));
  assert.ok(!workflowSource.includes("\n  schedule:"));

  assert.ok(liveResultVerifierSource.includes("degraded target threshold"));
  assert.ok(liveResultVerifierSource.includes("unsafe/hard transport blocks detected"));
  assert.ok(liveResultVerifierSource.includes("selectedTargetCount: 5"));
  assert.ok(liveResultVerifierSource.includes("selectedTargetCount: 25"));
}

verifyCheckedInManifest();
verifyDigestDeterminism();
await verifyFailClosedPreflight();
await verifySelectedCanaryAndRecordFalse();
verifyCliSafetyContract();
verifyWorkflowBoundary();

console.log("TRUST_PHASE8I2B_ROLLOUT_CONTROLS_VERIFIED");
