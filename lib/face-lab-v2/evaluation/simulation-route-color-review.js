import {
  hashFaceLabAuthorityValue
} from "../simulation-authority-core.js";
import {
  reconstructFaceLabSimulationRenderAuthority
} from "../simulation-render-authority.js";

export const FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION =
  "face-lab-simulation-route-color-review-v1";

export const FACE_LAB_SIMULATION_ROUTE_REVIEW_VALUES = Object.freeze([
  "executed",
  "partial",
  "missed",
  "contradicted",
  "not_assessable"
]);

export const FACE_LAB_SIMULATION_COLOR_REVIEW_VALUES = Object.freeze([
  "on_target",
  "near_target",
  "off_target",
  "not_assessable"
]);

const ROUTE_VALUE_SET =
  new Set(
    FACE_LAB_SIMULATION_ROUTE_REVIEW_VALUES
  );
const COLOR_VALUE_SET =
  new Set(
    FACE_LAB_SIMULATION_COLOR_REVIEW_VALUES
  );

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
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim();

  return /^[a-f0-9]{64}$/i.test(
    normalized
  )
    ? normalized.toLowerCase()
    : null;
}

function reviewerRefIsPseudonymous(value) {
  return Boolean(
    value &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(
      value
    )
  );
}

function hasObjectValues(value) {
  return isObject(value) &&
    Object.values(value).some((item) => {
      if (Array.isArray(item)) {
        return item.length > 0;
      }

      if (isObject(item)) {
        return Object.keys(item).length > 0;
      }

      return (
        item !== null &&
        item !== undefined &&
        item !== ""
      );
    });
}

function colorAuthorityHasIntent(value) {
  if (!isObject(value)) return false;

  if (
    typeof value.fidelityState === "string" &&
    value.fidelityState !== "none"
  ) {
    return true;
  }

  return [
    value.candidateSemanticAttributes,
    value.requestedSemanticAttributes,
    value.preferredSemanticAttributes
  ].some(hasObjectValues);
}

function cleanStringList(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .filter(
          (value) =>
            typeof value === "string" &&
            value.trim()
        )
        .map((value) => value.trim())
    )
  ];
}

function safeObject(value) {
  return isObject(value)
    ? structuredClone(value)
    : {};
}

function safeAnchor(anchor) {
  if (!isObject(anchor)) return null;

  const anchorId =
    cleanString(anchor.anchorId, 160);
  const role =
    cleanString(anchor.role, 80);
  const colorSpace =
    cleanString(anchor.colorSpace, 80);

  if (
    !anchorId ||
    !role ||
    !colorSpace
  ) {
    return null;
  }

  return {
    anchorId,
    role,
    colorSpace,
    value:
      structuredClone(
        anchor.value
      )
  };
}

function routeTarget(operation) {
  return {
    operationId:
      cleanString(
        operation?.operationId,
        160
      ),
    slotKey:
      cleanString(
        operation?.slotKey,
        120
      ),
    sourceMode:
      cleanString(
        operation?.sourceMode,
        80
      ),
    targetRegions:
      cleanStringList(
        operation?.targetRegions
      ),
    application: {
      placement:
        cleanStringList(
          operation
            ?.application
            ?.placement
        ),
      direction:
        cleanStringList(
          operation
            ?.application
            ?.direction
        ),
      intensity:
        cleanString(
          operation
            ?.application
            ?.intensity,
          120
        ),
      notes:
        cleanStringList(
          operation
            ?.application
            ?.notes
        )
    },
    criteria: {
      requiredAttributes:
        safeObject(
          operation
            ?.criteria
            ?.requiredAttributes
        ),
      preferredAttributes:
        safeObject(
          operation
            ?.criteria
            ?.preferredAttributes
        ),
      excludedAttributes:
        safeObject(
          operation
            ?.criteria
            ?.excludedAttributes
        )
    }
  };
}

function colorTarget(operation) {
  const colorAuthority =
    operation?.colorAuthority || {};

  return {
    operationId:
      cleanString(
        operation?.operationId,
        160
      ),
    slotKey:
      cleanString(
        operation?.slotKey,
        120
      ),
    targetRegions:
      cleanStringList(
        operation?.targetRegions
      ),
    fidelityState:
      cleanString(
        colorAuthority
          .fidelityState,
        80
      ),
    primaryAnchor:
      safeAnchor(
        colorAuthority
          .primaryAnchor
      ),
    candidateSemanticAttributes:
      safeObject(
        colorAuthority
          .candidateSemanticAttributes
      ),
    requestedSemanticAttributes:
      safeObject(
        colorAuthority
          .requestedSemanticAttributes
      ),
    preferredSemanticAttributes:
      safeObject(
        colorAuthority
          .preferredSemanticAttributes
      )
  };
}

function invalid(reason, details = {}) {
  return {
    reviewVersion:
      FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION,
    status: "invalid",
    reason,
    checks: null,
    ...details
  };
}

function buildAuthority({
  analysis,
  rawState,
  locale
}) {
  const reconstructed =
    reconstructFaceLabSimulationRenderAuthority({
      analysis,
      rawState,
      locale
    });

  if (reconstructed.status !== "ready") {
    return {
      valid: false,
      reason:
        reconstructed.reason
    };
  }

  const operations =
    Array.isArray(
      reconstructed.renderSpec
        ?.operations
    )
      ? reconstructed
          .renderSpec
          .operations
      : [];

  if (!operations.length) {
    return {
      valid: false,
      reason:
        "render_operations_missing"
    };
  }

  const routeTargets =
    operations.map(routeTarget);
  const routeIds =
    routeTargets
      .map((target) =>
        target.operationId
      );

  if (
    routeIds.some(
      (value) => !value
    ) ||
    new Set(routeIds).size !==
      routeIds.length
  ) {
    return {
      valid: false,
      reason:
        "render_operation_identity_invalid"
    };
  }

  const colorTargets =
    operations
      .filter(
        (operation) =>
          colorAuthorityHasIntent(
            operation
              ?.colorAuthority
          )
      )
      .map(colorTarget);

  return {
    valid: true,
    reconstructed,
    routeTargets,
    colorTargets
  };
}

function normalizeResponseMap({
  source,
  expectedIds,
  allowedValues,
  group
}) {
  if (!isObject(source)) {
    return {
      valid: false,
      reason:
        group +
        "_responses_missing"
    };
  }

  const actualIds =
    Object.keys(source)
      .sort();
  const sortedExpected =
    [...expectedIds].sort();

  if (
    JSON.stringify(actualIds) !==
    JSON.stringify(sortedExpected)
  ) {
    return {
      valid: false,
      reason:
        group +
        "_response_targets_mismatch",
      expectedIds:
        sortedExpected,
      actualIds
    };
  }

  const normalized = {};

  for (
    const targetId of
    sortedExpected
  ) {
    const value =
      cleanString(
        source[targetId],
        40
      );

    if (!allowedValues.has(value)) {
      return {
        valid: false,
        reason:
          group +
          "_response_invalid",
        invalidTargetId:
          targetId
      };
    }

    normalized[targetId] = value;
  }

  return {
    valid: true,
    normalized
  };
}

function routeCheck(responses) {
  const ids =
    Object.keys(responses);
  const contradicted =
    ids.filter(
      (id) =>
        responses[id] ===
        "contradicted"
    );
  const missed =
    ids.filter(
      (id) =>
        responses[id] ===
        "missed"
    );
  const partial =
    ids.filter(
      (id) =>
        responses[id] ===
        "partial"
    );
  const notAssessable =
    ids.filter(
      (id) =>
        responses[id] ===
        "not_assessable"
    );

  const findings = [
    ...contradicted.map(
      (operationId) => ({
        code:
          "ROUTE_OPERATION_CONTRADICTED",
        targetRef:
          operationId,
        failureSource:
          "evaluation_uncertain"
      })
    ),
    ...missed.map(
      (operationId) => ({
        code:
          "ROUTE_OPERATION_MISSED",
        targetRef:
          operationId,
        failureSource:
          "evaluation_uncertain"
      })
    ),
    ...partial.map(
      (operationId) => ({
        code:
          "UNDER_EDITED",
        targetRef:
          operationId,
        failureSource:
          "evaluation_uncertain"
      })
    )
  ];

  if (findings.length) {
    return {
      check: {
        status: "review",
        findings
      },
      diagnostics: {
        contradictedOperationIds:
          contradicted,
        missedOperationIds:
          missed,
        partialOperationIds:
          partial,
        notAssessableOperationIds:
          notAssessable
      }
    };
  }

  if (notAssessable.length) {
    return {
      check: {
        status:
          "not_evaluated",
        findings: []
      },
      diagnostics: {
        contradictedOperationIds: [],
        missedOperationIds: [],
        partialOperationIds: [],
        notAssessableOperationIds:
          notAssessable
      }
    };
  }

  return {
    check: {
      status: "pass",
      findings: []
    },
    diagnostics: {
      contradictedOperationIds: [],
      missedOperationIds: [],
      partialOperationIds: [],
      notAssessableOperationIds: []
    }
  };
}

function colorCheck(
  responses,
  expectedIds
) {
  if (!expectedIds.length) {
    return {
      check: {
        status:
          "not_applicable",
        findings: []
      },
      diagnostics: {
        offTargetOperationIds: [],
        nearTargetOperationIds: [],
        notAssessableOperationIds: []
      }
    };
  }

  const offTarget =
    expectedIds.filter(
      (id) =>
        responses[id] ===
        "off_target"
    );
  const nearTarget =
    expectedIds.filter(
      (id) =>
        responses[id] ===
        "near_target"
    );
  const notAssessable =
    expectedIds.filter(
      (id) =>
        responses[id] ===
        "not_assessable"
    );

  if (offTarget.length) {
    return {
      check: {
        status: "review",
        findings:
          offTarget.map(
            (operationId) => ({
              code:
                "COLOR_OFF_TARGET",
              targetRef:
                operationId,
              failureSource:
                "evaluation_uncertain"
            })
          )
      },
      diagnostics: {
        offTargetOperationIds:
          offTarget,
        nearTargetOperationIds:
          nearTarget,
        notAssessableOperationIds:
          notAssessable
      }
    };
  }

  if (notAssessable.length) {
    return {
      check: {
        status:
          "not_evaluated",
        findings: []
      },
      diagnostics: {
        offTargetOperationIds: [],
        nearTargetOperationIds:
          nearTarget,
        notAssessableOperationIds:
          notAssessable
      }
    };
  }

  return {
    check: {
      status: "pass",
      findings: []
    },
    diagnostics: {
      offTargetOperationIds: [],
      nearTargetOperationIds:
        nearTarget,
      notAssessableOperationIds: []
    }
  };
}

export function buildFaceLabSimulationRouteColorReviewTemplate({
  caseId,
  analysis,
  rawState,
  locale = "ko"
} = {}) {
  const normalizedCaseId =
    cleanString(caseId, 120);

  if (!normalizedCaseId) {
    return invalid(
      "case_id_missing"
    );
  }

  const authority =
    buildAuthority({
      analysis,
      rawState,
      locale
    });

  if (!authority.valid) {
    return invalid(
      authority.reason
    );
  }

  return {
    reviewVersion:
      FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION,
    status: "ready",
    reason:
      "route_color_review_template_built",
    caseId:
      normalizedCaseId,
    locale:
      locale === "en" ? "en" : "ko",
    trace: {
      routeId:
        authority.reconstructed
          .renderSpec.routeId,
      lookId:
        authority.reconstructed
          .renderSpec.lookId,
      renderSpecVersion:
        authority.reconstructed
          .renderSpec
          .renderSpecVersion,
      renderSpecSha256:
        authority.reconstructed
          .renderSpecSha256
    },
    routeTargets:
      authority.routeTargets,
    colorTargets:
      authority.colorTargets,
    responseTemplate: {
      renderSpecSha256:
        authority.reconstructed
          .renderSpecSha256,
      routeOperations:
        Object.fromEntries(
          authority.routeTargets
            .map((target) => [
              target.operationId,
              null
            ])
        ),
      colorTargets:
        Object.fromEntries(
          authority.colorTargets
            .map((target) => [
              target.operationId,
              null
            ])
        )
    },
    rawImagesIncluded: false
  };
}

export function buildFaceLabSimulationRouteColorReview({
  caseId,
  reviewerRef,
  analysis,
  rawState,
  locale = "ko",
  renderSpecSha256,
  routeOperations,
  colorTargets
} = {}) {
  const normalizedCaseId =
    cleanString(caseId, 120);
  const normalizedReviewerRef =
    cleanString(
      reviewerRef,
      120
    );

  if (!normalizedCaseId) {
    return invalid(
      "case_id_missing"
    );
  }

  if (!normalizedReviewerRef) {
    return invalid(
      "reviewer_ref_missing"
    );
  }

  if (
    !reviewerRefIsPseudonymous(
      normalizedReviewerRef
    )
  ) {
    return invalid(
      "reviewer_ref_not_pseudonymous"
    );
  }

  const authority =
    buildAuthority({
      analysis,
      rawState,
      locale
    });

  if (!authority.valid) {
    return invalid(
      authority.reason
    );
  }

  const normalizedDigest =
    normalizeSha256(
      renderSpecSha256
    );

  if (
    !normalizedDigest ||
    normalizedDigest !==
      authority.reconstructed
        .renderSpecSha256
  ) {
    return invalid(
      "render_spec_digest_mismatch"
    );
  }

  const routeIds =
    authority.routeTargets
      .map((target) =>
        target.operationId
      );
  const colorIds =
    authority.colorTargets
      .map((target) =>
        target.operationId
      );

  const normalizedRoute =
    normalizeResponseMap({
      source:
        routeOperations,
      expectedIds:
        routeIds,
      allowedValues:
        ROUTE_VALUE_SET,
      group: "route"
    });

  if (!normalizedRoute.valid) {
    return invalid(
      normalizedRoute.reason,
      {
        invalidTargetId:
          normalizedRoute
            .invalidTargetId ||
          null,
        expectedIds:
          normalizedRoute
            .expectedIds ||
          [],
        actualIds:
          normalizedRoute
            .actualIds ||
          []
      }
    );
  }

  const normalizedColor =
    normalizeResponseMap({
      source:
        colorTargets,
      expectedIds:
        colorIds,
      allowedValues:
        COLOR_VALUE_SET,
      group: "color"
    });

  if (!normalizedColor.valid) {
    return invalid(
      normalizedColor.reason,
      {
        invalidTargetId:
          normalizedColor
            .invalidTargetId ||
          null,
        expectedIds:
          normalizedColor
            .expectedIds ||
          [],
        actualIds:
          normalizedColor
            .actualIds ||
          []
      }
    );
  }

  const routeResult =
    routeCheck(
      normalizedRoute.normalized
    );
  const colorResult =
    colorCheck(
      normalizedColor.normalized,
      colorIds
    );

  const sealedResponse = {
    reviewVersion:
      FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION,
    caseId:
      normalizedCaseId,
    reviewerRef:
      normalizedReviewerRef,
    renderSpecSha256:
      authority.reconstructed
        .renderSpecSha256,
    routeOperations:
      normalizedRoute.normalized,
    colorTargets:
      normalizedColor.normalized
  };

  return {
    reviewVersion:
      FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION,
    status: "ready",
    reason:
      "route_color_review_built",
    caseId:
      normalizedCaseId,
    reviewerRef:
      normalizedReviewerRef,
    responseDigest:
      hashFaceLabAuthorityValue(
        sealedResponse
      ),
    trace: {
      routeId:
        authority.reconstructed
          .renderSpec.routeId,
      lookId:
        authority.reconstructed
          .renderSpec.lookId,
      renderSpecVersion:
        authority.reconstructed
          .renderSpec
          .renderSpecVersion,
      renderSpecSha256:
        authority.reconstructed
          .renderSpecSha256
    },
    responses: {
      routeOperations:
        normalizedRoute.normalized,
      colorTargets:
        normalizedColor.normalized
    },
    diagnostics: {
      route:
        routeResult.diagnostics,
      color:
        colorResult.diagnostics
    },
    checks: {
      route_adherence:
        routeResult.check,
      color_fidelity:
        colorResult.check
    },
    rawImagesIncluded: false
  };
}
