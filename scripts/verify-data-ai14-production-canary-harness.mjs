#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const env = vercel.env && typeof vercel.env === "object" ? vercel.env : {};
let assertions = 0;

function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  !existsSync(".github/workflows/data-ai14-production-canary.yml"),
  "retired DATA-AI14 historical Production canary workflow must stay absent"
);

const retiredActivationKeys = [
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

for (const key of retiredActivationKeys) {
  check(
    !Object.prototype.hasOwnProperty.call(env, key),
    `retired DATA-AI14 Production canary activation key must stay absent from vercel.json: ${key}`
  );
}

console.log(`DATA-AI14 historical Production canary retirement guard: PASS (${assertions} assertions; canonical current-main authority)`);
