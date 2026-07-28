import assert from "node:assert/strict";
import {
  applyPremiumSnapshotReplayDiagnosticHeaders,
  createPremiumSnapshotReplayDiagnostic,
  PREMIUM_SNAPSHOT_REPLAY_DIFF_HEADER,
  PREMIUM_SNAPSHOT_REPLAY_DIFF_CONTRACT_HEADER,
  PREMIUM_SNAPSHOT_REPLAY_EXISTING_FINGERPRINT_HEADER,
  PREMIUM_SNAPSHOT_REPLAY_NEXT_FINGERPRINT_HEADER,
  PREMIUM_SNAPSHOT_REPLAY_STATUS_HEADER
} from "../lib/premium-snapshot-replay-diagnostics.js";
import {
  createPremiumSessionDiagnosticId,
  PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER
} from "../lib/premium-session-payload-diagnostics.js";

const diagnosticId = createPremiumSessionDiagnosticId();
const request = new Request("https://preview.example.test/api/full-report", {
  headers: { [PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER]: diagnosticId }
});
const existingFingerprint = "a".repeat(64);
const nextFingerprint = "b".repeat(64);
const existing = {
  decisionBundle: {
    contextHash: "ctx1",
    contextRevision: 1,
    context: { metadata: { source: "full_report_current_products" } }
  },
  currentProducts: null
};
const next = structuredClone(existing);
next.decisionBundle.contextRevision = 2;
const replay = {
  status: "conflict",
  existing: {
    canonical: existing,
    fingerprint: existingFingerprint,
    contextHash: "ctx1",
    contextRevision: 1
  },
  next: {
    canonical: next,
    fingerprint: nextFingerprint,
    contextHash: "ctx1",
    contextRevision: 2
  }
};

const captured = [];
const originalInfo = console.info;
console.info = (...args) => captured.push(args);
let diagnostic;
try {
  diagnostic = createPremiumSnapshotReplayDiagnostic({
    request,
    replay,
    body: { currentProducts: [], privateText: "must-not-appear" },
    locale: "ko",
    currentProductsChanged: true,
    faceLabPersistenceDecision: "preserve",
    sourceStage: "finalized_replay",
    env: { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: "c".repeat(40) }
  });
} finally {
  console.info = originalInfo;
}

assert.equal(diagnostic.active, true);
assert.equal(diagnostic.replayStatus, "conflict");
assert.equal(diagnostic.diffPaths[0], "decisionBundle.contextRevision");
assert.equal(diagnostic.currentProductsInputState, "empty");
assert.equal(captured.length, 1);
const capturedJson = JSON.stringify(captured);
assert.equal(capturedJson.includes("must-not-appear"), false);
assert.equal(capturedJson.includes("decisionBundle.contextRevision"), true);
assert.equal(capturedJson.includes(existingFingerprint), true);
assert.equal(capturedJson.includes(nextFingerprint), true);

const response = new Response(null);
applyPremiumSnapshotReplayDiagnosticHeaders(response, diagnostic);
assert.equal(response.headers.get(PREMIUM_SNAPSHOT_REPLAY_STATUS_HEADER), "conflict");
assert.equal(
  response.headers.get(PREMIUM_SNAPSHOT_REPLAY_DIFF_HEADER),
  "decisionBundle.contextRevision"
);
const diffContract = JSON.parse(
  Buffer.from(
    response.headers.get(PREMIUM_SNAPSHOT_REPLAY_DIFF_CONTRACT_HEADER),
    "base64url"
  ).toString("utf8")
);
assert.equal(diffContract[0].path, "decisionBundle.contextRevision");
assert.equal(diffContract[0].existingType, "number");
assert.equal(diffContract[0].nextType, "number");
assert.match(diffContract[0].existingHash, /^sha256:[0-9a-f]{64}$/);
assert.match(diffContract[0].nextHash, /^sha256:[0-9a-f]{64}$/);
assert.equal(
  response.headers.get(PREMIUM_SNAPSHOT_REPLAY_EXISTING_FINGERPRINT_HEADER),
  existingFingerprint
);
assert.equal(
  response.headers.get(PREMIUM_SNAPSHOT_REPLAY_NEXT_FINGERPRINT_HEADER),
  nextFingerprint
);

const production = createPremiumSnapshotReplayDiagnostic({
  request,
  replay,
  body: { currentProducts: [] },
  locale: "ko",
  currentProductsChanged: true,
  faceLabPersistenceDecision: "preserve",
  sourceStage: "finalized_replay",
  env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: "c".repeat(40) }
});
assert.equal(production.active, false);
const productionResponse = new Response(null);
applyPremiumSnapshotReplayDiagnosticHeaders(productionResponse, production);
assert.equal(productionResponse.headers.has(PREMIUM_SNAPSHOT_REPLAY_STATUS_HEADER), false);
assert.equal(
  productionResponse.headers.has(PREMIUM_SNAPSHOT_REPLAY_DIFF_CONTRACT_HEADER),
  false
);

console.log("premium snapshot replay diagnostics verification passed");
