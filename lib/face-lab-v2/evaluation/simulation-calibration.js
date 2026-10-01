import {
  hashFaceLabAuthorityValue
} from "../simulation-authority-core.js";
import {
  FACE_LAB_SIMULATION_EVIDENCE_PACKET_VERSION
} from "./simulation-evidence-packet.js";
import {
  FACE_LAB_SIMULATION_EVALUATION_CHECKS
} from "./simulation-evaluation.js";
import {
  FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION,
  FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS,
  FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS
} from "./simulation-identity-scope-review.js";
import {
  FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION
} from "./simulation-route-color-review.js";

export const FACE_LAB_SIMULATION_CALIBRATION_CASE_VERSION =
  "face-lab-simulation-calibration-case-v1";

export const FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION =
  "face-lab-simulation-calibration-aggregate-v1";

export const FACE_LAB_SIMULATION_CALIBRATION_CHANGE_INTENSITIES =
  Object.freeze([
    "minimal",
    "light",
    "moderate",
    "high"
  ]);

export const FACE_LAB_SIMULATION_CALIBRATION_ROUTE_SELECTION_STATES =
  Object.freeze([
    "user_selected",
    "single_route_auto"
  ]);

const CHANGE_INTENSITY_SET =
  new Set(
    FACE_LAB_SIMULATION_CALIBRATION_CHANGE_INTENSITIES
  );
const ROUTE_SELECTION_STATE_SET =
  new Set(
    FACE_LAB_SIMULATION_CALIBRATION_ROUTE_SELECTION_STATES
  );
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanString(value, maxLength = 160) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function normalizeSha256(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return SHA256_PATTERN.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function identifier(value, maxLength = 120) {
  const normalized =
    cleanString(value, maxLength);

  return normalized &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(
      normalized
    )
    ? normalized
    : null;
}

function invalidCase(reason, details = {}) {
  return {
    caseVersion:
      FACE_LAB_SIMULATION_CALIBRATION_CASE_VERSION,
    status: "invalid",
    reason,
    ...details
  };
}

function invalidAggregate(reason, details = {}) {
  return {
    aggregateVersion:
      FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION,
    status: "invalid",
    reason,
    ...details
  };
}

function exactSet(values) {
  return [
    ...new Set(values)
  ].sort();
}

function sameStringSet(left, right) {
  return JSON.stringify(
    exactSet(left)
  ) === JSON.stringify(
    exactSet(right)
  );
}

function findEvidenceRef(
  packet,
  {
    version,
    digest,
    checkIds
  }
) {
  return (
    Array.isArray(
      packet?.checkEvidenceRefs
    ) &&
    packet.checkEvidenceRefs.some(
      (ref) =>
        ref?.evidenceVersion ===
          version &&
        ref?.evidenceDigest ===
          digest &&
        sameStringSet(
          Array.isArray(ref?.checkIds)
            ? ref.checkIds
            : [],
          checkIds
        )
    )
  );
}

function validateCompletedPacket(packet) {
  if (
    !isObject(packet) ||
    packet.packetVersion !==
      FACE_LAB_SIMULATION_EVIDENCE_PACKET_VERSION ||
    packet.status !== "ready"
  ) {
    return {
      valid: false,
      reason:
        "evidence_packet_not_ready"
    };
  }

  if (
    !isObject(packet.trace) ||
    !isObject(packet.evaluation) ||
    !isObject(packet.evaluation.checks)
  ) {
    return {
      valid: false,
      reason:
        "evidence_packet_structure_invalid"
    };
  }

  const caseId =
    identifier(packet.caseId);
  if (!caseId) {
    return {
      valid: false,
      reason:
        "evidence_packet_case_id_invalid"
    };
  }

  for (
    const checkId of
    FACE_LAB_SIMULATION_EVALUATION_CHECKS
  ) {
    const status =
      packet.evaluation
        .checks[checkId]
        ?.status;

    if (
      !status ||
      status === "not_evaluated"
    ) {
      return {
        valid: false,
        reason:
          "evidence_packet_evaluation_incomplete",
        incompleteCheckId:
          checkId
      };
    }
  }

  if (
    !["pass", "review", "fail"]
      .includes(
        packet.evaluation.verdict
      )
  ) {
    return {
      valid: false,
      reason:
        "evidence_packet_verdict_incomplete"
    };
  }

  const sourceImageSha256 =
    normalizeSha256(
      packet.trace
        .sourceImageSha256
    );
  const outputImageSha256 =
    normalizeSha256(
      packet.trace
        .outputImageSha256
    );
  const renderSpecSha256 =
    normalizeSha256(
      packet.trace
        .renderSpecSha256
    );

  if (
    !sourceImageSha256 ||
    !outputImageSha256 ||
    !renderSpecSha256
  ) {
    return {
      valid: false,
      reason:
        "evidence_packet_trace_invalid"
    };
  }

  return {
    valid: true,
    caseId,
    sourceImageSha256,
    outputImageSha256,
    renderSpecSha256
  };
}

function validateIdentityScopeReview(
  review,
  caseId
) {
  if (
    !isObject(review) ||
    review.reviewVersion !==
      FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION ||
    review.status !== "ready" ||
    review.caseId !== caseId ||
    !normalizeSha256(
      review.responseDigest
    ) ||
    !isObject(review.checks) ||
    !isObject(review.responses)
  ) {
    return {
      valid: false,
      reason:
        "identity_scope_review_invalid"
    };
  }

  if (
    !sameStringSet(
      Object.keys(
        review.checks
      ),
      [
        "identity_preservation",
        "edit_scope"
      ]
    )
  ) {
    return {
      valid: false,
      reason:
        "identity_scope_review_checks_invalid"
    };
  }

  return {
    valid: true
  };
}

function validateRouteColorReview(
  review,
  caseId,
  renderSpecSha256
) {
  if (
    !isObject(review) ||
    review.reviewVersion !==
      FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION ||
    review.status !== "ready" ||
    review.caseId !== caseId ||
    !normalizeSha256(
      review.responseDigest
    ) ||
    !isObject(review.checks) ||
    !isObject(review.responses) ||
    review?.trace
      ?.renderSpecSha256 !==
      renderSpecSha256
  ) {
    return {
      valid: false,
      reason:
        "route_color_review_invalid"
    };
  }

  if (
    !sameStringSet(
      Object.keys(
        review.checks
      ),
      [
        "route_adherence",
        "color_fidelity"
      ]
    )
  ) {
    return {
      valid: false,
      reason:
        "route_color_review_checks_invalid"
    };
  }

  return {
    valid: true
  };
}

function cleanFinding(finding, checkId) {
  if (!isObject(finding)) return null;

  const code =
    cleanString(
      finding.code,
      80
    );
  const targetRef =
    cleanString(
      finding.targetRef,
      160
    );
  const severity =
    cleanString(
      finding.severity,
      40
    );
  const failureSource =
    cleanString(
      finding.failureSource,
      80
    );

  if (!code) return null;

  return {
    checkId,
    code,
    targetRef,
    severity,
    failureSource
  };
}

function collectFindings(packet) {
  const findings = [];

  for (
    const checkId of
    FACE_LAB_SIMULATION_EVALUATION_CHECKS
  ) {
    for (
      const finding of
      packet.evaluation
        .checks[checkId]
        ?.findings || []
    ) {
      const normalized =
        cleanFinding(
          finding,
          checkId
        );

      if (normalized) {
        findings.push(normalized);
      }
    }
  }

  return findings;
}

function normalizeResponseMatrix({
  source,
  expectedKeys
}) {
  if (!isObject(source)) {
    return null;
  }

  const normalized = {};

  for (const key of expectedKeys) {
    const value =
      cleanString(
        source[key],
        80
      );

    if (!value) return null;
    normalized[key] = value;
  }

  if (
    !sameStringSet(
      Object.keys(source),
      expectedKeys
    )
  ) {
    return null;
  }

  return normalized;
}

function sanitizeIdentityScopeResponses(review) {
  const identity =
    normalizeResponseMatrix({
      source:
        review?.responses
          ?.identity,
      expectedKeys:
        FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS
    });
  const editScope =
    normalizeResponseMatrix({
      source:
        review?.responses
          ?.editScope,
      expectedKeys:
        FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS
    });

  return identity && editScope
    ? {
        identity,
        editScope
      }
    : null;
}

function sanitizeRouteColorResponses(review) {
  const routeOperations =
    isObject(
      review?.responses
        ?.routeOperations
    )
      ? structuredClone(
          review.responses
            .routeOperations
        )
      : null;
  const colorTargets =
    isObject(
      review?.responses
        ?.colorTargets
    )
      ? structuredClone(
          review.responses
            .colorTargets
        )
      : null;

  if (
    !routeOperations ||
    !colorTargets
  ) {
    return null;
  }

  for (
    const matrix of
    [
      routeOperations,
      colorTargets
    ]
  ) {
    for (
      const [
        key,
        value
      ] of
      Object.entries(matrix)
    ) {
      if (
        !cleanString(key, 160) ||
        !cleanString(value, 80)
      ) {
        return null;
      }
    }
  }

  return {
    routeOperations,
    colorTargets
  };
}

function checkStatuses(packet) {
  return Object.fromEntries(
    FACE_LAB_SIMULATION_EVALUATION_CHECKS.map(
      (checkId) => [
        checkId,
        packet.evaluation
          .checks[checkId]
          .status
      ]
    )
  );
}

export function buildFaceLabSimulationCalibrationCase({
  campaignId,
  intentGroupId,
  generationIndex,
  changeIntensity,
  routeSelectionState,
  packet,
  identityScopeReview,
  routeColorReview
} = {}) {
  const normalizedCampaignId =
    identifier(campaignId);
  const normalizedIntentGroupId =
    identifier(intentGroupId);
  const normalizedGenerationIndex =
    Number.isInteger(
      generationIndex
    ) &&
    generationIndex > 0
      ? generationIndex
      : null;

  if (!normalizedCampaignId) {
    return invalidCase(
      "campaign_id_invalid"
    );
  }

  if (!normalizedIntentGroupId) {
    return invalidCase(
      "intent_group_id_invalid"
    );
  }

  if (!normalizedGenerationIndex) {
    return invalidCase(
      "generation_index_invalid"
    );
  }

  if (
    !CHANGE_INTENSITY_SET.has(
      changeIntensity
    )
  ) {
    return invalidCase(
      "change_intensity_invalid"
    );
  }

  if (
    !ROUTE_SELECTION_STATE_SET.has(
      routeSelectionState
    )
  ) {
    return invalidCase(
      "route_selection_state_invalid"
    );
  }

  const packetValidation =
    validateCompletedPacket(packet);

  if (!packetValidation.valid) {
    return invalidCase(
      packetValidation.reason,
      {
        incompleteCheckId:
          packetValidation
            .incompleteCheckId ||
          null
      }
    );
  }

  const caseId =
    packetValidation.caseId;

  const identityValidation =
    validateIdentityScopeReview(
      identityScopeReview,
      caseId
    );

  if (!identityValidation.valid) {
    return invalidCase(
      identityValidation.reason
    );
  }

  const routeColorValidation =
    validateRouteColorReview(
      routeColorReview,
      caseId,
      packetValidation
        .renderSpecSha256
    );

  if (!routeColorValidation.valid) {
    return invalidCase(
      routeColorValidation.reason
    );
  }

  if (
    !findEvidenceRef(
      packet,
      {
        version:
          identityScopeReview
            .reviewVersion,
        digest:
          identityScopeReview
            .responseDigest,
        checkIds: [
          "identity_preservation",
          "edit_scope"
        ]
      }
    )
  ) {
    return invalidCase(
      "identity_scope_review_not_bound"
    );
  }

  if (
    !findEvidenceRef(
      packet,
      {
        version:
          routeColorReview
            .reviewVersion,
        digest:
          routeColorReview
            .responseDigest,
        checkIds: [
          "route_adherence",
          "color_fidelity"
        ]
      }
    )
  ) {
    return invalidCase(
      "route_color_review_not_bound"
    );
  }

  const identityScopeResponses =
    sanitizeIdentityScopeResponses(
      identityScopeReview
    );
  const routeColorResponses =
    sanitizeRouteColorResponses(
      routeColorReview
    );

  if (
    !identityScopeResponses ||
    !routeColorResponses
  ) {
    return invalidCase(
      "review_response_matrix_invalid"
    );
  }

  const packetDigest =
    hashFaceLabAuthorityValue(
      packet
    );
  const intentBindingDigest =
    hashFaceLabAuthorityValue({
      sourceImageSha256:
        packetValidation
          .sourceImageSha256,
      renderSpecSha256:
        packetValidation
          .renderSpecSha256
    });

  return {
    caseVersion:
      FACE_LAB_SIMULATION_CALIBRATION_CASE_VERSION,
    status: "ready",
    reason:
      "calibration_case_built",
    campaignId:
      normalizedCampaignId,
    caseId,
    intentGroupId:
      normalizedIntentGroupId,
    generationIndex:
      normalizedGenerationIndex,
    cohort: {
      changeIntensity,
      routeSelectionState,
      colorIntent:
        packet.evaluation
          .colorFidelityRequired ===
          true,
      operationCount:
        Array.isArray(
          packet?.intent?.operations
        )
          ? packet.intent
              .operations.length
          : 0
    },
    trace: {
      simulationVersion:
        cleanString(
          packet.trace
            .simulationVersion,
          120
        ),
      instructionVersion:
        cleanString(
          packet.trace
            .instructionVersion,
          120
        ),
      renderSpecVersion:
        cleanString(
          packet.trace
            .renderSpecVersion,
          120
        ),
      renderSpecSha256:
        packetValidation
          .renderSpecSha256,
      routeId:
        cleanString(
          packet.trace
            .routeId,
          120
        ),
      lookId:
        cleanString(
          packet.trace
            .lookId,
          160
        ),
      intentBindingDigest
    },
    evidence: {
      evidencePacketVersion:
        packet.packetVersion,
      evidencePacketDigest:
        packetDigest,
      reviewRefs: [
        {
          evidenceVersion:
            identityScopeReview
              .reviewVersion,
          evidenceDigest:
            identityScopeReview
              .responseDigest,
          checkIds: [
            "edit_scope",
            "identity_preservation"
          ]
        },
        {
          evidenceVersion:
            routeColorReview
              .reviewVersion,
          evidenceDigest:
            routeColorReview
              .responseDigest,
          checkIds: [
            "color_fidelity",
            "route_adherence"
          ]
        }
      ]
    },
    evaluation: {
      verdict:
        packet.evaluation.verdict,
      checkStatuses:
        checkStatuses(packet),
      findings:
        collectFindings(packet)
    },
    observations: {
      ...identityScopeResponses,
      ...routeColorResponses
    },
    privacy: {
      rawImagesIncluded: false,
      sourceImageHashRetained:
        false,
      outputImageHashRetained:
        false,
      analysisHashRetained:
        false,
      stateHashRetained:
        false,
      reviewerRefRetained:
        false
    }
  };
}

function increment(
  object,
  key
) {
  object[key] =
    (object[key] || 0) + 1;
}

function incrementNested(
  object,
  outer,
  inner
) {
  if (!object[outer]) {
    object[outer] = {};
  }

  increment(
    object[outer],
    inner
  );
}

function validateCalibrationCase(
  value,
  campaignId
) {
  if (
    !isObject(value) ||
    value.caseVersion !==
      FACE_LAB_SIMULATION_CALIBRATION_CASE_VERSION ||
    value.status !== "ready" ||
    value.campaignId !==
      campaignId ||
    !identifier(value.caseId) ||
    !identifier(
      value.intentGroupId
    ) ||
    !Number.isInteger(
      value.generationIndex
    ) ||
    value.generationIndex <= 0 ||
    !isObject(value.cohort) ||
    !CHANGE_INTENSITY_SET.has(
      value.cohort
        .changeIntensity
    ) ||
    !ROUTE_SELECTION_STATE_SET.has(
      value.cohort
        .routeSelectionState
    ) ||
    typeof value.cohort
      .colorIntent !== "boolean" ||
    !Number.isInteger(
      value.cohort
        .operationCount
    ) ||
    value.cohort
      .operationCount < 0 ||
    !isObject(value.trace) ||
    !normalizeSha256(
      value.trace
        .intentBindingDigest
    ) ||
    !normalizeSha256(
      value.trace
        .renderSpecSha256
    ) ||
    !isObject(value.evaluation) ||
    !["pass", "review", "fail"]
      .includes(
        value.evaluation.verdict
      ) ||
    !isObject(
      value.evaluation
        .checkStatuses
    ) ||
    !FACE_LAB_SIMULATION_EVALUATION_CHECKS.every(
      (checkId) =>
        typeof value.evaluation
          .checkStatuses[checkId] ===
          "string" &&
        value.evaluation
          .checkStatuses[checkId] !==
          "not_evaluated"
    ) ||
    !Array.isArray(
      value.evaluation
        .findings
    ) ||
    !isObject(value.observations) ||
    !isObject(
      value.observations
        .identity
    ) ||
    !isObject(
      value.observations
        .editScope
    ) ||
    !isObject(
      value.observations
        .routeOperations
    ) ||
    !isObject(
      value.observations
        .colorTargets
    ) ||
    !isObject(value.privacy) ||
    value.privacy
      .rawImagesIncluded !== false ||
    value.privacy
      .sourceImageHashRetained !== false ||
    value.privacy
      .outputImageHashRetained !== false ||
    value.privacy
      .analysisHashRetained !== false ||
    value.privacy
      .stateHashRetained !== false ||
    value.privacy
      .reviewerRefRetained !== false
  ) {
    return false;
  }

  return true;
}

function responseSignature(value) {
  return hashFaceLabAuthorityValue(
    value || {}
  );
}

export function aggregateFaceLabSimulationCalibration({
  campaignId,
  cases
} = {}) {
  const normalizedCampaignId =
    identifier(campaignId);

  if (!normalizedCampaignId) {
    return invalidAggregate(
      "campaign_id_invalid"
    );
  }

  if (
    !Array.isArray(cases) ||
    !cases.length
  ) {
    return invalidAggregate(
      "cases_missing"
    );
  }

  const caseIds = new Set();
  const generationKeys =
    new Set();
  const groups = new Map();

  for (const item of cases) {
    if (
      !validateCalibrationCase(
        item,
        normalizedCampaignId
      )
    ) {
      return invalidAggregate(
        "calibration_case_invalid"
      );
    }

    if (caseIds.has(item.caseId)) {
      return invalidAggregate(
        "case_id_duplicate",
        { caseId: item.caseId }
      );
    }
    caseIds.add(item.caseId);

    const generationKey =
      item.intentGroupId +
      ":" +
      item.generationIndex;

    if (
      generationKeys.has(
        generationKey
      )
    ) {
      return invalidAggregate(
        "generation_index_duplicate",
        {
          intentGroupId:
            item.intentGroupId,
          generationIndex:
            item.generationIndex
        }
      );
    }
    generationKeys.add(
      generationKey
    );

    if (
      !groups.has(
        item.intentGroupId
      )
    ) {
      groups.set(
        item.intentGroupId,
        []
      );
    }

    groups
      .get(item.intentGroupId)
      .push(item);
  }

  for (
    const [
      intentGroupId,
      groupCases
    ] of groups
  ) {
    const bindingDigests =
      new Set(
        groupCases.map(
          (item) =>
            item.trace
              .intentBindingDigest
        )
      );
    const renderDigests =
      new Set(
        groupCases.map(
          (item) =>
            item.trace
              .renderSpecSha256
        )
      );

    if (
      bindingDigests.size !== 1 ||
      renderDigests.size !== 1
    ) {
      return invalidAggregate(
        "intent_group_binding_mismatch",
        { intentGroupId }
      );
    }
  }

  const verdictCounts = {};
  const checkStatusCounts = {};
  const findingCodeCounts = {};
  const failureSourceCounts = {};
  const identityDimensionCounts = {};
  const editScopeDimensionCounts = {};
  const routeOperationCounts = {};
  const colorOperationCounts = {};
  const changeIntensityCounts = {};
  const routeSelectionStateCounts = {};
  let hardFailureCaseCount = 0;

  for (const item of cases) {
    increment(
      verdictCounts,
      item.evaluation.verdict
    );
    increment(
      changeIntensityCounts,
      item.cohort
        .changeIntensity
    );
    increment(
      routeSelectionStateCounts,
      item.cohort
        .routeSelectionState
    );

    for (
      const checkId of
      FACE_LAB_SIMULATION_EVALUATION_CHECKS
    ) {
      incrementNested(
        checkStatusCounts,
        checkId,
        item.evaluation
          .checkStatuses[checkId]
      );
    }

    let hasHardFinding = false;

    for (
      const finding of
      item.evaluation.findings || []
    ) {
      increment(
        findingCodeCounts,
        finding.code
      );

      if (
        finding.failureSource
      ) {
        increment(
          failureSourceCounts,
          finding.failureSource
        );
      }

      if (
        finding.severity ===
        "hard"
      ) {
        hasHardFinding = true;
      }
    }

    if (hasHardFinding) {
      hardFailureCaseCount += 1;
    }

    for (
      const [
        dimension,
        response
      ] of
      Object.entries(
        item.observations
          .identity || {}
      )
    ) {
      incrementNested(
        identityDimensionCounts,
        dimension,
        response
      );
    }

    for (
      const [
        dimension,
        response
      ] of
      Object.entries(
        item.observations
          .editScope || {}
      )
    ) {
      incrementNested(
        editScopeDimensionCounts,
        dimension,
        response
      );
    }

    for (
      const [
        operationId,
        response
      ] of
      Object.entries(
        item.observations
          .routeOperations || {}
      )
    ) {
      incrementNested(
        routeOperationCounts,
        operationId,
        response
      );
    }

    for (
      const [
        operationId,
        response
      ] of
      Object.entries(
        item.observations
          .colorTargets || {}
      )
    ) {
      incrementNested(
        colorOperationCounts,
        operationId,
        response
      );
    }
  }

  let repeatGroupCount = 0;
  let verdictDisagreementGroupCount = 0;
  let checkDisagreementGroupCount = 0;
  let routeResponseVarianceGroupCount = 0;
  let colorResponseVarianceGroupCount = 0;

  for (const groupCases of groups.values()) {
    if (groupCases.length < 2) {
      continue;
    }

    repeatGroupCount += 1;

    if (
      new Set(
        groupCases.map(
          (item) =>
            item.evaluation.verdict
        )
      ).size > 1
    ) {
      verdictDisagreementGroupCount += 1;
    }

    if (
      new Set(
        groupCases.map(
          (item) =>
            responseSignature(
              item.evaluation
                .checkStatuses
            )
        )
      ).size > 1
    ) {
      checkDisagreementGroupCount += 1;
    }

    if (
      new Set(
        groupCases.map(
          (item) =>
            responseSignature(
              item.observations
                .routeOperations
            )
        )
      ).size > 1
    ) {
      routeResponseVarianceGroupCount += 1;
    }

    if (
      new Set(
        groupCases.map(
          (item) =>
            responseSignature(
              item.observations
                .colorTargets
            )
        )
      ).size > 1
    ) {
      colorResponseVarianceGroupCount += 1;
    }
  }

  return {
    aggregateVersion:
      FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_VERSION,
    status: "ready",
    reason:
      "calibration_campaign_aggregated",
    campaignId:
      normalizedCampaignId,
    caseCount:
      cases.length,
    intentGroupCount:
      groups.size,
    repeatGroupCount,
    verdictCounts,
    checkStatusCounts,
    hardFailureCaseCount,
    findingCodeCounts,
    failureSourceCounts,
    cohortCounts: {
      changeIntensity:
        changeIntensityCounts,
      routeSelectionState:
        routeSelectionStateCounts
    },
    observationCounts: {
      identity:
        identityDimensionCounts,
      editScope:
        editScopeDimensionCounts,
      routeOperations:
        routeOperationCounts,
      colorTargets:
        colorOperationCounts
    },
    repeatVariance: {
      verdictDisagreementGroupCount,
      checkDisagreementGroupCount,
      routeResponseVarianceGroupCount,
      colorResponseVarianceGroupCount,
      interpretation:
        "Observed disagreement inside the same source-plus-Render-Spec binding is a variance signal, not automatic provider-cause attribution."
    },
    caseRefs:
      cases
        .map((item) => ({
          caseId:
            item.caseId,
          intentGroupId:
            item.intentGroupId,
          generationIndex:
            item.generationIndex,
          verdict:
            item.evaluation.verdict
        }))
        .sort(
          (left, right) =>
            left.caseId.localeCompare(
              right.caseId
            )
        ),
    privacy: {
      rawImagesIncluded: false,
      imageHashesIncluded: false,
      reviewerRefsIncluded: false,
      analysisOrStateHashesIncluded:
        false
    }
  };
}
