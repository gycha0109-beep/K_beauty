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

const providerService = read("lib/server/product-query-provider-shadow-service.js");
const dataAi1 = read("lib/server/product-query-intent-service.js");
const dataAi3 = read("lib/server/product-query-shadow-service.js");
const execution = read("lib/product-query-recommendation.js");
const route = read("app/api/internal/product-query-provider-shadow/route.js");
const oidc = read("lib/product-query-provider-shadow-oidc.js");
const workflow = read(".github/workflows/data-ai4-provider-shadow.yml");
const runtimeValidator = read("scripts/validate-data-ai4-provider-shadow-runtime-response.mjs");

check(providerService.includes('import "server-only"'),
  "provider shadow service must stay server-only");
check(providerService.includes("runNaturalLanguageProductQueryShadow"),
  "DATA-AI4 must reuse DATA-AI3 natural-language shadow entrypoint");
check(providerService.includes('PRODUCT_QUERY_PROVIDER_SHADOW_CONTRACT_VERSION =\n  "product-query-provider-shadow-v1"'),
  "DATA-AI4 contract version must be frozen");
check(providerService.includes('"ko_oily_no_cast_nonsticky_sunscreen"'),
  "sunscreen provider scenario must exist");
check(providerService.includes('"ko_dry_high_sensitivity_barrier_cream"'),
  "moisturizer provider scenario must exist");
check(providerService.includes('"ko_category_only_cleanser"'),
  "category-only provider scenario must exist");
check(providerService.includes('"ko_acne_treatment_pregnancy_unresolved"'),
  "unresolved pregnancy provider scenario must exist");
check(providerService.includes('query: "지성인데 백탁 없고 끈적이지 않는 선크림 찾아줘."'),
  "provider scenario queries must be frozen in code");
check(providerService.includes('query: "클렌저 찾아줘."'),
  "category-only query must be frozen in code");
check(providerService.includes("requireSparseIntent: true"),
  "category-only scenario must reject hallucinated user state");
check(providerService.includes("requirePregnancyUnresolved: true"),
  "unsupported pregnancy constraint must stay unresolved");
check(providerService.includes("execution.status !== scenario.expectedStatus"),
  "provider evaluation must verify downstream execution status");
check(providerService.includes("cross_category_result"),
  "provider evaluation must reject cross-category deterministic results");
check(providerService.includes("providerProductSelection: false"),
  "provider product selection authority must remain false");
check(providerService.includes("providerRankingAuthority: false"),
  "provider ranking authority must remain false");
check(providerService.includes("productionWrite: false"),
  "Production write must remain disabled");
check(providerService.includes("recommendationLogWrite: false"),
  "Recommendation log write must remain disabled");
check(providerService.includes("profileRead: false"),
  "saved profile read must remain disabled");
check(providerService.includes("historyRead: false"),
  "analysis-history read must remain disabled");
check(providerService.includes("directProductFactRead: false"),
  "direct Product Fact read must remain disabled");
check(providerService.includes("taxonomyRuntimeAuthority: false"),
  "taxonomy shadow must not become Recommendation authority");
check(providerService.includes("arbitraryQueryInput: false"),
  "arbitrary provider query input must remain disabled");
check(!providerService.includes("@supabase/supabase-js"),
  "DATA-AI4 must not bypass admitted product source with direct Supabase access");
check(!providerService.includes("TOP_PICK_SCORING_WEIGHTS"),
  "DATA-AI4 must not define new scoring weights");
check(!providerService.includes("product_fact_current"),
  "DATA-AI4 must not query Product Fact tables directly");
check(!providerService.includes("recommendation_logs"),
  "DATA-AI4 must not query recommendation logs");
check(!providerService.includes("skin_profiles"),
  "DATA-AI4 must not read saved skin profile");
check(!providerService.includes("analysis_results"),
  "DATA-AI4 must not read analysis history");

check(dataAi1.includes("store: false"),
  "DATA-AI1 provider request must remain non-persistent");
check(dataAi1.includes("Never choose products, product IDs, brands, scores, rankings"),
  "DATA-AI1 system boundary must still prohibit provider product selection");
check(dataAi3.includes("executeStructuredProductQuery"),
  "DATA-AI3 must still hand intent to deterministic execution");
check(execution.includes('scorerAuthority: "existing_recommendation_scoring"'),
  "DATA-AI2 must remain bound to the existing deterministic scorer");

check(route.includes('ALLOWED_DEPLOYMENT_REFS = new Set(["main"])'),
  "deployed provider probe must authorize main only");
check(route.includes("verifyDataAi4GitHubActionsOidcToken"),
  "provider probe must require dedicated GitHub Actions OIDC");
check(route.includes("ALLOWED_SCENARIO_IDS"),
  "provider probe must restrict caller input to frozen scenario IDs");
check(route.includes('bodyKeys.length !== 1 || bodyKeys[0] !== "scenarioId"'),
  "provider probe must accept exactly one scenarioId input field");
check(!route.includes("body?.query"),
  "provider probe must not accept raw query text");
check(route.includes('"Cache-Control": "no-store, max-age=0"'),
  "provider probe response must be no-store");
check(route.includes("queryTextExposed: false"),
  "runtime evidence must attest raw query text is not exposed");
check(route.includes("secretValueExposed: false"),
  "runtime evidence must attest secrets are not exposed");
check(route.includes("productionWrite: false"),
  "runtime evidence must attest zero Production write");
check(route.includes("recommendationLogWrite: false"),
  "runtime evidence must attest zero recommendation-log write");
check(route.includes("publicActivation: false"),
  "runtime evidence must attest no public activation");

check(oidc.includes('DATA_AI4_RUNTIME_PROBE_AUDIENCE =\n  "urn:bejewely:data-ai4:provider-shadow"'),
  "DATA-AI4 OIDC audience must be dedicated");
check(oidc.includes('".github/workflows/data-ai4-provider-shadow.yml"'),
  "OIDC claims must pin DATA-AI4 workflow path");
check(oidc.includes('payload?.event_name !== "push"'),
  "OIDC must reject non-push callers");
check(oidc.includes("payload?.workflow_sha !== expectedDeploymentSha"),
  "OIDC workflow SHA must match deployed SHA");
check(oidc.includes('payload?.runner_environment !== "github-hosted"'),
  "OIDC must bind to GitHub-hosted runner");

const pushSection = workflow.split("  pull_request:")[0];
check(pushSection.includes("    paths:"),
  "provider-backed main push probe must be path-bounded");
check(workflow.includes("cancel-in-progress: true"),
  "superseded DATA-AI4 runs must cancel");
check(workflow.includes("actions/checkout@v7"),
  "DATA-AI4 must use current checkout runtime");
check(workflow.includes("actions/setup-node@v7"),
  "DATA-AI4 must use current setup-node runtime");
check(workflow.includes("node-version: 22"),
  "DATA-AI4 verifier must run on Node 22");
check(workflow.includes("id-token: write"),
  "deployed provider probe requires short-lived GitHub OIDC");
check(workflow.includes("deployments: read"),
  "deployed provider probe may resolve only deployment metadata");
check(workflow.includes("if: github.event_name == 'push'"),
  "provider-backed runtime evaluation must not execute on pull requests");
check(workflow.includes("ko_oily_no_cast_nonsticky_sunscreen"),
  "workflow must run frozen sunscreen scenario");
check(workflow.includes("ko_dry_high_sensitivity_barrier_cream"),
  "workflow must run frozen moisturizer scenario");
check(workflow.includes("ko_category_only_cleanser"),
  "workflow must run frozen category-only scenario");
check(workflow.includes("ko_acne_treatment_pregnancy_unresolved"),
  "workflow must run frozen unresolved scenario");
check(workflow.includes("validate-data-ai4-provider-shadow-runtime-response.mjs"),
  "deployed provider probe must invoke standalone runtime-response validator");
check(!workflow.includes("<<'NODE'"),
  "DATA-AI4 workflow must not use inline Node heredocs");
check(runtimeValidator.includes('payload.result !== "PASS"'),
  "runtime validator must fail unless provider scenario passes");
check(runtimeValidator.includes('payload.deploymentRef !== "main"'),
  "runtime validator must bind evidence to main deployment");
check(runtimeValidator.includes('payload.persisted !== false'),
  "runtime validator must require non-persistence");
check(runtimeValidator.includes('payload.productionWrite !== false'),
  "runtime validator must require zero Production write");
check(runtimeValidator.includes('payload.publicActivation !== false'),
  "runtime validator must require no public activation");
check(!workflow.includes("OPENAI_API_KEY"),
  "GitHub workflow must not receive provider secret directly");
check(!workflow.includes("PRODUCT_QUERY_INTENT_MODEL:"),
  "automatic provider probe must use deployed model authority rather than workflow override");

console.log(`DATA-AI4 provider shadow verifier: PASS (${assertions} assertions)`);
