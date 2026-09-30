#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  D5D_SPF_RUNTIME_ACTIVATION_CONTRACT_VERSION,
  D5D_SPF_RUNTIME_ACTIVATION_SCOPE,
  normalizeD5dSpfRuntimeActivation,
} from "../lib/sunscreen-spf-production-activation-contract.mjs";
import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
} from "../lib/sunscreen-d5c-canary-authority-contract.mjs";

const read = (file) => fs.readFileSync(file, "utf8");

const migration = read(
  "supabase/migrations/20260930211137_data_ai29c_d5d_spf_runtime_activation_v1.sql",
);
const activationReader = read(
  "lib/server/sunscreen-spf-production-activation-reader.js",
);
const productionService = read(
  "lib/server/product-query-spf-production-service.js",
);
const shadowService = read(
  "lib/server/product-query-shadow-service.js",
);
const previewService = read(
  "lib/server/product-query-preview-service.js",
);
const betaRoute = read("app/api/my/product-query-beta/route.js");
const probeRoute = read(
  "app/api/internal/product-query-spf-production-activation/route.js",
);
const validator = read(
  "scripts/validate-data-ai29c-d5d-spf-production-activation-response.mjs",
);
const productSource = read("lib/product-source.js");
const betaActivation = read(
  "lib/product-query-authenticated-beta-controlled-activation.mjs",
);

// D5D-1: activation contract fails closed.
assert.equal(
  D5D_SPF_RUNTIME_ACTIVATION_CONTRACT_VERSION,
  "data-ai29c-d5d-spf-runtime-activation-v1",
);
assert.equal(
  D5D_SPF_RUNTIME_ACTIVATION_SCOPE,
  "authenticated_product_query_beta",
);

const off = normalizeD5dSpfRuntimeActivation({
  contract_version:
    "data-ai29c-d5d-spf-runtime-activation-v1",
  scope: "authenticated_product_query_beta",
  enabled: false,
  authorized_phase: "DATA-AI29C-D5D",
  updated_at: "2026-09-30T00:00:00Z",
});
assert.equal(off.enabled, false);

const on = normalizeD5dSpfRuntimeActivation({
  contract_version:
    "data-ai29c-d5d-spf-runtime-activation-v1",
  scope: "authenticated_product_query_beta",
  enabled: true,
  authorized_phase: "DATA-AI29C-D5D",
  updated_at: "2026-09-30T00:00:00Z",
});
assert.equal(on.enabled, true);

const malformed = normalizeD5dSpfRuntimeActivation({
  contract_version: "wrong",
  scope: "authenticated_product_query_beta",
  enabled: true,
  authorized_phase: "DATA-AI29C-D5D",
});
assert.equal(malformed.enabled, false);

// D5D-2: Production migration is explicit-approval ON but read-only for runtime.
for (const needle of [
  "sunscreen_spf_runtime_activation_v1",
  "authenticated_product_query_beta",
  "DATA-AI29C-D5D",
  "explicit_user_approval",
  "read_data_ai29c_d5d_spf_runtime_activation_v1",
  "security definer",
  "set search_path = ''",
  "D5D_RUNTIME_RAW_ACTIVATION_TABLE_SELECT_FORBIDDEN",
  "D5D_RUNTIME_ACTIVATION_RPC_EXECUTE_REQUIRED",
  "D5D_OWNER_SCHEMA_CREATE_FORBIDDEN",
]) {
  assert.ok(
    migration.includes(needle),
    "D5D migration missing: " + needle,
  );
}
assert.ok(
  migration.includes(
    "'authenticated_product_query_beta',\n  true,",
  ),
);
assert.ok(
  migration.includes(
    "revoke all privileges on public.sunscreen_spf_runtime_activation_v1",
  ),
);
assert.ok(
  migration.includes(
    "grant execute on function public.read_data_ai29c_d5d_spf_runtime_activation_v1()",
  ),
);

// D5D-3: application activation reader reuses the constrained admission
// runtime credential and cannot use service_role/Supabase JS.
assert.ok(activationReader.includes('import "server-only"'));
assert.ok(
  activationReader.includes(
    '"RECOMMENDATION_ADMISSION_DATABASE_URL"',
  ),
);
assert.ok(
  activationReader.includes('"recommendation_admission_runtime"'),
);
assert.ok(
  activationReader.includes(
    '"read_data_ai29c_d5d_spf_runtime_activation_v1"',
  ),
);
assert.equal(activationReader.includes("@supabase/supabase-js"), false);
assert.equal(activationReader.includes("SUPABASE_SERVICE_ROLE"), false);
assert.equal(activationReader.includes("service_role"), false);

// D5D-4: exact D3R3/D5C three-product allowlist is reused.
assert.equal(D5C_SUNSCREEN_CANARY_PRODUCT_IDS.length, 3);
for (const productId of D5C_SUNSCREEN_CANARY_PRODUCT_IDS) {
  assert.ok(productionService.includes(productId));
  assert.equal(
    productSource.includes(productId),
    false,
    "D5D target must not leak into base Product source: " + productId,
  );
}

// D5D-5: Production execution reuses governed authorities and current
// deterministic ranking, rather than inventing another scorer/admission path.
for (const authority of [
  "getRecommendationProducts",
  "readD5cSunscreenCanaryAuthorities",
  "evaluateSunscreenInitialAdmissionGrant",
  "projectEstablishedSunscreenSemantics",
  "readRecommendationSunscreenProtectionAuthorities",
  "projectSunscreenProtectionAuthority",
  "projectSunscreenSpfFact",
  "rankStructuredProductQueryFromProducts",
  "readD5dSpfRuntimeActivation",
]) {
  assert.ok(
    productionService.includes(authority),
    "D5D service missing authority: " + authority,
  );
}
assert.ok(
  productionService.includes(
    "EXPECTED_LEGACY_SUNSCREEN_COUNT = 11",
  ),
);
assert.ok(
  productionService.includes(
    "D5D_TARGET_ALREADY_IN_BASE_PRODUCT_SOURCE",
  ),
);
assert.ok(
  productionService.includes("D5D_TARGET_ADMISSION_INCOMPLETE"),
);
assert.ok(
  productionService.includes("D5D_LEGACY_SPF_AUTHORITY_INCOMPLETE"),
);
assert.ok(
  productionService.includes(
    "D5D_PROTECTION_CREDENTIAL_UNAVAILABLE",
  ),
);

// D5D-6: switch OFF or authority problems restore baseline behavior.
assert.ok(
  productionService.includes(
    "if (!activation.enabled || !sunscreenRequest)",
  ),
);
assert.ok(
  productionService.includes(
    "if (fallbackReasons.length > 0)",
  ),
);
assert.ok(
  productionService.includes(
    "baselineExecution(",
  ),
);

// D5D-7: SPF is the only activated protection axis.
assert.ok(
  productionService.includes("uva: Object.freeze({"),
);
assert.ok(
  productionService.includes("waterResistance: Object.freeze({"),
);
assert.ok(
  (productionService.match(/eligible: false/g) || []).length >= 2,
);
assert.ok(
  productionService.includes(
    "spfRuntimeGate: {\n        enabled: true",
  ),
);

// D5D-8: actual authenticated beta user path opts into Production SPF
// activation, while generic shadow/CI paths remain opt-in.
assert.ok(
  previewService.includes("productionSpfActivation: true"),
);
assert.ok(
  shadowService.includes(
    "options.productionSpfActivation === true",
  ),
);
assert.ok(
  shadowService.includes("executeD5dSpfProductionQuery"),
);
assert.ok(
  betaRoute.includes("executeProductQueryPreview"),
);
assert.ok(
  betaActivation.includes("authenticatedOnly: true"),
);
assert.ok(
  betaActivation.includes("publicSearchCutover: false"),
);
assert.ok(
  previewService.includes(
    'sunscreenSpfActivationScope: "authenticated_product_query_beta"',
  ),
);

// D5D-9: no GA/public-search cutover is introduced.
assert.equal(
  betaActivation.includes("publicSearchCutover: true"),
  false,
);
assert.ok(
  productionService.includes("publicSearchCutover: false"),
);
assert.ok(
  probeRoute.includes("publicSearchCutover: false"),
);

// D5D-10: internal deployed probe is main-only, OIDC-only and fixed-case.
assert.ok(
  probeRoute.includes('ALLOWED_DEPLOYMENT_REFS = new Set(["main"])'),
);
assert.ok(
  probeRoute.includes("verifyDataAi5GitHubActionsOidcToken"),
);
assert.ok(probeRoute.includes("ALLOWED_CASE_IDS"));
assert.ok(
  probeRoute.includes('keys.length !== 1'),
);
assert.ok(
  probeRoute.includes('keys[0] !== "caseId"'),
);
assert.equal(probeRoute.includes("body.query"), false);

// D5D-11: live probe requires actual activation, not silent fallback.
for (const needle of [
  "D5D_RUNTIME_SWITCH_NOT_ENABLED",
  "D5D_PRODUCTION_ACTIVATION_NOT_ACTIVE",
  "D5D_TARGET_GRANT_COUNT_MISMATCH",
  "D5D_COMBINED_SUNSCREEN_COUNT_MISMATCH",
  "D5D_UNEXPECTED_FALLBACK",
  "D5D_SPF_AXIS_NOT_APPLIED",
  "D5D_NON_OUTDOOR_SPF_AXIS_LEAK",
]) {
  assert.ok(
    productionService.includes(needle),
    "D5D probe missing assertion: " + needle,
  );
}
for (const needle of [
  'payload.candidateCount !== 14',
  'activation.switchEnabled !== true',
  'activation.activated !== true',
  'activation.targetGrantedCount !== 3',
  'activation.combinedSunscreenCount !== 14',
  'activation.legacySpfEligibleCount !== 11',
  'expectedCaseId === "outdoor_live"',
  'expectedCaseId === "non_outdoor_live"',
]) {
  assert.ok(
    validator.includes(needle),
    "D5D validator missing: " + needle,
  );
}

// D5D-12: Product Query remains query-only/non-persistent.
for (const boundary of [
  "providerInvoked: false",
  "rawQueryAccepted: false",
  "profileRead: false",
  "historyRead: false",
  "productionWrite: false",
  "recommendationLogWrite: false",
  "uvaActivated: false",
  "waterResistanceApplied: false",
  "persistence: false",
]) {
  assert.ok(
    productionService.includes(boundary),
    "D5D boundary missing: " + boundary,
  );
}

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D5D",
    activationScope: D5D_SPF_RUNTIME_ACTIVATION_SCOPE,
    runtimeSwitchDefaultFromMigration: true,
    currentProductionSunscreenCount: 11,
    governedTargetCount: 3,
    combinedSunscreenCount: 14,
    userSurface: "/api/my/product-query-beta",
    publicSearchCutover: false,
    decision:
      "D5D_SPF_PRODUCTION_ACTIVATION_CONTRACT_READY_DEPLOYED_PROBE_REQUIRED",
  }),
);
