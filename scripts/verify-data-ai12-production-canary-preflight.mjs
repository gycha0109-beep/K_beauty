#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateProductQueryProductionCanaryPreflight,
  PRODUCT_QUERY_PRODUCTION_CANARY_MAX_ACCOUNT_HASHES,
  PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES,
  PRODUCT_QUERY_PRODUCTION_CANARY_PREFLIGHT_LIMITS
} from "../lib/product-query-production-canary-preflight.mjs";
import { PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY } from "../lib/product-query-production-activation-safety-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY.readinessState ===
    "production_activation_safety_contract_ready" &&
    PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY.activationDecision === "not_authorized" &&
    PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY.effectiveSampleBps === 0,
  "DATA-AI12 must build on DATA-AI11 while Production remains unauthorized at 0 bps");

const empty = evaluateProductQueryProductionCanaryPreflight({});
check(empty.preflightReady === false &&
    empty.activationAllowed === false &&
    empty.effectiveSampleBps === 0 &&
    empty.operationalState === "hold_operational_inputs_pending",
  "missing operational inputs must hold at 0 bps");
for (const blocker of [
  "approved_initial_sample_bps_missing_or_invalid",
  "approved_account_hashes_missing_or_invalid",
  "activation_window_missing_or_invalid",
  "production_environment_mutation_not_authorized"
]) {
  check(empty.blockers.includes(blocker), `missing blocker: ${blocker}`);
}

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const validInputs = {
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS: "1",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES: `${hashA},${hashB}`,
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC: "2026-09-21T03:00:00Z",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC: "2026-09-21T03:30:00Z",
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED: "true"
};
const valid = evaluateProductQueryProductionCanaryPreflight(validInputs);
check(valid.preflightReady === true &&
    valid.approvedSampleBps === 1 &&
    valid.approvedAccountHashCount === 2 &&
    valid.windowValid === true &&
    valid.environmentMutationAuthorized === true,
  "prospective valid operational inputs must be recognizable");
check(valid.activationAllowed === false &&
    valid.effectiveSampleBps === 0 &&
    valid.operationalState === "inputs_validated_activation_still_not_authorized",
  "even validated DATA-AI12 preflight inputs must not activate traffic");

for (const invalidSample of ["", "0", "101", "-1", "1.5", "abc"]) {
  const result = evaluateProductQueryProductionCanaryPreflight({
    ...validInputs,
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS: invalidSample
  });
  check(result.preflightReady === false &&
      result.approvedSampleBps === 0 &&
      result.effectiveSampleBps === 0 &&
      result.blockers.includes("approved_initial_sample_bps_missing_or_invalid"),
    `invalid approved sample must fail closed: ${JSON.stringify(invalidSample)}`);
}

for (const invalidHashes of [
  "raw-user-id",
  "A".repeat(64),
  `${hashA},${hashA}`,
  `${hashA},${hashB},${"c".repeat(64)},${"d".repeat(64)}`
]) {
  const result = evaluateProductQueryProductionCanaryPreflight({
    ...validInputs,
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES: invalidHashes
  });
  check(result.preflightReady === false &&
      result.approvedAccountHashCount === 0 &&
      result.rawAccountIdsAccepted === false &&
      result.blockers.includes("approved_account_hashes_missing_or_invalid"),
    "invalid/raw/duplicate/unbounded account cohort must fail closed");
}

for (const invalidWindow of [
  {
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC: "2026-09-21T03:00:00+09:00",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC: "2026-09-21T03:30:00Z"
  },
  {
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC: "2026-09-21T03:30:00Z",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC: "2026-09-21T03:00:00Z"
  },
  {
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC: "2026-09-21T03:00:00Z",
    BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC: "2026-09-21T04:00:01Z"
  }
]) {
  const result = evaluateProductQueryProductionCanaryPreflight({
    ...validInputs,
    ...invalidWindow
  });
  check(result.preflightReady === false &&
      result.windowValid === false &&
      result.blockers.includes("activation_window_missing_or_invalid"),
    "malformed/reversed/overlong activation window must fail closed");
}

const noMutationApproval = evaluateProductQueryProductionCanaryPreflight({
  ...validInputs,
  BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED: "false"
});
check(noMutationApproval.preflightReady === false &&
    noMutationApproval.environmentMutationAuthorized === false &&
    noMutationApproval.blockers.includes("production_environment_mutation_not_authorized"),
  "Production environment mutation must require explicit authorization");

const limits = PRODUCT_QUERY_PRODUCTION_CANARY_PREFLIGHT_LIMITS;
check(limits.preflightOnly === true &&
    limits.activationAllowed === false &&
    limits.effectiveSampleBps === 0 &&
    limits.routeWiring === false &&
    limits.productionEnvironmentMutation === false,
  "DATA-AI12 preflight must remain non-activating and unwired");
check(limits.minimumApprovedSampleBps === 1 &&
    limits.maximumApprovedSampleBps === 100 &&
    limits.maximumApprovedAccountHashes === PRODUCT_QUERY_PRODUCTION_CANARY_MAX_ACCOUNT_HASHES &&
    PRODUCT_QUERY_PRODUCTION_CANARY_MAX_ACCOUNT_HASHES === 3,
  "DATA-AI12 input bounds must be explicit");
check(limits.accountHashFormat === "lowercase_sha256_hex" &&
    limits.rawAccountIdsProhibited === true &&
    limits.maximumActivationWindowMinutes === PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES &&
    PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES === 60,
  "cohort privacy and activation-window bounds must be explicit");
check(limits.publicSearchCutover === false &&
    limits.automaticTrafficSampling === false &&
    limits.persistence === "none" &&
    limits.releaseGateImplemented === false,
  "DATA-AI12 preflight must not create public traffic, persistence, or a release gate");

const previewRoute = readFileSync("app/api/my/product-query-preview/route.js", "utf8");
const stageRoute = readFileSync("app/api/my/product-query-stage-canary/route.js", "utf8");
check(!previewRoute.includes("product-query-production-canary-preflight") &&
    !stageRoute.includes("product-query-production-canary-preflight"),
  "DATA-AI12 preflight must not be wired into existing runtime routes");

console.log(`DATA-AI12 Production canary preflight verifier: PASS (${assertions} assertions)`);
