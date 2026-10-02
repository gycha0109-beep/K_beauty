import {
  FACE_LAB_SIMULATION_EVALUATION_CHECKS
} from "./simulation-evaluation.js";
import {
  FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION
} from "./simulation-calibration.js";

export const FACE_LAB_SIMULATION_PILOT_CLOSEOUT_VERSION =
  "face-lab-simulation-pilot-closeout-v1";

const CHECK_ID_SET =
  new Set(
    FACE_LAB_SIMULATION_EVALUATION_CHECKS
  );

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanString(
  value,
  maxLength = 160
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized &&
    normalized.length <= maxLength
      ? normalized
      : null;
}

function identifier(value) {
  const normalized =
    cleanString(value, 120);

  return normalized &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(
      normalized
    )
      ? normalized
      : null;
}

function invalid(
  reason,
  details = {}
) {
  return {
    closeoutVersion:
      FACE_LAB_SIMULATION_PILOT_CLOSEOUT_VERSION,
    status: "invalid",
    reason,
    ...details
  };
}

function increment(
  object,
  key
) {
  object[key] =
    (object[key] || 0) + 1;
}

function normalizeAcceptedObservation(
  value
) {
  if (!isObject(value)) {
    return null;
  }

  const caseId =
    identifier(value.caseId);
  const intentGroupId =
    identifier(
      value.intentGroupId
    );
  const generationIndex =
    Number.isInteger(
      value.generationIndex
    ) &&
    value.generationIndex > 0
      ? value.generationIndex
      : null;
  const incompleteCheckId =
    cleanString(
      value.incompleteCheckId,
      80
    );
  const calibrationReason =
    cleanString(
      value.calibrationReason,
      120
    );
  const evidenceVerdict =
    cleanString(
      value.evidenceVerdict,
      40
    );
  const hardFailureCodes =
    Array.isArray(
      value.hardFailureCodes
    )
      ? value.hardFailureCodes
          .map((code) =>
            cleanString(
              code,
              80
            )
          )
          .filter(Boolean)
      : null;
  const reviewFindingCodes =
    Array.isArray(
      value.reviewFindingCodes
    )
      ? value.reviewFindingCodes
          .map((code) =>
            cleanString(
              code,
              80
            )
          )
          .filter(Boolean)
      : null;
  const evidenceCheckStatuses =
    isObject(
      value.evidenceCheckStatuses
    )
      ? Object.fromEntries(
          FACE_LAB_SIMULATION_EVALUATION_CHECKS.map(
            (checkId) => [
              checkId,
              cleanString(
                value
                  .evidenceCheckStatuses[
                    checkId
                  ],
                40
              )
            ]
          )
        )
      : null;

  if (
    !caseId ||
    !intentGroupId ||
    !generationIndex ||
    !CHECK_ID_SET.has(
      incompleteCheckId
    ) ||
    calibrationReason !==
      "evidence_packet_evaluation_incomplete" ||
    evidenceVerdict !==
      "not_evaluated" ||
    !hardFailureCodes ||
    hardFailureCodes.length ||
    !reviewFindingCodes ||
    !evidenceCheckStatuses ||
    FACE_LAB_SIMULATION_EVALUATION_CHECKS.some(
      (checkId) =>
        !evidenceCheckStatuses[
          checkId
        ]
    ) ||
    evidenceCheckStatuses[
      incompleteCheckId
    ] !== "not_evaluated"
  ) {
    return null;
  }

  return {
    caseId,
    intentGroupId,
    generationIndex,
    incompleteCheckId,
    evidenceCheckStatuses,
    reviewFindingCodes,
    disposition:
      "accepted_not_assessable"
  };
}

export function buildFaceLabSimulationPilotCloseout({
  campaignId,
  expectedCaseCount,
  expectedIntentGroupCount,
  reviewedCaseCount,
  aggregate,
  acceptedNotAssessable
} = {}) {
  const normalizedCampaignId =
    identifier(campaignId);

  if (!normalizedCampaignId) {
    return invalid(
      "campaign_id_invalid"
    );
  }

  if (
    !Number.isInteger(
      expectedCaseCount
    ) ||
    expectedCaseCount <= 0
  ) {
    return invalid(
      "expected_case_count_invalid"
    );
  }

  if (
    !Number.isInteger(
      expectedIntentGroupCount
    ) ||
    expectedIntentGroupCount <= 0
  ) {
    return invalid(
      "expected_intent_group_count_invalid"
    );
  }

  if (
    !Number.isInteger(
      reviewedCaseCount
    ) ||
    reviewedCaseCount !==
      expectedCaseCount
  ) {
    return invalid(
      "reviewed_case_count_incomplete"
    );
  }

  if (
    !isObject(aggregate) ||
    aggregate.aggregateVersion !==
      FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION ||
    aggregate.status !== "ready" ||
    aggregate.campaignId !==
      normalizedCampaignId ||
    !Array.isArray(
      aggregate.caseRefs
    )
  ) {
    return invalid(
      "calibration_aggregate_invalid"
    );
  }

  if (
    !Array.isArray(
      acceptedNotAssessable
    )
  ) {
    return invalid(
      "accepted_not_assessable_invalid"
    );
  }

  const accepted = [];

  for (
    const value of
    acceptedNotAssessable
  ) {
    const normalized =
      normalizeAcceptedObservation(
        value
      );

    if (!normalized) {
      return invalid(
        "accepted_not_assessable_observation_invalid"
      );
    }

    accepted.push(
      normalized
    );
  }

  if (
    aggregate.caseCount +
      accepted.length !==
    reviewedCaseCount
  ) {
    return invalid(
      "pilot_case_accounting_mismatch",
      {
        admittedCaseCount:
          aggregate.caseCount,
        acceptedNotAssessableCount:
          accepted.length,
        reviewedCaseCount
      }
    );
  }

  const caseIds =
    new Set();
  const generationKeys =
    new Set();
  const intentGroupIds =
    new Set();

  for (
    const ref of
    aggregate.caseRefs
  ) {
    const caseId =
      identifier(ref?.caseId);
    const intentGroupId =
      identifier(
        ref?.intentGroupId
      );
    const generationIndex =
      Number.isInteger(
        ref?.generationIndex
      ) &&
      ref.generationIndex > 0
        ? ref.generationIndex
        : null;

    if (
      !caseId ||
      !intentGroupId ||
      !generationIndex
    ) {
      return invalid(
        "aggregate_case_ref_invalid"
      );
    }

    const generationKey =
      intentGroupId +
      ":" +
      generationIndex;

    if (
      caseIds.has(caseId) ||
      generationKeys.has(
        generationKey
      )
    ) {
      return invalid(
        "pilot_case_ref_duplicate"
      );
    }

    caseIds.add(caseId);
    generationKeys.add(
      generationKey
    );
    intentGroupIds.add(
      intentGroupId
    );
  }

  for (
    const observation of
    accepted
  ) {
    const generationKey =
      observation
        .intentGroupId +
      ":" +
      observation
        .generationIndex;

    if (
      caseIds.has(
        observation.caseId
      ) ||
      generationKeys.has(
        generationKey
      )
    ) {
      return invalid(
        "pilot_case_ref_duplicate"
      );
    }

    caseIds.add(
      observation.caseId
    );
    generationKeys.add(
      generationKey
    );
    intentGroupIds.add(
      observation
        .intentGroupId
    );
  }

  if (
    intentGroupIds.size !==
      expectedIntentGroupCount
  ) {
    return invalid(
      "intent_group_coverage_incomplete",
      {
        expectedIntentGroupCount,
        observedIntentGroupCount:
          intentGroupIds.size
      }
    );
  }

  const notAssessableByCheck =
    {};
  const acceptedCheckStatusCounts =
    {};
  const acceptedReviewFindingCodeCounts =
    {};

  for (
    const observation of
    accepted
  ) {
    increment(
      notAssessableByCheck,
      observation
        .incompleteCheckId
    );

    for (
      const checkId of
      FACE_LAB_SIMULATION_EVALUATION_CHECKS
    ) {
      if (
        !acceptedCheckStatusCounts[
          checkId
        ]
      ) {
        acceptedCheckStatusCounts[
          checkId
        ] = {};
      }

      increment(
        acceptedCheckStatusCounts[
          checkId
        ],
        observation
          .evidenceCheckStatuses[
            checkId
          ]
      );
    }

    for (
      const code of
      observation
        .reviewFindingCodes
    ) {
      increment(
        acceptedReviewFindingCodeCounts,
        code
      );
    }
  }

  const hardFailureStop =
    aggregate
      .hardFailureCaseCount >
    0;

  return {
    closeoutVersion:
      FACE_LAB_SIMULATION_PILOT_CLOSEOUT_VERSION,
    status: "ready",
    reason:
      "pilot_closeout_built",
    campaignId:
      normalizedCampaignId,
    coverage: {
      expectedCaseCount,
      reviewedCaseCount,
      admittedCalibrationCaseCount:
        aggregate.caseCount,
      acceptedNotAssessableCaseCount:
        accepted.length,
      expectedIntentGroupCount,
      observedIntentGroupCount:
        intentGroupIds.size,
      admittedIntentGroupCount:
        aggregate
          .intentGroupCount,
      admittedRepeatGroupCount:
        aggregate
          .repeatGroupCount
    },
    acceptedNotAssessable: {
      count:
        accepted.length,
      byCheck:
        notAssessableByCheck,
      checkStatusCounts:
        acceptedCheckStatusCounts,
      reviewFindingCodeCounts:
        acceptedReviewFindingCodeCounts,
      observations:
        accepted
    },
    calibrationSummary: {
      verdictCounts:
        aggregate
          .verdictCounts,
      checkStatusCounts:
        aggregate
          .checkStatusCounts,
      hardFailureCaseCount:
        aggregate
          .hardFailureCaseCount,
      findingCodeCounts:
        aggregate
          .findingCodeCounts,
      failureSourceCounts:
        aggregate
          .failureSourceCounts,
      repeatVariance:
        aggregate
          .repeatVariance
    },
    protocol: {
      hardFailureStop,
      expansionDecision:
        hardFailureStop
          ? "stop_for_failure_attribution"
          : "ready_for_protocol_freeze",
      failureAttributionOrder: [
        "render_spec",
        "instruction_builder",
        "repeat_generation_variance",
        "provider"
      ],
      notAssessablePolicy:
        "retain_human_observation_exclude_from_calibration_case",
      thresholdPolicy:
        "do_not_invent_numeric_thresholds_from_pilot"
    },
    nextStage:
      hardFailureStop
        ? "G-E2C_FAILURE_ATTRIBUTION"
        : "G-E2C_PROTOCOL_FREEZE",
    privacy: {
      rawImagesIncluded: false,
      imageHashesIncluded: false,
      reviewerRefsIncluded: false
    }
  };
}
