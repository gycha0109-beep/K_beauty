#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/data-ai14-production-canary.yml", "utf8");
let assertions = 0;

function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  workflow.includes("DATA-AI14 Historical Production Canary Guard") &&
    workflow.includes("pull_request:") &&
    workflow.includes('paths:\n      - "vercel.json"') &&
    workflow.includes("workflow_dispatch:"),
  "historical DATA-AI14 guard must protect activation-config changes and manual verification"
);

check(
  workflow.includes("permissions:\n  contents: read") &&
    !workflow.includes("deployments: read") &&
    !workflow.includes("id-token: write"),
  "historical guard must use contents-read-only permissions"
);

for (const forbidden of [
  "DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN",
  "Authorization: Bearer",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "x-vercel-trusted-oidc-idp-token",
  "/api/my/product-query-production-canary",
  "VERCEL_TOKEN",
  "SUPABASE_SERVICE_ROLE",
  "service_role"
]) {
  check(!workflow.includes(forbidden), `retired DATA-AI14 must not retain live credential/runtime capability: ${forbidden}`);
}

check(
  workflow.includes("BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES") &&
    workflow.includes("BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED") &&
    workflow.includes("has($key)") &&
    workflow.includes("DATA_AI14_HISTORICAL_CANARY=SUPERSEDED_BY_DATA_AI16"),
  "historical guard must fail if any superseded canary activation key reappears"
);

check(
  workflow.includes("timeout-minutes: 5"),
  "historical guard must remain bounded below the long-CI threshold"
);

console.log(`DATA-AI14 historical Production canary guard verifier: PASS (${assertions} assertions)`);
