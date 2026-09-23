#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE as evidence,
  PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE_VERSION
} from "../lib/product-query-authenticated-beta-evidence-closure.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  evidence.evidenceVersion ===
    PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE_VERSION &&
    evidence.evidenceVersion ===
      "product-query-authenticated-beta-evidence-closure-v1",
  "DATA-AI21 closure evidence version must be frozen"
);

check(
  evidence.phase === "DATA-AI21" &&
    evidence.scope ===
      "three_account_limited_beta_runtime_evidence_closure" &&
    evidence.closureState === "three_account_limited_beta_accepted" &&
    evidence.accepted === true,
  "DATA-AI21 must record accepted three-account limited-beta closure"
);

check(
  /^[a-f0-9]{40}$/.test(evidence.productionDeployment?.sha || "") &&
    evidence.productionDeployment?.environment === "production" &&
    evidence.productionDeployment?.state === "READY",
  "closure evidence must bind one READY Production deployment"
);

check(
  evidence.receiptContractVersion ===
    "product-query-authenticated-beta-evidence-receipt-v1" &&
    evidence.nestedContractVersion === "product-query-preview-v1" &&
    evidence.fixedQueryId === "sunscreen-oily-no-white-cast-v1",
  "closure evidence must bind the tested receipt/query contracts"
);

const slots = evidence.acceptedSlots || [];
check(
  slots.length === 3 &&
    JSON.stringify(slots.map((slot) => slot.cohortSlot)) ===
      JSON.stringify([1, 2, 3]),
  "closure evidence must contain exactly cohort slots 1, 2, and 3"
);

check(
  slots.every(
    (slot) =>
      Number.isInteger(slot.resultCount) &&
      slot.resultCount >= 0 &&
      slot.resultCount <= 5 &&
      slot.resultCountWithinBound === true &&
      slot.persisted === false &&
      Number.isFinite(Date.parse(slot.capturedAtUtc))
  ),
  "all three receipts must satisfy result-bound and non-persistence evidence"
);

check(
  slots.every(
    (slot, index) =>
      index === 0 ||
      Date.parse(slot.capturedAtUtc) >
        Date.parse(slots[index - 1].capturedAtUtc)
  ),
  "receipt capture timestamps must be strictly ordered"
);

check(
  evidence.privacy?.rawAccountIdRecorded === false &&
    evidence.privacy?.accountHashRecorded === false &&
    evidence.privacy?.accessTokenRecorded === false &&
    evidence.privacy?.rawQueryRecorded === false &&
    evidence.privacy?.productResultsRecorded === false,
  "final evidence must contain no sensitive identity/token/query/result material"
);

check(
  evidence.runtimeBoundary?.authenticatedOnly === true &&
    evidence.runtimeBoundary?.runtimeSensitiveAllowlist === true &&
    evidence.runtimeBoundary?.automaticTrafficSampling === false &&
    evidence.runtimeBoundary?.publicSearchCutover === false &&
    evidence.runtimeBoundary?.persistence === "none" &&
    evidence.runtimeBoundary?.maxApprovedAccounts === 3,
  "limited-beta runtime boundary must remain unchanged after closure"
);

for (const path of [
  "lib/product-query-authenticated-beta-evidence-capture.mjs",
  "app/api/my/product-query-beta/evidence-receipt/route.js",
  "scripts/verify-data-ai21-limited-beta-evidence.mjs",
  ".github/workflows/data-ai21-limited-beta-evidence.yml"
]) {
  check(!existsSync(path), `temporary DATA-AI21 capture artifact must be removed: ${path}`);
}

check(
  evidence.cleanup?.temporaryReceiptRouteRemoved === true &&
    evidence.cleanup?.temporaryCaptureContractRemoved === true &&
    evidence.cleanup?.temporaryCaptureVerifierRemoved === true &&
    evidence.cleanup?.temporaryCaptureWorkflowRemoved === true &&
    evidence.cleanup?.retiredReceiptRouteExpectedStatus === 404,
  "closure evidence must require complete temporary-surface cleanup"
);

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
check(
  !Object.hasOwn(
    config?.env || {},
    "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES"
  ),
  "approved cohort hashes must remain outside source control"
);

const workflow = readFileSync(
  ".github/workflows/data-ai21-limited-beta-evidence-closure.yml",
  "utf8"
);

check(
  workflow.includes("timeout-minutes: 5") &&
    workflow.includes("timeout-minutes: 7") &&
    workflow.includes("DATA_AI21_EVIDENCE_CLOSURE=PASS"),
  "DATA-AI21 closure CI must remain bounded below the long-CI threshold"
);

check(
  workflow.includes("/api/my/product-query-beta/evidence-receipt") &&
    workflow.includes('test "$status" = "404"') &&
    workflow.includes("/api/my/product-query-beta") &&
    workflow.includes('test "$status" = "401"'),
  "Production closure must prove receipt retirement and anonymous beta closure"
);

for (const forbidden of [
  "DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN",
  "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES",
  "Authorization: Bearer $DATA_AI",
  "accountHash",
  "rawAccountId",
  "accessToken"
]) {
  check(
    !workflow.includes(forbidden),
    `closure workflow must not materialize sensitive cohort material: ${forbidden}`
  );
}

check(
  evidence.nextRequiredPhase ===
    "data_ai22_beta_query_quality_evaluation",
  "DATA-AI21 closure must hand off only to DATA-AI22 quality evaluation"
);

console.log(
  `DATA-AI21 limited-beta evidence closure verifier: PASS (${assertions} assertions)`
);
