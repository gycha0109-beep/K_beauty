#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE as evidence
} from "../lib/product-query-hosted-preview-acceptance-evidence.mjs";
import {
  PRODUCT_QUERY_POST_PREVIEW_READINESS as readiness
} from "../lib/product-query-post-preview-readiness-contract.mjs";

let assertions = 0;

function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  !existsSync(".github/workflows/data-ai9-hosted-preview-acceptance.yml"),
  "retired DATA-AI9 historical evidence workflow must stay absent"
);

check(
  evidence.phase === "DATA-AI9" &&
    evidence.workflowRunId === 35546391008 &&
    evidence.workflowAttempt === 2 &&
    evidence.authenticatedPreviewAccepted === true &&
    evidence.stageCanaryAccepted === true &&
    evidence.secretMaterialRecorded === false,
  "successful DATA-AI9 hosted Preview evidence must remain frozen"
);

check(
  readiness.phase === "DATA-AI10" &&
    readiness.scope === "evidence_closure_only" &&
    readiness.readinessState === "hosted_authenticated_preview_accepted" &&
    readiness.unresolvedRuntimeEvidence.length === 0,
  "DATA-AI10 must remain the authority closing DATA-AI9 hosted Preview evidence"
);

console.log(`DATA-AI9 historical hosted Preview evidence verifier: PASS (${assertions} assertions; workflow retired)`);
