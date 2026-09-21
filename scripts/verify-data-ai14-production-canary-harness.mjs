#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/data-ai14-production-canary.yml", "utf8");
let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(workflow.includes('paths:\n      - "vercel.json"') &&
    workflow.includes("workflow_dispatch:"),
  "live canary must be bound to activation-config changes or explicit manual dispatch");
check(workflow.includes("deployments: read") &&
    workflow.includes("id-token: write") &&
    !workflow.includes("contents: write"),
  "harness permissions must remain read-only except OIDC");
check(workflow.includes("DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN") &&
    workflow.includes("authenticated credential expired") &&
    workflow.includes("credential subject not approved"),
  "harness must require a fresh credential for the exact approved subject");
check(workflow.includes("RAW_SUB_RECORDED=false") &&
    workflow.includes("RAW_TOKEN_RECORDED=false"),
  "harness must explicitly attest no raw subject/token recording");
check(workflow.includes("production_environment") &&
    workflow.includes("environment_url") &&
    workflow.includes("$GITHUB_SHA"),
  "harness must resolve an exact successful Production deployment for the triggering SHA");
check(workflow.includes("/api/my/product-query-production-canary") &&
    workflow.includes("product-query-production-canary-v1") &&
    workflow.includes("effectiveSampleBps !== 1"),
  "harness must call and validate the dedicated 1 BPS Production canary contract");
check(workflow.includes("manualOnly !== true") &&
    workflow.includes("automaticTrafficSampling !== false") &&
    workflow.includes("persisted !== false"),
  "harness must enforce manual/non-persistent/no-auto-traffic boundaries");
check(workflow.includes("raw query leaked in Production canary response") &&
    workflow.includes('new Set(["score", "matchedSignals", "provider", "model", "intent"])'),
  "harness must reject raw query echo and internal authority fields");
for (const forbidden of [
  "VERCEL_TOKEN",
  "SUPABASE_SERVICE_ROLE",
  "service_role",
  "signUp(",
  "signInAnonymously(",
  "createUser("
]) {
  check(!workflow.includes(forbidden), `forbidden live-canary capability: ${forbidden}`);
}
check(workflow.includes("6 * 60 * 60 * 1000") &&
    workflow.includes("BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS' vercel.json)\" = \"1") &&
    workflow.includes("BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS' vercel.json)\" = \"1"),
  "checked-in activation manifest must be bounded to six hours and exactly 1 BPS");
check(workflow.includes("DATA_AI14_PRODUCTION_CANARY=PASS"),
  "harness must emit a bounded PASS marker only after runtime validation");

console.log(`DATA-AI14 Production canary harness verifier: PASS (${assertions} assertions)`);
