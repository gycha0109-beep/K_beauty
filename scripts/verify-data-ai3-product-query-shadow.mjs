#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function read(path) {
  return readFileSync(path, "utf8");
}

const service = read("lib/server/product-query-shadow-service.js");
const oidc = read("lib/product-query-shadow-probe-oidc.js");
const route = read("app/api/internal/product-query-shadow/route.js");
const workflow = read(".github/workflows/data-ai3-product-query-shadow.yml");
const execution = read("lib/product-query-recommendation.js");
const intentService = read("lib/server/product-query-intent-service.js");

check(service.includes('import "server-only"'), "shadow orchestration must be server-only");
check(service.includes('import "@/lib/server/recommendation-candidate-admission-runtime"'),
  "real-corpus shadow must register recommendation admission runtime explicitly");
check(service.includes('extractProductQueryIntent'), "natural-language shadow path must reuse DATA-AI1");
check(service.includes('getRecommendationProducts'), "shadow evaluation must use admitted corpus authority");
check(service.includes('rankStructuredProductQueryFromProducts'),
  "shadow evaluation must reuse DATA-AI2 pure deterministic execution");
check(service.includes('executeStructuredProductQuery'),
  "shadow evaluation must compare DATA-AI2 runtime wrapper");
check(service.includes('createHash'), "shadow evaluation must fingerprint deterministic projections");
check(service.includes('PRODUCT_QUERY_SHADOW_CONTRACT_VERSION = "product-query-shadow-v1"'),
  "shadow contract version must be frozen");
check(service.includes('"sunscreen_sparse_preferences"'), "sunscreen scenario must exist");
check(service.includes('"moisturizer_explicit_context"'), "moisturizer scenario must exist");
check(service.includes('"category_only_fail_closed"'), "insufficient-intent scenario must exist");
check(service.includes('"unresolved_constraint_preserved"'), "unresolved-term scenario must exist");
check(service.includes('expectedStatus: "insufficient_supported_intent"'),
  "category-only query must remain fail-closed");
check(service.includes('expectedUnresolvedTerm: "pregnancy-safe"'),
  "unsupported constraint must remain explicit");
check(service.includes("pureFingerprint !== runtimeFingerprint"),
  "pure/runtime divergence must fail scenario");
check(service.includes("publicActivation: false"), "public activation must remain disabled");
check(service.includes('persistence: "none"'), "query/result persistence must remain disabled");
check(service.includes("profileRead: false"), "saved profile read must remain disabled");
check(service.includes("historyRead: false"), "history read must remain disabled");
check(service.includes("productionWrite: false"), "Production write must remain disabled");
check(service.includes("recommendationLogWrite: false"), "recommendation log write must remain disabled");
check(service.includes("directProductFactRead: false"), "direct Product Fact reads must remain disabled");
check(service.includes("taxonomyRuntimeAuthority: false"), "taxonomy shadow cannot become runtime authority");
check(!service.includes("@supabase/supabase-js"), "DATA-AI3 must not bypass product-source through Supabase client");
check(!service.includes("product_fact_current"), "DATA-AI3 must not query Product Fact tables directly");
check(!service.includes("recommendation_logs"), "DATA-AI3 must not write/read recommendation logs");
check(!service.includes("skin_profiles"), "DATA-AI3 must not read saved skin profiles");
check(!service.includes("analysis_results"), "DATA-AI3 must not read analysis history");

check(execution.includes('scorerAuthority: "existing_recommendation_scoring"'),
  "DATA-AI2 must remain existing scorer authority");
check(!service.includes("TOP_PICK_SCORING_WEIGHTS"),
  "DATA-AI3 must not define recommendation weights");
check(intentService.includes("store: false"), "DATA-AI1 provider requests must remain non-persistent");

check(route.includes('ALLOWED_DEPLOYMENT_REFS = new Set(["main"])'),
  "deployed shadow probe must only authorize main");
check(route.includes("verifyDataAi3GitHubActionsOidcToken"),
  "route must require dedicated GitHub OIDC verification");
check(route.includes('"Cache-Control": "no-store, max-age=0"'),
  "shadow probe responses must be no-store");
check(route.includes("queryTextExposed: false"), "runtime evidence must not expose raw query text");
check(route.includes("secretValueExposed: false"), "runtime evidence must not expose secrets");
check(route.includes("productionWrite: false"), "runtime evidence must attest zero Production write");
check(route.includes("publicActivation: false"), "runtime evidence must attest no public activation");
check(!route.includes("request.json()"), "automatic real-corpus probe must use frozen scenarios, not caller input");

check(oidc.includes('DATA_AI3_RUNTIME_PROBE_AUDIENCE =\n  "urn:bejewely:data-ai3:product-query-shadow"'),
  "OIDC audience must be dedicated to DATA-AI3");
check(oidc.includes('".github/workflows/data-ai3-product-query-shadow.yml"'),
  "OIDC token must pin exact workflow path");
check(oidc.includes('payload?.event_name !== "push"'), "OIDC must reject non-push callers");
check(oidc.includes("payload?.workflow_sha !== expectedDeploymentSha"),
  "OIDC must bind workflow SHA to deployment SHA");
check(oidc.includes('payload?.runner_environment !== "github-hosted"'),
  "OIDC must bind to GitHub-hosted runner");

const pushSection = workflow.split("  pull_request:")[0];
check(pushSection.includes("    paths:"), "main push runtime probe must be path-bounded");
check(workflow.includes("cancel-in-progress: true"), "superseded DATA-AI3 runs must cancel");
check(workflow.includes("actions/checkout@v7"), "DATA-AI3 workflow must use current checkout runtime");
check(workflow.includes("actions/setup-node@v7"), "DATA-AI3 workflow must use current setup-node runtime");
check(workflow.includes("node-version: 22"), "DATA-AI3 verifier must use Node 22");
check(workflow.includes("id-token: write"), "runtime probe requires short-lived OIDC only");
check(workflow.includes("deployments: read"), "runtime probe may resolve only deployment metadata");
check(workflow.includes("if: github.event_name == 'push'"),
  "deployed real-corpus probe must not execute on PRs");
check(workflow.includes("DATA_AI3_RUNTIME_PROBE_HTTP_STATUS"),
  "workflow must record deployed probe status");
check(workflow.includes('payload.result !== "PASS"'),
  "deployed probe must fail unless shadow evaluation passes");
check(!workflow.includes("OPENAI_API_KEY"), "automatic deterministic gate must not require provider secret");

console.log(`DATA-AI3 product-query shadow verifier: PASS (${assertions} assertions)`);
