#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE as evidence
} from "../lib/product-query-production-canary-acceptance-evidence.mjs";
import {
  PRODUCT_QUERY_POST_CANARY_READINESS as readiness
} from "../lib/product-query-post-canary-readiness-contract.mjs";
import {
  evaluateProductQueryProductionCanaryStaticGate
} from "../lib/product-query-production-canary-runtime.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(evidence.accepted === true &&
    evidence.workflowRunId === 35588622637 &&
    evidence.runtime?.httpAccepted === true &&
    evidence.runtime?.effectiveSampleBps === 1,
  "successful live Production canary evidence must remain frozen");

check(readiness.contractVersion === "product-query-post-canary-readiness-v1" &&
    readiness.phase === "DATA-AI16" &&
    readiness.scope === "production_canary_closure" &&
    readiness.readinessState === "production_canary_accepted_returning_default_off" &&
    readiness.productionCanaryAccepted === true,
  "DATA-AI16 closure readiness must be explicit");

check(readiness.activationBoundary?.productionActivation === false &&
    readiness.activationBoundary?.effectiveSampleBps === 0 &&
    readiness.activationBoundary?.automaticTrafficSampling === false &&
    readiness.activationBoundary?.publicSearchCutover === false &&
    readiness.activationBoundary?.persistence === "none",
  "post-canary current activation boundary must return to zero/default-off");

check(readiness.activationBoundary?.savedProfileRead === false &&
    readiness.activationBoundary?.historyRead === false &&
    readiness.activationBoundary?.providerProductSelection === false &&
    readiness.activationBoundary?.providerRankingAuthority === false &&
    readiness.activationBoundary?.deterministicRankingAuthorityPreserved === true,
  "post-canary authority boundaries must remain unchanged");

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const env = config?.env || {};
const activationKeys = [
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED"
];
check(activationKeys.every((key) => !Object.hasOwn(env, key)),
  "temporary DATA-AI15 Production activation manifest must be completely removed");

const defaultOff = evaluateProductQueryProductionCanaryStaticGate({
  VERCEL_ENV: "production",
  ...env
}, Date.parse("2026-09-21T13:19:00Z"));
check(defaultOff.staticAllowed === false &&
    defaultOff.runtimeAuthorized === false &&
    defaultOff.effectiveSampleBps === 0,
  "Production runtime must fail closed after activation manifest removal");

const workflow =
  readFileSync(".github/workflows/data-ai16-production-canary-closure.yml", "utf8");
check(workflow.includes("DATA_AI16_PRODUCTION_CANARY_DEFAULT_OFF=PASS") &&
    workflow.includes("/api/my/product-query-production-canary") &&
    workflow.includes('test "$status" = "404"'),
  "DATA-AI16 must prove the exact deployed Production route is unreachable after closure");

for (const forbidden of [
  "DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN",
  "VERCEL_TOKEN",
  "SUPABASE_SERVICE_ROLE",
  "service_role",
  "Authorization: Bearer $DATA_AI"
]) {
  check(!workflow.includes(forbidden),
    `closure probe must not require application credentials or privileged secrets: ${forbidden}`);
}

check(readiness.nextRequiredPhase === "data_ai17_authenticated_limited_beta_design" &&
    readiness.futureUserFacingActivationRequiresSeparateExplicitPhase === true,
  "user-facing beta must remain a separate explicit phase");

console.log(`DATA-AI16 Production canary closure verifier: PASS (${assertions} assertions)`);
