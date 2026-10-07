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
  projectSunscreenSpfFact,
} from "../lib/sunscreen-protection-projection.mjs";
import {
  SUNSCREEN_PROTECTION_SHADOW_WEIGHTS,
} from "../lib/sunscreen-protection-shadow-scoring.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const artifact = JSON.parse(
  read(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-e-four-product-internal-canary-v1.json",
  ),
);
const r4 = JSON.parse(
  read(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-r4-cosrx-recommendation-admission-reevaluation-v1.json",
  ),
);
const migration = read(
  "supabase/migrations/20261007155804_data_ai29c_d5e_e_cosrx_internal_canary_authority_v1.sql",
);
const d5cMigration = read(
  "supabase/migrations/20260930202522_data_ai29c_d5c_bounded_canary_authority_v1.sql",
);
const contract = read(
  "lib/sunscreen-d5e-e-cosrx-canary-authority-contract.mjs",
);
const reader = read(
  "lib/server/sunscreen-d5e-e-cosrx-canary-authority-reader.js",
);
const service = read(
  "lib/server/product-query-spf-four-product-canary-service.js",
);
const route = read(
  "app/api/internal/product-query-spf-four-product-canary/route.js",
);
const validator = read(
  "scripts/validate-data-ai29c-d5e-e-four-product-canary-runtime-response.mjs",
);
const d5dService = read(
  "lib/server/product-query-spf-production-service.js",
);

const COSRX = "888eca86-af25-4a12-b9ea-47922d83f520";
const oldIds = [
  "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
];

assert.equal(artifact.stage, "DATA-AI29C-D5E-E");
assert.equal(
  artifact.decision,
  "D5E_E_FOUR_PRODUCT_INTERNAL_CANARY_DEPLOYED_PROBE_REQUIRED",
);
assert.equal(artifact.target.legacyProductionSunscreenCount, 11);
assert.equal(artifact.target.existingD5cTargetCount, 3);
assert.equal(artifact.target.internalCanaryTargetCount, 4);
assert.equal(artifact.target.combinedInternalCanaryCount, 15);
assert.equal(artifact.target.cosrxProductId, COSRX);

assert.equal(D5C_SUNSCREEN_CANARY_PRODUCT_IDS.length, 3);
assert.equal(D5C_SUNSCREEN_CANARY_PRODUCT_IDS.includes(COSRX), false);
assert.equal(D5E_E_COSRX_CANARY_PRODUCT_ID, COSRX);
assert.deepEqual(
  [...D5C_SUNSCREEN_CANARY_PRODUCT_IDS].sort(),
  [...oldIds].sort(),
);

// D5E-E must not widen the existing D5C/D5D source contract.
assert.equal(d5dService.includes(COSRX), false);
assert.ok(d5dService.includes("activation?.targetGrantedCount !== 3"));
assert.ok(d5dService.includes("activation?.combinedSunscreenCount !== 14"));
assert.equal(artifact.authorityIsolation.d5cD5dSourceFilesModified, false);
assert.equal(artifact.authorityIsolation.d5cD5dAllowlistCount, 3);
assert.equal(artifact.authorityIsolation.cosrxInD5cD5dAllowlist, false);
assert.equal(artifact.authorityIsolation.betaAllowlistExpanded, false);
assert.equal(artifact.authorityIsolation.d5dRuntimeSwitchChanged, false);
assert.deepEqual(artifact.authorityIsolation.d5dRuntimeActivation, {
  scope: "authenticated_product_query_beta",
  enabled: true,
  authorizedPhase: "DATA-AI29C-D5D",
});

// Existing D5C migration remains exact-three in source.
for (const productId of oldIds) assert.ok(d5cMigration.includes(productId));
assert.equal(d5cMigration.includes(COSRX), false);

// New Production authority is COSRX-only and does not rewrite D5C.
assert.ok(
  migration.includes(
    "data_ai29c_d5e_e_cosrx_admission_reader_taxonomy_select_v1",
  ),
);
assert.ok(
  migration.includes(
    "read_data_ai29c_d5e_e_cosrx_canary_authority_v1",
  ),
);
assert.ok(
  migration.includes(
    "data-ai29c-d5e-e-cosrx-canary-authority-read-v1",
  ),
);
assert.ok(migration.includes(COSRX));
for (const productId of oldIds) assert.equal(migration.includes(productId), false);
assert.equal(
  migration.includes("read_data_ai29c_d5c_sunscreen_canary_authority_v1"),
  false,
);
assert.equal(
  migration.includes("drop policy if exists data_ai29c_d5c_admission_reader_taxonomy_select_v1"),
  false,
);
assert.ok(migration.includes("security definer"));
assert.ok(migration.includes("set search_path = ''"));
assert.ok(
  migration.includes(
    "from public, anon, authenticated, service_role, recommendation_admission_runtime",
  ),
);
assert.ok(
  migration.includes("to recommendation_admission_runtime"),
);
assert.ok(
  migration.includes("D5E_E_RUNTIME_RAW_TAXONOMY_SELECT_FORBIDDEN"),
);
assert.ok(
  migration.includes("D5E_E_RUNTIME_RAW_SEMANTIC_SELECT_FORBIDDEN"),
);
assert.ok(
  migration.includes("D5E_E_RUNTIME_DIRECT_SEMANTIC_RPC_FORBIDDEN"),
);

assert.ok(contract.includes(COSRX));
for (const productId of oldIds) assert.equal(contract.includes(productId), false);
assert.ok(reader.includes("RECOMMENDATION_ADMISSION_DATABASE_URL"));
assert.ok(reader.includes("recommendation_admission_runtime"));
assert.ok(
  reader.includes("read_data_ai29c_d5e_e_cosrx_canary_authority_v1"),
);
assert.equal(reader.includes("@supabase/supabase-js"), false);
assert.equal(reader.includes("SUPABASE_SERVICE_ROLE"), false);

// Internal service combines existing 3 + COSRX only in request memory.
assert.ok(service.includes("readD5cSunscreenCanaryAuthorities"));
assert.ok(service.includes("readD5eECosrxCanaryAuthority"));
assert.ok(service.includes("D5E_E_FOUR_PRODUCT_CANARY_IDS"));
assert.ok(service.includes("safe.candidateCount !== 15"));
assert.ok(service.includes("safe.gate.adjustments.length !== 15"));
assert.ok(service.includes("[D5E_E_COSRX_CANARY_PRODUCT_ID, 6]"));
assert.ok(service.includes("betaAllowlistExpanded: false"));
for (const authority of [
  "getRecommendationProducts",
  "evaluateSunscreenInitialAdmissionGrant",
  "projectEstablishedSunscreenSemantics",
  "readRecommendationSunscreenProtectionAuthoritiesWithBoundedRetry",
  "projectSunscreenProtectionAuthority",
  "projectSunscreenSpfFact",
  "rankStructuredProductQueryFromProducts",
]) {
  assert.ok(service.includes(authority), authority);
}

// Exact OIDC-only internal route and fixed cases.
assert.ok(route.includes('ALLOWED_DEPLOYMENT_REFS = new Set(["main"])'));
assert.ok(route.includes("verifyDataAi5GitHubActionsOidcToken"));
assert.ok(route.includes("ALLOWED_CASE_IDS"));
assert.ok(route.includes('bodyKeys[0] !== "caseId"'));
assert.equal(route.includes("body?.query"), false);
assert.ok(route.includes("productionWrite: false"));
assert.ok(route.includes("recommendationLogWrite: false"));
assert.ok(route.includes("publicActivation: false"));

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
  if (
    file ===
    "app/api/internal/product-query-spf-four-product-canary/route.js"
  ) {
    continue;
  }
  if (!/\.(js|mjs|cjs|ts|tsx)$/.test(file)) continue;
  assert.equal(
    read(file).includes("product-query-spf-four-product-canary-service"),
    false,
    "D5E-E service leaked to another route: " + file,
  );
}

for (const needle of [
  "payload.currentProductionSunscreenCount !== 11",
  "payload.canaryTargetCount !== 4",
  "payload.canaryGrantedCount !== 4",
  "payload.combinedSunscreenCount !== 15",
  "payload.legacySpfEligibleCount !== 11",
  "payload.execution.candidateCount !== 15",
  "gate.adjustments?.length !== 15",
  'deltaById.get("888eca86-af25-4a12-b9ea-47922d83f520") !== 6',
]) {
  assert.ok(validator.includes(needle), needle);
}

assert.equal(
  r4.decision,
  "D5E_D_R4_COSRX_RECOMMENDATION_ADMISSION_REEVALUATION_PASS",
);
assert.equal(r4.actualEvaluation.grant, true);
assert.equal(
  r4.actualEvaluation.decision,
  "SUNSCREEN_INITIAL_ADMISSION_GRANT",
);

const spf50 = projectSunscreenSpfFact({ value_number: 50 });
assert.equal(spf50.eligible, true);
assert.equal(spf50.bucket, "spf_50_plus_band");
assert.equal(
  SUNSCREEN_PROTECTION_SHADOW_WEIGHTS.spf[spf50.bucket],
  6,
);
assert.equal(artifact.expectedSpfDelta[COSRX], 6);
assert.equal(artifact.expectedSpfDelta.legacyEach, 6);

assert.equal(artifact.productionAuthority.migrationVersion, "20261007155804");
assert.equal(artifact.productionAuthority.applied, true);
assert.equal(artifact.productionAuthority.publicExecute, false);
assert.equal(artifact.productionAuthority.anonExecute, false);
assert.equal(artifact.productionAuthority.authenticatedExecute, false);
assert.equal(artifact.productionAuthority.serviceRoleExecute, false);
assert.equal(artifact.productionAuthority.runtimeRawTaxonomySelect, false);
assert.equal(artifact.productionAuthority.runtimeDirectSemanticRpc, false);

for (const key of [
  "productRowMutation",
  "permanentCandidateAdmissionMutation",
  "productionRankingChanged",
  "publicActivation",
  "uvaActivated",
  "waterResistanceActivated",
  "persistence",
]) {
  assert.equal(artifact.productionBoundary[key], false, key);
}
assert.equal(artifact.productionBoundary.productionWritesFromCanary, 0);
assert.equal(artifact.productionBoundary.recommendationLogWrites, 0);

assert.equal(artifact.canary.executed, false);
assert.equal(artifact.canary.expectedDeployedProbeCount, 6);
assert.equal(
  artifact.nextGate.stage,
  "DATA-AI29C-D5E-F_AUTHENTICATED_BETA_ALLOWLIST_EXPANSION",
);
assert.equal(
  artifact.nextGate.status,
  "BLOCKED_UNTIL_D5E_E_DEPLOYED_6_OF_6_PASS",
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      stage: artifact.stage,
      decision: artifact.decision,
      existingD5dTargetCount: 3,
      internalTargetCount: 4,
      combinedInternalCanaryCount: 15,
      cosrxSpfDelta: 6,
      deployedProbeRequired: true,
      nextGate: artifact.nextGate.stage,
    },
    null,
    2,
  ),
);
