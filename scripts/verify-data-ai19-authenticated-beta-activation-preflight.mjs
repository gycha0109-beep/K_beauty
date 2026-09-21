#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED,
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
  "DATA-AI19 historical preflight must not itself authorize Production beta activation"
);

check(
  safety.phase === "DATA-AI19" &&
    safety.scope === "authenticated_limited_beta_activation_preflight_only" &&
    safety.activationAuthorized === false &&
    safety.actualProductionActivationInScope === false,
  "DATA-AI19 historical evidence must remain preflight-only"
);

check(
  safety.accessBoundary?.authenticatedOnly === true &&
    safety.accessBoundary?.explicitServerSideBetaEligibilityRequired === true &&
    safety.accessBoundary?.approvedAccountHashAlgorithm === "sha256" &&
    safety.accessBoundary?.maxInitialApprovedAccounts === 5 &&
    safety.accessBoundary?.anonymousTraffic === false &&
    safety.accessBoundary?.automaticTrafficSampling === false &&
    safety.accessBoundary?.publicSearchCutover === false,
  "DATA-AI19 historical access boundary must remain frozen"
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
  "DATA-AI19 historical preflight must not widen AI or user-context authority"
);

check(
  safety.dataBoundary?.persistence === "none" &&
    safety.dataBoundary?.rawQueryPersistence === false &&
    safety.dataBoundary?.recommendationLogWrite === false &&
    safety.dataBoundary?.productionWrite === false &&
    safety.dataBoundary?.accessTokenPersistence === false &&
    safety.dataBoundary?.rawAccountIdPersistence === false,
  "DATA-AI19 historical preflight must remain non-persistent and write-free"
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
  "DATA-AI19 historical safety evidence must retain approval and rollback requirements"
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
  "valid historical candidate may pass preflight but DATA-AI19 itself must remain unauthorized"
);

const missingApproval =
  evaluateProductQueryAuthenticatedBetaActivationPreflight(candidateEnv);
check(
  missingApproval.preflightReady === false &&
    missingApproval.checks.explicitActivationApproval === false,
  "historical preflight must fail closed without separate activation approval"
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
  "historical preflight must fail closed when emergency disable is active"
);

const tooManyHashes = [
  ...hashes,
  hashProductQueryBetaSubject("data-ai19-test-subject-6")
];
const overCap = evaluateProductQueryAuthenticatedBetaActivationPreflight(
  {
    ...candidateEnv,
    BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES: tooManyHashes.join(",")
  },
  { explicitActivationApproval: true }
);
check(
  overCap.preflightReady === false &&
    overCap.checks.approvedAccountCohort === false,
  "historical DATA-AI19 preflight must preserve its original five-account ceiling"
);

check(
  safety.nextRequiredPhase ===
    "data_ai20_authenticated_limited_beta_controlled_activation" &&
    safety.nextPhaseRequiresExplicitUserApproval === true,
  "DATA-AI19 must preserve the explicit DATA-AI20 approval boundary as historical evidence"
);

console.log(
  `DATA-AI19 historical authenticated beta activation preflight verifier: PASS (${assertions} assertions)`
);
