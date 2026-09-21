import {
  evaluateProductQueryAuthenticatedBetaRuntime,
  hashProductQueryBetaSubject,
  parseApprovedProductQueryBetaAccountHashes
} from "./product-query-authenticated-beta-runtime.mjs";
import {
  DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED,
  DATA_AI20_MAX_APPROVED_ACCOUNTS,
  evaluateProductQueryAuthenticatedBetaControlledActivation
} from "./product-query-authenticated-beta-controlled-activation.mjs";

export const PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CAPTURE_VERSION =
  "product-query-authenticated-beta-evidence-capture-v1";

export const DATA_AI21_EVIDENCE_CAPTURE_PHASE_AUTHORIZED = true;
export const DATA_AI21_REQUIRED_COHORT_SIZE = 3;
export const DATA_AI21_FIXED_QUERY_ID = "sunscreen-oily-no-white-cast-v1";
export const DATA_AI21_FIXED_QUERY =
  "oily skin sunscreen no white cast non sticky";

export function evaluateProductQueryAuthenticatedBetaEvidenceCapture({
  envLike = {},
  subject = null
} = {}) {
  const activation =
    evaluateProductQueryAuthenticatedBetaControlledActivation(envLike);
  const approvedHashes = parseApprovedProductQueryBetaAccountHashes(
    envLike.BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES
  );
  const subjectHash = hashProductQueryBetaSubject(subject);
  const cohortSlot =
    Boolean(subjectHash) && Array.isArray(approvedHashes)
      ? approvedHashes.indexOf(subjectHash) + 1
      : 0;

  const runtime = evaluateProductQueryAuthenticatedBetaRuntime({
    envLike,
    subject,
    phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED
  });

  const allowed =
    DATA_AI21_EVIDENCE_CAPTURE_PHASE_AUTHORIZED === true &&
    activation.allowed === true &&
    activation.maxApprovedAccounts === DATA_AI20_MAX_APPROVED_ACCOUNTS &&
    activation.approvedAccountCount === DATA_AI21_REQUIRED_COHORT_SIZE &&
    runtime.allowed === true &&
    cohortSlot >= 1 &&
    cohortSlot <= DATA_AI21_REQUIRED_COHORT_SIZE;

  return Object.freeze({
    version: PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CAPTURE_VERSION,
    phase: "DATA-AI21",
    allowed,
    cohortSlot: allowed ? cohortSlot : 0,
    requiredCohortSize: DATA_AI21_REQUIRED_COHORT_SIZE,
    authenticatedOnly: true,
    cookieTransportRequired: true,
    fixedQueryId: DATA_AI21_FIXED_QUERY_ID,
    persistence: "none",
    rawAccountIdReturned: false,
    accountHashReturned: false,
    accessTokenPersistence: false,
    rawQueryPersistence: false
  });
}

export const PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CAPTURE = Object.freeze({
  phase: "DATA-AI21",
  scope: "three_account_limited_beta_runtime_evidence_capture",
  state: "pending_live_three_account_acceptance",
  requiredCohortSize: DATA_AI21_REQUIRED_COHORT_SIZE,
  requiredSlots: Object.freeze([1, 2, 3]),
  fixedQueryId: DATA_AI21_FIXED_QUERY_ID,
  liveAcceptance: Object.freeze({
    exactProductionDeploymentRequired: true,
    eachSlotMustReturnReceipt: true,
    expectedReceiptContract:
      "product-query-authenticated-beta-evidence-receipt-v1",
    expectedNestedContract: "product-query-preview-v1",
    maxResults: 5
  }),
  accessBoundary: Object.freeze({
    authenticatedOnly: true,
    cookieTransportOnly: true,
    runtimeSensitiveAllowlistRequired: true,
    anonymousTraffic: false,
    nonAllowlistedTraffic: false,
    maxApprovedAccounts: 3
  }),
  privacyBoundary: Object.freeze({
    persistence: "none",
    rawAccountIdRecorded: false,
    accountHashRecorded: false,
    accessTokenRecorded: false,
    rawUserQueryRecorded: false,
    productResultsRecorded: false
  }),
  closureBoundary: Object.freeze({
    temporaryCaptureRouteMustBeRemoved: true,
    finalEvidenceMustBeNonSensitive: true,
    nextPhaseAfterClosure: "data_ai22_beta_query_quality_evaluation"
  })
});
