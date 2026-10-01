import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "../simulation-instructions.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
} from "../simulation-provider-config.js";
import {
  FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION
} from "./simulation-identity-scope-review.js";
import {
  FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION
} from "./simulation-route-color-review.js";

export const FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION =
  "face-lab-simulation-pilot-capture-v1";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SAFE_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const SOURCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const OUTPUT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanId(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const normalized = value.trim();

  return ID_PATTERN.test(normalized)
    ? normalized
    : null;
}

function cleanHash(value) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized = value.trim();

  return SHA256_PATTERN.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function cleanFileName(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    normalized === "." ||
    normalized === ".." ||
    !SAFE_FILE_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function invalid(reason, details = {}) {
  return {
    captureVersion:
      FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION,
    status: "invalid",
    reason,
    ...details
  };
}

function clone(value) {
  return structuredClone(value);
}

export function buildFaceLabSimulationPilotCapture({
  caseId,
  locale = "ko",
  analysis,
  faceLabV2State,
  responseMeta,
  identityScopeReview,
  routeColorReview,
  files
} = {}) {
  const normalizedCaseId =
    cleanId(caseId);

  if (!normalizedCaseId) {
    return invalid("case_id_invalid");
  }

  if (
    !isObject(analysis) ||
    !isObject(faceLabV2State)
  ) {
    return invalid(
      "capture_context_invalid"
    );
  }

  if (!isObject(responseMeta)) {
    return invalid(
      "response_meta_invalid"
    );
  }

  const simulationVersion =
    cleanId(
      responseMeta.simulationVersion
    );
  const instructionVersion =
    cleanId(
      responseMeta.instructionVersion
    );
  const routeId =
    cleanId(responseMeta.routeId);
  const lookId =
    cleanId(responseMeta.lookId);
  const renderSpecSha256 =
    cleanHash(
      responseMeta.renderSpecSha256
    );
  const providerConfigVersion =
    cleanId(
      responseMeta.providerConfigVersion
    );
  const providerConfigFingerprint =
    cleanHash(
      responseMeta
        .providerConfigFingerprint
    );

  if (
    simulationVersion !==
      FACE_LAB_AI_SIMULATION_VERSION
  ) {
    return invalid(
      "simulation_version_mismatch"
    );
  }

  if (
    instructionVersion !==
      FACE_LAB_SIMULATION_INSTRUCTION_VERSION
  ) {
    return invalid(
      "instruction_version_mismatch"
    );
  }

  if (
    providerConfigVersion !==
      FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
  ) {
    return invalid(
      "provider_config_version_mismatch"
    );
  }

  if (
    !providerConfigFingerprint
  ) {
    return invalid(
      "provider_config_fingerprint_invalid"
    );
  }

  if (
    !routeId ||
    !lookId ||
    !renderSpecSha256
  ) {
    return invalid(
      "simulation_trace_invalid"
    );
  }

  if (
    !isObject(identityScopeReview) ||
    identityScopeReview.reviewVersion !==
      FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION ||
    identityScopeReview.status !==
      "ready" ||
    identityScopeReview.caseId !==
      normalizedCaseId ||
    identityScopeReview.rawImagesIncluded !==
      false
  ) {
    return invalid(
      "identity_scope_review_invalid"
    );
  }

  if (
    !isObject(routeColorReview) ||
    routeColorReview.reviewVersion !==
      FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION ||
    routeColorReview.status !==
      "ready" ||
    routeColorReview.caseId !==
      normalizedCaseId ||
    routeColorReview.rawImagesIncluded !==
      false ||
    !isObject(routeColorReview.trace)
  ) {
    return invalid(
      "route_color_review_invalid"
    );
  }

  if (
    routeColorReview.trace.routeId !==
      routeId ||
    routeColorReview.trace.lookId !==
      lookId ||
    cleanHash(
      routeColorReview.trace
        .renderSpecSha256
    ) !== renderSpecSha256
  ) {
    return invalid(
      "review_trace_mismatch"
    );
  }

  if (!isObject(files)) {
    return invalid(
      "capture_files_invalid"
    );
  }

  const sourceImageName =
    cleanFileName(
      files.sourceImageName
    );
  const outputImageName =
    cleanFileName(
      files.outputImageName
    );
  const sourceMimeType =
    typeof files.sourceMimeType ===
      "string"
      ? files.sourceMimeType.trim()
      : null;
  const outputMimeType =
    typeof files.outputMimeType ===
      "string"
      ? files.outputMimeType.trim()
      : null;

  if (
    !sourceImageName ||
    !outputImageName ||
    !SOURCE_MIME_TYPES.has(
      sourceMimeType
    ) ||
    !OUTPUT_MIME_TYPES.has(
      outputMimeType
    )
  ) {
    return invalid(
      "capture_files_invalid"
    );
  }

  return {
    captureVersion:
      FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION,
    status: "ready",
    reason:
      "pilot_capture_built",
    sensitiveLocalOnly: true,
    caseId:
      normalizedCaseId,
    locale:
      locale === "en" ? "en" : "ko",
    analysis:
      clone(analysis),
    faceLabV2State:
      clone(faceLabV2State),
    responseMeta: {
      simulationVersion,
      instructionVersion,
      providerConfigVersion,
      providerConfigFingerprint,
      routeId,
      lookId,
      renderSpecSha256
    },
    identityScopeReview:
      clone(identityScopeReview),
    routeColorReview:
      clone(routeColorReview),
    files: {
      sourceImageName,
      sourceMimeType,
      outputImageName,
      outputMimeType
    },
    privacy: {
      reviewTicketIncluded: false,
      simulationAuthorityIncluded:
        false,
      rawImageBytesIncluded: false,
      imageHashesIncluded: false,
      localPathsIncluded: false,
      providerPayloadIncluded: false
    }
  };
}
