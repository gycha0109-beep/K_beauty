#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRODUCT_QUERY_RELEASE_READINESS } from "../lib/product-query-release-readiness-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function read(path) {
  return readFileSync(path, "utf8");
}

const workflow = read(".github/workflows/data-ai9-hosted-preview-acceptance.yml");
const previewPolicy = read("lib/product-query-preview-policy.mjs");
const canaryPolicy = read("lib/product-query-stage-canary-policy.mjs");
const previewRoute = read("app/api/my/product-query-preview/route.js");
const canaryRoute = read("app/api/my/product-query-stage-canary/route.js");

check(workflow.includes("workflow_dispatch:") &&
    !workflow.includes("\n  push:") &&
    !workflow.includes("\n  pull_request:") &&
    !workflow.includes("\n  schedule:"),
  "DATA-AI9 hosted acceptance must be manual-only");
check(workflow.includes("timeout-minutes: 5"),
  "DATA-AI9 hosted acceptance must stay bounded to five minutes");
check(workflow.includes("deployments: read") &&
    workflow.includes("id-token: write") &&
    workflow.includes("contents: read"),
  "DATA-AI9 must use least GitHub permissions for deployment attestation and Vercel protection");
check(workflow.includes('deployments?sha=$GITHUB_SHA') &&
    workflow.includes('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"'),
  "DATA-AI9 must attest the exact selected SHA");
check(workflow.includes('production_environment') &&
    workflow.includes('[ "$production" = "true" ]') &&
    workflow.includes('[ "$environment" = "production" ]'),
  "DATA-AI9 must reject Production deployments");
check(workflow.includes('https://*.vercel.app') &&
    workflow.includes('candidate" = "$url"'),
  "DATA-AI9 must bind execution to an exact successful Vercel deployment URL");
check(workflow.includes("DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN") &&
    workflow.includes('test -n "$DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN"') &&
    workflow.includes('-H "Authorization: Bearer $DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN"'),
  "DATA-AI9 must require an existing authenticated user credential");
check(!workflow.includes("signUp") &&
    !workflow.includes("signInAnonymously") &&
    !workflow.includes("createUser") &&
    !workflow.includes("admin.createUser"),
  "DATA-AI9 must not create or bypass users");
check(workflow.includes("x-vercel-trusted-oidc-idp-token") &&
    workflow.includes("ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
  "DATA-AI9 must use GitHub OIDC only for Vercel Deployment Protection");
check(workflow.includes("/api/my/product-query-preview") &&
    workflow.includes("/api/my/product-query-stage-canary"),
  "DATA-AI9 must exercise existing DATA-AI6 and DATA-AI7 routes");
check(workflow.includes('test "$status" = "200"') &&
    workflow.includes('"product-query-preview-v1"') &&
    workflow.includes('"product-query-stage-canary-v1"'),
  "DATA-AI9 must require successful expected runtime contracts");
check(workflow.includes("allParity !== true") &&
    workflow.includes("repetitions !== 2") &&
    workflow.includes('evidenceRetention !== "request_local_only"'),
  "DATA-AI9 must require the two-run request-local repeatability evidence");
check(workflow.includes("persisted !== false") &&
    workflow.includes("raw query leaked in hosted Preview response"),
  "DATA-AI9 must require non-persistence and reject raw-query reflection");
check(workflow.includes('new Set(["score", "matchedSignals", "provider", "model", "intent"])'),
  "DATA-AI9 must reject internal scoring/provider/intent fields in hosted response");
check(!workflow.includes("VERCEL_TOKEN") &&
    !workflow.includes("SUPABASE_SERVICE_ROLE") &&
    !workflow.includes("OPENAI_API_KEY"),
  "DATA-AI9 must not require deployment mutation, service-role, or provider secrets");
check(!workflow.includes("vercel env") &&
    !workflow.includes("/v9/projects/") &&
    !workflow.includes("createProjectEnv"),
  "DATA-AI9 must not mutate Vercel environment state");

check(PRODUCT_QUERY_RELEASE_READINESS.readinessState === "hosted_authenticated_preview_pending" &&
    PRODUCT_QUERY_RELEASE_READINESS.activationDecision === "not_authorized",
  "adding the DATA-AI9 harness must not claim hosted acceptance or activation readiness");
check(PRODUCT_QUERY_RELEASE_READINESS.activationBoundary.productionActivation === false &&
    PRODUCT_QUERY_RELEASE_READINESS.activationBoundary.publicSearchCutover === false &&
    PRODUCT_QUERY_RELEASE_READINESS.activationBoundary.effectiveSampleBps === 0 &&
    PRODUCT_QUERY_RELEASE_READINESS.activationBoundary.releaseGateImplemented === false,
  "DATA-AI9 must preserve DATA-AI8 Production/cutover/traffic/release boundaries");

check(previewPolicy.includes('vercelEnv === "preview"') &&
    !previewPolicy.includes('vercelEnv === "production" &&'),
  "DATA-AI6 policy must remain Preview-only");
check(canaryPolicy.includes('vercelEnv !== "production"') &&
    canaryPolicy.includes("effectiveSampleBps: 0"),
  "DATA-AI7 policy must remain Production-excluded at 0 bps");
check(previewRoute.indexOf("evaluateProductQueryPreviewPolicy(process.env)") <
    previewRoute.indexOf("resolveRouteSupabaseAuth(request)"),
  "DATA-AI6 must continue to gate environment before authentication/provider work");
check(canaryRoute.indexOf("evaluateProductQueryStageCanaryPolicy(process.env)") <
    canaryRoute.indexOf("resolveRouteSupabaseAuth(request)"),
  "DATA-AI7 must continue to gate environment before authentication/provider work");

console.log(`DATA-AI9 hosted Preview acceptance harness verifier: PASS (${assertions} assertions)`);
