import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildFaceLabSimulationPilotCapture,
  FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-pilot-capture.js";

const CLIENT_PATH = "app/face-lab-test/FaceLabTestClient.jsx";
const SECTION_PATH = "components/full-report/PremiumFaceLabSection.jsx";
const REVIEW_PANEL_PATH = "components/face-lab-test/FaceLabSimulationReviewPanel.jsx";
const REVIEW_ROUTE_PATH = "app/api/face-lab-simulation-review-test/route.js";
const PILOT_CAPTURE_PATH = "lib/face-lab-v2/evaluation/simulation-pilot-capture.js";

const client = (await readFile(CLIENT_PATH, "utf8")).replace(/\r\n/g, "\n");
const section = (await readFile(SECTION_PATH, "utf8")).replace(/\r\n/g, "\n");
const reviewPanel = (await readFile(REVIEW_PANEL_PATH, "utf8")).replace(/\r\n/g, "\n");
const reviewRoute = (await readFile(REVIEW_ROUTE_PATH, "utf8")).replace(/\r\n/g, "\n");
const pilotCaptureSource = (await readFile(PILOT_CAPTURE_PATH, "utf8")).replace(/\r\n/g, "\n");

function requireFragment(source, fragment, label) {
  assert.ok(source.includes(fragment), `${label}: missing required fragment`);
}

const captureCaseId =
  "face-lab-review:pilot-001";
const captureRenderSpecSha256 =
  "a".repeat(64);
const captureProviderFingerprint =
  "b".repeat(64);

const identityScopeReviewFixture = {
  reviewVersion:
    "face-lab-simulation-identity-scope-review-v1",
  status: "ready",
  reason:
    "identity_scope_review_built",
  caseId:
    captureCaseId,
  reviewerRef:
    "operator-01",
  responseDigest:
    "c".repeat(64),
  responses: {
    identity: {
      facial_geometry: "stable"
    },
    editScope: {
      background: "unchanged"
    }
  },
  checks: {
    identity_preservation: {
      status: "pass",
      findings: []
    },
    edit_scope: {
      status: "pass",
      findings: []
    }
  },
  rawImagesIncluded: false,
  reviewTicket:
    "must-not-survive-capture"
};

const routeColorReviewFixture = {
  reviewVersion:
    "face-lab-simulation-route-color-review-v1",
  status: "ready",
  reason:
    "route_color_review_built",
  caseId:
    captureCaseId,
  reviewerRef:
    "operator-01",
  responseDigest:
    "d".repeat(64),
  trace: {
    routeId: "route:test",
    lookId: "look:test",
    renderSpecVersion:
      "face-lab-render-spec-v1",
    renderSpecSha256:
      captureRenderSpecSha256
  },
  responses: {
    routeOperations: {
      "render-operation:test":
        "executed"
    },
    colorTargets: {}
  },
  checks: {
    route_adherence: {
      status: "pass",
      findings: []
    },
    color_fidelity: {
      status:
        "not_applicable",
      findings: []
    }
  },
  rawImagesIncluded: false,
  providerPayload: {
    mustNotSurvive: true
  }
};

const captureInput = {
  caseId:
    captureCaseId,
  locale: "ko",
  analysis: {
    schemaVersion:
      "face-lab-observation-v1",
    status: "available"
  },
  faceLabV2State: {
    surveyAnswers: {
      target: "soft"
    },
    targetFinderResult: null,
    selectedRouteId:
      "route:test"
  },
  responseMeta: {
    simulationVersion:
      "face-lab-ai-simulation-v1",
    instructionVersion:
      "face-lab-simulation-instruction-v1",
    providerConfigVersion:
      "face-lab-simulation-provider-config-v1",
    providerConfigFingerprint:
      captureProviderFingerprint,
    routeId:
      "route:test",
    lookId:
      "look:test",
    renderSpecSha256:
      captureRenderSpecSha256
  },
  identityScopeReview:
    identityScopeReviewFixture,
  routeColorReview:
    routeColorReviewFixture,
  files: {
    sourceImageName:
      "테스트 원본.jpg",
    sourceMimeType:
      "image/jpeg",
    outputImageName:
      "face-lab-review_pilot-001-simulation.png",
    outputMimeType:
      "image/png"
  }
};

const capture =
  buildFaceLabSimulationPilotCapture(
    captureInput
  );

assert.equal(
  capture.status,
  "ready"
);
assert.equal(
  capture.captureVersion,
  FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
);
assert.equal(
  capture.sensitiveLocalOnly,
  true
);
assert.equal(
  capture.responseMeta
    .providerConfigFingerprint,
  captureProviderFingerprint
);
assert.deepEqual(
  capture.files,
  captureInput.files
);

const captureSerialized =
  JSON.stringify(capture);

for (const forbidden of [
  "must-not-survive-capture",
  "mustNotSurvive",
  "sourceImageSha256",
  "outputImageSha256",
  "simulationAuthority",
  '"reviewTicket":',
  "providerPayload",
  "data:image/",
  "sourceImagePath",
  "outputImagePath",
  "apiKey",
  '"prompt":'
]) {
  assert.equal(
    captureSerialized.includes(
      forbidden
    ),
    false,
    "pilot capture retained forbidden material: " +
      forbidden
  );
}

assert.equal(
  buildFaceLabSimulationPilotCapture({
    ...captureInput,
    identityScopeReview: {
      ...identityScopeReviewFixture,
      caseId:
        "face-lab-review:other"
    }
  }).reason,
  "identity_scope_review_invalid"
);

assert.equal(
  buildFaceLabSimulationPilotCapture({
    ...captureInput,
    responseMeta: {
      ...captureInput.responseMeta,
      providerConfigVersion:
        "face-lab-simulation-provider-config-old"
    }
  }).reason,
  "provider_config_version_mismatch"
);

assert.equal(
  buildFaceLabSimulationPilotCapture({
    ...captureInput,
    responseMeta: {
      ...captureInput.responseMeta,
      providerConfigFingerprint:
        "not-a-sha"
    }
  }).reason,
  "provider_config_fingerprint_invalid"
);

assert.equal(
  buildFaceLabSimulationPilotCapture({
    ...captureInput,
    routeColorReview: {
      ...routeColorReviewFixture,
      trace: {
        ...routeColorReviewFixture.trace,
        renderSpecSha256:
          "e".repeat(64)
      }
    }
  }).reason,
  "review_trace_mismatch"
);

assert.equal(
  buildFaceLabSimulationPilotCapture({
    ...captureInput,
    files: {
      ...captureInput.files,
      outputImageName:
        "../simulation.png"
    }
  }).reason,
  "capture_files_invalid"
);

requireFragment(
  reviewRoute,
  "buildFaceLabSimulationPilotCapture",
  "server pilot capture builder"
);
requireFragment(
  reviewRoute,
  "files:\n            body.captureFiles",
  "server capture file metadata"
);
requireFragment(
  reviewRoute,
  "pilotCapture.status !==\n        \"ready\"",
  "server pilot capture fail closed"
);
assert.doesNotMatch(
  reviewRoute,
  /writeFile|appendFile|createWriteStream|generateFaceLabSimulation/,
  "review route must not persist capture artifacts or invoke image generation"
);
assert.doesNotMatch(
  pilotCaptureSource,
  /writeFile|appendFile|createWriteStream|fetch\(|generateFaceLabSimulation/,
  "pilot capture authority must stay pure and provider-free"
);

requireFragment(client, 'const [sourceImageFile, setSourceImageFile] = useState(null);', "source image File retention");
requireFragment(client, 'setSourceImageFile(file);', "source image File capture");
requireFragment(client, 'payload?.simulationAuthority?.token', "signed authority capture");
requireFragment(client, 'fetch("/api/face-lab-simulation-test"', "simulation endpoint");
requireFragment(client, 'formData.append("image", sourceImageFile);', "simulation source image");
requireFragment(client, 'formData.append("locale", "ko");', "simulation locale");
requireFragment(client, 'formData.append("simulationAuthority", simulationAuthority.token);', "simulation authority token");
requireFragment(client, 'formData.append("analysis", JSON.stringify(faceLabAnalysis));', "authoritative observation analysis");
requireFragment(client, 'formData.append("faceLabV2State", JSON.stringify(simulationState));', "Face Lab V2 user state");
requireFragment(client, '"Idempotency-Key": globalThis.crypto.randomUUID()', "idempotency key");
requireFragment(client, 'const blob = await response.blob();', "binary image response");
requireFragment(client, 'URL.createObjectURL(blob)', "binary image object URL");
requireFragment(client, 'URL.revokeObjectURL(current);', "object URL revocation");
requireFragment(client, 'response.headers.get("X-Face-Lab-Route-Id")', "route response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Look-Id")', "look response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Fidelity")', "fidelity response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Review-Case-Id")', "review case response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Review-Ticket")', "review ticket response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Review-Expires-At")', "review expiry response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Provider-Config-Version")', "provider config version metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Provider-Config-Fingerprint")', "provider config fingerprint metadata");
requireFragment(client, 'fetch("/api/face-lab-simulation-review-test"', "review endpoint");
requireFragment(client, 'mode: "template"', "review template mode");
requireFragment(client, 'mode: "submit"', "review submit mode");
requireFragment(client, 'setReviewAuthority(nextReviewAuthority);', "review ticket retention");
requireFragment(client, 'payload?.trace?.renderSpecSha256 !== authority.renderSpecSha256', "review template trace binding");
requireFragment(client, 'payload?.trace?.providerConfigVersion !== authority.providerConfigVersion', "review provider config version binding");
requireFragment(client, 'payload?.trace?.providerConfigFingerprint !== authority.providerConfigFingerprint', "review provider config fingerprint binding");
requireFragment(client, 'payload?.trace?.providerConfigFingerprint !== reviewAuthority.providerConfigFingerprint', "review submit provider config binding");
requireFragment(client, 'simulationImageUrl && reviewAuthority', "review panel output gating");
requireFragment(client, '<FaceLabSimulationReviewPanel', "review panel wiring");
requireFragment(client, 'resetReview();', "review invalidation on simulation reset");
requireFragment(client, 'simulationRequestSequenceRef.current += 1;', "stale simulation invalidation");
requireFragment(client, 'reviewRequestSequenceRef.current += 1;', "stale review invalidation");
requireFragment(client, 'Fidelity는 아직 평가되지 않았습니다.', "unverified fidelity copy");
requireFragment(client, 'simulationState?.selectedRouteId', "committed route gating");
requireFragment(client, 'simulationStatus !== "generating"', "duplicate generation gating");
requireFragment(client, 'const [simulationImageBlob, setSimulationImageBlob] = useState(null);', "simulation blob retention");
requireFragment(client, 'const [simulationCaptureContext, setSimulationCaptureContext] = useState(null);', "generation capture context");
requireFragment(client, 'const [pilotCapture, setPilotCapture] = useState(null);', "pilot capture state");
requireFragment(client, 'setSimulationImageBlob(null);', "simulation blob reset");
requireFragment(client, 'setSimulationCaptureContext(null);', "capture context reset");
requireFragment(client, 'structuredClone(\n            faceLabAnalysis', "generation-time analysis snapshot");
requireFragment(client, 'structuredClone(\n            simulationState', "generation-time state snapshot");
requireFragment(client, 'captureFiles:\n              simulationCaptureContext.files', "review submit capture files");
requireFragment(client, 'payload?.pilotCapture?.status !== "ready"', "pilot capture response validation");
requireFragment(client, 'setPilotCapture(\n          payload.pilotCapture', "pilot capture response retention");
requireFragment(client, 'downloadLocalBlob(\n      simulationImageBlob', "simulation image local save");
requireFragment(client, 'JSON.stringify(\n            pilotCapture', "capture manifest serialization");
requireFragment(client, 'onSaveSimulationImage={saveSimulationImage}', "simulation save callback wiring");
requireFragment(client, 'onSavePilotCapture={savePilotCapture}', "capture save callback wiring");
requireFragment(client, 'captureReady={Boolean(', "capture readiness gating");

assert.doesNotMatch(
  client,
  /formData\.append\("(?:renderSpec|look|appearanceHandoff|providerRuntime|providerPayload|prompt)"/,
  "client must not submit render/provider authority"
);

requireFragment(reviewPanel, 'data-face-lab-simulation-review-panel', "review panel marker");
requireFragment(reviewPanel, '(keys || []).map((key) => [key, null])', "null-default response maps");
requireFragment(reviewPanel, 'const complete =', "review completeness gate");
requireFragment(reviewPanel, 'disabled={!complete || submitStatus === "submitting"}', "review submit gating");
requireFragment(reviewPanel, 'reviewerRef: "operator-01"', "pseudonymous UAT reviewer ref");
requireFragment(reviewPanel, 'identityScopeReview: result.identityScopeReview', "safe identity review export");
requireFragment(reviewPanel, 'routeColorReview: result.routeColorReview', "safe route/color review export");
requireFragment(reviewPanel, 'Review JSON 복사', "review JSON export");
requireFragment(reviewPanel, 'Simulation 이미지 저장', "simulation image save action");
requireFragment(reviewPanel, 'Capture Manifest 저장', "capture manifest save action");
requireFragment(reviewPanel, 'captureReady ? (', "capture action readiness gate");
requireFragment(reviewPanel, 'onSaveSimulationImage', "simulation save callback prop");
requireFragment(reviewPanel, 'onSavePilotCapture', "capture save callback prop");
requireFragment(reviewPanel, '다시 평가', "review reset action");
requireFragment(reviewPanel, '이번 Render Spec에는 별도 색상 평가 대상이 없습니다.', "color N/A state");

assert.doesNotMatch(
  reviewPanel,
  /reviewTicket|simulationAuthority|sourceImageSha256|outputImageSha256|providerPayload|faceLabV2State|\banalysis\b|data:image\//,
  "review panel must not receive or export authority/image/provider material"
);

assert.doesNotMatch(
  reviewPanel,
  /\b(?:score|점수|rating)\b/i,
  "review panel must not introduce numeric scoring"
);

const exportStart = reviewPanel.indexOf("const exportPayload = {");
const exportEnd = reviewPanel.indexOf("navigator.clipboard.writeText", exportStart);
assert.ok(exportStart >= 0 && exportEnd > exportStart, "review export payload boundary missing");
const exportSlice = reviewPanel.slice(exportStart, exportEnd);
for (const forbidden of [
  "token",
  "ticket",
  "image",
  "renderSpecSha256",
  "analysis",
  "faceLabV2State",
  "provider"
]) {
  assert.equal(
    exportSlice.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    "review export leaked forbidden material: " + forbidden
  );
}

requireFragment(section, 'onSimulationStateChange = null', "simulation state callback prop");
requireFragment(section, 'const selectedRouteId = committedRouteIdFromResult(result);', "committed route derivation");
requireFragment(section, 'onSimulationStateChange({', "simulation state emission");
requireFragment(section, 'surveyAnswers,', "survey state emission");
requireFragment(section, 'targetFinderResult: approvedFinder || null,', "finder state emission");
requireFragment(section, 'selectedRouteId', "route state emission");
requireFragment(section, 'emitSimulationState(\n        stored.surveyAnswers,', "restored state emission");
requireFragment(section, 'emitSimulationState(surveyAnswers, approvedFinder, result);', "confirmed state emission");
requireFragment(section, 'clearSimulationState();', "edit invalidation");

assert.doesNotMatch(
  section,
  /onSimulationStateChange\(\{[\s\S]{0,500}(?:renderSpec|appearanceHandoff|providerRuntime|providerPayload|prompt)\s*:/,
  "simulation callback must not expose render/provider authority"
);

console.log("FACE_LAB_V2_SIMULATION_UAT_UI=PASS");
