#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS,
  D5E_F_AUTHENTICATED_BETA_TARGET_COUNT,
  D5E_F_AUTHENTICATED_BETA_COMBINED_SUNSCREEN_COUNT,
} from "../lib/sunscreen-d5e-f-authenticated-beta-contract.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const closeout = JSON.parse(
  read(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-f-authenticated-beta-allowlist-expansion-closeout-v1.json",
  ),
);
const predeploy = JSON.parse(
  read(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-f-authenticated-beta-allowlist-expansion-v1.json",
  ),
);
const frontier = JSON.parse(
  read(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-sunscreen-admission-expansion-frontier-v1.json",
  ),
);
const d5dService = read("lib/server/product-query-spf-production-service.js");
const betaRoute = read("app/api/my/product-query-beta/route.js");
const previewRoute = read("app/api/my/product-query-preview/route.js");
const productionCanaryRoute = read(
  "app/api/my/product-query-production-canary/route.js",
);

assert.equal(closeout.stage, "DATA-AI29C-D5E-F-CLOSEOUT");
assert.equal(
  closeout.decision,
  "D5E_F_AUTHENTICATED_BETA_ALLOWLIST_EXPANSION_PASS",
);
assert.equal(
  closeout.source.mergeSha,
  "0fe05b64b14e455ddebe2387c2f5a82fe6619e9d",
);
assert.equal(closeout.source.canonicalStaticRunId, "37608315052");
assert.equal(closeout.source.canonicalStaticRunAttempt, 2);
assert.equal(closeout.source.activationReadinessRunId, "37608315267");
assert.equal(closeout.source.activationReadinessRunAttempt, 2);

assert.deepEqual(closeout.passCounts, {
  d5dProductionActivation: 4,
  d5cInternalCanary: 6,
  d5eEFourProductInternalCanary: 6,
  d5eFAuthenticatedBetaExpansion: 4,
  activationReadiness: 24,
});

assert.equal(D5E_F_AUTHENTICATED_BETA_TARGET_COUNT, 4);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.length, 4);
assert.equal(D5E_F_AUTHENTICATED_BETA_COMBINED_SUNSCREEN_COUNT, 15);
assert.equal(closeout.authenticatedBeta.legacyProductionSunscreenCount, 11);
assert.equal(closeout.authenticatedBeta.governedTargetCount, 4);
assert.equal(closeout.authenticatedBeta.combinedSunscreenCount, 15);
assert.equal(closeout.authenticatedBeta.runtimeSwitchEnabled, true);
assert.equal(
  closeout.authenticatedBeta.runtimeSwitchScope,
  "authenticated_product_query_beta",
);
assert.equal(closeout.authenticatedBeta.publicSearchCutover, false);

assert.deepEqual(closeout.outdoorProbe, {
  caseId: "outdoor_live",
  repeat2Pass: true,
  candidateCount: 15,
  targetGrantedCount: 4,
  combinedSunscreenCount: 15,
  legacySpfEligibleCount: 11,
  authorityComplete: true,
  axisApplied: true,
  adjustmentCount: 15,
  cosrxSpfDelta: 6,
});
assert.equal(closeout.nonOutdoorProbe.repeat2Pass, true);
assert.equal(closeout.nonOutdoorProbe.candidateCount, 15);
assert.equal(closeout.nonOutdoorProbe.targetGrantedCount, 4);
assert.equal(closeout.nonOutdoorProbe.axisApplied, false);
assert.equal(closeout.nonOutdoorProbe.adjustmentCount, 0);

assert.equal(
  predeploy.decision,
  "D5E_F_AUTHENTICATED_BETA_ALLOWLIST_EXPANSION_DEPLOYED_PROBE_REQUIRED",
);
assert.equal(predeploy.runtimeProbe.executed, false);

assert.equal(frontier.stage, "DATA-AI29C-D5E-0");
assert.deepEqual(
  frontier.stagedPlan.map((row) => row.stage),
  closeout.disposition.definedStages,
);
assert.equal(closeout.disposition.d5eComplete, true);
assert.equal(closeout.disposition.nextD5eStage, null);
assert.equal(closeout.disposition.followOnWaveDefined, false);

assert.equal(d5dService.includes("888eca86-af25-4a12-b9ea-47922d83f520"), false);
assert.ok(d5dService.includes("activation?.targetGrantedCount !== 3"));
assert.ok(d5dService.includes("activation?.combinedSunscreenCount !== 14"));
assert.ok(betaRoute.includes("authenticatedBetaSunscreenExpansion: true"));
assert.equal(
  previewRoute.includes("authenticatedBetaSunscreenExpansion"),
  false,
);
assert.equal(
  productionCanaryRoute.includes("authenticatedBetaSunscreenExpansion"),
  false,
);

for (const value of Object.values(closeout.frozenBoundaries)) {
  assert.equal(value, false);
}

console.log(
  JSON.stringify(
    {
      status: "PASS",
      stage: closeout.stage,
      decision: closeout.decision,
      d5eFPassCount:
        closeout.passCounts.d5eFAuthenticatedBetaExpansion,
      activationReadinessPassCount:
        closeout.passCounts.activationReadiness,
      combinedSunscreenCount:
        closeout.authenticatedBeta.combinedSunscreenCount,
      nextD5eStage: closeout.disposition.nextD5eStage,
    },
    null,
    2,
  ),
);
