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
    activation.explicitUserApprovalRecorded === true,
  "DATA-AI20 activation contract must remain explicit"
);

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const sourceEnv = config?.env || {};

check(
  sourceEnv.BEJEWELY_PRODUCT_QUERY_BETA_ENABLED === "true" &&
    sourceEnv.BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED === "true" &&
    sourceEnv.BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE === "false" &&
    sourceEnv.BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING === "false" &&
    sourceEnv.BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER === "false" &&
    sourceEnv.BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE === "none",
  "checked-in activation manifest must remain bounded"
);
check(
  !Object.hasOwn(
    sourceEnv,
    "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES"
  ),
  "approved account hashes must not be checked into vercel.json"
);
const middleware = readFileSync("middleware.js", "utf8");
check(
  middleware.includes('request.nextUrl.pathname === "/api/my/product-query-beta/account-hash"') &&
    middleware.includes("status: 404"),
  "temporary account-hash enrollment route must be externally tombstoned with 404"
);

const subjects = [
  "data-ai20-cohort-fixture-a",
  "data-ai20-cohort-fixture-b",
  "data-ai20-cohort-fixture-c"
];
const hashes = subjects.map(hashProductQueryBetaSubject);
const runtimeEnv = {
  VERCEL_ENV: "production",
  ...sourceEnv,
  BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: hashes.join(",")
};

const gate = evaluateProductQueryAuthenticatedBetaControlledActivation(runtimeEnv);
check(
  gate.allowed === true &&
    gate.approvedAccountCount === 3 &&
    gate.maxApprovedAccounts === 3,
  "three-account sensitive runtime configuration must satisfy DATA-AI20"
);

for (const subject of subjects) {
  const eligible = evaluateProductQueryAuthenticatedBetaRuntime({
    envLike: runtimeEnv,
    subject,
    phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED
  });
  check(eligible.allowed === true, "each configured cohort subject must be eligible");
}

const unlisted = evaluateProductQueryAuthenticatedBetaRuntime({
  envLike: runtimeEnv,
  subject: "data-ai20-unlisted-fixture",
  phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED
});
check(unlisted.allowed === false, "unlisted authenticated subjects must remain closed");

const overLimitEnv = {
  ...runtimeEnv,
  BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: [
    ...hashes,
    hashProductQueryBetaSubject("data-ai20-fourth-fixture")
  ].join(",")
};
check(
  evaluateProductQueryAuthenticatedBetaControlledActivation(overLimitEnv).allowed === false,
  "more than three approved accounts must fail closed"
);

const emergencyGate = evaluateProductQueryAuthenticatedBetaControlledActivation({
  ...runtimeEnv,
  BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE: "true"
});
check(emergencyGate.allowed === false, "emergency disable must fail closed");

const route = readFileSync("app/api/my/product-query-beta/route.js", "utf8");
check(
  route.includes("evaluateProductQueryAuthenticatedBetaControlledActivation") &&
    route.includes("DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED") &&
    route.indexOf("evaluateProductQueryAuthenticatedBetaControlledActivation") <
      route.indexOf("resolveRouteSupabaseAuth(request)"),
  "beta route must enforce DATA-AI20 activation before authenticated execution"
);

const workflow = readFileSync(
  ".github/workflows/data-ai20-authenticated-beta-controlled-activation.yml",
  "utf8"
);
check(
  workflow.includes("timeout-minutes: 5") &&
    workflow.includes("timeout-minutes: 7") &&
    workflow.includes("DATA_AI20_RUNTIME_SENSITIVE_COHORT=PASS") &&
    workflow.includes("/api/my/product-query-beta/account-hash") &&
    workflow.includes('test "$status" = "404"') &&
    workflow.includes('test "$status" = "401"') &&
    !workflow.includes("DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN") &&
    !workflow.includes("credential subject not approved"),
  "DATA-AI20 CI must validate runtime-sensitive activation without persisted bearer credentials"
);

console.log(
  `DATA-AI20 secure cohort configuration verifier: PASS (${assertions} assertions)`
);
