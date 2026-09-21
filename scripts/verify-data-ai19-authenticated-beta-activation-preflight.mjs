#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED,
  evaluateProductQueryAuthenticatedBetaStaticGate,
  hashProductQueryBetaSubject
} from "../lib/product-query-authenticated-beta-runtime.mjs";
import {
  DATA_AI19_BETA_ACTIVATION_AUTHORIZED,
  DATA_AI19_INITIAL_BETA_MAX_APPROVED_ACCOUNTS,
  PRODUCT_QUERY_AUTHENTICATED_BETA_ACTIVATION_SAFETY as safety,
  evaluateProductQueryAuthenticatedBetaActivationPreflight
} from "../lib/product-query-authenticated-beta-activation-preflight.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED === false &&
    DATA_AI19_BETA_ACTIVATION_AUTHORIZED === false,
  "DATA-AI19 must not authorize Production beta activation"
);

check(
  safety.phase === "DATA-AI19" &&
    safety.scope === "authenticated_limited_beta_activation_preflight_only" &&
    safety.activationAuthorized === false &&
    safety.actualProductionActivationInScope === false,
  "DATA-AI19 must remain preflight-only"
);

check(
  safety.accessBoundary?.authenticatedOnly === true &&
    safety.accessBoundary?.explicitServerSideBetaEligibilityRequired === true &&
    safety.accessBoundary?.approvedAccountHashAlgorithm === "sha256" &&
    safety.accessBoundary?.maxInitialApprovedAccounts === 5 &&
    safety.accessBoundary?.anonymousTraffic === false &&
    safety.accessBoundary?.automaticTrafficSampling === false &&
    safety.accessBoundary?.publicSearchCutover === false,
  "initial beta access boundary must remain explicit and tightly bounded"
);

check(
  safety.authorityBoundary?.providerRole === "intent_parsing_only" &&
    safety.authorityBoundary?.providerProductSelection === false &&
    safety.authorityBoundary?.providerRankingAuthority === false &&
    safety.authorityBoundary?.deterministicRankingAuthority ===
      "existing_recommendation_engine" &&
    safety.authorityBoundary?.queryProvenance === "query_only" &&
    safety.authorityBoundary?.profileMerge === false &&
    safety.authorityBoundary?.savedProfileRead === false &&
    safety.authorityBoundary?.historyRead === false,
  "activation preflight must not widen AI or user-context authority"
);

check(
  safety.dataBoundary?.persistence === "none" &&
    safety.dataBoundary?.rawQueryPersistence === false &&
    safety.dataBoundary?.recommendationLogWrite === false &&
    safety.dataBoundary?.productionWrite === false &&
    safety.dataBoundary?.accessTokenPersistence === false &&
    safety.dataBoundary?.rawAccountIdPersistence === false,
  "activation preflight must remain non-persistent and write-free"
);

check(
  safety.safetyBoundary?.explicitSeparateActivationApprovalRequired === true &&
    safety.safetyBoundary?.emergencyDisableRequired === true &&
    safety.safetyBoundary?.failClosedOnMissingApproval === true &&
    safety.safetyBoundary?.failClosedOnInvalidAllowlist === true &&
    safety.safetyBoundary?.failClosedOnEmergencyDisable === true &&
    safety.safetyBoundary?.rollbackProcedure?.includes(
      "verify_deployed_beta_route_404"
    ),
  "activation must have explicit approval, emergency disable, and rollback proof"
);

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const env = config?.env || {};
const betaActivationKeys = [
  "BEJEWELY_PRODUCT_QUERY_BETA_ENABLED",
  "BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED",
  "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES",
  "BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE",
  "BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING",
  "BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER",
  "BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE"
];
check(
  betaActivationKeys.every((key) => !Object.hasOwn(env, key)),
  "DATA-AI19 must not check in a Production beta activation manifest"
);

const currentGate = evaluateProductQueryAuthenticatedBetaStaticGate({
  VERCEL_ENV: "production",
  ...env
});
check(
  currentGate.staticAllowed === false &&
    currentGate.phaseRuntimeAuthorized === false,
  "current Production beta runtime must remain default-off"
);

const hashes = Array.from(
  { length: DATA_AI19_INITIAL_BETA_MAX_APPROVED_ACCOUNTS },
  (_, index) => hashProductQueryBetaSubject(`data-ai19-test-subject-${index + 1}`)
);
const candidateEnv = {
  VERCEL_ENV: "production",
  BEJEWELY_PRODUCT_QUERY_BETA_ENABLED: "true",
  BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED: "true",
  BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: hashes.join(","),
  BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE: "false",
  BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING: "false",
  BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER: "false",
  BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE: "none"
};

const approved = evaluateProductQueryAuthenticatedBetaActivationPreflight(
  candidateEnv,
  { explicitActivationApproval: true }
);
check(
  approved.preflightReady === true &&
    approved.activationAuthorized === false &&
    approved.approvedAccountCount === 5,
  "valid future candidate may pass preflight but DATA-AI19 still must not authorize activation"
);

const missingApproval =
  evaluateProductQueryAuthenticatedBetaActivationPreflight(candidateEnv);
check(
  missingApproval.preflightReady === false &&
    missingApproval.checks.explicitActivationApproval === false,
  "missing separate activation approval must fail closed"
);

const emergencyDisabled =
  evaluateProductQueryAuthenticatedBetaActivationPreflight(
    {
      ...candidateEnv,
      BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE: "true"
    },
    { explicitActivationApproval: true }
  );
check(
  emergencyDisabled.preflightReady === false &&
    emergencyDisabled.checks.emergencyDisableClear === false,
  "emergency disable must block activation preflight"
);

const tooManyHashes = [
  ...hashes,
  hashProductQueryBetaSubject("data-ai19-test-subject-6")
];
const oversized =
  evaluateProductQueryAuthenticatedBetaActivationPreflight(
    {
      ...candidateEnv,
      BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES:
        tooManyHashes.join(",")
    },
    { explicitActivationApproval: true }
  );
check(
  oversized.preflightReady === false &&
    oversized.approvedAccountCount === 6 &&
    oversized.checks.approvedAccountCohort === false,
  "initial approved beta cohort must be capped at five accounts"
);

check(
  safety.nextRequiredPhase ===
      "data_ai20_authenticated_limited_beta_controlled_activation" &&
    safety.nextPhaseRequiresExplicitUserApproval === true,
  "actual Production beta activation must remain a separate explicitly approved phase"
);

console.log(
  `DATA-AI19 authenticated beta activation preflight verifier: PASS (${assertions} assertions)`
);
