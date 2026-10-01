import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  FACE_LAB_SIMULATION_AUTHORITY_VERSION,
  issueFaceLabSimulationAuthority,
  verifyFaceLabSimulationAuthority
} from "../lib/face-lab-v2/simulation-authority-core.js";
import {
  issueFaceLabSimulationReviewTicket,
  verifyFaceLabSimulationReviewTicket
} from "../lib/face-lab-v2/simulation-review-ticket-core.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
} from "../lib/face-lab-v2/simulation-provider-config.js";

const secret =
  "test-secret-face-lab-simulation-authority";
const image =
  Buffer.from("canonical-image-fixture");
const analysis = {
  schemaVersion:
    "face-lab-observation-v1",
  status: "available",
  observations: {
    outline: {
      faceShape: {
        status: "available",
        value: "oval"
      }
    }
  }
};

const issued =
  issueFaceLabSimulationAuthority({
    secret,
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_000_000,
    ttlMs: 60_000
  });

assert.ok(issued);
assert.equal(
  issued.version,
  FACE_LAB_SIMULATION_AUTHORITY_VERSION
);
assert.ok(
  typeof issued.token === "string" &&
  issued.token.length < 2048
);

const verified =
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_030_000
  });

assert.equal(verified.ok, true);

const changedAnalysis =
  structuredClone(analysis);
changedAnalysis.observations
  .outline.faceShape.value = "round";

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer: image,
    analysis: changedAnalysis,
    locale: "ko",
    nowMs: 1_030_000
  }).code,
  "simulation_authority_mismatch"
);

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer:
      Buffer.from(
        "different-canonical-image"
      ),
    analysis,
    locale: "ko",
    nowMs: 1_030_000
  }).code,
  "simulation_authority_mismatch"
);

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_061_000
  }).code,
  "simulation_authority_expired"
);

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret: "wrong-secret",
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_030_000
  }).code,
  "simulation_authority_invalid"
);

const reviewState = {
  surveyAnswers: {
    target: "soft"
  },
  targetFinderResult: null,
  selectedRouteId: "route:test"
};
const reviewContext = {
  renderSpecSha256:
    "a".repeat(64),
  routeId: "route:test",
  lookId: "look:test",
  simulationVersion:
    "face-lab-ai-simulation-v1",
  instructionVersion:
    "face-lab-simulation-instruction-v1",
  providerConfigVersion:
    FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
  providerConfigFingerprint:
    "c".repeat(64)
};
const reviewTicket =
  issueFaceLabSimulationReviewTicket({
    secret,
    sourceImageBuffer: image,
    outputImageBuffer:
      Buffer.from("simulation-output-a"),
    analysis,
    faceLabV2State:
      reviewState,
    locale: "ko",
    ...reviewContext,
    caseId:
      "face-lab-review:fixture-001",
    nowMs: 2_000_000,
    ttlMs: 60_000
  });

assert.ok(reviewTicket);
const reviewPayload = JSON.parse(
  Buffer.from(
    reviewTicket.token.split(".")[0],
    "base64url"
  ).toString("utf8")
);
for (const forbidden of [
  "sourceImageSha256",
  "outputImageSha256",
  "analysisSha256",
  "faceLabV2StateSha256"
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      reviewPayload,
      forbidden
    ),
    false
  );
}
assert.match(
  reviewPayload.sourceRef,
  /^[a-f0-9]{64}$/
);
assert.match(
  reviewPayload.outputRef,
  /^[a-f0-9]{64}$/
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: reviewTicket.token,
    secret,
    analysis,
    faceLabV2State:
      reviewState,
    locale: "ko",
    ...reviewContext,
    nowMs: 2_030_000
  }).ok,
  true
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: reviewTicket.token,
    secret,
    analysis: changedAnalysis,
    faceLabV2State:
      reviewState,
    locale: "ko",
    ...reviewContext,
    nowMs: 2_030_000
  }).code,
  "simulation_review_ticket_mismatch"
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: reviewTicket.token,
    secret,
    analysis,
    faceLabV2State: {
      ...reviewState,
      selectedRouteId: "route:other"
    },
    locale: "ko",
    ...reviewContext,
    nowMs: 2_030_000
  }).code,
  "simulation_review_ticket_mismatch"
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: reviewTicket.token,
    secret,
    analysis,
    faceLabV2State:
      reviewState,
    locale: "ko",
    ...reviewContext,
    renderSpecSha256:
      "b".repeat(64),
    nowMs: 2_030_000
  }).code,
  "simulation_review_ticket_mismatch"
);

assert.equal(
  verifyFaceLabSimulationReviewTicket({
    token: reviewTicket.token,
    secret,
    analysis,
    faceLabV2State:
      reviewState,
    locale: "ko",
    ...reviewContext,
    nowMs: 2_061_000
  }).code,
  "simulation_review_ticket_expired"
);

const testRoute = readFileSync(
  "app/api/face-reading-test/route.js",
  "utf8"
);
const readingRoute = readFileSync(
  "app/api/face-reading/route.js",
  "utf8"
);
const simulationRoute = readFileSync(
  "app/api/face-lab-simulation-test/route.js",
  "utf8"
);
const reviewRoute = readFileSync(
  "app/api/face-lab-simulation-review-test/route.js",
  "utf8"
);

execFileSync(
  process.execPath,
  [
    "--check",
    "app/api/face-lab-simulation-review-test/route.js"
  ],
  { stdio: "pipe" }
);

assert.ok(
  testRoute.includes(
    "issueSimulationAuthority: true"
  )
);
assert.ok(
  readingRoute.includes(
    "issueFaceLabSimulationAuthority"
  )
);
assert.ok(
  readingRoute.includes(
    "simulationAuthority"
  )
);

for (const required of [
  'formData.get(\n        "simulationAuthority"\n      )',
  "verifyFaceLabSimulationAuthority",
  "normalizeFaceLabSimulationState",
  "buildFaceLabSimulationCanonical",
  "buildFaceLabSimulationRenderSpec",
  'endpoint:\n          "face-lab-simulation-test"',
  "generateFaceLabSimulation",
  "new NextResponse(",
  '"X-Face-Lab-Render-Spec-SHA256"',
  '"X-Face-Lab-Instruction-Version"',
  '"X-Face-Lab-Fidelity"',
  '"X-Face-Lab-Review-Case-Id"',
  '"X-Face-Lab-Review-Ticket"',
  '"X-Face-Lab-Review-Expires-At"',
  '"X-Face-Lab-Provider-Config-Version"',
  '"X-Face-Lab-Provider-Config-Fingerprint"',
  "issueFaceLabSimulationReviewTicket",
  '"not_evaluated"'
]) {
  assert.ok(
    simulationRoute.includes(required),
    "simulation endpoint contract missing: " +
      required
  );
}

for (const forbidden of [
  'formData.get("renderSpec")',
  'formData.get("look")',
  'formData.get("appearanceHandoff")',
  "providerRuntime:"
]) {
  assert.equal(
    simulationRoute.includes(forbidden),
    false,
    "client/provider authority leaked: " +
      forbidden
  );
}

const authorityIndex =
  simulationRoute.indexOf(
    "verifyFaceLabSimulationAuthority"
  );
const canonicalIndex =
  simulationRoute.indexOf(
    "buildFaceLabSimulationCanonical",
    authorityIndex + 1
  );
const renderIndex =
  simulationRoute.indexOf(
    "buildFaceLabSimulationRenderSpec",
    canonicalIndex + 1
  );
const guardIndex =
  simulationRoute.indexOf(
    "await guardAnalysisRequest",
    renderIndex + 1
  );
const providerIndex =
  simulationRoute.indexOf(
    "await generateFaceLabSimulation",
    guardIndex + 1
  );

assert.ok(authorityIndex >= 0);
assert.ok(canonicalIndex > authorityIndex);
assert.ok(renderIndex > canonicalIndex);
assert.ok(guardIndex > renderIndex);
assert.ok(providerIndex > guardIndex);

const reviewTicketIndex =
  simulationRoute.indexOf(
    "issueFaceLabSimulationReviewTicket",
    providerIndex + 1
  );
const completionIndex =
  simulationRoute.indexOf(
    "await completeAnalysisRequestGuard",
    reviewTicketIndex + 1
  );

assert.ok(
  reviewTicketIndex >
    providerIndex
);
assert.ok(
  completionIndex >
    reviewTicketIndex
);

for (const required of [
  "verifyFaceLabSimulationReviewTicket",
  "reconstructFaceLabSimulationRenderAuthority",
  "buildFaceLabSimulationRouteColorReviewTemplate",
  "buildFaceLabSimulationIdentityScopeReview",
  "buildFaceLabSimulationRouteColorReview",
  'endpoint:\n          "face-reading-test"',
  '"template"',
  '"submit"',
  "createNoStoreHeaders"
]) {
  assert.ok(
    reviewRoute.includes(required),
    "review endpoint contract missing: " +
      required
  );
}

for (const forbidden of [
  "generateFaceLabSimulation",
  "resolveOpenAiApiKey",
  "providerPayload",
  "sourceImageSha256",
  "outputImageSha256"
]) {
  assert.equal(
    reviewRoute.includes(forbidden),
    false,
    "review endpoint authority/privacy boundary leaked: " +
      forbidden
  );
}

const reviewVerifyIndex =
  reviewRoute.indexOf(
    "verifyFaceLabSimulationReviewTicket"
  );
const reviewGuardIndex =
  reviewRoute.indexOf(
    "await guardAnalysisRequest",
    reviewVerifyIndex + 1
  );

assert.ok(
  reviewVerifyIndex >= 0
);
assert.ok(
  reviewGuardIndex >
    reviewVerifyIndex
);

console.log(JSON.stringify({
  ok: true,
  authorityVersion:
    FACE_LAB_SIMULATION_AUTHORITY_VERSION,
  checked: [
    "signed_authority_ticket",
    "analysis_tamper_rejected",
    "image_swap_rejected",
    "expiry_rejected",
    "server_canonical_rebuild",
    "server_render_spec_build",
    "render_spec_trace_digest",
    "guard_before_provider",
    "no_client_render_spec",
    "binary_no_store_output",
    "fidelity_not_evaluated",
    "review_ticket_opaque_refs",
    "review_ticket_tamper_context_rejected",
    "review_ticket_expiry_rejected",
    "review_ticket_after_provider",
    "review_api_no_provider",
    "review_ticket_before_review_guard",
    "provider_config_response_headers",
    "provider_config_review_ticket_binding"
  ]
}, null, 2));
