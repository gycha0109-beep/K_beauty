#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const PATH =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-sunscreen-admission-expansion-frontier-v1.json";
const evidence = JSON.parse(fs.readFileSync(PATH, "utf8"));

assert.equal(evidence.stage, "DATA-AI29C-D5E-0");
assert.equal(
  evidence.decision,
  "D5E0_SUNSCREEN_ADMISSION_EXPANSION_FRONTIER_FROZEN_COSRX_WAVE2_SELECTED",
);
assert.equal(evidence.mode, "ZERO_WRITE_DESIGN_PREFLIGHT");
assert.equal(evidence.sourceMainSha, "236c06d3f8f81f6a8067547700dedd9cacddcf62");

assert.equal(evidence.frontier.nonExactProductCount, 9);
assert.equal(evidence.frontier.currentLiveAllowlist.length, 3);
assert.equal(evidence.frontier.remaining.length, 6);

const liveIds = evidence.frontier.currentLiveAllowlist
  .map((row) => row.productId)
  .sort();
assert.deepEqual(liveIds, [
  "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
]);

const cosrx = evidence.selectedWave2;
assert.equal(cosrx.productId, "888eca86-af25-4a12-b9ea-47922d83f520");
assert.equal(
  cosrx.currentSubjectId,
  "994d7edb-7432-40c3-b09f-08cd59f91627",
);
assert.equal(cosrx.evidenceCandidates.length, 3);

const byFact = new Map(
  cosrx.evidenceCandidates.map((row) => [row.factKey, row]),
);
assert.deepEqual([...byFact.keys()].sort(), [
  "spf_value",
  "uv_filter_type",
  "uva_label",
]);
for (const row of byFact.values()) {
  assert.equal(row.candidateState, "READY");
  assert.equal(row.evidenceAuthority, "product_specific_primary");
  assert.equal(row.confidence, "high");
  assert.equal(row.market, "KR");
  assert.match(row.canonicalEvidenceDigest, /^[0-9a-f]{64}$/);
}
assert.equal(byFact.get("spf_value").normalizedValue, 50);
assert.equal(byFact.get("uva_label").normalizedValue, "PA++++");
assert.equal(byFact.get("uv_filter_type").normalizedValue, "organic");

const remainingById = new Map(
  evidence.frontier.remaining.map((row) => [row.productId, row]),
);
for (const id of [
  "b576991e-79c9-4189-b6e9-527aeeb03566",
  "7c709c04-e299-4ca6-be69-6aaf4a753f13",
]) {
  assert.equal(
    remainingById.get(id)?.tier,
    "D2_AUTHORITY_COMPLETE_SEMANTIC_FINISH_HOLD",
  );
  assert.equal(remainingById.get(id)?.finishState, "reviewed_not_established");
}

assert.equal(evidence.upstream.legacySunscreenCount, 11);
assert.equal(evidence.upstream.currentLiveNewAllowlistCount, 3);
assert.equal(evidence.upstream.d5dSwitchEnabledAtCapture, true);
assert.equal(evidence.upstream.d5dAuthorizedPhase, "DATA-AI29C-D5D");

const d5cContract = fs.readFileSync(
  "lib/sunscreen-d5c-canary-authority-contract.mjs",
  "utf8",
);
const d5cMigration = fs.readFileSync(
  "supabase/migrations/20260930202522_data_ai29c_d5c_bounded_canary_authority_v1.sql",
  "utf8",
);
for (const id of liveIds) {
  assert.ok(d5cContract.includes(id));
  assert.ok(d5cMigration.includes(id));
}
assert.equal(
  d5cContract.includes("888eca86-af25-4a12-b9ea-47922d83f520"),
  false,
  "D5E-0 must not widen the runtime canary allowlist",
);
assert.equal(
  d5cMigration.includes("888eca86-af25-4a12-b9ea-47922d83f520"),
  false,
  "D5E-0 must not rewrite the deployed D5C DB allowlist",
);

for (const value of Object.values(evidence.frozenBoundaries)) {
  assert.equal(value, false);
}

assert.equal(evidence.stagedPlan[0].stage, "DATA-AI29C-D5E-A");
assert.equal(evidence.stagedPlan[0].productionWrites, 0);
for (const stage of evidence.stagedPlan.slice(1)) {
  assert.equal(stage.authorizedNow, false);
}

assert.equal(
  evidence.nextGate,
  "DATA-AI29C-D5E-A_COSRX_PRODUCT_FACT_ADOPTION_PREFLIGHT",
);
assert.equal(evidence.nextGateAuthorized, true);

console.log(JSON.stringify({
  status: "PASS",
  stage: evidence.stage,
  decision: evidence.decision,
  frontierCount: evidence.frontier.nonExactProductCount,
  liveAllowlistCount: evidence.frontier.currentLiveAllowlist.length,
  remainingCount: evidence.frontier.remaining.length,
  selectedWave2: cosrx.productId,
  readyCriticalEvidenceCandidates: cosrx.evidenceCandidates.length,
  productionWrites: 0,
  nextGate: evidence.nextGate,
}, null, 2));
