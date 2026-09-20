#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateProductQueryPreviewPolicy
} from "../lib/product-query-preview-policy.mjs";
import {
  evaluateProductQueryStageCanaryPolicy
} from "../lib/product-query-stage-canary-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function read(path) {
  return readFileSync(path, "utf8");
}

const previewRoute = read("app/api/my/product-query-preview/route.js");
const stageRoute = read("app/api/my/product-query-stage-canary/route.js");
const workflow = read(".github/workflows/data-ai7-production-fail-closed.yml");

check(
  evaluateProductQueryPreviewPolicy({
    BEJEWELY_PRODUCT_QUERY_PREVIEW_ENABLED: "true",
    VERCEL_ENV: "production"
  }).allowed === false,
  "DATA-AI6 preview must remain disabled in Production even when explicitly requested"
);

check(
  evaluateProductQueryStageCanaryPolicy({
    BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED: "true",
    VERCEL_ENV: "production",
    NODE_ENV: "production"
  }).allowed === false,
  "DATA-AI7 stage canary must remain disabled in Production even when explicitly requested"
);

for (const [label, source] of [
  ["DATA-AI6", previewRoute],
  ["DATA-AI7", stageRoute]
]) {
  const policyIndex = source.indexOf("evaluateProductQuery");
  const authIndex = source.indexOf("resolveRouteSupabaseAuth(request)");
  check(policyIndex >= 0 && authIndex > policyIndex,
    `${label} must evaluate environment policy before Supabase auth`);
  check(source.includes("if (!policy.allowed)") && source.includes("return notFound()"),
    `${label} must fail closed with 404 when policy is disabled`);
}

check(workflow.includes("github.event_name == 'push'"),
  "deployed runtime probe must execute only after a main push");
check(workflow.includes("deployments: read") && workflow.includes("id-token: write"),
  "runtime probe must use least required GitHub deployment/OIDC permissions");
check(workflow.includes("/api/my/product-query-preview"),
  "runtime probe must exercise the DATA-AI6 route");
check(workflow.includes("/api/my/product-query-stage-canary"),
  "runtime probe must exercise the DATA-AI7 route");
check((workflow.match(/test "\$status" = "404"/g) || []).length === 1,
  "runtime probe must require HTTP 404 for every guarded route");
check(!workflow.includes("-H \"Authorization: Bearer"),
  "runtime probe must not provide Supabase/application authorization");
check(!workflow.includes("SUPABASE_SERVICE_ROLE") &&
      !workflow.includes("SUPABASE_ACCESS_TOKEN") &&
      !workflow.includes("OPENAI_API_KEY"),
  "runtime probe must not receive Supabase privileged credentials or provider keys");
check(workflow.includes("raw query leaked in disabled-route response"),
  "runtime probe must reject raw-query reflection");
check(!workflow.includes("workflow_run:") &&
      !workflow.includes("schedule:"),
  "runtime probe must not become an automatic periodic traffic source");

console.log(`DATA-AI7 Production fail-closed verifier: PASS (${assertions} assertions)`);
