#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DATA_AI21_EVIDENCE_CAPTURE_PHASE_AUTHORIZED,
  DATA_AI21_FIXED_QUERY,
  DATA_AI21_FIXED_QUERY_ID,
  DATA_AI21_REQUIRED_COHORT_SIZE,
  PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CAPTURE as contract,
  evaluateProductQueryAuthenticatedBetaEvidenceCapture
} from "../lib/product-query-authenticated-beta-evidence-capture.mjs";
import {
  hashProductQueryBetaSubject
} from "../lib/product-query-authenticated-beta-runtime.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  DATA_AI21_EVIDENCE_CAPTURE_PHASE_AUTHORIZED === true &&
    DATA_AI21_REQUIRED_COHORT_SIZE === 3,
  "DATA-AI21 must explicitly authorize exactly three-account evidence capture"
);

check(
  contract.phase === "DATA-AI21" &&
    contract.scope === "three_account_limited_beta_runtime_evidence_capture" &&
    contract.state === "pending_live_three_account_acceptance" &&
    JSON.stringify(contract.requiredSlots) === JSON.stringify([1, 2, 3]),
  "DATA-AI21 capture contract must remain pending until all three live slots are observed"
);

check(
  contract.accessBoundary?.authenticatedOnly === true &&
    contract.accessBoundary?.cookieTransportOnly === true &&
    contract.accessBoundary?.runtimeSensitiveAllowlistRequired === true &&
    contract.accessBoundary?.anonymousTraffic === false &&
    contract.accessBoundary?.nonAllowlistedTraffic === false &&
    contract.accessBoundary?.maxApprovedAccounts === 3,
  "DATA-AI21 access boundary must stay cookie-authenticated and three-account bounded"
);

check(
  contract.privacyBoundary?.persistence === "none" &&
    contract.privacyBoundary?.rawAccountIdRecorded === false &&
    contract.privacyBoundary?.accountHashRecorded === false &&
    contract.privacyBoundary?.accessTokenRecorded === false &&
    contract.privacyBoundary?.rawUserQueryRecorded === false &&
    contract.privacyBoundary?.productResultsRecorded === false,
  "DATA-AI21 must not persist or expose account/token/query/result material"
);

const subjects = ["slot-a", "slot-b", "slot-c"];
const hashes = subjects.map(hashProductQueryBetaSubject);
const env = {
  VERCEL_ENV: "production",
  BEJEWELY_PRODUCT_QUERY_BETA_ENABLED: "true",
  BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED: "true",
  BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: hashes.join(","),
  BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE: "false",
  BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING: "false",
  BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER: "false",
  BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE: "none"
};

for (let index = 0; index < subjects.length; index += 1) {
  const policy = evaluateProductQueryAuthenticatedBetaEvidenceCapture({
    envLike: env,
    subject: subjects[index]
  });
  check(
    policy.allowed === true &&
      policy.cohortSlot === index + 1 &&
      policy.requiredCohortSize === 3 &&
      policy.fixedQueryId === DATA_AI21_FIXED_QUERY_ID,
    `fixture slot ${index + 1} must resolve without exposing account material`
  );
}

const unlisted = evaluateProductQueryAuthenticatedBetaEvidenceCapture({
  envLike: env,
  subject: "slot-unlisted"
});
check(
  unlisted.allowed === false && unlisted.cohortSlot === 0,
  "non-allowlisted authenticated users must fail closed"
);

const twoAccountEnv = {
  ...env,
  BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: hashes.slice(0, 2).join(",")
};
check(
  evaluateProductQueryAuthenticatedBetaEvidenceCapture({
    envLike: twoAccountEnv,
    subject: subjects[0]
  }).allowed === false,
  "DATA-AI21 must not claim closure evidence before all three cohort entries are configured"
);

const emergencyEnv = {
  ...env,
  BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE: "true"
};
check(
  evaluateProductQueryAuthenticatedBetaEvidenceCapture({
    envLike: emergencyEnv,
    subject: subjects[0]
  }).allowed === false,
  "emergency disable must close the evidence surface"
);

check(
  typeof DATA_AI21_FIXED_QUERY === "string" &&
    DATA_AI21_FIXED_QUERY.length > 10 &&
    DATA_AI21_FIXED_QUERY.length <= 500,
  "DATA-AI21 fixed natural-language query must remain bounded"
);

const route = readFileSync(
  "app/api/my/product-query-beta/evidence-receipt/route.js",
  "utf8"
);

check(
  route.includes('authContext.transport !== "cookie"') &&
    route.includes("authContext.user?.is_anonymous !== false") &&
    route.includes("evaluateProductQueryAuthenticatedBetaEvidenceCapture"),
  "receipt route must require a permanent cookie-authenticated allowlisted user"
);

check(
  route.includes("executeProductQueryPreview(DATA_AI21_FIXED_QUERY)") &&
    route.includes('result?.contractVersion !== "product-query-preview-v1"') &&
    route.includes("result.results.length > 5") &&
    route.includes("hasForbiddenRuntimeField(result)"),
  "receipt route must execute and validate the fixed natural-language query through the deterministic preview boundary"
);

for (const forbidden of [
  "authContext.user.id,",
  "accountHash:",
  "accessToken:",
  "body.query",
  "request.text()",
  "request.json()"
]) {
  check(!route.includes(forbidden), `receipt route must not expose or accept sensitive/user query material: ${forbidden}`);
}

check(
  route.includes("rawAccountIdReturned: false") &&
    route.includes("accountHashReturned: false") &&
    route.includes("accessTokenReturned: false") &&
    route.includes("rawQueryReturned: false") &&
    route.includes("productResultsReturned: false"),
  "receipt must explicitly attest its privacy boundary"
);

const workflow = readFileSync(
  ".github/workflows/data-ai21-limited-beta-evidence.yml",
  "utf8"
);

check(
  workflow.includes("timeout-minutes: 5") &&
    workflow.includes("timeout-minutes: 7") &&
    workflow.includes("DATA_AI21_PRODUCTION_PREFLIGHT=PASS"),
  "DATA-AI21 CI must stay bounded below the long-CI threshold"
);

check(
  workflow.includes("/api/my/product-query-beta/evidence-receipt") &&
    workflow.includes('test "$status" = "401"') &&
    !workflow.includes("DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN") &&
    !workflow.includes("BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES"),
  "DATA-AI21 Production preflight must prove anonymous closure without materializing cohort identifiers"
);

console.log(
  `DATA-AI21 limited-beta evidence capture verifier: PASS (${assertions} assertions)`
);
