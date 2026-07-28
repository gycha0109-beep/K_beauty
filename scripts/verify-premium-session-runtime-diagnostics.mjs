import assert from "node:assert/strict";
import {
  applyPremiumSessionDiagnosticHeaders,
  classifyPremiumSessionPayload,
  createPremiumSessionDiagnosticContext,
  createPremiumSessionDiagnosticId,
  describePremiumSessionStructure,
  isValidPremiumSessionDiagnosticId,
  logPremiumSessionDiagnosticStage,
  logPremiumSessionValidationFailure,
  PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER,
  PREMIUM_SESSION_DIAGNOSTIC_VERSION_HEADER,
  PREMIUM_SESSION_FINAL_STAGE_HEADER,
  PREMIUM_SESSION_PIPELINE_DIAGNOSTIC_VERSION,
  PREMIUM_SESSION_RUNTIME_COMMIT_HEADER
} from "../lib/premium-session-payload-diagnostics.js";

const COMMIT_SHA = "a".repeat(40);
const diagnosticId = createPremiumSessionDiagnosticId();
assert.equal(isValidPremiumSessionDiagnosticId(diagnosticId), true);
assert.equal(isValidPremiumSessionDiagnosticId("premium-session-diagnostic-invalid"), false);
assert.equal(isValidPremiumSessionDiagnosticId("x".repeat(1000)), false);

function requestWithId(value) {
  return new Request("https://preview.example.test/api/analyze", {
    headers: value
      ? { [PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER]: value }
      : {}
  });
}

const previewContext = createPremiumSessionDiagnosticContext(
  requestWithId(diagnosticId),
  { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: COMMIT_SHA }
);
assert.equal(previewContext.active, true);
assert.equal(previewContext.runtimeCommitSha, COMMIT_SHA);

const productionContext = createPremiumSessionDiagnosticContext(
  requestWithId(diagnosticId),
  { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: COMMIT_SHA }
);
assert.equal(productionContext.active, false);
const invalidContext = createPremiumSessionDiagnosticContext(
  requestWithId("invalid"),
  { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: COMMIT_SHA }
);
assert.equal(invalidContext.active, false);

const secretMarkers = {
  token: "eyJ-secret-token",
  cookie: "kbeauty_premium_report=secret-cookie",
  reportText: "private premium report body",
  imageUrl: "data:image/png;base64,secret-image"
};
const stageInput = {
  decisionBundle: { nested: [{ value: secretMarkers.reportText }] },
  freeResult: { token: secretMarkers.token },
  imageUrl: secretMarkers.imageUrl,
  cookie: secretMarkers.cookie
};
const descriptor = describePremiumSessionStructure(stageInput, [
  "decisionBundle",
  "freeResult"
]);
assert.equal(descriptor.present, true);
assert.equal(descriptor.isRecord, true);
assert.equal(descriptor.requiredKeysPresent, true);
assert.equal(descriptor.decisionBundlePresent, true);
assert.equal(descriptor.freeResultPresent, true);
const descriptorJson = JSON.stringify(descriptor);
Object.values(secretMarkers).forEach((marker) => {
  assert.equal(descriptorJson.includes(marker), false);
});

const cyclic = {};
cyclic.self = cyclic;
assert.equal(describePremiumSessionStructure(cyclic).truncatedMeasurement, true);
let deep = {};
let cursor = deep;
for (let index = 0; index < 30; index += 1) {
  cursor.next = {};
  cursor = cursor.next;
}
assert.equal(describePremiumSessionStructure(deep).truncatedMeasurement, true);
assert.equal(
  describePremiumSessionStructure(Array.from({ length: 70000 }, (_, index) => index))
    .truncatedMeasurement,
  true
);

const captured = [];
const sink = {
  info(...args) {
    captured.push(args);
  },
  warn(...args) {
    captured.push(args);
  }
};
const stageLog = logPremiumSessionDiagnosticStage(
  previewContext,
  "S2_session_source",
  stageInput,
  { requiredKeys: ["decisionBundle", "freeResult"], sink }
);
assert.equal(stageLog.diagnosticVersion, PREMIUM_SESSION_PIPELINE_DIAGNOSTIC_VERSION);
assert.equal(stageLog.diagnosticId, diagnosticId);
assert.equal(stageLog.runtimeCommitSha, COMMIT_SHA);
assert.equal(stageLog.stage, "S2_session_source");
assert.equal(stageLog.present, true);
assert.equal(stageLog.isRecord, true);
assert.equal(captured.length, 1);
const stageLogJson = JSON.stringify(stageLog);
Object.values(secretMarkers).forEach((marker) => {
  assert.equal(stageLogJson.includes(marker), false);
});
assert.equal(
  logPremiumSessionDiagnosticStage(
    productionContext,
    "S2_session_source",
    stageInput,
    { sink }
  ),
  null
);
assert.equal(captured.length, 1);

assert.equal(classifyPremiumSessionPayload(null), "outer_payload_missing");
assert.equal(classifyPremiumSessionPayload("invalid"), "outer_payload_missing");
assert.equal(classifyPremiumSessionPayload({}), "premium_report_missing");
assert.equal(
  classifyPremiumSessionPayload({ premiumReport: [] }),
  "premium_report_not_record"
);
assert.equal(
  classifyPremiumSessionPayload({ premiumReport: {} }),
  "premium_report_empty_record"
);
assert.equal(
  classifyPremiumSessionPayload({ premiumReport: { decisionBundle: {} } }),
  null
);
const validationLog = logPremiumSessionValidationFailure(
  previewContext,
  "premium_report_not_record",
  sink
);
assert.equal(validationLog.validationReason, "premium_report_not_record");
assert.equal(validationLog.diagnosticId, diagnosticId);

const response = new Response(null);
previewContext.finalStage = "S7_session_input";
applyPremiumSessionDiagnosticHeaders(response, previewContext);
assert.equal(
  response.headers.get(PREMIUM_SESSION_DIAGNOSTIC_VERSION_HEADER),
  PREMIUM_SESSION_PIPELINE_DIAGNOSTIC_VERSION
);
assert.equal(
  response.headers.get(PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER),
  diagnosticId
);
assert.equal(
  response.headers.get(PREMIUM_SESSION_RUNTIME_COMMIT_HEADER),
  COMMIT_SHA
);
assert.equal(
  response.headers.get(PREMIUM_SESSION_FINAL_STAGE_HEADER),
  "S7_session_input"
);

const productionResponse = new Response(null);
applyPremiumSessionDiagnosticHeaders(productionResponse, productionContext);
assert.equal(
  productionResponse.headers.has(PREMIUM_SESSION_DIAGNOSTIC_VERSION_HEADER),
  false
);

console.log("premium session runtime diagnostics verification passed");
