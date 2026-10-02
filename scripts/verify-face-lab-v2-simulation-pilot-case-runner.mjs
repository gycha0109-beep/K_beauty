import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFaceLabV2Canonical
} from "../lib/face-lab-v2/canonical-composer.js";
import {
  reconstructFaceLabSimulationRenderAuthority
} from "../lib/face-lab-v2/simulation-render-authority.js";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../lib/face-lab-v2/simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "../lib/face-lab-v2/simulation-instructions.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
} from "../lib/face-lab-v2/simulation-provider-config.js";
import {
  buildFaceLabSimulationIdentityScopeReview
} from "../lib/face-lab-v2/evaluation/simulation-identity-scope-review.js";
import {
  buildFaceLabSimulationRouteColorReview,
  buildFaceLabSimulationRouteColorReviewTemplate
} from "../lib/face-lab-v2/evaluation/simulation-route-color-review.js";
import {
  buildFaceLabSimulationPilotCaseArtifacts,
  FACE_LAB_SIMULATION_PILOT_CASE_RUNNER_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-pilot-case-runner.js";
import {
  FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-pilot-capture.js";
import {
  buildFaceLabV2CoverageCohort
} from "../lib/face-lab-v2/evaluation/harness.js";

function identityStable() {
  return {
    facial_geometry: "stable",
    eye_anatomy: "stable",
    nose_geometry: "stable",
    jaw_chin_geometry:
      "stable",
    ear_geometry: "stable"
  };
}

function editScopeStable() {
  return {
    face_structure:
      "unchanged",
    background:
      "unchanged",
    clothing:
      "unchanged",
    body:
      "unchanged",
    head_pose:
      "unchanged",
    camera_perspective:
      "unchanged",
    expression:
      "unchanged",
    lighting_direction:
      "unchanged",
    unrequested_beautification:
      "unchanged"
  };
}

function responseMap(
  targets,
  value
) {
  return Object.fromEntries(
    targets.map(
      (target) => [
        target.operationId,
        value
      ]
    )
  );
}

function findFixture() {
  const cohort =
    buildFaceLabV2CoverageCohort({
      caseCount: 32
    });

  for (
    const item of
    cohort.cases
  ) {
    const preview =
      buildFaceLabV2Canonical({
        analysis:
          item.analysis,
        surveyAnswers:
          item.surveyAnswers,
        targetFinderResult:
          null,
        selectedRouteId:
          null,
        locale: "ko"
      });

    for (
      const route of
      preview?.routes?.routes || []
    ) {
      const rawState = {
        surveyAnswers:
          item.surveyAnswers,
        targetFinderResult:
          null,
        selectedRouteId:
          route.routeId
      };
      const reconstructed =
        reconstructFaceLabSimulationRenderAuthority({
          analysis:
            item.analysis,
          rawState,
          locale: "ko"
        });

      if (
        reconstructed.status ===
          "ready" &&
        reconstructed.renderSpec
          .operations.length >= 1
      ) {
        return {
          item,
          rawState,
          reconstructed
        };
      }
    }
  }

  throw new Error(
    "no pilot-case fixture available"
  );
}

const fixture =
  findFixture();
const caseId =
  "PILOT-CASE-001";

const identityScopeReview =
  buildFaceLabSimulationIdentityScopeReview({
    caseId,
    reviewerRef:
      "operator-private",
    identity:
      identityStable(),
    editScope:
      editScopeStable()
  });

assert.equal(
  identityScopeReview.status,
  "ready"
);

const routeTemplate =
  buildFaceLabSimulationRouteColorReviewTemplate({
    caseId,
    analysis:
      fixture.item.analysis,
    rawState:
      fixture.rawState,
    locale: "ko"
  });

assert.equal(
  routeTemplate.status,
  "ready"
);

const routeColorReview =
  buildFaceLabSimulationRouteColorReview({
    caseId,
    reviewerRef:
      "operator-private",
    analysis:
      fixture.item.analysis,
    rawState:
      fixture.rawState,
    locale: "ko",
    renderSpecSha256:
      routeTemplate.trace
        .renderSpecSha256,
    routeOperations:
      responseMap(
        routeTemplate.routeTargets,
        "executed"
      ),
    colorTargets:
      responseMap(
        routeTemplate.colorTargets,
        "on_target"
      )
  });

assert.equal(
  routeColorReview.status,
  "ready"
);

const runSpec = {
  campaignId:
    "G-E-PILOT-001",
  intentGroupId:
    "intent-001",
  generationIndex: 1,
  changeIntensity:
    "moderate",
  routeSelectionState:
    "user_selected"
};

const captureManifest = {
  captureVersion:
    FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION,
  caseId,
  locale: "ko",
  analysis:
    fixture.item.analysis,
  faceLabV2State:
    fixture.rawState,
  responseMeta: {
    simulationVersion:
      FACE_LAB_AI_SIMULATION_VERSION,
    instructionVersion:
      FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
    providerConfigVersion:
      FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
    providerConfigFingerprint:
      "c".repeat(64),
    routeId:
      fixture.reconstructed
        .renderSpec.routeId,
    lookId:
      fixture.reconstructed
        .renderSpec.lookId,
    renderSpecSha256:
      fixture.reconstructed
        .renderSpecSha256
  }
};

const result =
  buildFaceLabSimulationPilotCaseArtifacts({
    runSpec,
    captureManifest,
    canonicalSourceImageBytes:
      Buffer.from(
        "pilot-canonical-source"
      ),
    outputImageBytes:
      Buffer.from(
        "pilot-output-image"
      ),
    identityScopeReview,
    routeColorReview
  });

assert.equal(
  result.status,
  "ready"
);
assert.equal(
  result.runnerVersion,
  FACE_LAB_SIMULATION_PILOT_CASE_RUNNER_VERSION
);
assert.equal(
  result.caseId,
  caseId
);
assert.equal(
  result.evidencePacket.status,
  "ready"
);
assert.equal(
  result.calibrationCase.status,
  "ready"
);
assert.equal(
  result.calibrationCase.caseId,
  caseId
);
assert.equal(
  result.calibrationCase
    .campaignId,
  runSpec.campaignId
);
assert.equal(
  result.calibrationCase
    .intentGroupId,
  runSpec.intentGroupId
);
assert.equal(
  result.calibrationCase
    .generationIndex,
  1
);
assert.deepEqual(
  result.outputNames,
  {
    evidencePacket:
      `${caseId}.evidence-packet.json`,
    calibrationCase:
      `${caseId}.calibration-case.json`
  }
);

const serialized =
  JSON.stringify(result);

for (const forbidden of [
  "operator-private",
  "sourceImagePath",
  "outputImagePath",
  "checkEvidencePaths",
  "reviewTicket",
  "simulationAuthority",
  "data:image",
  "pilot-canonical-source",
  "pilot-output-image"
]) {
  assert.equal(
    serialized.includes(
      forbidden
    ),
    false,
    "pilot case result leaked private input: " +
      forbidden
  );
}

const badReview =
  buildFaceLabSimulationPilotCaseArtifacts({
    runSpec,
    captureManifest,
    canonicalSourceImageBytes:
      Buffer.from("source"),
    outputImageBytes:
      Buffer.from("output"),
    identityScopeReview: {
      ...identityScopeReview,
      reviewVersion:
        "wrong-review-version"
    },
    routeColorReview
  });

assert.equal(
  badReview.status,
  "invalid"
);
assert.equal(
  badReview.reason,
  "pilot_case_identity_scope_review_invalid"
);

const badRuntime =
  buildFaceLabSimulationPilotCaseArtifacts({
    runSpec,
    captureManifest: {
      ...captureManifest,
      responseMeta: {
        ...captureManifest
          .responseMeta,
        providerConfigFingerprint:
          "not-a-sha"
      }
    },
    canonicalSourceImageBytes:
      Buffer.from("source"),
    outputImageBytes:
      Buffer.from("output"),
    identityScopeReview,
    routeColorReview
  });

assert.equal(
  badRuntime.status,
  "invalid"
);
assert.equal(
  badRuntime.reason,
  "pilot_case_evidence_packet_invalid"
);

const badGenerationIndex =
  buildFaceLabSimulationPilotCaseArtifacts({
    runSpec: {
      ...runSpec,
      generationIndex: 0
    },
    captureManifest,
    canonicalSourceImageBytes:
      Buffer.from("source"),
    outputImageBytes:
      Buffer.from("output"),
    identityScopeReview,
    routeColorReview
  });

assert.equal(
  badGenerationIndex.status,
  "invalid"
);
assert.equal(
  badGenerationIndex.reason,
  "pilot_case_calibration_case_invalid"
);

const emptyBytes =
  buildFaceLabSimulationPilotCaseArtifacts({
    runSpec,
    captureManifest,
    canonicalSourceImageBytes:
      Buffer.alloc(0),
    outputImageBytes:
      Buffer.from("output"),
    identityScopeReview,
    routeColorReview
  });

assert.equal(
  emptyBytes.status,
  "invalid"
);
assert.equal(
  emptyBytes.reason,
  "pilot_case_image_bytes_invalid"
);

const cliSource =
  readFileSync(
    "scripts/run-face-lab-v2-simulation-pilot-case.mjs",
    "utf8"
  );

for (const required of [
  'path.basename(',
  ') !== "private"',
  "resolveContainedPath",
  "canonicalizeImageBytes",
  "detectImageSignature",
  "buildFaceLabSimulationPilotCaseArtifacts",
  "result.outputNames.evidencePacket",
  "result.outputNames.calibrationCase",
  "writeJsonAtomic"
]) {
  assert.ok(
    cliSource.includes(required),
    "missing pilot-case CLI contract fragment: " +
      required
  );
}

for (const forbidden of [
  "generateFaceLabSimulation",
  "resolveOpenAiApiKey",
  "writeFileSync",
  "fetch("
]) {
  assert.equal(
    cliSource.includes(
      forbidden
    ),
    false,
    "pilot-case CLI must not invoke provider/network authority: " +
      forbidden
  );
}

const workflowSource =
  readFileSync(
    ".github/workflows/face-lab-v2-foundation.yml",
    "utf8"
  );

for (const required of [
  "verify-face-lab-v2-simulation-pilot-case-runner.mjs",
  "run-face-lab-v2-simulation-pilot-case.mjs"
]) {
  assert.ok(
    workflowSource.includes(
      required
    ),
    "Face Lab CI missing pilot-case runner coverage: " +
      required
  );
}

console.log(
  "FACE_LAB_V2_SIMULATION_PILOT_CASE_RUNNER=PASS"
);
