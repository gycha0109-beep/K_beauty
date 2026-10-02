import {
  faceLabPrivateArtifactStem,
  isFaceLabPrivateArtifactCaseId
} from "./private-artifact-filename.js";

export const FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION =
  "face-lab-simulation-pilot-capture-v1";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const IMAGE_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

function cleanString(value, maxLength = 160) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > maxLength
  ) {
    return null;
  }

  return normalized;
}

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function normalizeSha256(value) {
  const normalized =
    cleanString(value, 64);

  if (
    !normalized ||
    !SHA256_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized.toLowerCase();
}

function normalizeMimeType(value) {
  const normalized =
    cleanString(value, 64)
      ?.toLowerCase();

  return normalized &&
    IMAGE_EXTENSIONS[normalized]
      ? normalized
      : null;
}

function invalid(reason, extra = {}) {
  return {
    status: "invalid",
    reason,
    ...extra
  };
}

function validateReview(
  review,
  expectedCaseId,
  label
) {
  if (
    !isObject(review) ||
    review.status !== "ready" ||
    review.caseId !== expectedCaseId ||
    !cleanString(
      review.reviewVersion,
      160
    ) ||
    !normalizeSha256(
      review.responseDigest
    ) ||
    !isObject(review.checks)
  ) {
    return invalid(
      "pilot_capture_review_invalid",
      { review: label }
    );
  }

  return {
    status: "ready"
  };
}

export function buildFaceLabSimulationPilotCapture({
  caseId,
  locale = "ko",
  sourceMimeType,
  outputMimeType,
  analysis,
  faceLabV2State,
  responseMeta,
  identityScopeReview,
  routeColorReview
}) {
  const normalizedCaseId =
    cleanString(caseId, 120);

  if (
    !normalizedCaseId ||
    !isFaceLabPrivateArtifactCaseId(
      normalizedCaseId
    )
  ) {
    return invalid(
      "pilot_capture_case_id_invalid"
    );
  }

  const normalizedLocale =
    locale === "en"
      ? "en"
      : locale === "ko"
        ? "ko"
        : null;
  const normalizedSourceMimeType =
    normalizeMimeType(
      sourceMimeType
    );
  const normalizedOutputMimeType =
    normalizeMimeType(
      outputMimeType
    );

  if (!normalizedLocale) {
    return invalid(
      "pilot_capture_locale_invalid"
    );
  }

  if (
    !normalizedSourceMimeType ||
    !normalizedOutputMimeType
  ) {
    return invalid(
      "pilot_capture_image_type_invalid"
    );
  }

  if (
    !isObject(analysis) ||
    !isObject(faceLabV2State) ||
    !isObject(responseMeta)
  ) {
    return invalid(
      "pilot_capture_context_invalid"
    );
  }

  const reviewCaseId =
    cleanString(
      responseMeta.reviewCaseId,
      120
    );
  const simulationVersion =
    cleanString(
      responseMeta.simulationVersion,
      160
    );
  const instructionVersion =
    cleanString(
      responseMeta.instructionVersion,
      160
    );
  const providerConfigVersion =
    cleanString(
      responseMeta.providerConfigVersion,
      160
    );
  const providerConfigFingerprint =
    normalizeSha256(
      responseMeta
        .providerConfigFingerprint
    );
  const routeId =
    cleanString(
      responseMeta.routeId,
      160
    );
  const lookId =
    cleanString(
      responseMeta.lookId,
      160
    );
  const renderSpecSha256 =
    normalizeSha256(
      responseMeta.renderSpecSha256
    );

  if (
    reviewCaseId !==
      normalizedCaseId ||
    !simulationVersion ||
    !instructionVersion ||
    !providerConfigVersion ||
    !providerConfigFingerprint ||
    !routeId ||
    !lookId ||
    !renderSpecSha256
  ) {
    return invalid(
      reviewCaseId !== normalizedCaseId
        ? "pilot_capture_case_binding_mismatch"
        : "pilot_capture_response_meta_invalid"
    );
  }

  if (
    cleanString(
      faceLabV2State.selectedRouteId,
      160
    ) !== routeId
  ) {
    return invalid(
      "pilot_capture_route_binding_mismatch"
    );
  }

  const identityValidation =
    validateReview(
      identityScopeReview,
      normalizedCaseId,
      "identity_scope"
    );

  if (
    identityValidation.status !==
    "ready"
  ) {
    return identityValidation;
  }

  const routeValidation =
    validateReview(
      routeColorReview,
      normalizedCaseId,
      "route_color"
    );

  if (
    routeValidation.status !==
    "ready"
  ) {
    return routeValidation;
  }

  const sourceExtension =
    IMAGE_EXTENSIONS[
      normalizedSourceMimeType
    ];
  const outputExtension =
    IMAGE_EXTENSIONS[
      normalizedOutputMimeType
    ];
  const artifactStem =
    faceLabPrivateArtifactStem(
      normalizedCaseId
    );

  if (!artifactStem) {
    return invalid(
      "pilot_capture_case_id_invalid"
    );
  }

  const fileNames = {
    sourceImage:
      `${artifactStem}.source.${sourceExtension}`,
    outputImage:
      `${artifactStem}.output.${outputExtension}`,
    identityScopeReview:
      `${artifactStem}.identity-scope.review.json`,
    routeColorReview:
      `${artifactStem}.route-color.review.json`,
    manifest:
      `${artifactStem}.evidence-input.json`
  };

  const manifest = {
    captureVersion:
      FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION,
    caseId:
      normalizedCaseId,
    locale:
      normalizedLocale,
    sourceImagePath:
      `./${fileNames.sourceImage}`,
    sourceMimeType:
      normalizedSourceMimeType,
    outputImagePath:
      `./${fileNames.outputImage}`,
    analysis,
    faceLabV2State,
    responseMeta: {
      simulationVersion,
      instructionVersion,
      providerConfigVersion,
      providerConfigFingerprint,
      routeId,
      lookId,
      renderSpecSha256
    },
    checkEvidencePaths: [
      `./${fileNames.identityScopeReview}`,
      `./${fileNames.routeColorReview}`
    ]
  };

  return {
    status: "ready",
    captureVersion:
      FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION,
    caseId:
      normalizedCaseId,
    fileNames,
    manifest,
    reviews: {
      identityScopeReview,
      routeColorReview
    }
  };
}
