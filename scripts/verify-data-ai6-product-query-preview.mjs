#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateProductQueryPreviewPolicy,
  PRODUCT_QUERY_PREVIEW_POLICY_LIMITS
} from "../lib/product-query-preview-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function read(path) {
  return readFileSync(path, "utf8");
}

const service = read("lib/server/product-query-preview-service.js");
const route = read("app/api/my/product-query-preview/route.js");
const policy = read("lib/product-query-preview-policy.mjs");
const intentService = read("lib/server/product-query-intent-service.js");
const execution = read("lib/product-query-recommendation.js");

const defaultPolicy = evaluateProductQueryPreviewPolicy({});
check(defaultPolicy.allowed === false, "DATA-AI6 preview must default OFF");

const productionPolicy = evaluateProductQueryPreviewPolicy({
  BEJEWELY_PRODUCT_QUERY_PREVIEW_ENABLED: "true",
  VERCEL_ENV: "production"
});
check(productionPolicy.allowed === false, "DATA-AI6 must never activate in Vercel Production");
check(productionPolicy.productionAllowed === false, "Production authorization must stay false");

const previewDisabled = evaluateProductQueryPreviewPolicy({ VERCEL_ENV: "preview" });
check(previewDisabled.allowed === false, "Preview environment alone must not activate DATA-AI6");

const previewEnabled = evaluateProductQueryPreviewPolicy({
  BEJEWELY_PRODUCT_QUERY_PREVIEW_ENABLED: "true",
  VERCEL_ENV: "preview"
});
check(previewEnabled.allowed === true, "Explicit server flag may activate preview environment only");

check(PRODUCT_QUERY_PREVIEW_POLICY_LIMITS.productionActivation === false,
  "DATA-AI6 policy must freeze Production activation OFF");
check(PRODUCT_QUERY_PREVIEW_POLICY_LIMITS.browserControlledActivation === false,
  "browser must not control DATA-AI6 activation");
check(PRODUCT_QUERY_PREVIEW_POLICY_LIMITS.requestControlledActivation === false,
  "request payload must not control DATA-AI6 activation");

check(policy.includes('vercelEnv === "preview"'),
  "preview policy must bind activation to Vercel preview environment");
check(!policy.includes('vercelEnv === "production" &&'),
  "preview policy must not authorize Production");

check(service.includes('import "server-only"'),
  "DATA-AI6 preview service must stay server-only");
check(service.includes('"product-query-preview-v1"'),
  "DATA-AI6 preview contract version must be frozen");
check(service.includes("runNaturalLanguageProductQueryShadow"),
  "DATA-AI6 must reuse validated DATA-AI1→2→3 path");
check(service.includes("resultLimit: RESULT_LIMIT"),
  "DATA-AI6 result count must remain bounded");
check(service.includes("authenticatedOnly: true"),
  "DATA-AI6 contract must require authenticated access");
check(service.includes('persistence: "none"'),
  "DATA-AI6 must not persist queries/results");
check(service.includes("profileRead: false") && service.includes("historyRead: false"),
  "DATA-AI6 must stay separate from saved profile/history");
check(service.includes("productionWrite: false"),
  "DATA-AI6 must not write Production");
check(service.includes("recommendationLogWrite: false"),
  "DATA-AI6 must not write recommendation logs");
check(service.includes("directProductFactRead: false"),
  "DATA-AI6 must not read Product Fact directly");
check(service.includes("taxonomyRuntimeAuthority: false"),
  "DATA-AI6 must not promote taxonomy shadow to runtime authority");
check(service.includes("providerProductSelection: false") &&
    service.includes("providerRankingAuthority: false"),
  "provider must not gain product-selection/ranking authority");
check(service.includes("publicProductionActivation: false"),
  "DATA-AI6 service must freeze public Production activation OFF");
check(!service.includes("@supabase/supabase-js"),
  "DATA-AI6 service must not create a direct Supabase data path");
check(!service.includes("skin_profiles") && !service.includes("analysis_results"),
  "DATA-AI6 service must not read profile/history tables");
check(!service.includes("recommendation_logs") && !service.includes("product_fact_current"),
  "DATA-AI6 service must not bypass recommendation/Product Fact authorities");
check(!service.includes("score:") && !service.includes("matchedSignals:"),
  "user preview payload must not expose internal scoring details");
check(!service.includes("provider: shadow") && !service.includes("model: shadow") &&
    !service.includes("intent: shadow"),
  "user preview payload must not expose provider/model/internal parsed intent");

const policyIndex = route.indexOf("evaluateProductQueryPreviewPolicy(process.env)");
const authIndex = route.indexOf("resolveRouteSupabaseAuth(request)");
check(policyIndex >= 0 && authIndex > policyIndex,
  "route must fail closed on preview policy before auth/provider work");
check(route.includes("if (!policy.allowed) return notFound()"),
  "disabled DATA-AI6 route must be indistinguishable via 404");
check(route.includes("if (!authContext)") && route.includes('"unauthorized"'),
  "enabled preview route must require a valid user session");
check(route.includes('keys.length !== 1 || keys[0] !== "query"'),
  "DATA-AI6 route must accept exactly one query field");
check(route.includes("MAX_BODY_BYTES = 2048"),
  "DATA-AI6 request body must be bounded");
check(route.includes("createNoStoreHeaders"),
  "DATA-AI6 response must be no-store");
check(!route.includes("body.profile") && !route.includes("body.history"),
  "caller must not inject profile/history context");
check(!route.includes("body.model") && !route.includes("body.limit"),
  "caller must not control provider model or result limit");
check(!route.includes("query: body.query"),
  "route must not echo raw query text in response");

check(intentService.includes("store: false"),
  "DATA-AI1 provider request must remain non-persistent");
check(intentService.includes("Never choose products, product IDs, brands, scores, rankings"),
  "DATA-AI1 provider must remain intent-only");
check(execution.includes('scorerAuthority: "existing_recommendation_scoring"'),
  "existing deterministic scorer must remain ranking authority");

console.log(`DATA-AI6 controlled preview verifier: PASS (${assertions} assertions)`);
