import {
  hashFaceLabAuthorityValue
} from "../simulation-authority-core.js";

export const FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION =
  "face-lab-simulation-identity-scope-review-v1";

export const FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS = Object.freeze([
  "facial_geometry",
  "eye_anatomy",
  "nose_geometry",
  "jaw_chin_geometry",
  "ear_geometry"
]);

export const FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS = Object.freeze([
  "face_structure",
  "background",
  "clothing",
  "body",
  "head_pose",
  "camera_perspective",
  "expression",
  "lighting_direction",
  "unrequested_beautification"
]);

export const FACE_LAB_SIMULATION_IDENTITY_REVIEW_VALUES = Object.freeze([
  "stable",
  "minor_drift",
  "major_drift",
  "not_assessable"
]);

export const FACE_LAB_SIMULATION_SCOPE_REVIEW_VALUES = Object.freeze([
  "unchanged",
  "minor_change",
  "major_change",
  "not_assessable"
]);

const IDENTITY_VALUE_SET =
  new Set(
    FACE_LAB_SIMULATION_IDENTITY_REVIEW_VALUES
  );
const SCOPE_VALUE_SET =
  new Set(
    FACE_LAB_SIMULATION_SCOPE_REVIEW_VALUES
  );

const HARD_SCOPE_CODES = Object.freeze({
  face_structure:
    "SCOPE_FACE_STRUCTURE",
  background:
    "SCOPE_BACKGROUND",
  clothing:
    "SCOPE_CLOTHING",
  body:
    "SCOPE_BODY",
  head_pose:
    "SCOPE_HEAD_POSE",
  camera_perspective:
    "SCOPE_CAMERA_PERSPECTIVE",
  expression:
    "SCOPE_EXPRESSION",
  lighting_direction:
    "SCOPE_LIGHTING_DIRECTION"
});

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

function invalid(reason, details = {}) {
  return {
    reviewVersion:
      FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION,
    status: "invalid",
    reason,
    checks: null,
    ...details
  };
}

function normalizeDimensionResponses({
  source,
  dimensions,
  allowedValues,
  group
}) {
  if (!isObject(source)) {
    return {
      valid: false,
      reason: group + "_responses_missing"
    };
  }

  const normalized = {};

  for (const dimension of dimensions) {
    const value =
      cleanString(source[dimension], 40);

    if (!allowedValues.has(value)) {
      return {
        valid: false,
        reason:
          group +
          "_response_invalid",
        invalidDimension:
          dimension
      };
    }

    normalized[dimension] = value;
  }

  const unknownDimensions =
    Object.keys(source).filter(
      (dimension) =>
        !dimensions.includes(dimension)
    );

  if (unknownDimensions.length) {
    return {
      valid: false,
      reason:
        group +
        "_unknown_dimension",
      unknownDimensions
    };
  }

  return {
    valid: true,
    normalized
  };
}

function identityCheck(responses) {
  const notAssessable =
    FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS
      .filter(
        (dimension) =>
          responses[dimension] ===
          "not_assessable"
      );
  const major =
    FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS
      .filter(
        (dimension) =>
          responses[dimension] ===
          "major_drift"
      );
  const minor =
    FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS
      .filter(
        (dimension) =>
          responses[dimension] ===
          "minor_drift"
      );

  if (major.length) {
    return {
      check: {
        status: "fail",
        findings:
          major.map((dimension) => ({
            code:
              "IDENTITY_MAJOR_DRIFT",
            targetRef: dimension,
            failureSource:
              "evaluation_uncertain"
          }))
      },
      diagnostics: {
        notAssessableDimensions:
          notAssessable,
        majorDriftDimensions:
          major,
        minorDriftDimensions:
          minor
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
        notAssessableDimensions:
          notAssessable,
        majorDriftDimensions: [],
        minorDriftDimensions:
          minor
      }
    };
  }

  if (minor.length) {
    return {
      check: {
        status: "review",
        findings:
          minor.map((dimension) => ({
            code:
              "IDENTITY_MINOR_DRIFT",
            targetRef: dimension,
            failureSource:
              "evaluation_uncertain"
          }))
      },
      diagnostics: {
        notAssessableDimensions: [],
        majorDriftDimensions: [],
        minorDriftDimensions:
          minor
      }
    };
  }

  return {
    check: {
      status: "pass",
      findings: []
    },
    diagnostics: {
      notAssessableDimensions: [],
      majorDriftDimensions: [],
      minorDriftDimensions: []
    }
  };
}

function editScopeCheck(responses) {
  const notAssessable =
    FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS
      .filter(
        (dimension) =>
          responses[dimension] ===
          "not_assessable"
      );
  const major =
    FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS
      .filter(
        (dimension) =>
          responses[dimension] ===
          "major_change"
      );
  const minor =
    FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS
      .filter(
        (dimension) =>
          responses[dimension] ===
          "minor_change"
      );

  const hardMajor =
    major.filter(
      (dimension) =>
        Boolean(
          HARD_SCOPE_CODES[dimension]
        )
    );

  if (hardMajor.length) {
    return {
      check: {
        status: "fail",
        findings:
          hardMajor.map((dimension) => ({
            code:
              HARD_SCOPE_CODES[dimension],
            targetRef: dimension,
            failureSource:
              "evaluation_uncertain"
          }))
      },
      diagnostics: {
        notAssessableDimensions:
          notAssessable,
        majorChangeDimensions:
          major,
        minorChangeDimensions:
          minor
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
        notAssessableDimensions:
          notAssessable,
        majorChangeDimensions:
          major,
        minorChangeDimensions:
          minor
      }
    };
  }

  const findings = [];

  for (const dimension of minor) {
    if (
      dimension ===
      "unrequested_beautification"
    ) {
      findings.push({
        code:
          "SCOPE_UNREQUESTED_BEAUTIFICATION",
        targetRef: dimension,
        failureSource:
          "evaluation_uncertain"
      });
    } else {
      findings.push({
        code: "OVER_EDITED",
        targetRef: dimension,
        failureSource:
          "evaluation_uncertain"
      });
    }
  }

  if (
    major.includes(
      "unrequested_beautification"
    )
  ) {
    findings.push({
      code:
        "SCOPE_UNREQUESTED_BEAUTIFICATION",
      targetRef:
        "unrequested_beautification",
      failureSource:
        "evaluation_uncertain"
    });
  }

  if (findings.length) {
    return {
      check: {
        status: "review",
        findings
      },
      diagnostics: {
        notAssessableDimensions: [],
        majorChangeDimensions:
          major,
        minorChangeDimensions:
          minor
      }
    };
  }

  return {
    check: {
      status: "pass",
      findings: []
    },
    diagnostics: {
      notAssessableDimensions: [],
      majorChangeDimensions: [],
      minorChangeDimensions: []
    }
  };
}

export function buildFaceLabSimulationIdentityScopeReview({
  caseId,
  reviewerRef,
  identity,
  editScope
} = {}) {
  const normalizedCaseId =
    cleanString(caseId, 120);
  const normalizedReviewerRef =
    cleanString(reviewerRef, 120);

  if (!normalizedCaseId) {
    return invalid("case_id_missing");
  }

  if (!normalizedReviewerRef) {
    return invalid(
      "reviewer_ref_missing"
    );
  }

  const identityNormalized =
    normalizeDimensionResponses({
      source: identity,
      dimensions:
        FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS,
      allowedValues:
        IDENTITY_VALUE_SET,
      group: "identity"
    });

  if (!identityNormalized.valid) {
    return invalid(
      identityNormalized.reason,
      {
        invalidDimension:
          identityNormalized
            .invalidDimension ||
          null,
        unknownDimensions:
          identityNormalized
            .unknownDimensions ||
          []
      }
    );
  }

  const scopeNormalized =
    normalizeDimensionResponses({
      source: editScope,
      dimensions:
        FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS,
      allowedValues:
        SCOPE_VALUE_SET,
      group: "edit_scope"
    });

  if (!scopeNormalized.valid) {
    return invalid(
      scopeNormalized.reason,
      {
        invalidDimension:
          scopeNormalized
            .invalidDimension ||
          null,
        unknownDimensions:
          scopeNormalized
            .unknownDimensions ||
          []
      }
    );
  }

  const identityResult =
    identityCheck(
      identityNormalized.normalized
    );
  const scopeResult =
    editScopeCheck(
      scopeNormalized.normalized
    );

  const sealedResponse = {
    reviewVersion:
      FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION,
    caseId:
      normalizedCaseId,
    reviewerRef:
      normalizedReviewerRef,
    identity:
      identityNormalized.normalized,
    editScope:
      scopeNormalized.normalized
  };

  return {
    reviewVersion:
      FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION,
    status: "ready",
    reason:
      "identity_scope_review_built",
    caseId:
      normalizedCaseId,
    reviewerRef:
      normalizedReviewerRef,
    responseDigest:
      hashFaceLabAuthorityValue(
        sealedResponse
      ),
    responses: {
      identity:
        identityNormalized.normalized,
      editScope:
        scopeNormalized.normalized
    },
    diagnostics: {
      identity:
        identityResult.diagnostics,
      editScope:
        scopeResult.diagnostics
    },
    checks: {
      identity_preservation:
        identityResult.check,
      edit_scope:
        scopeResult.check
    },
    rawImagesIncluded: false
  };
}
