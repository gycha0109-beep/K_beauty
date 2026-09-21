#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateProductQueryProductionCanaryRuntime,
  evaluateProductQueryProductionCanaryStaticGate,
  hashProductQueryCanarySubject,
  PRODUCT_QUERY_PRODUCTION_CANARY_RUNTIME_LIMITS
} from "../lib/product-query-production-canary-runtime.mjs";
import {
  PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES
} from "../lib/product-query-production-canary-preflight.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const subject = "00000000-0000-4000-8000-000000000001";
const subjectHash = hashProductQueryCanarySubject(subject);
check(/^[a-f0-9]{64}$/.test(subjectHash), "subject identity must be reduced to a SHA-256 hash");

const validEnv = {
  VERCEL_ENV: "production",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH: "false",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT: "authenticated_bounded",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS: "1",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS: "1",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES: subjectHash,
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC: "2026-09-21T03:00:00Z",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC: "2026-09-21T09:00:00Z",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED: "true"
};

check(PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES === 360,
  "user-approved DATA-AI13 canary window ceiling must be six hours");

const midpoint = Date.parse("2026-09-21T06:00:00Z");
const staticGate = evaluateProductQueryProductionCanaryStaticGate(validEnv, midpoint);
check(staticGate.staticAllowed === true &&
    staticGate.runtimeAuthorized === true &&
    staticGate.insideWindow === true &&
    staticGate.configurationEligible === true &&
    staticGate.preflightReady === true &&
    staticGate.approvedSampleBps === 1 &&
    staticGate.effectiveSampleBps === 1,
  "fully approved in-window Production configuration must pass the static gate");

const allowed = evaluateProductQueryProductionCanaryRuntime({
  envLike: validEnv,
  subject,
  nowMs: midpoint
});
check(allowed.allowed === true &&
    allowed.approvedSubject === true &&
    allowed.effectiveSampleBps === 1 &&
    allowed.manualOnly === true &&
    allowed.automaticTrafficSampling === false &&
    allowed.publicSearchCutover === false &&
    allowed.persisted === false,
  "only the approved authenticated subject may enter the manual canary");

const wrongSubject = evaluateProductQueryProductionCanaryRuntime({
  envLike: validEnv,
  subject: "00000000-0000-4000-8000-000000000002",
  nowMs: midpoint
});
check(wrongSubject.allowed === false &&
    wrongSubject.approvedSubject === false &&
    wrongSubject.effectiveSampleBps === 0,
  "non-approved authenticated subjects must fail closed");

for (const nowMs of [
  Date.parse("2026-09-21T02:59:59Z"),
  Date.parse("2026-09-21T09:00:00Z")
]) {
  const result = evaluateProductQueryProductionCanaryRuntime({
    envLike: validEnv,
    subject,
    nowMs
  });
  check(result.allowed === false && result.effectiveSampleBps === 0,
    "requests outside the six-hour window must fail closed");
}

for (const overrides of [
  { VERCEL_ENV: "preview" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "false" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE: "false" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH: "true" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED: "false" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED: "false" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT: "public" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS: "2" },
  { BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS: "0" }
]) {
  const result = evaluateProductQueryProductionCanaryRuntime({
    envLike: { ...validEnv, ...overrides },
    subject,
    nowMs: midpoint
  });
  check(result.allowed === false && result.effectiveSampleBps === 0,
    `runtime safety override must fail closed: ${JSON.stringify(overrides)}`);
}

const overlongWindow = evaluateProductQueryProductionCanaryRuntime({
  envLike: {
    ...validEnv,
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC: "2026-09-21T09:00:01Z"
  },
  subject,
  nowMs: midpoint
});
check(overlongWindow.allowed === false && overlongWindow.effectiveSampleBps === 0,
  "a canary window longer than six hours must fail closed");

const limits = PRODUCT_QUERY_PRODUCTION_CANARY_RUNTIME_LIMITS;
check(limits.authenticatedOnly === true &&
    limits.manualOnly === true &&
    limits.automaticTrafficSampling === false &&
    limits.publicSearchCutover === false,
  "DATA-AI13 must remain authenticated/manual-only with no public or automatic traffic");
check(limits.rawAccountIdPersistence === false &&
    limits.accountHashPersistence === false &&
    limits.rawQueryPersistence === false &&
    limits.accessTokenPersistence === false &&
    limits.persistence !== "database",
  "DATA-AI13 must not persist account, token, or raw-query material");
check(limits.savedProfileRead === false &&
    limits.historyRead === false &&
    limits.productionWrite === false &&
    limits.recommendationLogWrite === false,
  "DATA-AI13 must not merge profile/history or write recommendation state");
check(limits.directProductFactRead === false &&
    limits.taxonomyRuntimeAuthority === false &&
    limits.providerProductSelection === false &&
    limits.providerRankingAuthority === false &&
    limits.deterministicRankingAuthorityPreserved === true,
  "DATA-AI13 must preserve existing deterministic ranking authority");
check(limits.fallbackMode === "existing_path" && limits.releaseGateImplemented === false,
  "canary failure must leave the existing path intact and must not create a release gate");

const route = readFileSync("app/api/my/product-query-production-canary/route.js", "utf8");
const staticGateIndex = route.indexOf("const staticGate = evaluateProductQueryProductionCanaryStaticGate");
const authIndex = route.indexOf("resolveRouteSupabaseAuth(request)");
const runtimeGateIndex = route.indexOf("const runtimePolicy = evaluateProductQueryProductionCanaryRuntime");
const bodyReadIndex = route.indexOf("request.text()");
check(staticGateIndex >= 0 && authIndex > staticGateIndex &&
    runtimeGateIndex > authIndex && bodyReadIndex > runtimeGateIndex,
  "route must fail closed before auth/provider body work and enforce cohort after verified auth");
check(route.includes("executeProductQueryPreview(body.query)") &&
    !route.includes("recommendation_logs") &&
    !route.includes("product_fact") &&
    !route.includes("saved_profile"),
  "route must reuse the bounded preview executor without new authority/write paths");

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const activationEnv = vercelConfig?.env || {};
const activationKeys = [
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES"
];
const activationPresent = activationKeys.some((key) => Object.hasOwn(activationEnv, key));
if (!activationPresent) {
  check(activationKeys.every((key) => !Object.hasOwn(activationEnv, key)),
    "dormant runtime must not contain partial activation keys");
} else {
  check(activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED === "true" &&
      activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE === "true" &&
      activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH === "false" &&
      activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT === "authenticated_bounded" &&
      activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS === "1" &&
      activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS === "1" &&
      activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED === "true" &&
      activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED === "true",
    "active runtime manifest must preserve exact bounded activation controls");
  check(/^[a-f0-9]{64}$/.test(
      String(activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES || "")
    ),
    "active runtime manifest must contain exactly one lowercase SHA-256 subject hash");
  const activationStart = Date.parse(
    String(activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC || "")
  );
  const activationEnd = Date.parse(
    String(activationEnv.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC || "")
  );
  check(Number.isFinite(activationStart) &&
      Number.isFinite(activationEnd) &&
      activationEnd - activationStart === 6 * 60 * 60 * 1000,
    "active runtime manifest must be exactly six hours");
}

console.log(`DATA-AI13 Production canary runtime verifier: PASS (${assertions} assertions)`);
