#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
} from "../lib/sunscreen-d5c-canary-authority-contract.mjs";
import {
  D5E_E_COSRX_CANARY_PRODUCT_ID,
} from "../lib/sunscreen-d5e-e-cosrx-canary-authority-contract.mjs";
import {
  D5E_F_AUTHENTICATED_BETA_CONTRACT_VERSION,
  D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS,
  D5E_F_AUTHENTICATED_BETA_TARGET_COUNT,
  D5E_F_AUTHENTICATED_BETA_COMBINED_SUNSCREEN_COUNT,
} from "../lib/sunscreen-d5e-f-authenticated-beta-contract.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const artifact = JSON.parse(
  read(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-f-authenticated-beta-allowlist-expansion-v1.json",
  ),
);
const d5dService = read("lib/server/product-query-spf-production-service.js");
const d5eFService = read(
  "lib/server/product-query-spf-authenticated-beta-service.js",
);
const shadowService = read("lib/server/product-query-shadow-service.js");
const previewService = read("lib/server/product-query-preview-service.js");
const betaRoute = read("app/api/my/product-query-beta/route.js");
const previewRoute = read("app/api/my/product-query-preview/route.js");
const productionCanaryRoute = read(
  "app/api/my/product-query-production-canary/route.js",
);
const probeRoute = read(
  "app/api/internal/product-query-spf-authenticated-beta-expansion/route.js",
);
const validator = read(
  "scripts/validate-data-ai29c-d5e-f-authenticated-beta-runtime-response.mjs",
);

const COSRX = "888eca86-af25-4a12-b9ea-47922d83f520";

assert.equal(artifact.stage, "DATA-AI29C-D5E-F");
assert.equal(
  artifact.decision,
  "D5E_F_AUTHENTICATED_BETA_ALLOWLIST_EXPANSION_DEPLOYED_PROBE_REQUIRED",
);
assert.equal(artifact.prerequisite.d5eEDeployedProbePassCount, 6);
assert.equal(artifact.prerequisite.d5dProductionProbePassCount, 4);
assert.equal(artifact.prerequisite.d5cCanaryPassCount, 6);
assert.equal(artifact.prerequisite.activationReadinessPassCount, 24);
assert.equal(
  artifact.prerequisite.deploymentSha,
  "266922e7198ba5904a05a5ba3968ad6330593cbf",
);

assert.equal(D5C_SUNSCREEN_CANARY_PRODUCT_IDS.length, 3);
assert.equal(D5C_SUNSCREEN_CANARY_PRODUCT_IDS.includes(COSRX), false);
assert.equal(D5E_E_COSRX_CANARY_PRODUCT_ID, COSRX);
assert.equal(D5E_F_AUTHENTICATED_BETA_TARGET_COUNT, 4);
assert.equal(D5E_F_AUTHENTICATED_BETA_COMBINED_SUNSCREEN_COUNT, 15);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.length, 4);
assert.equal(new Set(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS).size, 4);
assert.ok(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.includes(COSRX));
for (const productId of D5C_SUNSCREEN_CANARY_PRODUCT_IDS) {
  assert.ok(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.includes(productId));
}
assert.equal(
  D5E_F_AUTHENTICATED_BETA_CONTRACT_VERSION,
  "data-ai29c-d5e-f-authenticated-beta-allowlist-expansion-v1",
);

assert.equal(d5dService.includes(COSRX), false);
assert.ok(d5dService.includes("activation?.targetGrantedCount !== 3"));
assert.ok(d5dService.includes("activation?.combinedSunscreenCount !== 14"));

assert.ok(d5eFService.includes("readD5cSunscreenCanaryAuthorities"));
assert.ok(d5eFService.includes("readD5eECosrxCanaryAuthority"));
assert.ok(d5eFService.includes("D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS"));
assert.ok(d5eFService.includes("activation?.targetGrantedCount !== 4"));
assert.ok(d5eFService.includes("activation?.combinedSunscreenCount !== 15"));
assert.ok(d5eFService.includes("execution?.candidateCount !== 15"));
assert.ok(d5eFService.includes("gate?.adjustments?.length !== 15"));
assert.ok(d5eFService.includes(COSRX));

assert.ok(
  shadowService.includes(
    "options.authenticatedBetaSunscreenExpansion === true",
  ),
);
assert.ok(shadowService.includes("executeD5eFAuthenticatedBetaSpfQuery"));
assert.ok(
  previewService.includes(
    "options.authenticatedBetaSunscreenExpansion === true",
  ),
);
assert.ok(betaRoute.includes("authenticatedBetaSunscreenExpansion: true"));
assert.equal(
  previewRoute.includes("authenticatedBetaSunscreenExpansion"),
  false,
);
assert.equal(
  productionCanaryRoute.includes("authenticatedBetaSunscreenExpansion"),
  false,
);

function allFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...allFiles(full));
    else out.push(full);
  }
  return out;
}
for (const file of allFiles("app/api")) {
  if (!/\.(js|mjs|cjs|ts|tsx)$/.test(file)) continue;
  if (file === "app/api/my/product-query-beta/route.js") continue;
  assert.equal(
    read(file).includes("authenticatedBetaSunscreenExpansion: true"),
    false,
    "D5E-F expansion leaked to another route: " + file,
  );
}

assert.ok(probeRoute.includes('ALLOWED_DEPLOYMENT_REFS = new Set(["main"])'));
assert.ok(probeRoute.includes("verifyDataAi5GitHubActionsOidcToken"));
assert.ok(probeRoute.includes("getD5eFAuthenticatedBetaProbeCaseIds"));
assert.ok(probeRoute.includes("runD5eFAuthenticatedBetaProbeCase"));
assert.ok(probeRoute.includes('keys[0] !== "caseId"'));
assert.equal(probeRoute.includes("body?.query"), false);
assert.ok(probeRoute.includes("publicSearchCutover: false"));

for (const needle of [
  "payload.candidateCount !== 15",
  "activation.targetGrantedCount !== 4",
  "activation.combinedSunscreenCount !== 15",
  "gate.adjustmentCount !== 15",
]) {
  assert.ok(validator.includes(needle), needle);
}

assert.equal(artifact.authority.newProductionMigrationRequired, false);
assert.equal(artifact.authority.d5dRuntimeSwitchChanged, false);
assert.equal(
  artifact.authority.runtimeSwitchScope,
  "authenticated_product_query_beta",
);
assert.equal(artifact.routingBoundary.publicSearchCutover, false);
for (const key of [
  "productRowMutation",
  "recommendationLogWrite",
  "persistence",
  "publicActivation",
  "uvaActivated",
  "waterResistanceActivated",
]) {
  assert.equal(artifact.productionBoundary[key], false, key);
}
assert.equal(artifact.runtimeProbe.expectedDeployedProbeCount, 4);
assert.equal(artifact.runtimeProbe.executed, false);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      stage: artifact.stage,
      decision: artifact.decision,
      previousBetaTargetCount: 3,
      expandedBetaTargetCount: 4,
      combinedAuthenticatedBetaSunscreenCount: 15,
      d5eEPrerequisitePassCount:
        artifact.prerequisite.d5eEDeployedProbePassCount,
      deployedProbeRequired: true,
    },
    null,
    2,
  ),
);
