#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_RELEASE_READINESS,
  PRODUCT_QUERY_RELEASE_READINESS_CONTRACT_VERSION
} from "../lib/product-query-release-readiness-contract.mjs";
import { evaluateProductQueryPreviewPolicy } from "../lib/product-query-preview-policy.mjs";
import { evaluateProductQueryStageCanaryPolicy } from "../lib/product-query-stage-canary-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function read(path) {
  return readFileSync(path, "utf8");
}

const readiness = PRODUCT_QUERY_RELEASE_READINESS;
const previewService = read("lib/server/product-query-preview-service.js");
const canaryService = read("lib/server/product-query-stage-canary-service.js");
const failClosedWorkflow = read(".github/workflows/data-ai7-production-fail-closed.yml");
const currentMainHealth = read("scripts/verify-current-main-health.mjs");

check(readiness.contractVersion === PRODUCT_QUERY_RELEASE_READINESS_CONTRACT_VERSION &&
    readiness.contractVersion === "product-query-release-readiness-v1",
  "DATA-AI8 contract version must be frozen");
check(readiness.phase === "DATA-AI8" && readiness.scope === "evidence_only",
  "DATA-AI8 must remain evidence-only");
check(readiness.readinessState === "hosted_authenticated_preview_pending" &&
    readiness.activationDecision === "not_authorized",
  "DATA-AI8 must not claim activation readiness before hosted authenticated Preview acceptance");
check(readiness.unresolvedRuntimeEvidence.length === 1 &&
    readiness.unresolvedRuntimeEvidence[0] === "hosted_authenticated_preview_acceptance" &&
    readiness.nextRequiredEvidence === "hosted_authenticated_preview_acceptance",
  "hosted authenticated Preview acceptance must remain the explicit unresolved runtime gate");

const requiredEvidence = new Set(readiness.prerequisiteEvidenceClasses);
for (const evidence of [
  "data-ai3-real-corpus-shadow",
  "data-ai4-provider-backed-shadow",
  "data-ai5-activation-readiness-shadow",
  "data-ai6-controlled-authenticated-preview-contract",
  "data-ai7-test-stage-repeatability-runtime",
  "data-ai7-production-fail-closed-deployed-probe"
]) {
  check(requiredEvidence.has(evidence), `missing prerequisite evidence class: ${evidence}`);
}

const boundary = readiness.activationBoundary;
check(boundary.productionActivation === false &&
    boundary.productionShadow === false &&
    boundary.publicSearchCutover === false,
  "DATA-AI8 must not authorize Production activation/shadow or public Search cutover");
check(boundary.automaticTrafficSampling === false && boundary.effectiveSampleBps === 0,
  "DATA-AI8 automatic traffic sampling must remain 0 bps");
check(boundary.persistence === "none" &&
    boundary.savedProfileRead === false &&
    boundary.historyRead === false,
  "DATA-AI8 must not persist evidence or merge saved profile/history");
check(boundary.productFactDirectRead === false &&
    boundary.taxonomyRuntimeAuthority === false,
  "DATA-AI8 must not promote Product Fact/taxonomy authority");
check(boundary.providerProductSelection === false &&
    boundary.providerRankingAuthority === false,
  "DATA-AI8 must preserve deterministic product selection/ranking authority");
check(boundary.releaseGateImplemented === false &&
    boundary.productionEnvironmentMutation === false &&
    readiness.futureActivationRequiresSeparateExplicitPhase === true,
  "DATA-AI8 must not become a release gate or mutate Production activation state");

const previewProduction = evaluateProductQueryPreviewPolicy({
  BEJEWELY_PRODUCT_QUERY_PREVIEW_ENABLED: "true",
  VERCEL_ENV: "production"
});
const canaryProduction = evaluateProductQueryStageCanaryPolicy({
  BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED: "true",
  VERCEL_ENV: "production",
  NODE_ENV: "production"
});
check(previewProduction.allowed === false && previewProduction.productionAllowed === false,
  "DATA-AI6 Preview policy must remain fail-closed in Production");
check(canaryProduction.allowed === false &&
    canaryProduction.productionAllowed === false &&
    canaryProduction.effectiveSampleBps === 0,
  "DATA-AI7 canary policy must remain fail-closed at 0 bps in Production");

check(previewService.includes('persistence: "none"') &&
    previewService.includes("profileRead: false") &&
    previewService.includes("historyRead: false") &&
    previewService.includes("providerRankingAuthority: false"),
  "DATA-AI6 dependency must preserve non-persistence/profile-history/ranking boundaries");
check(canaryService.includes('persistence: "none"') &&
    canaryService.includes("automaticTrafficSampling: false") &&
    canaryService.includes("publicSearchCutover: false") &&
    canaryService.includes("releaseGateImplemented: false"),
  "DATA-AI7 dependency must preserve no-traffic/no-cutover/no-release-gate boundaries");

check(failClosedWorkflow.includes("DATA-AI7 deployed Production fail-closed probe") &&
    failClosedWorkflow.includes('test "$status" = "404"') &&
    failClosedWorkflow.includes("/api/my/product-query-preview") &&
    failClosedWorkflow.includes("/api/my/product-query-stage-canary"),
  "deployed Production fail-closed evidence must stay wired to both guarded routes");
check(currentMainHealth.includes('run("DATA-AI8 release-readiness evidence boundary", node, ["scripts/verify-data-ai8-release-readiness.mjs"]);'),
  "Current Main Health must enforce DATA-AI8 readiness boundary");

console.log(`DATA-AI8 release-readiness verifier: PASS (${assertions} assertions)`);
