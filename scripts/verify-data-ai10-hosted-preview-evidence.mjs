#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE as evidence
} from "../lib/product-query-hosted-preview-acceptance-evidence.mjs";
import {
  PRODUCT_QUERY_POST_PREVIEW_READINESS,
  PRODUCT_QUERY_POST_PREVIEW_READINESS_CONTRACT_VERSION
} from "../lib/product-query-post-preview-readiness-contract.mjs";
import { PRODUCT_QUERY_RELEASE_READINESS } from "../lib/product-query-release-readiness-contract.mjs";
import { evaluateProductQueryPreviewPolicy } from "../lib/product-query-preview-policy.mjs";
import { evaluateProductQueryStageCanaryPolicy } from "../lib/product-query-stage-canary-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(evidence.evidenceVersion === "product-query-hosted-preview-acceptance-evidence-v1",
  "hosted Preview evidence version must be frozen");
check(evidence.phase === "DATA-AI9" &&
    evidence.workflowRunId === 35546391008 &&
    evidence.workflowAttempt === 2,
  "evidence must identify the successful DATA-AI9 workflow attempt");
check(evidence.selectedRef === "data-ai9-hosted-preview-runtime" &&
    evidence.selectedSha === "a53fe034524024c24cffdf33da6cf59e18ff0c81",
  "evidence must bind the exact selected Preview ref and SHA");
check(evidence.deploymentHost === "k-beauty-hifq6e412-johnny-self.vercel.app" &&
    evidence.deploymentEnvironment === "preview" &&
    evidence.productionEnvironment === false,
  "accepted deployment must remain explicitly non-Production");
check(evidence.authenticatedPreviewAccepted === true &&
    evidence.stageCanaryAccepted === true &&
    evidence.stageCanaryRepetitions === 2 &&
    evidence.stageCanaryAllParity === true,
  "DATA-AI6 and DATA-AI7 hosted runtime acceptance must be complete");
check(evidence.evidenceRetention === "request_local_only" &&
    evidence.persisted === false &&
    evidence.secretMaterialRecorded === false &&
    evidence.rawQueryRecorded === false,
  "checked-in acceptance evidence must contain no secret/raw-query persistence");

const readiness = PRODUCT_QUERY_POST_PREVIEW_READINESS;
check(readiness.contractVersion === PRODUCT_QUERY_POST_PREVIEW_READINESS_CONTRACT_VERSION &&
    readiness.contractVersion === "product-query-post-preview-readiness-v1",
  "DATA-AI10 contract version must be frozen");
check(readiness.phase === "DATA-AI10" &&
    readiness.scope === "evidence_closure_only" &&
    readiness.readinessState === "hosted_authenticated_preview_accepted",
  "DATA-AI10 must close only the hosted Preview evidence gap");
check(readiness.hostedPreviewEvidenceVersion === evidence.evidenceVersion &&
    readiness.unresolvedRuntimeEvidence.length === 0,
  "DATA-AI10 must bind the accepted hosted Preview evidence");
check(readiness.activationDecision === "not_authorized" &&
    readiness.nextRequiredPhase === "separate_explicit_production_activation_design" &&
    readiness.futureActivationRequiresSeparateExplicitPhase === true,
  "hosted Preview acceptance must not itself authorize Production activation");

const boundary = readiness.activationBoundary;
check(boundary.productionActivation === false &&
    boundary.productionShadow === false &&
    boundary.publicSearchCutover === false &&
    boundary.automaticTrafficSampling === false &&
    boundary.effectiveSampleBps === 0,
  "DATA-AI10 must preserve zero Production traffic and no cutover");
check(boundary.persistence === "none" &&
    boundary.savedProfileRead === false &&
    boundary.historyRead === false &&
    boundary.productionEnvironmentMutation === false,
  "DATA-AI10 must preserve no-persistence/no-Production-mutation boundaries");
check(boundary.productFactDirectRead === false &&
    boundary.taxonomyRuntimeAuthority === false &&
    boundary.providerProductSelection === false &&
    boundary.providerRankingAuthority === false &&
    boundary.releaseGateImplemented === false,
  "DATA-AI10 must not promote authority or implement a release gate");

check(PRODUCT_QUERY_RELEASE_READINESS.phase === "DATA-AI8" &&
    PRODUCT_QUERY_RELEASE_READINESS.readinessState === "hosted_authenticated_preview_pending" &&
    PRODUCT_QUERY_RELEASE_READINESS.activationDecision === "not_authorized",
  "historical DATA-AI8 snapshot must remain immutable");

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
  "DATA-AI6 must remain fail-closed in Production");
check(canaryProduction.allowed === false &&
    canaryProduction.productionAllowed === false &&
    canaryProduction.effectiveSampleBps === 0,
  "DATA-AI7 must remain fail-closed at 0 bps in Production");

console.log(`DATA-AI10 hosted Preview evidence closure verifier: PASS (${assertions} assertions)`);
