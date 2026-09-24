#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE as evidence,
  PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE_VERSION
} from "../lib/product-query-beta-quality-acceptance-evidence.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  evidence.evidenceVersion === PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE_VERSION &&
    evidence.evidenceVersion === "product-query-beta-quality-acceptance-evidence-v1",
  "DATA-AI22 acceptance evidence version must be frozen"
);

check(
  evidence.phase === "DATA-AI22" &&
    evidence.scope === "authenticated_production_provider_quality_acceptance" &&
    evidence.closureState === "quality_contract_accepted" &&
    evidence.accepted === true,
  "DATA-AI22 must record accepted Production provider quality closure"
);

check(
  /^[a-f0-9]{40}$/.test(evidence.acceptanceDeployment?.sha || "") &&
    evidence.acceptanceDeployment?.sha ===
      "626e9f0b9dfc97b99fef3ffac4ef3e0694200830" &&
    /^dpl_/.test(evidence.acceptanceDeployment?.id || "") &&
    evidence.acceptanceDeployment?.environment === "production" &&
    evidence.acceptanceDeployment?.state === "READY",
  "closure evidence must bind the accepted immutable Production deployment"
);

check(
  evidence.contractVersion === "data-ai22-live-provider-acceptance-v1" &&
    evidence.routeContractVersion === "data-ai22-live-provider-acceptance-route-v1" &&
    evidence.provider === "openai" &&
    evidence.model === "gpt-5.6-luna",
  "closure evidence must bind the accepted provider contracts"
);

const corpus = evidence.corpus || {};
check(
  corpus.batchCount === 6 &&
    corpus.batchSize === 5 &&
    corpus.caseCount === 30 &&
    corpus.runtimeSucceeded === 30 &&
    corpus.intentMatched === 30,
  "closure evidence must freeze the complete 6x5 Production corpus"
);

check(
  corpus.intentAccuracy === 1 &&
    corpus.paraphraseStablePairs === 15 &&
    corpus.paraphrasePairCount === 15 &&
    corpus.paraphraseStability === 1,
  "final intent and paraphrase acceptance must be 100 percent"
);

check(
  corpus.criticalIntentViolations === 0 &&
    corpus.securityRegressions === 0 &&
    corpus.persistenceRegressions === 0 &&
    Array.isArray(corpus.failedCaseIds) &&
    corpus.failedCaseIds.length === 0,
  "final DATA-AI22 gate must contain zero critical, security, persistence, or case failures"
);

const batches = evidence.batches || [];
check(
  batches.length === 6 &&
    JSON.stringify(batches.map((batch) => batch.batch)) ===
      JSON.stringify([1, 2, 3, 4, 5, 6]) &&
    batches.every(
      (batch) =>
        batch.caseCount === 5 &&
        batch.passed === 5 &&
        Number.isFinite(Date.parse(batch.capturedAtUtc))
    ),
  "all six accepted five-case batches must be frozen"
);

check(
  batches.every(
    (batch, index) =>
      index === 0 ||
      Date.parse(batch.capturedAtUtc) > Date.parse(batches[index - 1].capturedAtUtc)
  ),
  "accepted batch timestamps must be strictly ordered"
);

check(
  evidence.residualBoundaries?.["DA22-OILY-02"]?.accepted === true &&
    evidence.residualBoundaries?.["DA22-OILY-02"]?.skinType === "oily" &&
    evidence.residualBoundaries?.["DA22-OILY-02"]?.concerns?.length === 0 &&
    evidence.residualBoundaries?.["DA22-OILY-02"]?.criticalMismatchCount === 0,
  "DA22-OILY-02 residual ownership must be accepted"
);

check(
  evidence.residualBoundaries?.["DA22-CON-01"]?.accepted === true &&
    evidence.residualBoundaries?.["DA22-CON-01"]?.toneUpWanted === null &&
    evidence.residualBoundaries?.["DA22-CON-01"]?.conflictEvidencePreserved === true &&
    evidence.residualBoundaries?.["DA22-CON-01"]?.confidence === "low" &&
    evidence.residualBoundaries?.["DA22-CON-01"]?.criticalMismatchCount === 0,
  "DA22-CON-01 fail-closed conflict semantics must be accepted"
);

check(
  evidence.privacy?.fixedSyntheticCorpusOnly === true &&
    evidence.privacy?.userQueryAccepted === false &&
    evidence.privacy?.rawAccountIdRecorded === false &&
    evidence.privacy?.accountHashRecorded === false &&
    evidence.privacy?.accessTokenRecorded === false &&
    evidence.privacy?.productResultsRecorded === false &&
    evidence.privacy?.persisted === false,
  "frozen evidence must remain non-sensitive and non-persistent"
);

check(
  evidence.runtimeBoundary?.authenticatedOnly === true &&
    evidence.runtimeBoundary?.automaticTrafficSampling === false &&
    evidence.runtimeBoundary?.publicSearchCutover === false &&
    evidence.runtimeBoundary?.persistence === "none",
  "DATA-AI22 closure must not expand runtime authority"
);

for (const path of [
  "app/api/my/product-query-beta/quality-evaluation/route.js",
  "lib/server/product-query-beta-quality-live-service.js"
]) {
  check(!existsSync(path), `temporary DATA-AI22 live surface must be removed: ${path}`);
}

for (const path of [
  "fixtures/data-ai22/product-query-quality-cases.json",
  "scripts/verify-data-ai22-product-query-quality.mjs",
  "scripts/run-data-ai22-product-query-quality-evaluation.mjs"
]) {
  check(existsSync(path), `permanent DATA-AI22 regression asset must remain: ${path}`);
}

check(
  evidence.cleanup?.temporaryQualityRouteRemoved === true &&
    evidence.cleanup?.temporaryLiveServiceRemoved === true &&
    evidence.cleanup?.closureVerifierRetained === true &&
    evidence.cleanup?.closureWorkflowRetained === true &&
    evidence.cleanup?.retiredQualityRouteExpectedStatus === 404,
  "closure evidence must require live-surface retirement and 404 verification"
);

const workflow = readFileSync(
  ".github/workflows/data-ai22-live-provider-acceptance.yml",
  "utf8"
);

check(
  workflow.includes("DATA_AI22_QUALITY_CLOSURE=PASS") &&
    workflow.includes("/api/my/product-query-beta/quality-evaluation?batch=1") &&
    workflow.includes('test "$status" = "404"') &&
    workflow.includes("/api/my/product-query-beta") &&
    workflow.includes('test "$status" = "401"'),
  "Production closure workflow must prove quality-route retirement and anonymous beta closure"
);

for (const forbidden of [
  "DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN",
  "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES",
  "Authorization: Bearer $DATA_AI"
]) {
  check(
    !workflow.includes(forbidden),
    `closure workflow must not materialize sensitive cohort material: ${forbidden}`
  );
}

check(
  Number.isFinite(Date.parse(evidence.acceptedAtUtc)),
  "closure evidence must record an accepted timestamp"
);

console.log(
  `DATA-AI22 Production quality closure verifier: PASS (${assertions} assertions)`
);
