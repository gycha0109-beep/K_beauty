#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateProductQueryProductionCanaryStaticGate
} from "../lib/product-query-production-canary-runtime.mjs";

const EXPECTED_ACCOUNT_HASH =
  "3cfc4137292c33a0fae2425be0883721738ce90daf3ae9618dffcb802bb02a95";
const EXPECTED_START = "2026-09-21T10:19:00Z";
const EXPECTED_END = "2026-09-21T16:19:00Z";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const env = config?.env || {};

check(env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED === "true" &&
    env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE === "true" &&
    env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH === "false" &&
    env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT === "authenticated_bounded",
  "activation manifest must be explicit, canary-only, and kill-switch-disarmed only for the bounded window");

check(env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS === "1" &&
    env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS === "1",
  "configured and approved sample must both be exactly 1 BPS");

check(env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES ===
    EXPECTED_ACCOUNT_HASH &&
    /^[a-f0-9]{64}$/.test(env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES),
  "activation manifest must authorize exactly the re-attested pseudonymous account hash");

check(env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC === EXPECTED_START &&
    env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC === EXPECTED_END &&
    Date.parse(EXPECTED_END) - Date.parse(EXPECTED_START) === 6 * 60 * 60 * 1000,
  "activation window must be exactly the user-approved six hours");

check(env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED === "true" &&
    env.BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED === "true",
  "Production environment mutation and runtime activation must be explicitly authorized");

const midpoint = Date.parse("2026-09-21T13:19:00Z");
const gate = evaluateProductQueryProductionCanaryStaticGate({
  VERCEL_ENV: "production",
  ...env
}, midpoint);

check(gate.staticAllowed === true &&
    gate.runtimeAuthorized === true &&
    gate.insideWindow === true &&
    gate.approvedSampleBps === 1 &&
    gate.effectiveSampleBps === 1,
  "exact approved manifest must be statically eligible only inside its window");

for (const timestamp of [
  Date.parse("2026-09-21T10:18:59Z"),
  Date.parse("2026-09-21T16:19:00Z")
]) {
  const outside = evaluateProductQueryProductionCanaryStaticGate({
    VERCEL_ENV: "production",
    ...env
  }, timestamp);
  check(outside.staticAllowed === false && outside.effectiveSampleBps === 0,
    "activation must fail closed outside the approved window");
}

check(config?.git?.deploymentEnabled?.main === true &&
    config?.git?.deploymentEnabled?.["**"] === false,
  "Production activation must not broaden Git deployment scope");

const runtimeRoute =
  readFileSync("app/api/my/product-query-production-canary/route.js", "utf8");
check(runtimeRoute.includes("manualOnly: true") &&
    runtimeRoute.includes("automaticTrafficSampling: false") &&
    !runtimeRoute.includes("publicSearchCutover: true"),
  "activation must remain dedicated manual canary traffic only");

console.log(`DATA-AI15 six-hour Production canary activation verifier: PASS (${assertions} assertions)`);
