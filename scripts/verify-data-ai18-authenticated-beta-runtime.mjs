#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED,
  PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_LIMITS as limits,
  evaluateProductQueryAuthenticatedBetaRuntime,
  evaluateProductQueryAuthenticatedBetaStaticGate,
  hashProductQueryBetaSubject,
  parseApprovedProductQueryBetaAccountHashes
} from "../lib/product-query-authenticated-beta-runtime.mjs";
import {
  PRODUCT_QUERY_AUTHENTICATED_LIMITED_BETA_DESIGN as design
} from "../lib/product-query-authenticated-limited-beta-design-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  design.phase === "DATA-AI17" &&
    design.nextRequiredPhase ===
      "data_ai18_authenticated_limited_beta_runtime_implementation_default_off",
  "DATA-AI18 must implement the accepted DATA-AI17 design"
);

check(
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED === false &&
    limits.phase === "DATA-AI18" &&
    limits.defaultEnabled === false &&
    limits.phaseRuntimeAuthorized === false &&
    limits.userFacingProductionActivation === false,
  "DATA-AI18 runtime must remain phase-authorized false/default-off"
);

check(
  limits.authenticatedOnly === true &&
    limits.explicitServerSideBetaEligibilityRequired === true &&
    limits.automaticTrafficSampling === false &&
    limits.publicSearchCutover === false &&
    limits.browserControlledActivation === false &&
    limits.requestControlledActivation === false,
  "beta runtime access must remain authenticated, explicit, and server-controlled"
);

check(
  limits.providerRole === "intent_parsing_only" &&
    limits.providerProductSelection === false &&
    limits.providerRankingAuthority === false &&
    limits.deterministicRankingAuthority === "existing_recommendation_engine",
  "provider authority must remain intent parsing only"
);

check(
  limits.savedProfileRead === false &&
    limits.historyRead === false &&
    limits.profileMerge === false &&
    limits.persistence === "none" &&
    limits.productionWrite === false &&
    limits.recommendationLogWrite === false &&
    limits.directProductFactRead === false &&
    limits.taxonomyRuntimeAuthority === false,
  "runtime implementation must not widen data or Product Fact authority"
);

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const env = config?.env || {};
const activationKeys = [
  "BEJEWELY_PRODUCT_QUERY_BETA_ENABLED",
  "BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED",
  "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES"
];
check(
  activationKeys.every((key) => !Object.hasOwn(env, key)),
  "DATA-AI18 must not check in a beta activation manifest"
);

const defaultOff = evaluateProductQueryAuthenticatedBetaStaticGate({
  VERCEL_ENV: "production",
  ...env
});
check(
  defaultOff.staticAllowed === false &&
    defaultOff.phaseRuntimeAuthorized === false &&
    defaultOff.automaticTrafficSampling === false &&
    defaultOff.publicSearchCutover === false,
  "Production beta runtime must fail closed in DATA-AI18"
);

const testSubject = "data-ai18-test-subject";
const testHash = hashProductQueryBetaSubject(testSubject);
check(
  /^[0-9a-f]{64}$/.test(testHash) &&
    parseApprovedProductQueryBetaAccountHashes(testHash)?.[0] === testHash &&
    parseApprovedProductQueryBetaAccountHashes("not-a-sha256") === null,
  "server-side beta eligibility hashes must be strict SHA-256 values"
);

const futureEligible = evaluateProductQueryAuthenticatedBetaRuntime({
  envLike: {
    VERCEL_ENV: "production",
    BEJEWELY_PRODUCT_QUERY_BETA_ENABLED: "true",
    BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED: "true",
    BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: testHash
  },
  subject: testSubject,
  phaseRuntimeAuthorized: true
});
const futureIneligible = evaluateProductQueryAuthenticatedBetaRuntime({
  envLike: {
    VERCEL_ENV: "production",
    BEJEWELY_PRODUCT_QUERY_BETA_ENABLED: "true",
    BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED: "true",
    BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: testHash
  },
  subject: "different-test-subject",
  phaseRuntimeAuthorized: true
});
check(
  futureEligible.allowed === true &&
    futureEligible.approvedSubject === true &&
    futureIneligible.allowed === false &&
    futureIneligible.approvedSubject === false,
  "future explicit phase authorization must still require exact server-side account eligibility"
);

const currentEvenWithEnv = evaluateProductQueryAuthenticatedBetaRuntime({
  envLike: {
    VERCEL_ENV: "production",
    BEJEWELY_PRODUCT_QUERY_BETA_ENABLED: "true",
    BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED: "true",
    BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: testHash
  },
  subject: testSubject
});
check(
  currentEvenWithEnv.allowed === false &&
    currentEvenWithEnv.phaseRuntimeAuthorized === false,
  "DATA-AI18 code authorization must dominate accidental environment activation"
);

const route = readFileSync("app/api/my/product-query-beta/route.js", "utf8");
check(
  route.includes("evaluateProductQueryAuthenticatedBetaStaticGate(process.env)") &&
    route.indexOf("evaluateProductQueryAuthenticatedBetaStaticGate(process.env)") <
      route.indexOf("resolveRouteSupabaseAuth(request)") &&
    route.includes("evaluateProductQueryAuthenticatedBetaRuntime") &&
    route.includes("subject: authContext.user.id") &&
    route.includes("executeProductQueryPreview(body.query)"),
  "beta route must fail closed before auth and reuse authenticated deterministic Product Query execution"
);

check(
  route.includes('automaticTrafficSampling: false') &&
    route.includes('publicSearchCutover: false') &&
    route.includes('persisted: false') &&
    !route.includes("Math.random") &&
    !route.includes("cookies().set") &&
    !route.includes("localStorage"),
  "beta route must not sample traffic or persist activation state"
);

const previewService =
  readFileSync("lib/server/product-query-preview-service.js", "utf8");
const shadowService =
  readFileSync("lib/server/product-query-shadow-service.js", "utf8");
check(
  previewService.includes("runNaturalLanguageProductQueryShadow") &&
    shadowService.includes("executeStructuredProductQuery(extracted.intent") &&
    shadowService.includes('provenance: "query_only_shadow"') &&
    shadowService.includes('persisted: false'),
  "beta runtime must preserve provider-intent to deterministic-execution handoff"
);

const workflow =
  readFileSync(".github/workflows/data-ai18-authenticated-beta-runtime.yml", "utf8");
check(
  workflow.includes("DATA_AI18_AUTHENTICATED_BETA_DEFAULT_OFF=PASS") &&
    workflow.includes("/api/my/product-query-beta") &&
    workflow.includes('test "$status" = "404"') &&
    workflow.includes("timeout-minutes: 5"),
  "DATA-AI18 must prove the exact deployed Production beta route remains default-off"
);

for (const forbidden of [
  "DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE",
  "service_role",
  "Authorization: Bearer $DATA_AI"
]) {
  check(
    !workflow.includes(forbidden),
    `default-off probe must not require application credentials: ${forbidden}`
  );
}

console.log(
  `DATA-AI18 authenticated beta runtime verifier: PASS (${assertions} assertions)`
);
