#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateProductQueryProductionActivationPolicy,
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS,
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_LIMITS
} from "../lib/product-query-production-activation-policy.mjs";
import {
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY as safety,
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY_CONTRACT_VERSION
} from "../lib/product-query-production-activation-safety-contract.mjs";
import { PRODUCT_QUERY_POST_PREVIEW_READINESS } from "../lib/product-query-post-preview-readiness-contract.mjs";
import { evaluateProductQueryPreviewPolicy } from "../lib/product-query-preview-policy.mjs";
import { evaluateProductQueryStageCanaryPolicy } from "../lib/product-query-stage-canary-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function evaluate(overrides = {}) {
  return evaluateProductQueryProductionActivationPolicy(overrides);
}

check(safety.contractVersion === PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY_CONTRACT_VERSION &&
    safety.contractVersion === "product-query-production-activation-safety-v1",
  "DATA-AI11 safety contract version must be frozen");
check(safety.phase === "DATA-AI11" &&
    safety.scope === "production_activation_design_only" &&
    safety.readinessState === "production_activation_safety_contract_ready",
  "DATA-AI11 must remain design-only");
check(PRODUCT_QUERY_POST_PREVIEW_READINESS.readinessState === "hosted_authenticated_preview_accepted" &&
    PRODUCT_QUERY_POST_PREVIEW_READINESS.activationDecision === "not_authorized",
  "DATA-AI11 must build on accepted hosted Preview evidence without rewriting DATA-AI10");
check(safety.activationDecision === "not_authorized" &&
    safety.effectiveSampleBps === 0 &&
    safety.initialCanarySampleBps === null &&
    safety.initialCanarySampleDecision === "deferred_to_data_ai12",
  "DATA-AI11 must not authorize or choose the initial Production canary");
check(safety.maximumFutureCanarySampleBps === PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS &&
    PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS === 100,
  "future canary configuration must have a hard 1% ceiling");

const disabled = evaluate();
check(disabled.configurationEligible === false &&
    disabled.activationAllowed === false &&
    disabled.effectiveSampleBps === 0 &&
    disabled.killSwitchEngaged === true,
  "missing configuration must fail closed with the kill switch engaged");

const activationFlagOnly = evaluate({
  VERCEL_ENV: "production",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "true"
});
check(activationFlagOnly.configurationEligible === false &&
    activationFlagOnly.effectiveSampleBps === 0,
  "activation flag alone must never enable Production traffic");

const previewAttempt = evaluate({
  VERCEL_ENV: "preview",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH: "false",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT: "authenticated_bounded",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS: "25"
});
check(previewAttempt.productionEnvironment === false &&
    previewAttempt.configurationEligible === false &&
    previewAttempt.effectiveSampleBps === 0,
  "Production activation configuration must not become eligible in Preview");

const fullyConfigured = evaluate({
  VERCEL_ENV: "production",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH: "false",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT: "authenticated_bounded",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS: "25"
});
check(fullyConfigured.configurationEligible === true &&
    fullyConfigured.configuredSampleBps === 25 &&
    fullyConfigured.hostedAcceptanceSatisfied === true,
  "valid future DATA-AI12 configuration should be recognizable without activating it");
check(fullyConfigured.activationAllowed === false &&
    fullyConfigured.effectiveSampleBps === 0 &&
    fullyConfigured.activationDecision === "not_authorized",
  "even a fully configured DATA-AI11 policy must remain non-activating at 0 bps");

const killSwitchOn = evaluate({
  VERCEL_ENV: "production",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT: "authenticated_bounded",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS: "25"
});
check(killSwitchOn.killSwitchEngaged === true &&
    killSwitchOn.configurationEligible === false &&
    killSwitchOn.effectiveSampleBps === 0,
  "kill switch must fail closed");

for (const invalidSample of ["", "0", "101", "-1", "1.5", "abc", "  "]) {
  const result = evaluate({
    VERCEL_ENV: "production",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "true",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE: "true",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH: "false",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT: "authenticated_bounded",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS: invalidSample
  });
  check(result.sampleConfigurationValid === false &&
      result.configuredSampleBps === 0 &&
      result.configurationEligible === false &&
      result.effectiveSampleBps === 0,
    `invalid sample value must fail closed: ${JSON.stringify(invalidSample)}`);
}

const wrongCohort = evaluate({
  VERCEL_ENV: "production",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE: "true",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH: "false",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT: "public",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS: "1"
});
check(wrongCohort.authenticatedBoundedCohort === false &&
    wrongCohort.configurationEligible === false &&
    wrongCohort.effectiveSampleBps === 0,
  "public/anonymous cohort must not be eligible");

const requestLikeNoise = evaluate({
  query: "enable=true",
  Authorization: "Bearer ignored",
  sampleBps: "100",
  headers: { "x-enable-product-query": "true" }
});
check(requestLikeNoise.activationRequested === false &&
    requestLikeNoise.canaryModeRequested === false &&
    requestLikeNoise.configurationEligible === false,
  "request-like values must not control activation");

const limits = PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_LIMITS;
check(limits.designOnly === true &&
    limits.productionActivation === false &&
    limits.productionShadow === false &&
    limits.effectiveSampleBps === 0 &&
    limits.automaticTrafficSampling === false &&
    limits.publicSearchCutover === false &&
    limits.anonymousTraffic === false,
  "DATA-AI11 must preserve zero Production/public/automatic traffic");
check(limits.browserControlledActivation === false &&
    limits.requestControlledActivation === false &&
    limits.productionEnvironmentMutation === false &&
    limits.releaseGateImplemented === false,
  "DATA-AI11 must not expose runtime activation controls or mutate Production");
check(limits.persistence === "none" &&
    limits.rawQueryPersistence === false &&
    limits.accessTokenPersistence === false &&
    limits.savedProfileRead === false &&
    limits.historyRead === false,
  "DATA-AI11 must preserve non-persistence and no profile/history merge");
check(limits.productFactDirectRead === false &&
    limits.taxonomyRuntimeAuthority === false &&
    limits.providerProductSelection === false &&
    limits.providerRankingAuthority === false &&
    limits.deterministicRankingAuthorityPreserved === true,
  "DATA-AI11 must preserve deterministic product-selection/ranking authority");
check(limits.fallbackMode === "existing_path" &&
    safety.failureBehavior.failClosedOnInvalidConfiguration === true &&
    safety.failureBehavior.failClosedOnProviderUnavailable === true &&
    safety.failureBehavior.failClosedOnProviderProtocolError === true &&
    safety.failureBehavior.failClosedOnInternalExecutionError === true,
  "future runtime failure behavior must fall back to the existing path");

const previewProduction = evaluateProductQueryPreviewPolicy({
  BEJEWELY_PRODUCT_QUERY_PREVIEW_ENABLED: "true",
  VERCEL_ENV: "production"
});
const stageProduction = evaluateProductQueryStageCanaryPolicy({
  BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED: "true",
  VERCEL_ENV: "production",
  NODE_ENV: "production"
});
check(previewProduction.allowed === false && previewProduction.productionAllowed === false,
  "DATA-AI6 must remain Production fail-closed");
check(stageProduction.allowed === false &&
    stageProduction.productionAllowed === false &&
    stageProduction.effectiveSampleBps === 0,
  "DATA-AI7 must remain Production fail-closed");

const previewRoute = readFileSync("app/api/my/product-query-preview/route.js", "utf8");
const stageRoute = readFileSync("app/api/my/product-query-stage-canary/route.js", "utf8");
check(!previewRoute.includes("product-query-production-activation-policy") &&
    !stageRoute.includes("product-query-production-activation-policy"),
  "DATA-AI11 policy must not be wired into existing runtime routes");

check(safety.nextRequiredPhase === "data_ai12_controlled_production_canary" &&
    safety.futureActivationRequiresSeparateExplicitPhase === true,
  "actual Production canary must require a separate DATA-AI12 phase");

console.log(`DATA-AI11 Production activation safety verifier: PASS (${assertions} assertions)`);
