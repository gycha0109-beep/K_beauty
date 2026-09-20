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

const service = read("lib/server/product-query-activation-readiness-service.js");
const route = read("app/api/internal/product-query-activation-readiness/route.js");
const oidc = read("lib/product-query-activation-readiness-oidc.js");
const intentService = read("lib/server/product-query-intent-service.js");
const execution = read("lib/product-query-recommendation.js");
const workflow = read(".github/workflows/data-ai5-activation-readiness.yml");
const runtimeValidator = read("scripts/validate-data-ai5-activation-readiness-runtime-response.mjs");

const caseIds = [
  "sun_pref_a",
  "sun_pref_b",
  "barrier_cream_a",
  "barrier_cream_b",
  "category_only_a",
  "category_only_b",
  "pregnancy_unresolved_a",
  "pregnancy_unresolved_b",
  "makeup_eye_sun_a",
  "makeup_eye_sun_b",
  "adversarial_selection_a",
  "adversarial_selection_b"
];

check(service.includes('import "server-only"'),
  "DATA-AI5 readiness service must stay server-only");
check(service.includes('"product-query-activation-readiness-v1"'),
  "DATA-AI5 readiness contract version must be frozen");
check(service.includes("runNaturalLanguageProductQueryShadow"),
  "DATA-AI5 must reuse the provider-to-deterministic shadow path");
for (const id of caseIds) {
  check(service.includes(`id: "${id}"`), `DATA-AI5 case missing: ${id}`);
  check(workflow.includes(id), `DATA-AI5 workflow case missing: ${id}`);
}
for (const family of [
  "sunscreen_preferences",
  "barrier_moisturizer",
  "category_only_fail_closed",
  "unsupported_safety_constraint",
  "makeup_eye_sunscreen",
  "adversarial_product_selection"
]) {
  check(service.includes(`family: "${family}"`), `DATA-AI5 family missing: ${family}`);
}
check(service.includes('query: "세안제 추천해줘."'),
  "DATA-AI5 must include a cleanser paraphrase");
check(service.includes("requireSparseIntent: true"),
  "low-information cases must reject hallucinated profile state");
check(service.includes("requirePregnancyUnresolved: true"),
  "unsupported pregnancy safety must remain unresolved");
check(service.includes('allowedConstraintStatuses: ["resolved", "partial"]'),
  "adversarial cases must allow safe ignore or unresolved preservation");
check(service.includes("cross_category_result"),
  "DATA-AI5 must reject cross-category ranking");
check(service.includes("repetitionsPerCase: 2"),
  "DATA-AI5 repeatability count must remain frozen at two");
check(service.includes("publicActivation: false"),
  "DATA-AI5 must not activate public product search");
check(service.includes("productionWrite: false"),
  "DATA-AI5 must not write Production");
check(service.includes("recommendationLogWrite: false"),
  "DATA-AI5 must not write recommendation logs");
check(service.includes("profileRead: false"),
  "DATA-AI5 must not read saved profiles");
check(service.includes("historyRead: false"),
  "DATA-AI5 must not read analysis history");
check(service.includes("directProductFactRead: false"),
  "DATA-AI5 must not read Product Fact directly");
check(service.includes("taxonomyRuntimeAuthority: false"),
  "DATA-AI5 must not promote taxonomy shadow to runtime authority");
check(service.includes("providerProductSelection: false"),
  "provider must not gain product selection authority");
check(service.includes("providerRankingAuthority: false"),
  "provider must not gain ranking authority");
check(!service.includes("@supabase/supabase-js"),
  "DATA-AI5 service must not bypass admitted product source");
check(!service.includes("TOP_PICK_SCORING_WEIGHTS"),
  "DATA-AI5 must not introduce scoring weights");
check(!service.includes("product_fact_current"),
  "DATA-AI5 must not query Product Fact tables directly");
check(!service.includes("recommendation_logs"),
  "DATA-AI5 must not query recommendation logs");
check(!service.includes("skin_profiles"),
  "DATA-AI5 must not query saved skin profiles");
check(!service.includes("analysis_results"),
  "DATA-AI5 must not query analysis history");

check(intentService.includes("store: false"),
  "DATA-AI1 provider request must remain non-persistent");
check(intentService.includes("Never choose products, product IDs, brands, scores, rankings"),
  "DATA-AI1 must still prohibit provider product selection");
check(execution.includes('scorerAuthority: "existing_recommendation_scoring"'),
  "DATA-AI2 existing deterministic scorer must remain authority");

check(route.includes('ALLOWED_DEPLOYMENT_REFS = new Set(["main"])'),
  "DATA-AI5 runtime probe must authorize main only");
check(route.includes("ALLOWED_CASE_IDS"),
  "DATA-AI5 runtime probe must restrict callers to frozen cases");
check(route.includes('bodyKeys.length !== 1 || bodyKeys[0] !== "caseId"'),
  "DATA-AI5 runtime route must accept exactly one caseId field");
check(!route.includes("body?.query"),
  "DATA-AI5 runtime route must not accept raw query text");
check(route.includes('"provider_availability"'),
  "provider availability failure must be classified separately");
check(route.includes('"provider_protocol"'),
  "provider protocol failure must be classified separately");
check(route.includes('"semantic_assertion"'),
  "semantic assertion failure must be classified separately");
check(route.includes("queryTextExposed: false"),
  "runtime evidence must attest raw query text is not exposed");
check(route.includes("productionWrite: false"),
  "runtime evidence must attest zero Production writes");
check(route.includes("recommendationLogWrite: false"),
  "runtime evidence must attest zero recommendation-log writes");
check(route.includes("publicActivation: false"),
  "runtime evidence must attest public activation remains off");

check(oidc.includes('"urn:bejewely:data-ai5:activation-readiness"'),
  "DATA-AI5 OIDC audience must be dedicated");
check(oidc.includes('".github/workflows/data-ai5-activation-readiness.yml"'),
  "OIDC claims must pin DATA-AI5 workflow path");
check(oidc.includes('payload?.event_name !== "push"'),
  "OIDC must reject non-push callers");
check(oidc.includes("payload?.workflow_sha !== expectedDeploymentSha"),
  "OIDC workflow SHA must match deployed SHA");
check(oidc.includes('payload?.runner_environment !== "github-hosted"'),
  "OIDC must bind to GitHub-hosted runner");

const pushSection = workflow.split("  pull_request:")[0];
check(pushSection.includes("    paths:"),
  "DATA-AI5 live probe must be path-bounded");
check(workflow.includes("cancel-in-progress: true"),
  "superseded DATA-AI5 runs must cancel");
check(workflow.includes("actions/checkout@v7"),
  "DATA-AI5 must use current checkout runtime");
check(workflow.includes("actions/setup-node@v7"),
  "DATA-AI5 must use current setup-node runtime");
check(workflow.includes("node-version: 22"),
  "DATA-AI5 static job must use Node 22");
check(workflow.includes("id-token: write"),
  "DATA-AI5 runtime requires short-lived GitHub OIDC");
check(workflow.includes("for repeat in 1 2"),
  "DATA-AI5 must run every frozen case twice");
check(workflow.includes("validate-data-ai5-activation-readiness-runtime-response.mjs"),
  "DATA-AI5 runtime must invoke standalone validator");
check(workflow.includes("Checkout exact runtime probe SHA"),
  "DATA-AI5 runtime must checkout exact main SHA");
check(workflow.includes("Verify runtime probe checkout"),
  "DATA-AI5 runtime must attest exact checkout");
check(!workflow.includes("OPENAI_API_KEY"),
  "GitHub workflow must not receive provider secret");
check(!workflow.includes("PRODUCT_QUERY_INTENT_MODEL:"),
  "DATA-AI5 must use deployed model authority");
check(!workflow.includes("current-main-health.yml"),
  "DATA-AI5 live provider gate must not become a reverse dependency of Current Main Health");

check(runtimeValidator.includes('payload.result !== "PASS"'),
  "runtime validator must require case PASS");
check(runtimeValidator.includes('payload.failureClass !== null'),
  "runtime validator must reject classified runtime/provider failures");
check(runtimeValidator.includes('payload.deploymentRef !== "main"'),
  "runtime validator must bind to main deployment");
check(runtimeValidator.includes('payload.persisted !== false'),
  "runtime validator must require non-persistence");
check(runtimeValidator.includes('payload.productionWrite !== false'),
  "runtime validator must require zero Production write");
check(runtimeValidator.includes('payload.publicActivation !== false'),
  "runtime validator must require no public activation");

console.log(`DATA-AI5 activation-readiness verifier: PASS (${assertions} assertions)`);
