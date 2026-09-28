import assert from "node:assert/strict";
import fs from "node:fs";

function argValue(name) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

const resultPath = argValue("result");
const mode = argValue("mode");
const dynamicFull = argValue("dynamic-full") === "true";
if (!resultPath) throw new Error("--result=<path> is required");
if (!["canary", "full"].includes(mode)) throw new Error("--mode=canary|full is required");
if (dynamicFull && mode !== "full") throw new Error("--dynamic-full=true is only valid for full mode");

const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
assert.equal(result.contract, "trust-official-source-transport-worker-result-v1");
assert.equal(result.scope, mode);
assert.equal(result.record, true);
assert.equal(result.blockedSourceCount, 0);
assert.deepEqual(result.blockedTargets, []);
assert.match(result.fleetSnapshotDigest, /^[0-9a-f]{64}$/);
assert.match(result.scopeSnapshotDigest, /^[0-9a-f]{64}$/);
assert.equal(result.networkProbeCount, result.selectedTargetCount);
assert.equal(result.observationCount, result.selectedSourceCount);

const expected = mode === "canary"
  ? { selectedTargetCount: 5, selectedSourceCount: 10 }
  : dynamicFull
    ? {
        selectedTargetCount: result.uniqueReadyTargetCount,
        selectedSourceCount: result.readySourceCount,
      }
    : { selectedTargetCount: 25, selectedSourceCount: 35 };

assert.equal(result.dynamicFleet, dynamicFull);
assert.ok(expected.selectedTargetCount > 0);
assert.ok(expected.selectedSourceCount > 0);
assert.equal(result.selectedTargetCount, expected.selectedTargetCount);
assert.equal(result.selectedSourceCount, expected.selectedSourceCount);

const probes = Array.isArray(result.probes) ? result.probes : [];
assert.equal(probes.length, expected.selectedTargetCount);

const hardBlocked = [];
let degradedCount = 0;

for (const item of probes) {
  assert.ok(item.targetKey);
  assert.ok(item.effectiveLocator);
  assert.ok(item.probe);
  assert.ok(["HEALTHY","REDIRECTED","MISSING","TRANSIENT","BLOCKED"].includes(item.probe.transportResult));
  assert.equal(item.sourceResults.length, item.sourceCount);

  if (item.probe.transportResult === "TRANSIENT" || item.probe.transportResult === "BLOCKED") {
    degradedCount += 1;
  }

  if (item.probe.transportResult === "BLOCKED") {
    const detail = String(item.probe.detail || "");
    const isOrdinaryRemoteAccessBlock =
      /^SOURCE_BLOCKED:http_(401|403|451)$/.test(detail);
    if (!isOrdinaryRemoteAccessBlock) {
      hardBlocked.push({
        targetKey: item.targetKey,
        effectiveLocator: item.effectiveLocator,
        detail,
      });
    }
  }
}

assert.deepEqual(
  hardBlocked,
  [],
  `unsafe/hard transport blocks detected: ${JSON.stringify(hardBlocked)}`,
);

if (mode === "canary") {
  assert.ok(
    degradedCount < 2,
    `canary degraded target threshold exceeded: ${degradedCount}/5`,
  );
} else {
  assert.ok(
    degradedCount * 5 < expected.selectedTargetCount,
    `full fleet degraded target threshold reached 20%: ${degradedCount}/${expected.selectedTargetCount}`,
  );
}

const summary = {
  contract: "trust-phase8i2b-live-result-verification-v1",
  mode,
  dynamicFull,
  runId: result.runId,
  fleetSnapshotDigest: result.fleetSnapshotDigest,
  scopeSnapshotDigest: result.scopeSnapshotDigest,
  selectedTargetCount: result.selectedTargetCount,
  selectedSourceCount: result.selectedSourceCount,
  networkProbeCount: result.networkProbeCount,
  observationCount: result.observationCount,
  incidentCount: result.incidentCount,
  resultCounts: result.resultCounts,
  degradedCount,
  hardBlockedCount: hardBlocked.length,
  result: "PASS",
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
