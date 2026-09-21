#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED,
  evaluateProductQueryAuthenticatedBetaRuntime,
  hashProductQueryBetaSubject
} from "../lib/product-query-authenticated-beta-runtime.mjs";
import {
  DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED,
  DATA_AI20_MAX_APPROVED_ACCOUNTS,
  PRODUCT_QUERY_AUTHENTICATED_BETA_CONTROLLED_ACTIVATION as activation,
  evaluateProductQueryAuthenticatedBetaControlledActivation
} from "../lib/product-query-authenticated-beta-controlled-activation.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED === false,
  "DATA-AI18 historical default-off authorization must remain frozen"
);
check(
  DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED === true &&
    DATA_AI20_MAX_APPROVED_ACCOUNTS === 3,
  "DATA-AI20 must explicitly authorize a maximum three-account cohort"
);
check(
  activation.phase === "DATA-AI20" &&
    activation.scope === "authenticated_limited_beta_controlled_activation" &&
    activation.activationAuthorized === true &&
    activation.explicitUserApprovalRecorded === true &&
    activation.initialCohortStrategy === "one_account_then_expand_to_max_three",
  "DATA-AI20 activation contract must record explicit bounded activation"
);
check(
  activation.accessBoundary?.authenticatedOnly === true &&
    activation.accessBoundary?.explicitServerSideBetaEligibilityRequired === true &&
    activation.accessBoundary?.approvedAccountHashAlgorithm === "sha256" &&
    activation.accessBoundary?.maxApprovedAccounts === 3 &&
    activation.accessBoundary?.automaticTrafficSampling === false &&
    activation.accessBoundary?.publicSearchCutover === false,
  "DATA-AI20 access boundary must remain authenticated and tightly bounded"
);
check(
  activation.authorityBoundary?.providerRole === "intent_parsing_only" &&
    activation.authorityBoundary?.providerProductSelection === false &&
    activation.authorityBoundary?.providerRankingAuthority === false &&
    activation.authorityBoundary?.deterministicRankingAuthority ===
      "existing_recommendation_engine" &&
    activation.authorityBoundary?.queryProvenance === "query_only" &&
    activation.authorityBoundary?.profileMerge === false &&
    activation.authorityBoundary?.savedProfileRead === false &&
    activation.authorityBoundary?.historyRead === false,
  "DATA-AI20 must not widen provider or user-context authority"
);
check(
  activation.dataBoundary?.persistence === "none" &&
    activation.dataBoundary?.rawQueryPersistence === false &&
    activation.dataBoundary?.recommendationLogWrite === false &&
    activation.dataBoundary?.productionWrite === false &&
    activation.dataBoundary?.accessTokenPersistence === false &&
    activation.dataBoundary?.rawAccountIdPersistence === false,
  "DATA-AI20 must remain non-persistent and write-free"
);
check(
  activation.rollbackBoundary?.emergencyDisableRequired === true &&
    activation.rollbackBoundary?.failClosedOnEmergencyDisable === true &&
    activation.rollbackBoundary?.rollbackTarget ===
      "authenticated_beta_route_404",
  "DATA-AI20 must preserve an emergency rollback path"
);

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const env = config?.env || {};
const expectedHash =
  "3cfc4137292c33a0fae2425be0883721738ce90daf3ae9618dffcb802bb02a95";

check(
  env.BEJEWELY_PRODUCT_QUERY_BETA_ENABLED === "true" &&
    env.BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED === "true" &&
    env.BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE === "false" &&
    env.BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING === "false" &&
    env.BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER === "false" &&
    env.BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE === "none",
  "checked-in DATA-AI20 Production activation manifest must remain bounded"
);
check(
  env.BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES === expectedHash,
  "initial DATA-AI20 cohort must contain exactly the previously approved single account hash"
);

const gate = evaluateProductQueryAuthenticatedBetaControlledActivation({
  VERCEL_ENV: "production",
  ...env
});
check(
  gate.allowed === true &&
    gate.approvedAccountCount === 1 &&
    gate.maxApprovedAccounts === 3,
  "initial one-account Production activation must satisfy the DATA-AI20 gate"
);

const eligible = evaluateProductQueryAuthenticatedBetaRuntime({
  envLike: { VERCEL_ENV: "production", ...env },
  subject: "data-ai20-eligible-fixture",
  phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED
});
const fixtureHash = hashProductQueryBetaSubject("data-ai20-eligible-fixture");
check(
  eligible.allowed === false && fixtureHash !== expectedHash,
  "non-allowlisted authenticated subjects must remain closed"
);

const emergencyGate = evaluateProductQueryAuthenticatedBetaControlledActivation({
  VERCEL_ENV: "production",
  ...env,
  BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE: "true"
});
check(
  emergencyGate.allowed === false,
  "emergency disable must fail closed"
);

const route = readFileSync("app/api/my/product-query-beta/route.js", "utf8");
check(
  route.includes("evaluateProductQueryAuthenticatedBetaControlledActivation") &&
    route.includes("DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED") &&
    route.indexOf("evaluateProductQueryAuthenticatedBetaControlledActivation") <
      route.indexOf("resolveRouteSupabaseAuth(request)") &&
    route.includes(
      "phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED"
    ),
  "beta route must enforce DATA-AI20 activation before authenticated execution"
);

const workflow = readFileSync(
  ".github/workflows/data-ai20-authenticated-beta-controlled-activation.yml",
  "utf8"
);
check(
  workflow.includes("timeout-minutes: 7") &&
    workflow.includes("DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN") &&
    workflow.includes("DATA_AI20_AUTHENTICATED_LIMITED_BETA=PASS") &&
    workflow.includes("/api/my/product-query-beta"),
  "DATA-AI20 workflow must remain bounded and prove the authenticated Production route"
);

console.log(
  `DATA-AI20 authenticated limited-beta controlled activation verifier: PASS (${assertions} assertions)`
);
