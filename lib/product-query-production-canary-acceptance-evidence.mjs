export const PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE_VERSION =
  "product-query-production-canary-acceptance-evidence-v1";

export const PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE = Object.freeze({
  evidenceVersion: PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE_VERSION,
  phase: "DATA-AI15",
  accepted: true,
  activationSha: "8348adef50944f957cf17df61e2f92b31c1ccdd6",
  workflowRunId: 35588622637,
  workflowJobId: 106297698065,
  deployment: Object.freeze({
    id: "dpl_5gBSLD2iCHYxryadHtbqMqog2fux",
    host: "k-beauty-2a5lw0hhw-johnny-self.vercel.app",
    environment: "production",
    state: "READY"
  }),
  activationWindow: Object.freeze({
    startUtc: "2026-09-21T10:19:00Z",
    endUtc: "2026-09-21T16:19:00Z",
    durationMinutes: 360
  }),
  runtime: Object.freeze({
    authenticatedCredentialMatchedApprovedSubject: true,
    effectiveSampleBps: 1,
    manualOnly: true,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persisted: false,
    responseContract: "product-query-production-canary-v1",
    httpAccepted: true
  }),
  privacy: Object.freeze({
    rawSubjectRecorded: false,
    rawTokenRecorded: false,
    rawQueryPersisted: false
  })
});
