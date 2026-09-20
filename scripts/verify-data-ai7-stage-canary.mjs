#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateProductQueryStageCanaryPolicy,
  PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS
} from "../lib/product-query-stage-canary-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function read(path) {
  return readFileSync(path, "utf8");
}

const policy = read("lib/product-query-stage-canary-policy.mjs");
const core = read("lib/product-query-stage-canary-core.mjs");
const service = read("lib/server/product-query-stage-canary-service.js");
const route = read("app/api/my/product-query-stage-canary/route.js");
const previewService = read("lib/server/product-query-preview-service.js");

check(evaluateProductQueryStageCanaryPolicy({}).allowed === false,
  "DATA-AI7 must default disabled");

const production = evaluateProductQueryStageCanaryPolicy({
  BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED: "true",
  VERCEL_ENV: "production",
  NODE_ENV: "production"
});
check(production.allowed === false && production.productionAllowed === false,
  "DATA-AI7 must never activate in Production");
check(production.effectiveSampleBps === 0,
  "DATA-AI7 Production sampling must remain zero");

const previewDisabled = evaluateProductQueryStageCanaryPolicy({
  VERCEL_ENV: "preview"
});
check(previewDisabled.allowed === false,
  "Preview environment alone must not activate DATA-AI7");

const previewEnabled = evaluateProductQueryStageCanaryPolicy({
  BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED: "true",
  VERCEL_ENV: "preview"
});
check(previewEnabled.allowed === true,
  "Explicit server flag may enable manual Vercel Preview canary");

const testEnabled = evaluateProductQueryStageCanaryPolicy({
  BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED: "true",
  NODE_ENV: "test"
});
check(testEnabled.allowed === true,
  "Explicit server flag may enable test-equivalent canary");

check(PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.manualOnly === true,
  "DATA-AI7 must remain manual-only");
check(PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.effectiveSampleBps === 0,
  "DATA-AI7 automatic traffic sample must stay 0 bps");
check(PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.productionActivation === false &&
    PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.productionShadow === false,
  "DATA-AI7 Production activation/shadow must stay forbidden");
check(PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.automaticTrafficSampling === false,
  "DATA-AI7 must not sample Production traffic");
check(PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.publicSearchCutover === false,
  "DATA-AI7 must not cut over a public Search API");
check(PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.persistence === "none",
  "DATA-AI7 evidence must remain non-persistent");
check(PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS.releaseGateImplemented === false,
  "DATA-AI7 must not become a release gate");

check(policy.includes('vercelEnv === "preview" || nodeEnv === "test"'),
  "DATA-AI7 must bind activation to test/stage-equivalent environments");
check(policy.includes('vercelEnv !== "production"'),
  "DATA-AI7 policy must explicitly exclude Vercel Production");

check(core.includes('"product-query-stage-canary-v1"'),
  "DATA-AI7 contract version must be frozen in the shared core");
check((core.match(/await executePreview\(query\)/g) || []).length === 2,
  "DATA-AI7 core must perform exactly two controlled repetitions");
check(core.includes('evidenceRetention: "request_local_only"'),
  "DATA-AI7 evidence must remain request-local");
check(core.includes("persisted: false"),
  "DATA-AI7 core must remain explicitly non-persistent");

check(service.includes('import "server-only"'),
  "DATA-AI7 service must stay server-only");
check(service.includes("executeProductQueryStageCanaryCore"),
  "DATA-AI7 server service must delegate to the shared tested core");
check(service.includes("executePreview: executeProductQueryPreview"),
  "DATA-AI7 server service must bind only the existing DATA-AI6 preview executor");
check(service.includes("effectiveSampleBps: 0"),
  "DATA-AI7 service must freeze traffic sampling at zero");
check(service.includes("profileRead: false") && service.includes("historyRead: false"),
  "DATA-AI7 must not merge saved profile/history");
check(service.includes('persistence: "none"') && service.includes("recommendationLogWrite: false"),
  "DATA-AI7 must not persist evidence or recommendation logs");
check(service.includes("productionActivation: false") &&
    service.includes("productionShadow: false"),
  "DATA-AI7 service must not authorize Production");
check(service.includes("automaticTrafficSampling: false") &&
    service.includes("publicSearchCutover: false"),
  "DATA-AI7 must not hook automatic traffic or cut over Search");
check(service.includes("directProductFactRead: false") &&
    service.includes("taxonomyRuntimeAuthority: false"),
  "DATA-AI7 must preserve Product Fact/taxonomy authority boundaries");
check(service.includes("providerProductSelection: false") &&
    service.includes("providerRankingAuthority: false"),
  "DATA-AI7 must preserve deterministic product selection/ranking");
check(service.includes("releaseGateImplemented: false"),
  "DATA-AI7 must not manufacture release authority");
check(!service.includes("@supabase/supabase-js") &&
    !service.includes("recommendation_logs") &&
    !service.includes("product_fact_current"),
  "DATA-AI7 service must not add direct data/write authority");

const policyIndex = route.indexOf("evaluateProductQueryStageCanaryPolicy(process.env)");
const authIndex = route.indexOf("resolveRouteSupabaseAuth(request)");
check(policyIndex >= 0 && authIndex > policyIndex,
  "DATA-AI7 route must fail closed before auth/provider work");
check(route.includes("if (!policy.allowed) return notFound()"),
  "disabled DATA-AI7 route must return 404");
check(route.includes("if (!authContext)") && route.includes('"unauthorized"'),
  "enabled DATA-AI7 route must require authentication");
check(route.includes('keys.length !== 1 || keys[0] !== "query"'),
  "DATA-AI7 route must accept exactly one query field");
check(route.includes("MAX_BODY_BYTES = 2048"),
  "DATA-AI7 request body must stay bounded");
check(route.includes("createNoStoreHeaders"),
  "DATA-AI7 response must be no-store");
check(!route.includes("body.profile") && !route.includes("body.history") &&
    !route.includes("body.sample") && !route.includes("body.model"),
  "caller must not inject profile/history/sampling/model controls");

check(previewService.includes('persistence: "none"') &&
    previewService.includes("providerRankingAuthority: false"),
  "DATA-AI7 dependency must preserve DATA-AI6 non-persistence and ranking boundary");

console.log(`DATA-AI7 stage canary verifier: PASS (${assertions} assertions)`);
