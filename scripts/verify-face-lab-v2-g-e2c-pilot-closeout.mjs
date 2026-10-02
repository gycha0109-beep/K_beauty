import assert from "node:assert/strict";
import {
  buildFaceLabSimulationPilotCloseout,
  FACE_LAB_SIMULATION_PILOT_CLOSEOUT_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-pilot-closeout.js";
import {
  FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-calibration.js";

const campaignId =
  "G-E-PILOT-TEST";

function caseRef(
  intentGroupId,
  generationIndex
) {
  return {
    caseId:
      `case-${intentGroupId}-${generationIndex}`,
    intentGroupId,
    generationIndex,
    verdict: "pass"
  };
}

const aggregate = {
  aggregateVersion:
    FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION,
  status: "ready",
  reason:
    "calibration_campaign_aggregated",
  campaignId,
  caseCount: 6,
  intentGroupCount: 3,
  repeatGroupCount: 3,
  verdictCounts: {
    pass: 4,
    review: 2
  },
  checkStatusCounts: {
    identity_preservation: {
      pass: 6
    },
    route_adherence: {
      pass: 4,
      review: 2
    },
    color_fidelity: {
      pass: 6
    },
    edit_scope: {
      pass: 6
    }
  },
  hardFailureCaseCount: 0,
  findingCodeCounts: {
    UNDER_EDITED: 2
  },
  failureSourceCounts: {
    evaluation_uncertain: 2
  },
  repeatVariance: {
    verdictDisagreementGroupCount: 1,
    checkDisagreementGroupCount: 1,
    routeResponseVarianceGroupCount: 1,
    colorResponseVarianceGroupCount: 0,
    interpretation:
      "variance signal"
  },
  caseRefs: [
    caseRef("intent-01", 1),
    caseRef("intent-01", 2),
    caseRef("intent-03", 1),
    caseRef("intent-03", 2),
    caseRef("intent-04", 1),
    caseRef("intent-04", 2)
  ]
};

function notAssessable(
  generationIndex
) {
  return {
    caseId:
      `case-intent-02-${generationIndex}`,
    intentGroupId:
      "intent-02",
    generationIndex,
    reason:
      "pilot_case_calibration_case_invalid",
    calibrationReason:
      "evidence_packet_evaluation_incomplete",
    incompleteCheckId:
      "route_adherence",
    evidenceVerdict:
      "not_evaluated",
    hardFailureCodes: [],
    reviewFindingCodes: [],
    evidenceCheckStatuses: {
      identity_preservation:
        "pass",
      route_adherence:
        "not_evaluated",
      color_fidelity:
        "pass",
      edit_scope:
        "pass"
    }
  };
}

const closeout =
  buildFaceLabSimulationPilotCloseout({
    campaignId,
    expectedCaseCount: 8,
    expectedIntentGroupCount: 4,
    reviewedCaseCount: 8,
    aggregate,
    acceptedNotAssessable: [
      notAssessable(1),
      notAssessable(2)
    ]
  });

assert.equal(
  closeout.status,
  "ready"
);
assert.equal(
  closeout.closeoutVersion,
  FACE_LAB_SIMULATION_PILOT_CLOSEOUT_VERSION
);
assert.equal(
  closeout.coverage
    .reviewedCaseCount,
  8
);
assert.equal(
  closeout.coverage
    .admittedCalibrationCaseCount,
  6
);
assert.equal(
  closeout.coverage
    .acceptedNotAssessableCaseCount,
  2
);
assert.equal(
  closeout.coverage
    .observedIntentGroupCount,
  4
);
assert.equal(
  closeout.acceptedNotAssessable
    .byCheck
    .route_adherence,
  2
);
assert.equal(
  closeout.acceptedNotAssessable
    .checkStatusCounts
    .route_adherence
    .not_evaluated,
  2
);
assert.equal(
  closeout.calibrationSummary
    .hardFailureCaseCount,
  0
);
assert.equal(
  closeout.protocol
    .hardFailureStop,
  false
);
assert.equal(
  closeout.protocol
    .expansionDecision,
  "ready_for_protocol_freeze"
);
assert.equal(
  closeout.nextStage,
  "G-E2C_PROTOCOL_FREEZE"
);

const hardFailure =
  buildFaceLabSimulationPilotCloseout({
    campaignId,
    expectedCaseCount: 8,
    expectedIntentGroupCount: 4,
    reviewedCaseCount: 8,
    aggregate: {
      ...aggregate,
      hardFailureCaseCount: 1,
      verdictCounts: {
        ...aggregate
          .verdictCounts,
        fail: 1
      }
    },
    acceptedNotAssessable: [
      notAssessable(1),
      notAssessable(2)
    ]
  });

assert.equal(
  hardFailure.status,
  "ready"
);
assert.equal(
  hardFailure.protocol
    .hardFailureStop,
  true
);
assert.equal(
  hardFailure.protocol
    .expansionDecision,
  "stop_for_failure_attribution"
);
assert.equal(
  hardFailure.nextStage,
  "G-E2C_FAILURE_ATTRIBUTION"
);

const contaminated =
  buildFaceLabSimulationPilotCloseout({
    campaignId,
    expectedCaseCount: 8,
    expectedIntentGroupCount: 4,
    reviewedCaseCount: 8,
    aggregate,
    acceptedNotAssessable: [
      {
        ...notAssessable(1),
        hardFailureCodes: [
          "IDENTITY_MAJOR_DRIFT"
        ]
      },
      notAssessable(2)
    ]
  });

assert.equal(
  contaminated.status,
  "invalid"
);
assert.equal(
  contaminated.reason,
  "accepted_not_assessable_observation_invalid"
);

const incompleteReview =
  buildFaceLabSimulationPilotCloseout({
    campaignId,
    expectedCaseCount: 8,
    expectedIntentGroupCount: 4,
    reviewedCaseCount: 7,
    aggregate,
    acceptedNotAssessable: [
      notAssessable(1)
    ]
  });

assert.equal(
  incompleteReview.status,
  "invalid"
);
assert.equal(
  incompleteReview.reason,
  "reviewed_case_count_incomplete"
);

const serialized =
  JSON.stringify(closeout);

for (const forbidden of [
  "promotionThreshold",
  "qualityThreshold",
  "productionFidelity"
]) {
  assert.equal(
    serialized.includes(
      forbidden
    ),
    false,
    "pilot closeout must not invent calibration thresholds: " +
      forbidden
  );
}

console.log(
  "FACE_LAB_G_E2C_PILOT_CLOSEOUT=PASS"
);
