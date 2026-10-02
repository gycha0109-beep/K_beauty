import {
  FACE_LAB_SIMULATION_EVALUATION_CHECKS
} from "./simulation-evaluation.js";
import {
  FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION
} from "./simulation-calibration.js";

export const FACE_LAB_G_E3_FULL_CALIBRATION_CLOSEOUT_VERSION =
  "face-lab-g-e3-full-calibration-closeout-v1";

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
      FACE_LAB_G_E3_FULL_CALIBRATION_CLOSEOUT_VERSION,
    status: "invalid",
    reason,
    ...details
  };
}

function increment(
  target,
  key
) {
  target[key] =
    (target[key] || 0) + 1;
}

function normalizeAccepted(
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
  const statuses =
    isObject(
      value
        .evidenceCheckStatuses
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

  if (
    !caseId ||
    !intentGroupId ||
    !generationIndex ||
    !CHECK_ID_SET.has(
      incompleteCheckId
    ) ||
    !statuses ||
    FACE_LAB_SIMULATION_EVALUATION_CHECKS.some(
      (checkId) =>
        !statuses[checkId]
    ) ||
    statuses[
      incompleteCheckId
    ] !== "not_evaluated" ||
    !reviewFindingCodes ||
    !hardFailureCodes ||
    hardFailureCodes.length
  ) {
    return null;
  }

  return {
    caseId,
    intentGroupId,
    generationIndex,
    incompleteCheckId,
    evidenceCheckStatuses:
      statuses,
    reviewFindingCodes,
    hardFailureCodes
  };
}

export function buildFaceLabGE3FullCalibrationCloseout({
  campaignId,
  aggregate,
  acceptedNotAssessable,
  waves
} = {}) {
  const normalizedCampaignId =
    identifier(campaignId);

  if (!normalizedCampaignId) {
    return invalid(
      "campaign_id_invalid"
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
      "full_calibration_aggregate_invalid"
    );
  }

  if (
    !Array.isArray(
      acceptedNotAssessable
    ) ||
    !Array.isArray(
      waves
    ) ||
    waves.length !== 3
  ) {
    return invalid(
      "full_calibration_closeout_input_invalid"
    );
  }

  const normalizedAccepted =
    [];

  for (
    const item of
    acceptedNotAssessable
  ) {
    const normalized =
      normalizeAccepted(item);

    if (!normalized) {
      return invalid(
        "accepted_not_assessable_invalid"
      );
    }

    normalizedAccepted.push(
      normalized
    );
  }

  const normalizedWaves =
    waves.map(
      (wave) => ({
        waveId:
          cleanString(
            wave?.waveId,
            40
          ),
        intentOffset:
          Number.isInteger(
            wave?.intentOffset
          )
            ? wave.intentOffset
            : null,
        reviewedCaseCount:
          Number.isInteger(
            wave
              ?.reviewedCaseCount
          )
            ? wave
                .reviewedCaseCount
            : null,
        hardFailureCaseCount:
          Number.isInteger(
            wave
              ?.hardFailureCaseCount
          )
            ? wave
                .hardFailureCaseCount
            : null
      })
    );

  const expectedWaves = [
    {
      waveId:
        "wave-01",
      intentOffset: 0
    },
    {
      waveId:
        "wave-02",
      intentOffset: 4
    },
    {
      waveId:
        "wave-03",
      intentOffset: 8
    }
  ];

  for (
    let index = 0;
    index <
      expectedWaves.length;
    index += 1
  ) {
    const wave =
      normalizedWaves[index];
    const expected =
      expectedWaves[index];

    if (
      wave.waveId !==
        expected.waveId ||
      wave.intentOffset !==
        expected.intentOffset ||
      wave.reviewedCaseCount !==
        8 ||
      wave.hardFailureCaseCount !==
        0
    ) {
      return invalid(
        "g_e3_wave_closeout_invalid",
        {
          waveIndex:
            index
        }
      );
    }
  }

  const caseIds =
    new Set();
  const generationKeys =
    new Set();
  const intentIds =
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
        "full_calibration_case_duplicate"
      );
    }

    caseIds.add(caseId);
    generationKeys.add(
      generationKey
    );
    intentIds.add(
      intentGroupId
    );
  }

  for (
    const item of
    normalizedAccepted
  ) {
    const generationKey =
      item.intentGroupId +
      ":" +
      item.generationIndex;

    if (
      caseIds.has(
        item.caseId
      ) ||
      generationKeys.has(
        generationKey
      )
    ) {
      return invalid(
        "full_calibration_case_duplicate"
      );
    }

    caseIds.add(
      item.caseId
    );
    generationKeys.add(
      generationKey
    );
    intentIds.add(
      item.intentGroupId
    );
  }

  if (
    aggregate.caseCount +
      normalizedAccepted.length !==
      24 ||
    caseIds.size !== 24 ||
    generationKeys.size !== 24 ||
    intentIds.size !== 12
  ) {
    return invalid(
      "full_calibration_coverage_incomplete",
      {
        admittedCaseCount:
          aggregate.caseCount,
        acceptedNotAssessableCount:
          normalizedAccepted
            .length,
        observedCaseCount:
          caseIds.size,
        observedIntentCount:
          intentIds.size
      }
    );
  }

  for (
    let intentNumber = 1;
    intentNumber <= 12;
    intentNumber += 1
  ) {
    const intentGroupId =
      `intent-${String(
        intentNumber
      ).padStart(
        2,
        "0"
      )}`;

    for (
      const generationIndex of
      [1, 2]
    ) {
      if (
        !generationKeys.has(
          intentGroupId +
            ":" +
            generationIndex
        )
      ) {
        return invalid(
          "full_calibration_generation_missing",
          {
            intentGroupId,
            generationIndex
          }
        );
      }
    }
  }

  if (
    aggregate
      .hardFailureCaseCount >
    0
  ) {
    return invalid(
      "full_calibration_hard_failure_present"
    );
  }

  const notAssessableByCheck =
    {};
  const acceptedCheckStatusCounts =
    {};
  const reviewFindingCodeCounts =
    {};

  for (
    const item of
    normalizedAccepted
  ) {
    increment(
      notAssessableByCheck,
      item
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
        item
          .evidenceCheckStatuses[
            checkId
          ]
      );
    }

    for (
      const code of
      item.reviewFindingCodes
    ) {
      increment(
        reviewFindingCodeCounts,
        code
      );
    }
  }

  return {
    closeoutVersion:
      FACE_LAB_G_E3_FULL_CALIBRATION_CLOSEOUT_VERSION,
    status: "ready",
    reason:
      "g_e3_full_calibration_closeout_built",
    campaignId:
      normalizedCampaignId,
    coverage: {
      expectedIntentCount: 12,
      observedIntentCount:
        intentIds.size,
      generationsPerIntent: 2,
      expectedOutputCount: 24,
      reviewedOutputCount:
        caseIds.size,
      admittedCalibrationCaseCount:
        aggregate.caseCount,
      acceptedNotAssessableCaseCount:
        normalizedAccepted
          .length,
      waveCount: 3
    },
    acceptedNotAssessable: {
      count:
        normalizedAccepted
          .length,
      byCheck:
        notAssessableByCheck,
      checkStatusCounts:
        acceptedCheckStatusCounts,
      reviewFindingCodeCounts
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
    campaignRuntime:
      aggregate
        .campaignRuntime,
    waveSummary:
      normalizedWaves,
    protocol: {
      hardFailureStop: false,
      failureAttributionOrder: [
        "render_spec",
        "instruction_builder",
        "repeat_generation_variance",
        "provider"
      ],
      notAssessablePolicy:
        "retain_human_observation_exclude_from_calibration_case",
      thresholdPolicy:
        "interpret_24_output_distribution_before_threshold_promotion"
    },
    decisionState:
      "full_calibration_evidence_ready",
    privacy: {
      rawImagesIncluded: false,
      imageHashesIncluded: false,
      reviewerRefsIncluded: false
    }
  };
}
