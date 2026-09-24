export const PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE_VERSION =
  "product-query-beta-quality-acceptance-evidence-v1";

export const PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE = Object.freeze({
  evidenceVersion: PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE_VERSION,
  phase: "DATA-AI22",
  scope: "authenticated_production_provider_quality_acceptance",
  closureState: "quality_contract_accepted",
  accepted: true,
  acceptanceDeployment: Object.freeze({
    sha: "626e9f0b9dfc97b99fef3ffac4ef3e0694200830",
    id: "dpl_Av4dZTLs5cm5Au6jRtXKTxaKymzM",
    host: "k-beauty-6fb5hpt8y-johnny-self.vercel.app",
    environment: "production",
    state: "READY"
  }),
  contractVersion: "data-ai22-live-provider-acceptance-v1",
  routeContractVersion: "data-ai22-live-provider-acceptance-route-v1",
  provider: "openai",
  model: "gpt-5.6-luna",
  corpus: Object.freeze({
    batchCount: 6,
    batchSize: 5,
    caseCount: 30,
    runtimeSucceeded: 30,
    intentMatched: 30,
    intentAccuracy: 1,
    paraphraseStablePairs: 15,
    paraphrasePairCount: 15,
    paraphraseStability: 1,
    criticalIntentViolations: 0,
    securityRegressions: 0,
    persistenceRegressions: 0,
    failedCaseIds: Object.freeze([])
  }),
  batches: Object.freeze([
    Object.freeze({ batch: 1, caseCount: 5, passed: 5, capturedAtUtc: "2026-09-24T01:13:42.896Z" }),
    Object.freeze({ batch: 2, caseCount: 5, passed: 5, capturedAtUtc: "2026-09-24T01:13:58.748Z" }),
    Object.freeze({ batch: 3, caseCount: 5, passed: 5, capturedAtUtc: "2026-09-24T01:14:07.510Z" }),
    Object.freeze({ batch: 4, caseCount: 5, passed: 5, capturedAtUtc: "2026-09-24T01:14:16.378Z" }),
    Object.freeze({ batch: 5, caseCount: 5, passed: 5, capturedAtUtc: "2026-09-24T01:14:27.143Z" }),
    Object.freeze({ batch: 6, caseCount: 5, passed: 5, capturedAtUtc: "2026-09-24T01:14:36.794Z" })
  ]),
  residualBoundaries: Object.freeze({
    "DA22-OILY-02": Object.freeze({
      accepted: true,
      skinType: "oily",
      concerns: Object.freeze([]),
      criticalMismatchCount: 0
    }),
    "DA22-CON-01": Object.freeze({
      accepted: true,
      toneUpWanted: null,
      conflictEvidencePreserved: true,
      confidence: "low",
      criticalMismatchCount: 0
    })
  }),
  privacy: Object.freeze({
    fixedSyntheticCorpusOnly: true,
    userQueryAccepted: false,
    rawAccountIdRecorded: false,
    accountHashRecorded: false,
    accessTokenRecorded: false,
    productResultsRecorded: false,
    persisted: false
  }),
  runtimeBoundary: Object.freeze({
    authenticatedOnly: true,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persistence: "none"
  }),
  cleanup: Object.freeze({
    temporaryQualityRouteRemoved: true,
    temporaryLiveServiceRemoved: true,
    closureVerifierRetained: true,
    closureWorkflowRetained: true,
    retiredQualityRouteExpectedStatus: 404
  }),
  acceptedAtUtc: "2026-09-24T01:14:36.794Z"
});
