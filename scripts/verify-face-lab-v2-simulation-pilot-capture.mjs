import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFaceLabSimulationPilotCapture,
  FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-pilot-capture.js";

const caseId =
  "pilot-case-001";

const identityScopeReview = {
  status: "ready",
  caseId,
  reviewVersion:
    "face-lab-simulation-identity-scope-review-v1",
  responseDigest:
    "a".repeat(64),
  checks: {
    identity_preservation: {
      status: "pass"
    },
    edit_scope: {
      status: "pass"
    }
  }
};

const routeColorReview = {
  status: "ready",
  caseId,
  reviewVersion:
    "face-lab-simulation-route-color-review-v1",
  responseDigest:
    "b".repeat(64),
  checks: {
    route_adherence: {
      status: "pass"
    },
    color_fidelity: {
      status: "pass"
    }
  }
};

const input = {
  caseId,
  locale: "ko",
  sourceMimeType:
    "image/jpeg",
  outputMimeType:
    "image/png",
  analysis: {
    analysisVersion:
      "fixture-analysis"
  },
  faceLabV2State: {
    selectedRouteId:
      "route-001",
    targetStyle: {
      status: "available"
    }
  },
  responseMeta: {
    reviewCaseId:
      caseId,
    simulationVersion:
      "face-lab-ai-simulation-v1",
    instructionVersion:
      "face-lab-simulation-instruction-v1",
    providerConfigVersion:
      "face-lab-simulation-provider-config-v1",
    providerConfigFingerprint:
      "c".repeat(64),
    routeId:
      "route-001",
    lookId:
      "look-001",
    renderSpecSha256:
      "d".repeat(64)
  },
  identityScopeReview,
  routeColorReview
};

const capture =
  buildFaceLabSimulationPilotCapture(
    input
  );

assert.equal(
  capture.status,
  "ready"
);
assert.equal(
  capture.captureVersion,
  FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
);
assert.deepEqual(
  capture.fileNames,
  {
    sourceImage:
      "pilot-case-001.source.jpg",
    outputImage:
      "pilot-case-001.output.png",
    identityScopeReview:
      "pilot-case-001.identity-scope.review.json",
    routeColorReview:
      "pilot-case-001.route-color.review.json",
    manifest:
      "pilot-case-001.evidence-input.json"
  }
);
assert.equal(
  capture.manifest.sourceImagePath,
  "./pilot-case-001.source.jpg"
);
assert.equal(
  capture.manifest.outputImagePath,
  "./pilot-case-001.output.png"
);
assert.deepEqual(
  capture.manifest
    .checkEvidencePaths,
  [
    "./pilot-case-001.identity-scope.review.json",
    "./pilot-case-001.route-color.review.json"
  ]
);
assert.deepEqual(
  capture.manifest.responseMeta,
  {
    simulationVersion:
      input.responseMeta
        .simulationVersion,
    instructionVersion:
      input.responseMeta
        .instructionVersion,
    providerConfigVersion:
      input.responseMeta
        .providerConfigVersion,
    providerConfigFingerprint:
      input.responseMeta
        .providerConfigFingerprint,
    routeId:
      input.responseMeta.routeId,
    lookId:
      input.responseMeta.lookId,
    renderSpecSha256:
      input.responseMeta
        .renderSpecSha256
  }
);

const serialized =
  JSON.stringify(capture);

for (const forbidden of [
  "reviewTicket",
  "simulationAuthority",
  "sourceImageBytes",
  "outputImageBytes",
  "data:image",
  "../",
  "\\private\\"
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    "pilot capture descriptor leaked forbidden material: " +
      forbidden
  );
}

const routeMismatch =
  buildFaceLabSimulationPilotCapture({
    ...input,
    faceLabV2State: {
      ...input.faceLabV2State,
      selectedRouteId:
        "route-other"
    }
  });

assert.equal(
  routeMismatch.status,
  "invalid"
);
assert.equal(
  routeMismatch.reason,
  "pilot_capture_route_binding_mismatch"
);

const caseBindingMismatch =
  buildFaceLabSimulationPilotCapture({
    ...input,
    responseMeta: {
      ...input.responseMeta,
      reviewCaseId:
        "pilot-case-other"
    }
  });

assert.equal(
  caseBindingMismatch.status,
  "invalid"
);
assert.equal(
  caseBindingMismatch.reason,
  "pilot_capture_case_binding_mismatch"
);

const reviewMismatch =
  buildFaceLabSimulationPilotCapture({
    ...input,
    routeColorReview: {
      ...routeColorReview,
      caseId:
        "pilot-case-other"
    }
  });

assert.equal(
  reviewMismatch.status,
  "invalid"
);
assert.equal(
  reviewMismatch.reason,
  "pilot_capture_review_invalid"
);

const badFingerprint =
  buildFaceLabSimulationPilotCapture({
    ...input,
    responseMeta: {
      ...input.responseMeta,
      providerConfigFingerprint:
        "not-a-sha"
    }
  });

assert.equal(
  badFingerprint.status,
  "invalid"
);
assert.equal(
  badFingerprint.reason,
  "pilot_capture_response_meta_invalid"
);

const unsafeCaseId =
  buildFaceLabSimulationPilotCapture({
    ...input,
    caseId:
      "../pilot-case"
  });

assert.equal(
  unsafeCaseId.status,
  "invalid"
);
assert.equal(
  unsafeCaseId.reason,
  "pilot_capture_case_id_invalid"
);

const clientSource =
  readFileSync(
    "app/face-lab-test/FaceLabTestClient.jsx",
    "utf8"
  );

for (const required of [
  "buildFaceLabSimulationPilotCapture",
  "setSimulationImageBlob(blob);",
  "window.showDirectoryPicker",
  'directory.name !== "private"',
  "capture.fileNames.sourceImage",
  "capture.fileNames.outputImage",
  "capture.fileNames.identityScopeReview",
  "capture.fileNames.routeColorReview",
  "capture.fileNames.manifest",
  "data-face-lab-pilot-capture"
]) {
  assert.ok(
    clientSource.includes(required),
    "missing pilot capture UI contract fragment: " +
      required
  );
}

const evidenceRunnerSource =
  readFileSync(
    "scripts/build-face-lab-v2-simulation-evidence-packet.mjs",
    "utf8"
  );

for (const required of [
  "input.sourceImagePath",
  "input.outputImagePath",
  "input.responseMeta",
  "input.checkEvidencePaths"
]) {
  assert.ok(
    evidenceRunnerSource.includes(
      required
    ),
    "G-B evidence runner no longer accepts capture manifest field: " +
      required
  );
}

console.log(
  "FACE_LAB_V2_SIMULATION_PILOT_CAPTURE=PASS"
);
