#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_AUTHENTICATED_LIMITED_BETA_DESIGN as design
} from "../lib/product-query-authenticated-limited-beta-design-contract.mjs";
import {
  PRODUCT_QUERY_POST_CANARY_READINESS as readiness
} from "../lib/product-query-post-canary-readiness-contract.mjs";
import {
  PRODUCT_QUERY_EXECUTION_LIMITS
} from "../lib/product-query-execution-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  readiness.phase === "DATA-AI16" &&
    readiness.productionCanaryAccepted === true &&
    readiness.activationBoundary?.productionActivation === false &&
    readiness.activationBoundary?.effectiveSampleBps === 0,
  "DATA-AI17 must start from accepted DATA-AI16 default-off closure"
);

check(
  design.contractVersion ===
      "product-query-authenticated-limited-beta-design-v1" &&
    design.phase === "DATA-AI17" &&
    design.scope === "authenticated_limited_beta_design_only" &&
    design.betaState === "designed_not_implemented" &&
    design.activationDecision === "not_authorized",
  "frozen DATA-AI17 design evidence must remain design-only and non-activating"
);

check(
  design.accessBoundary?.authenticatedOnly === true &&
    design.accessBoundary?.explicitServerSideBetaEligibilityRequired === true &&
    design.accessBoundary?.anonymousTraffic === false &&
    design.accessBoundary?.automaticTrafficSampling === false &&
    design.accessBoundary?.publicAnonymousRoute === false &&
    design.accessBoundary?.browserControlledActivation === false &&
    design.accessBoundary?.requestControlledActivation === false,
  "limited beta access must be explicit, authenticated, server-side, and non-sampled"
);

check(
  design.authorityBoundary?.providerRole === "intent_parsing_only" &&
    design.authorityBoundary?.providerProductSelection === false &&
    design.authorityBoundary?.providerRankingAuthority === false &&
    design.authorityBoundary?.deterministicRankingAuthority ===
      "existing_recommendation_engine" &&
    design.authorityBoundary?.queryProvenance === "query_only",
  "provider authority must stop at intent parsing"
);

check(
  design.authorityBoundary?.profileMerge === false &&
    design.authorityBoundary?.savedProfileRead === false &&
    design.authorityBoundary?.historyRead === false &&
    design.authorityBoundary?.productFactDirectRead === false &&
    design.authorityBoundary?.taxonomyRuntimeAuthority === false,
  "beta design must not silently widen user or product authority"
);

check(
  design.dataBoundary?.persistence === "none" &&
    design.dataBoundary?.rawQueryPersistence === false &&
    design.dataBoundary?.recommendationLogWrite === false &&
    design.dataBoundary?.productionWrite === false &&
    design.dataBoundary?.accessTokenPersistence === false &&
    design.dataBoundary?.rawAccountIdPersistence === false,
  "DATA-AI17 must remain non-persistent and write-free"
);

check(
  design.integrationBoundary?.betaRouteImplemented === false &&
    design.integrationBoundary?.userFacingUiConnected === false &&
    design.integrationBoundary?.publicSearchCutover === false &&
    design.integrationBoundary?.productionEnvironmentMutation === false &&
    design.integrationBoundary?.activationManifestPresent === false &&
    design.integrationBoundary?.releaseGateImplemented === false,
  "frozen DATA-AI17 design record must show that implementation/activation was deferred"
);

check(
  design.failureBehavior?.failClosedOnMissingAuthentication === true &&
    design.failureBehavior?.failClosedOnMissingBetaEligibility === true &&
    design.failureBehavior?.failClosedOnProviderUnavailable === true &&
    design.failureBehavior?.failClosedOnProviderProtocolError === true &&
    design.failureBehavior?.providerFailureMaySelectProducts === false,
  "future beta runtime must fail closed without expanding provider authority"
);

check(
  PRODUCT_QUERY_EXECUTION_LIMITS.publicActivation === false &&
    PRODUCT_QUERY_EXECUTION_LIMITS.profileMerge === false &&
    PRODUCT_QUERY_EXECUTION_LIMITS.historyRead === false &&
    PRODUCT_QUERY_EXECUTION_LIMITS.productionWrite === false &&
    PRODUCT_QUERY_EXECUTION_LIMITS.productFactDirectRead === false &&
    PRODUCT_QUERY_EXECUTION_LIMITS.taxonomyRuntimeAuthority === false &&
    PRODUCT_QUERY_EXECUTION_LIMITS.rankingAuthority ===
      "existing_recommendation_engine",
  "current execution contract must preserve deterministic authority boundaries"
);

const intentService =
  readFileSync("lib/server/product-query-intent-service.js", "utf8");
check(
  intentService.includes("This is intent extraction, not skincare advice.") &&
    intentService.includes(
      "Never choose products, product IDs, brands, scores, rankings, Product Facts, ingredients, or claims."
    ) &&
    intentService.includes("productSelection: false") &&
    intentService.includes("profileMerge: false") &&
    intentService.includes("store: false"),
  "provider contract must remain query-only intent extraction"
);

const shadowService =
  readFileSync("lib/server/product-query-shadow-service.js", "utf8");
check(
  shadowService.includes("extractProductQueryIntent(query, options)") &&
    shadowService.includes("executeStructuredProductQuery(extracted.intent") &&
    shadowService.includes('provenance: "query_only_shadow"') &&
    shadowService.includes('persisted: false'),
  "natural-language path must hand provider intent to deterministic execution"
);

const recommendation =
  readFileSync("lib/product-query-recommendation.js", "utf8");
check(
  recommendation.includes('scorerAuthority: "existing_recommendation_scoring"') &&
    recommendation.includes('candidateAdmissionAuthority: "production-recommendation-candidate-admission-v1"') &&
    recommendation.includes("getRecommendationProducts") &&
    recommendation.includes("scoreCanonicalProduct") &&
    recommendation.includes("scoreSunscreenProduct"),
  "product selection and ranking authority must remain existing deterministic code"
);

check(
  design.nextRequiredPhase ===
      "data_ai18_authenticated_limited_beta_runtime_implementation_default_off" &&
    design.userFacingProductionActivationRequiresSeparateExplicitPhase === true,
  "runtime implementation and user-facing activation must remain later explicit phases"
);

console.log(
  `DATA-AI17 authenticated limited-beta design verifier: PASS (${assertions} assertions)`
);
