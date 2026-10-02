import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  buildFaceLabGE3FullCalibrationCloseout,
  FACE_LAB_G_E3_FULL_CALIBRATION_CLOSEOUT_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-g-e3-full-calibration-closeout.js";
import {
  FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-calibration.js";

const campaignId =
  "G-E3-CAL-TEST";

const caseRefs = [];
for (
  let intent = 1;
  intent <= 12;
  intent += 1
) {
  if (
    intent === 5
  ) {
    continue;
  }

  for (
    const generationIndex of
    [1, 2]
  ) {
    const intentGroupId =
      `intent-${String(
        intent
      ).padStart(
        2,
        "0"
      )}`;

    caseRefs.push({
      caseId:
        `case-${intentGroupId}-${generationIndex}`,
      intentGroupId,
      generationIndex,
      verdict: "pass"
    });
  }
}

const aggregate = {
  aggregateVersion:
    FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION,
  status: "ready",
  reason:
    "calibration_campaign_aggregated",
  campaignId,
  campaignRuntime: {
    simulationVersion:
      "face-lab-ai-simulation-v1",
    instructionVersion:
      "face-lab-simulation-instruction-v1",
    renderSpecVersion:
      "face-lab-render-spec-v1",
    providerConfigVersion:
      "face-lab-simulation-provider-config-v1",
    providerConfigFingerprint:
      "a".repeat(64)
  },
  caseCount:
    caseRefs.length,
  intentGroupCount: 11,
  repeatGroupCount: 11,
  verdictCounts: {
    pass:
      caseRefs.length
  },
  checkStatusCounts: {},
  hardFailureCaseCount: 0,
  findingCodeCounts: {},
  failureSourceCounts: {},
  repeatVariance: {
    verdictDisagreementGroupCount: 0,
    checkDisagreementGroupCount: 0,
    routeResponseVarianceGroupCount: 0,
    colorResponseVarianceGroupCount: 0,
    interpretation:
      "variance signal"
  },
  caseRefs
};

const accepted =
  [1, 2].map(
    (generationIndex) => ({
      caseId:
        `case-intent-05-${generationIndex}`,
      intentGroupId:
        "intent-05",
      generationIndex,
      incompleteCheckId:
        "route_adherence",
      evidenceCheckStatuses: {
        identity_preservation:
          "pass",
        route_adherence:
          "not_evaluated",
        color_fidelity:
          "not_evaluated",
        edit_scope:
          "pass"
      },
      reviewFindingCodes: [],
      hardFailureCodes: []
    })
  );

const waves = [
  {
    waveId:
      "wave-01",
    intentOffset: 0,
    reviewedCaseCount: 8,
    hardFailureCaseCount: 0
  },
  {
    waveId:
      "wave-02",
    intentOffset: 4,
    reviewedCaseCount: 8,
    hardFailureCaseCount: 0
  },
  {
    waveId:
      "wave-03",
    intentOffset: 8,
    reviewedCaseCount: 8,
    hardFailureCaseCount: 0
  }
];

const closeout =
  buildFaceLabGE3FullCalibrationCloseout({
    campaignId,
    aggregate,
    acceptedNotAssessable:
      accepted,
    waves
  });

assert.equal(
  closeout.status,
  "ready"
);
assert.equal(
  closeout.closeoutVersion,
  FACE_LAB_G_E3_FULL_CALIBRATION_CLOSEOUT_VERSION
);
assert.equal(
  closeout.coverage
    .reviewedOutputCount,
  24
);
assert.equal(
  closeout.coverage
    .observedIntentCount,
  12
);
assert.equal(
  closeout.coverage
    .admittedCalibrationCaseCount,
  22
);
assert.equal(
  closeout.coverage
    .acceptedNotAssessableCaseCount,
  2
);
assert.equal(
  closeout.acceptedNotAssessable
    .byCheck
    .route_adherence,
  2
);
assert.equal(
  closeout.calibrationSummary
    .hardFailureCaseCount,
  0
);
assert.equal(
  closeout.decisionState,
  "full_calibration_evidence_ready"
);
assert.equal(
  closeout.protocol
    .thresholdPolicy,
  "interpret_24_output_distribution_before_threshold_promotion"
);

const hardAccepted =
  buildFaceLabGE3FullCalibrationCloseout({
    campaignId,
    aggregate,
    acceptedNotAssessable: [
      {
        ...accepted[0],
        hardFailureCodes: [
          "IDENTITY_MAJOR_DRIFT"
        ]
      },
      accepted[1]
    ],
    waves
  });

assert.equal(
  hardAccepted.status,
  "invalid"
);
assert.equal(
  hardAccepted.reason,
  "accepted_not_assessable_invalid"
);

const missingGeneration =
  buildFaceLabGE3FullCalibrationCloseout({
    campaignId,
    aggregate: {
      ...aggregate,
      caseCount:
        aggregate.caseCount - 1,
      caseRefs:
        aggregate.caseRefs
          .slice(1)
    },
    acceptedNotAssessable:
      accepted,
    waves
  });

assert.equal(
  missingGeneration.status,
  "invalid"
);

const scriptSource =
  readFileSync(
    "scripts/run-face-lab-v2-g-e3-full-calibration.mjs",
    "utf8"
  );

for (const required of [
  "wave-01",
  "wave-02",
  "wave-03",
  "campaign.aggregate-input.json",
  "wave.closeout.json",
  "aggregateFaceLabSimulationCalibration",
  "buildFaceLabGE3FullCalibrationCloseout",
  "FACE_LAB_G_E3_HARD_FAILURE_STOP",
  "FACE_LAB_G_E3_FULL_CALIBRATION_EVIDENCE_READY",
  "full-calibration.aggregate.json",
  "full-calibration.closeout.json"
]) {
  assert.ok(
    scriptSource.includes(
      required
    ),
    "missing G-E3 full calibration marker: " +
      required
  );
}

assert.equal(
  scriptSource.includes(
    "fetch("
  ),
  false
);

console.log(
  "FACE_LAB_G_E3_FULL_CALIBRATION=PASS"
);
