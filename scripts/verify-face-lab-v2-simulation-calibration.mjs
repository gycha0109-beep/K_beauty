import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFaceLabV2Canonical
} from "../lib/face-lab-v2/canonical-composer.js";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../lib/face-lab-v2/simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "../lib/face-lab-v2/simulation-instructions.js";
import {
  reconstructFaceLabSimulationRenderAuthority
} from "../lib/face-lab-v2/simulation-render-authority.js";
import {
  buildFaceLabSimulationEvidencePacket
} from "../lib/face-lab-v2/evaluation/simulation-evidence-packet.js";
import {
  requiresFaceLabColorFidelity
} from "../lib/face-lab-v2/evaluation/simulation-evaluation.js";
import {
  buildFaceLabSimulationIdentityScopeReview
} from "../lib/face-lab-v2/evaluation/simulation-identity-scope-review.js";
import {
  buildFaceLabSimulationRouteColorReview,
  buildFaceLabSimulationRouteColorReviewTemplate
} from "../lib/face-lab-v2/evaluation/simulation-route-color-review.js";
import {
  aggregateFaceLabSimulationCalibration,
  buildFaceLabSimulationCalibrationCase,
  FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION,
  FACE_LAB_SIMULATION_CALIBRATION_CASE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-calibration.js";
import {
  buildFaceLabV2CoverageCohort
} from "../lib/face-lab-v2/evaluation/harness.js";

function identity(value = "stable") {
  return {
    facial_geometry: value,
    eye_anatomy: value,
    nose_geometry: value,
    jaw_chin_geometry: value,
    ear_geometry: value
  };
}

function editScope(value = "unchanged") {
  return {
    face_structure: value,
    background: value,
    clothing: value,
    body: value,
    head_pose: value,
    camera_perspective: value,
    expression: value,
    lighting_direction: value,
    unrequested_beautification: value
  };
}

function responseMap(targets, value) {
  return Object.fromEntries(
    targets.map((target) => [
      target.operationId,
      value
    ])
  );
}

function findColorFixture() {
  const cohort =
    buildFaceLabV2CoverageCohort({
      caseCount: 32
    });

  for (const item of cohort.cases) {
    const preview =
      buildFaceLabV2Canonical({
        analysis: item.analysis,
        surveyAnswers:
          item.surveyAnswers,
        targetFinderResult: null,
        selectedRouteId: null,
        locale: "ko"
      });

    for (
      const route of
      preview?.routes?.routes || []
    ) {
      const rawState = {
        surveyAnswers:
          item.surveyAnswers,
        targetFinderResult: null,
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
        requiresFaceLabColorFidelity(
          reconstructed.renderSpec
        ) &&
        reconstructed
          .renderSpec
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
    "no color-intent calibration fixture available"
  );
}

const fixture =
  findColorFixture();

function buildReviewedPacket({
  caseId,
  sourceBytes,
  outputBytes,
  routeMode = "pass",
  identityMode = "pass"
}) {
  const identityInput =
    identity();

  if (
    identityMode === "major"
  ) {
    identityInput
      .facial_geometry =
      "major_drift";
  }

  const identityScopeReview =
    buildFaceLabSimulationIdentityScopeReview({
      caseId,
      reviewerRef:
        "operator-01",
      identity:
        identityInput,
      editScope:
        editScope()
    });

  assert.equal(
    identityScopeReview.status,
    "ready"
  );

  const template =
    buildFaceLabSimulationRouteColorReviewTemplate({
      caseId,
      analysis:
        fixture.item.analysis,
      rawState:
        fixture.rawState,
      locale: "ko"
    });

  assert.equal(
    template.status,
    "ready"
  );

  const routeOperations =
    responseMap(
      template.routeTargets,
      "executed"
    );

  if (
    routeMode === "partial"
  ) {
    routeOperations[
      template.routeTargets[0]
        .operationId
    ] = "partial";
  }

  const routeColorReview =
    buildFaceLabSimulationRouteColorReview({
      caseId,
      reviewerRef:
        "operator-01",
      analysis:
        fixture.item.analysis,
      rawState:
        fixture.rawState,
      locale: "ko",
      renderSpecSha256:
        template.trace
          .renderSpecSha256,
      routeOperations,
      colorTargets:
        responseMap(
          template.colorTargets,
          "on_target"
        )
    });

  assert.equal(
    routeColorReview.status,
    "ready"
  );

  const packet =
    buildFaceLabSimulationEvidencePacket({
      caseId,
      analysis:
        fixture.item.analysis,
      rawState:
        fixture.rawState,
      locale: "ko",
      canonicalSourceImageBytes:
        sourceBytes,
      outputImageBytes:
        outputBytes,
      responseMeta: {
        simulationVersion:
          FACE_LAB_AI_SIMULATION_VERSION,
        instructionVersion:
          FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
        routeId:
          fixture.reconstructed
            .renderSpec.routeId,
        lookId:
          fixture.reconstructed
            .renderSpec.lookId,
        renderSpecSha256:
          fixture.reconstructed
            .renderSpecSha256
      },
      checks: {
        ...identityScopeReview.checks,
        ...routeColorReview.checks
      },
      checkEvidenceRefs: [
        {
          evidenceVersion:
            identityScopeReview
              .reviewVersion,
          evidenceDigest:
            identityScopeReview
              .responseDigest,
          checkIds:
            Object.keys(
              identityScopeReview
                .checks
            )
        },
        {
          evidenceVersion:
            routeColorReview
              .reviewVersion,
          evidenceDigest:
            routeColorReview
              .responseDigest,
          checkIds:
            Object.keys(
              routeColorReview
                .checks
            )
        }
      ]
    });

  assert.equal(
    packet.status,
    "ready"
  );

  return {
    packet,
    identityScopeReview,
    routeColorReview
  };
}

const sharedSource =
  Buffer.from(
    "calibration-source-shared"
  );

const passArtifacts =
  buildReviewedPacket({
    caseId: "CAL-001-A",
    sourceBytes:
      sharedSource,
    outputBytes:
      Buffer.from(
        "calibration-output-a"
      )
  });

const reviewArtifacts =
  buildReviewedPacket({
    caseId: "CAL-001-B",
    sourceBytes:
      sharedSource,
    outputBytes:
      Buffer.from(
        "calibration-output-b"
      ),
    routeMode: "partial"
  });

const failArtifacts =
  buildReviewedPacket({
    caseId: "CAL-002-A",
    sourceBytes:
      Buffer.from(
        "calibration-source-hard-fail"
      ),
    outputBytes:
      Buffer.from(
        "calibration-output-hard-fail"
      ),
    identityMode: "major"
  });

assert.equal(
  passArtifacts
    .packet
    .evaluation.verdict,
  "pass"
);
assert.equal(
  reviewArtifacts
    .packet
    .evaluation.verdict,
  "review"
);
assert.equal(
  failArtifacts
    .packet
    .evaluation.verdict,
  "fail"
);

function calibrationCase({
  artifacts,
  intentGroupId,
  generationIndex,
  changeIntensity
}) {
  return buildFaceLabSimulationCalibrationCase({
    campaignId:
      "G-E-PILOT-001",
    intentGroupId,
    generationIndex,
    changeIntensity,
    routeSelectionState:
      "user_selected",
    packet:
      artifacts.packet,
    identityScopeReview:
      artifacts
        .identityScopeReview,
    routeColorReview:
      artifacts
        .routeColorReview
  });
}

const passCase =
  calibrationCase({
    artifacts:
      passArtifacts,
    intentGroupId:
      "intent-001",
    generationIndex: 1,
    changeIntensity:
      "moderate"
  });
const reviewCase =
  calibrationCase({
    artifacts:
      reviewArtifacts,
    intentGroupId:
      "intent-001",
    generationIndex: 2,
    changeIntensity:
      "moderate"
  });
const failCase =
  calibrationCase({
    artifacts:
      failArtifacts,
    intentGroupId:
      "intent-002",
    generationIndex: 1,
    changeIntensity:
      "high"
  });

for (
  const item of
  [
    passCase,
    reviewCase,
    failCase
  ]
) {
  assert.equal(
    item.status,
    "ready"
  );
  assert.equal(
    item.caseVersion,
    FACE_LAB_SIMULATION_CALIBRATION_CASE_VERSION
  );
  assert.equal(
    item.privacy
      .rawImagesIncluded,
    false
  );
  assert.equal(
    item.privacy
      .sourceImageHashRetained,
    false
  );
  assert.equal(
    item.privacy
      .reviewerRefRetained,
    false
  );
  assert.match(
    item.trace
      .intentBindingDigest,
    /^[a-f0-9]{64}$/
  );
}

assert.equal(
  passCase.trace
    .intentBindingDigest,
  reviewCase.trace
    .intentBindingDigest
);
assert.notEqual(
  passCase.trace
    .intentBindingDigest,
  failCase.trace
    .intentBindingDigest
);

const passSerialized =
  JSON.stringify(passCase);

for (const forbidden of [
  "sourceImageSha256",
  "outputImageSha256",
  "analysisSha256",
  "faceLabV2StateSha256",
  '"reviewerRef":',
  "operator-01",
  passArtifacts.packet.trace
    .sourceImageSha256,
  passArtifacts.packet.trace
    .outputImageSha256
]) {
  assert.equal(
    passSerialized.includes(
      forbidden
    ),
    false,
    "calibration case retained forbidden private material: " +
      forbidden
  );
}

const tamperedIdentityReview =
  structuredClone(
    passArtifacts
      .identityScopeReview
  );
tamperedIdentityReview
  .responseDigest =
  "f".repeat(64);

const unbound =
  buildFaceLabSimulationCalibrationCase({
    campaignId:
      "G-E-PILOT-001",
    intentGroupId:
      "intent-003",
    generationIndex: 1,
    changeIntensity:
      "light",
    routeSelectionState:
      "user_selected",
    packet:
      passArtifacts.packet,
    identityScopeReview:
      tamperedIdentityReview,
    routeColorReview:
      passArtifacts
        .routeColorReview
  });

assert.equal(
  unbound.status,
  "invalid"
);
assert.equal(
  unbound.reason,
  "identity_scope_review_not_bound"
);

const incompletePacket =
  structuredClone(
    passArtifacts.packet
  );
incompletePacket
  .evaluation
  .checks
  .route_adherence
  .status =
  "not_evaluated";
incompletePacket
  .evaluation
  .verdict =
  "not_evaluated";

const incomplete =
  buildFaceLabSimulationCalibrationCase({
    campaignId:
      "G-E-PILOT-001",
    intentGroupId:
      "intent-004",
    generationIndex: 1,
    changeIntensity:
      "light",
    routeSelectionState:
      "user_selected",
    packet:
      incompletePacket,
    identityScopeReview:
      passArtifacts
        .identityScopeReview,
    routeColorReview:
      passArtifacts
        .routeColorReview
  });

assert.equal(
  incomplete.status,
  "invalid"
);
assert.equal(
  incomplete.reason,
  "evidence_packet_evaluation_incomplete"
);
assert.equal(
  incomplete.incompleteCheckId,
  "route_adherence"
);

const aggregate =
  aggregateFaceLabSimulationCalibration({
    campaignId:
      "G-E-PILOT-001",
    cases: [
      passCase,
      reviewCase,
      failCase
    ]
  });

assert.equal(
  aggregate.status,
  "ready"
);
assert.equal(
  aggregate.aggregateVersion,
  FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION
);
assert.equal(
  aggregate.caseCount,
  3
);
assert.equal(
  aggregate.intentGroupCount,
  2
);
assert.equal(
  aggregate.repeatGroupCount,
  1
);
assert.deepEqual(
  aggregate.verdictCounts,
  {
    pass: 1,
    review: 1,
    fail: 1
  }
);
assert.equal(
  aggregate.hardFailureCaseCount,
  1
);
assert.equal(
  aggregate.findingCodeCounts
    .UNDER_EDITED,
  1
);
assert.equal(
  aggregate.findingCodeCounts
    .IDENTITY_MAJOR_DRIFT,
  1
);
assert.equal(
  aggregate.repeatVariance
    .verdictDisagreementGroupCount,
  1
);
assert.equal(
  aggregate.repeatVariance
    .routeResponseVarianceGroupCount,
  1
);
assert.equal(
  aggregate.repeatVariance
    .colorResponseVarianceGroupCount,
  0
);

const variedOperationId =
  Object.keys(
    reviewCase
      .observations
      .routeOperations
  ).find(
    (operationId) =>
      reviewCase
        .observations
        .routeOperations[
          operationId
        ] === "partial"
  );

assert.ok(variedOperationId);
assert.deepEqual(
  aggregate
    .observationCounts
    .routeOperations[
      variedOperationId
    ],
  {
    executed: 2,
    partial: 1
  }
);

const aggregateSerialized =
  JSON.stringify(aggregate);

for (const forbidden of [
  "sourceImageSha256",
  "outputImageSha256",
  "analysisSha256",
  "faceLabV2StateSha256",
  '"reviewerRef":',
  "operator-01",
  "intentBindingDigest",
  "renderSpecSha256"
]) {
  assert.equal(
    aggregateSerialized.includes(
      forbidden
    ),
    false,
    "aggregate leaked case-level binding/private material: " +
      forbidden
  );
}

const duplicateGeneration =
  aggregateFaceLabSimulationCalibration({
    campaignId:
      "G-E-PILOT-001",
    cases: [
      passCase,
      {
        ...reviewCase,
        generationIndex: 1
      }
    ]
  });

assert.equal(
  duplicateGeneration.status,
  "invalid"
);
assert.equal(
  duplicateGeneration.reason,
  "generation_index_duplicate"
);

const bindingMismatch =
  aggregateFaceLabSimulationCalibration({
    campaignId:
      "G-E-PILOT-001",
    cases: [
      passCase,
      {
        ...reviewCase,
        trace: {
          ...reviewCase.trace,
          intentBindingDigest:
            "f".repeat(64)
        }
      }
    ]
  });

assert.equal(
  bindingMismatch.status,
  "invalid"
);
assert.equal(
  bindingMismatch.reason,
  "intent_group_binding_mismatch"
);

const malformedPersistedCase =
  aggregateFaceLabSimulationCalibration({
    campaignId:
      "G-E-PILOT-001",
    cases: [
      {
        ...passCase,
        privacy: {
          ...passCase.privacy,
          sourceImageHashRetained:
            true
        }
      }
    ]
  });

assert.equal(
  malformedPersistedCase.status,
  "invalid"
);
assert.equal(
  malformedPersistedCase.reason,
  "calibration_case_invalid"
);

const caseCliSource =
  readFileSync(
    "scripts/build-face-lab-v2-simulation-calibration-case.mjs",
    "utf8"
  );
const aggregateCliSource =
  readFileSync(
    "scripts/aggregate-face-lab-v2-simulation-calibration.mjs",
    "utf8"
  );
const gitignore =
  readFileSync(
    ".gitignore",
    "utf8"
  );

for (const source of [
  caseCliSource,
  aggregateCliSource
]) {
  assert.equal(
    source.includes(
      "generateFaceLabSimulation"
    ),
    false
  );
  assert.equal(
    source.includes(
      "writeFile"
    ),
    false
  );
}

assert.ok(
  gitignore
    .split(/\r?\n/)
    .some(
      (line) =>
        line.trim() ===
        "private"
    ),
  "private calibration workspace must remain ignored"
);

const coreSource =
  readFileSync(
    "lib/face-lab-v2/evaluation/simulation-calibration.js",
    "utf8"
  );

for (const forbidden of [
  "generateFaceLabSimulation",
  "resolveOpenAiApiKey",
  "productionFidelity",
  "promotionThreshold",
  "qualityThreshold"
]) {
  assert.equal(
    coreSource.includes(forbidden),
    false,
    "Gate G-E0 must not invoke providers or invent production thresholds: " +
      forbidden
  );
}

for (const forbiddenKey of [
  "qualityThreshold",
  "promotionThreshold",
  "productionFidelity"
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      aggregate,
      forbiddenKey
    ),
    false
  );
}

console.log(
  "FACE_LAB_V2_SIMULATION_CALIBRATION=PASS"
);
