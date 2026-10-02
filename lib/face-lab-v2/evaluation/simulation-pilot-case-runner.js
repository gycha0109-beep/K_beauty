import {
  buildFaceLabSimulationEvidencePacket
} from "./simulation-evidence-packet.js";
import {
  buildFaceLabSimulationCalibrationCase
} from "./simulation-calibration.js";
import {
  FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION
} from "./simulation-identity-scope-review.js";
import {
  FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION
} from "./simulation-route-color-review.js";
import {
  FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
} from "./simulation-pilot-capture.js";
import {
  faceLabPrivateArtifactStem
} from "./private-artifact-filename.js";

export const FACE_LAB_SIMULATION_PILOT_CASE_RUNNER_VERSION =
  "face-lab-simulation-pilot-case-runner-v1";

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanString(value, maxLength = 160) {
  if (typeof value !== "string") {
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

function invalid(reason, extra = {}) {
  return {
    runnerVersion:
      FACE_LAB_SIMULATION_PILOT_CASE_RUNNER_VERSION,
    status: "invalid",
    reason,
    ...extra
  };
}

function validReview(
  review,
  {
    caseId,
    version,
    checkIds
  }
) {
  if (
    !isObject(review) ||
    review.status !== "ready" ||
    review.caseId !== caseId ||
    review.reviewVersion !== version ||
    typeof review.responseDigest !==
      "string" ||
    !/^[a-f0-9]{64}$/i.test(
      review.responseDigest
    ) ||
    !isObject(review.checks)
  ) {
    return false;
  }

  return checkIds.every(
    (checkId) =>
      Object.prototype
        .hasOwnProperty
        .call(
          review.checks,
          checkId
        )
  );
}

export function buildFaceLabSimulationPilotCaseArtifacts({
  runSpec,
  captureManifest,
  canonicalSourceImageBytes,
  outputImageBytes,
  identityScopeReview,
  routeColorReview
}) {
  if (
    !isObject(runSpec) ||
    !isObject(captureManifest) ||
    captureManifest.captureVersion !==
      FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
  ) {
    return invalid(
      "pilot_case_input_invalid"
    );
  }

  const caseId =
    identifier(
      captureManifest.caseId
    );

  if (!caseId) {
    return invalid(
      "pilot_case_id_invalid"
    );
  }

  if (
    !Buffer.isBuffer(
      canonicalSourceImageBytes
    ) ||
    !canonicalSourceImageBytes.length ||
    !Buffer.isBuffer(
      outputImageBytes
    ) ||
    !outputImageBytes.length
  ) {
    return invalid(
      "pilot_case_image_bytes_invalid"
    );
  }

  if (
    !isObject(
      captureManifest.analysis
    ) ||
    !isObject(
      captureManifest.faceLabV2State
    ) ||
    !isObject(
      captureManifest.responseMeta
    )
  ) {
    return invalid(
      "pilot_case_capture_context_invalid"
    );
  }

  if (
    !validReview(
      identityScopeReview,
      {
        caseId,
        version:
          FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION,
        checkIds: [
          "identity_preservation",
          "edit_scope"
        ]
      }
    )
  ) {
    return invalid(
      "pilot_case_identity_scope_review_invalid"
    );
  }

  if (
    !validReview(
      routeColorReview,
      {
        caseId,
        version:
          FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION,
        checkIds: [
          "route_adherence",
          "color_fidelity"
        ]
      }
    )
  ) {
    return invalid(
      "pilot_case_route_color_review_invalid"
    );
  }

  const evidencePacket =
    buildFaceLabSimulationEvidencePacket({
      caseId,
      analysis:
        captureManifest.analysis,
      rawState:
        captureManifest
          .faceLabV2State,
      locale:
        captureManifest.locale,
      canonicalSourceImageBytes,
      outputImageBytes,
      responseMeta:
        captureManifest
          .responseMeta,
      checks: {
        ...identityScopeReview
          .checks,
        ...routeColorReview
          .checks
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
            ).sort()
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
            ).sort()
        }
      ]
    });

  if (
    evidencePacket.status !==
    "ready"
  ) {
    return invalid(
      "pilot_case_evidence_packet_invalid",
      {
        evidenceReason:
          evidencePacket.reason
      }
    );
  }

  const calibrationCase =
    buildFaceLabSimulationCalibrationCase({
      campaignId:
        runSpec.campaignId,
      intentGroupId:
        runSpec.intentGroupId,
      generationIndex:
        runSpec.generationIndex,
      changeIntensity:
        runSpec.changeIntensity,
      routeSelectionState:
        runSpec.routeSelectionState,
      packet:
        evidencePacket,
      identityScopeReview,
      routeColorReview
    });

  if (
    calibrationCase.status !==
    "ready"
  ) {
    return invalid(
      "pilot_case_calibration_case_invalid",
      {
        calibrationReason:
          calibrationCase.reason,
        incompleteCheckId:
          calibrationCase
            .incompleteCheckId ||
          null,
        evidenceVerdict:
          evidencePacket
            .evaluation
            .verdict,
        hardFailureCodes:
          (
            evidencePacket
              .evaluation
              .hardFailures ||
            []
          )
            .map(
              (finding) =>
                cleanString(
                  finding?.code,
                  80
                )
            )
            .filter(Boolean),
        reviewFindingCodes:
          (
            evidencePacket
              .evaluation
              .reviewFindings ||
            []
          )
            .map(
              (finding) =>
                cleanString(
                  finding?.code,
                  80
                )
            )
            .filter(Boolean),
        evidenceCheckStatuses:
          Object.fromEntries(
            Object.entries(
              evidencePacket
                .evaluation
                .checks ||
              {}
            ).map(
              ([
                checkId,
                check
              ]) => [
                checkId,
                cleanString(
                  check?.status,
                  40
                )
              ]
            )
          )
      }
    );
  }

  if (
    calibrationCase.caseId !==
      caseId
  ) {
    return invalid(
      "pilot_case_output_binding_mismatch"
    );
  }

  return {
    runnerVersion:
      FACE_LAB_SIMULATION_PILOT_CASE_RUNNER_VERSION,
    status: "ready",
    reason:
      "pilot_case_artifacts_built",
    caseId,
    campaignId:
      calibrationCase.campaignId,
    intentGroupId:
      calibrationCase.intentGroupId,
    generationIndex:
      calibrationCase
        .generationIndex,
    outputNames: {
      evidencePacket:
        `${faceLabPrivateArtifactStem(caseId)}.evidence-packet.json`,
      calibrationCase:
        `${faceLabPrivateArtifactStem(caseId)}.calibration-case.json`
    },
    evidencePacket,
    calibrationCase
  };
}
