import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  issueFaceLabSimulationReviewTicket,
  verifyFaceLabSimulationReviewTicket,
  FACE_LAB_SIMULATION_REVIEW_TICKET_VERSION
} from "../lib/face-lab-v2/simulation-review-ticket-core.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
} from "../lib/face-lab-v2/simulation-provider-config.js";

const secret =
  "gate-g-e1-review-ticket-secret";
const analysis = {
  version: "fixture",
  faceShape: "oval"
};
const state = {
  surveyAnswers: {
    target: "soft"
  },
  targetFinderResult: null,
  selectedRouteId: "route:test"
};
const context = {
  renderSpecSha256:
    "a".repeat(64),
  routeId:
    "route:test",
  lookId:
    "look:test",
  simulationVersion:
    "face-lab-ai-simulation-v1",
  instructionVersion:
    "face-lab-simulation-instruction-v1",
  providerConfigVersion:
    FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
  providerConfigFingerprint:
    "c".repeat(64)
};
const nowMs =
  Date.UTC(
    2026,
    9,
    1,
    10,
    0,
    0
  );

const ticket =
  issueFaceLabSimulationReviewTicket({
    secret,
    sourceImageBuffer:
      Buffer.from("source-a"),
    outputImageBuffer:
      Buffer.from("output-a"),
    analysis,
    faceLabV2State:
      state,
    locale: "ko",
    ...context,
    caseId:
      "face-lab-review:fixture-001",
    nowMs,
    ttlMs:
      30 * 60 * 1000
  });

assert.ok(ticket);
assert.equal(
  ticket.version,
  FACE_LAB_SIMULATION_REVIEW_TICKET_VERSION
);
assert.equal(
  ticket.caseId,
  "face-lab-review:fixture-001"
);
assert.match(
  ticket.token,
  /^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/
);

const encodedPayload =
  ticket.token.split(".")[0];
const decodedPayload =
  JSON.parse(
    Buffer.from(
      encodedPayload,
      "base64url"
    ).toString("utf8")
  );

for (const forbidden of [
  "sourceImageSha256",
  "outputImageSha256",
  "analysisSha256",
  "faceLabV2StateSha256",
  "source-a",
  "output-a"
]) {
  assert.equal(
    JSON.stringify(
      decodedPayload
    ).includes(forbidden),
    false,
    "review ticket must not expose raw hash/input material: " +
      forbidden
  );
}

for (const required of [
  "sourceRef",
  "outputRef",
  "analysisRef",
  "stateRef"
]) {
  assert.match(
    decodedPayload[required],
    /^[a-f0-9]{64}$/
  );
}

const verified =
  verifyFaceLabSimulationReviewTicket({
    token:
      ticket.token,
    secret,
    analysis,
    faceLabV2State:
      state,
    locale: "ko",
    ...context,
    nowMs:
      nowMs +
      60 * 1000
  });

assert.equal(
  verified.ok,
  true
);
assert.equal(
  verified.caseId,
  ticket.caseId
);
assert.equal(
  verified.renderSpecSha256,
  context.renderSpecSha256
);
assert.equal(
  verified.providerConfigVersion,
  context.providerConfigVersion
);
assert.equal(
  verified.providerConfigFingerprint,
  context.providerConfigFingerprint
);

const secondOutput =
  issueFaceLabSimulationReviewTicket({
    secret,
    sourceImageBuffer:
      Buffer.from("source-a"),
    outputImageBuffer:
      Buffer.from("output-b"),
    analysis,
    faceLabV2State:
      state,
    locale: "ko",
    ...context,
    caseId:
      "face-lab-review:fixture-002",
    nowMs
  });

const secondPayload =
  JSON.parse(
    Buffer.from(
      secondOutput.token.split(".")[0],
      "base64url"
    ).toString("utf8")
  );

assert.notEqual(
  secondPayload.outputRef,
  decodedPayload.outputRef,
  "different output images must receive different opaque output refs"
);

const tampered =
  ticket.token.slice(0, -1) +
  (ticket.token.endsWith("a")
    ? "b"
    : "a");

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: tampered,
    secret,
    analysis,
    faceLabV2State: state,
    locale: "ko",
    ...context,
    nowMs
  }).code,
  "simulation_review_ticket_invalid"
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: ticket.token,
    secret,
    analysis: {
      ...analysis,
      faceShape: "round"
    },
    faceLabV2State: state,
    locale: "ko",
    ...context,
    nowMs
  }).code,
  "simulation_review_ticket_mismatch"
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: ticket.token,
    secret,
    analysis,
    faceLabV2State: {
      ...state,
      selectedRouteId:
        "route:other"
    },
    locale: "ko",
    ...context,
    nowMs
  }).code,
  "simulation_review_ticket_mismatch"
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: ticket.token,
    secret,
    analysis,
    faceLabV2State: state,
    locale: "ko",
    ...context,
    renderSpecSha256:
      "b".repeat(64),
    nowMs
  }).code,
  "simulation_review_ticket_mismatch"
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: ticket.token,
    secret,
    analysis,
    faceLabV2State: state,
    locale: "ko",
    ...context,
    nowMs:
      nowMs +
      31 * 60 * 1000
  }).code,
  "simulation_review_ticket_expired"
);

const simulationRoute =
  readFileSync(
    "app/api/face-lab-simulation-test/route.js",
    "utf8"
  );
const reviewRoute =
  readFileSync(
    "app/api/face-lab-simulation-review-test/route.js",
    "utf8"
  );

for (const required of [
  "issueFaceLabSimulationReviewTicket",
  '"X-Face-Lab-Review-Case-Id"',
  '"X-Face-Lab-Review-Ticket"',
  '"X-Face-Lab-Review-Expires-At"',
  '"X-Face-Lab-Provider-Config-Version"',
  '"X-Face-Lab-Provider-Config-Fingerprint"'
]) {
  assert.ok(
    simulationRoute.includes(
      required
    ),
    "simulation endpoint missing review ticket surface: " +
      required
  );
}

const providerIndex =
  simulationRoute.indexOf(
    "await generateFaceLabSimulation"
  );
const ticketIndex =
  simulationRoute.indexOf(
    "issueFaceLabSimulationReviewTicket"
  );
const completionIndex =
  simulationRoute.indexOf(
    "await completeAnalysisRequestGuard"
  );

assert.ok(
  providerIndex >= 0 &&
  ticketIndex >
    providerIndex &&
  completionIndex >
    ticketIndex,
  "review ticket must be issued after provider success and before guard completion"
);

for (const forbidden of [
  "generateFaceLabSimulation",
  "resolveOpenAiApiKey",
  "providerPayload",
  "prompt"
]) {
  assert.equal(
    reviewRoute.includes(
      forbidden
    ),
    false,
    "review endpoint must not invoke image generation/provider authority: " +
      forbidden
  );
}

for (const required of [
  "verifyFaceLabSimulationReviewTicket",
  "reconstructFaceLabSimulationRenderAuthority",
  "buildFaceLabSimulationRouteColorReviewTemplate",
  "buildFaceLabSimulationIdentityScopeReview",
  "buildFaceLabSimulationRouteColorReview",
  '"face-reading-test"',
  '"template"',
  '"submit"'
]) {
  assert.ok(
    reviewRoute.includes(
      required
    ),
    "review endpoint missing contract surface: " +
      required
  );
}

const verifyIndex =
  reviewRoute.indexOf(
    "verifyFaceLabSimulationReviewTicket"
  );
const reviewGuardIndex =
  reviewRoute.indexOf(
    "await guardAnalysisRequest"
  );

assert.ok(
  verifyIndex >= 0 &&
  reviewGuardIndex >
    verifyIndex,
  "review ticket must be verified before consuming test guard quota"
);

for (const forbidden of [
  "sourceImageSha256",
  "outputImageSha256",
  "sourceRef:",
  "outputRef:",
  "reviewTicket:"
]) {
  assert.equal(
    reviewRoute.includes(
      forbidden
    ),
    false,
    "review API must not expose ticket-private image references in response JSON: " +
      forbidden
  );
}

assert.ok(
  reviewRoute.includes(
    "createNoStoreHeaders"
  )
);

console.log(
  "FACE_LAB_V2_SIMULATION_REVIEW_AUTHORITY=PASS"
);
