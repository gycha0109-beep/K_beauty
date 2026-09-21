#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const workflow = readFileSync(
  ".github/workflows/data-ai9-hosted-preview-acceptance.yml",
  "utf8"
);

check(
  workflow.includes("workflow_dispatch:") &&
    !workflow.includes("\n  push:") &&
    !workflow.includes("\n  pull_request:") &&
    !workflow.includes("\n  schedule:"),
  "DATA-AI9 historical evidence workflow must remain manual-only"
);

check(
  workflow.includes("permissions:\n  contents: read") &&
    !workflow.includes("deployments: read") &&
    !workflow.includes("id-token: write"),
  "DATA-AI9 historical evidence workflow must require contents-read-only permission"
);

for (const forbidden of [
  "DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN",
  "Authorization: Bearer",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "x-vercel-trusted-oidc-idp-token",
  "deployment_url",
  "/api/my/product-query-preview",
  "/api/my/product-query-stage-canary",
  "VERCEL_TOKEN",
  "SUPABASE_SERVICE_ROLE"
]) {
  check(!workflow.includes(forbidden), `historical DATA-AI9 must not retain live runtime capability: ${forbidden}`);
}

check(
  workflow.includes("timeout-minutes: 5") &&
    workflow.includes("verify-data-ai9-hosted-preview-acceptance.mjs") &&
    workflow.includes(
      "DATA_AI9_HOSTED_PREVIEW_ACCEPTANCE=HISTORICAL_EVIDENCE_FROZEN_BY_DATA_AI10"
    ),
  "DATA-AI9 workflow must verify and report frozen evidence only"
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

console.log(`DATA-AI9 historical hosted Preview evidence verifier: PASS (${assertions} assertions)`);
