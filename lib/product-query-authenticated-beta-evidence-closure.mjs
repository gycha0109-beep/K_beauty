export const PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE_VERSION =
  "product-query-authenticated-beta-evidence-closure-v1";

export const PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE = Object.freeze({
  evidenceVersion: PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE_VERSION,
  phase: "DATA-AI21",
  scope: "three_account_limited_beta_runtime_evidence_closure",
  closureState: "three_account_limited_beta_accepted",
  accepted: true,
  productionDeployment: Object.freeze({
    sha: "0c804b60d02a130fa31d40c913fdbe50470682d1",
    id: "dpl_64DNpspqUR9YnT7Xxjyh6ovcnTzN",
    host: "k-beauty-68fhpkqv2-johnny-self.vercel.app",
    environment: "production",
    state: "READY"
  }),
  receiptContractVersion:
    "product-query-authenticated-beta-evidence-receipt-v1",
  nestedContractVersion: "product-query-preview-v1",
  fixedQueryId: "sunscreen-oily-no-white-cast-v1",
  acceptedSlots: Object.freeze([
    Object.freeze({
      cohortSlot: 1,
      resultCount: 5,
      resultCountWithinBound: true,
      persisted: false,
      capturedAtUtc: "2026-09-21T19:41:38.724Z"
    }),
    Object.freeze({
      cohortSlot: 2,
      resultCount: 5,
      resultCountWithinBound: true,
      persisted: false,
      capturedAtUtc: "2026-09-21T19:46:52.169Z"
    }),
    Object.freeze({
      cohortSlot: 3,
      resultCount: 5,
      resultCountWithinBound: true,
      persisted: false,
      capturedAtUtc: "2026-09-21T20:04:40.500Z"
    })
  ]),
  privacy: Object.freeze({
    rawAccountIdRecorded: false,
    accountHashRecorded: false,
    accessTokenRecorded: false,
    rawQueryRecorded: false,
    productResultsRecorded: false
  }),
  runtimeBoundary: Object.freeze({
    authenticatedOnly: true,
    runtimeSensitiveAllowlist: true,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persistence: "none",
    maxApprovedAccounts: 3
  }),
  cleanup: Object.freeze({
    temporaryReceiptRouteRemoved: true,
    temporaryCaptureContractRemoved: true,
    temporaryCaptureVerifierRemoved: true,
    temporaryCaptureWorkflowRemoved: true,
    retiredReceiptRouteExpectedStatus: 404
  }),
  nextRequiredPhase: "data_ai22_beta_query_quality_evaluation"
});
