import {
  hashFaceLabAuthorityImage,
  hashFaceLabAuthorityValue
} from "../simulation-authority-core.js";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "../simulation-instructions.js";
import {
  reconstructFaceLabSimulationRenderAuthority
} from "../simulation-render-authority.js";
import {
  adjudicateFaceLabSimulationEvidence,
  requiresFaceLabColorFidelity
} from "./simulation-evaluation.js";

export const FACE_LAB_SIMULATION_EVIDENCE_PACKET_VERSION =
  "face-lab-simulation-evidence-packet-v1";

export const FACE_LAB_SIMULATION_EVIDENCE_TRACE_VERSION =
  "face-lab-simulation-evidence-trace-v1";

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

function invalid(reason, details = {}) {
  return {
    packetVersion:
      FACE_LAB_SIMULATION_EVIDENCE_PACKET_VERSION,
    traceVersion:
      FACE_LAB_SIMULATION_EVIDENCE_TRACE_VERSION,
    status: "invalid",
    reason,
    rawImagesIncluded: false,
    ...details
  };
}

export function buildFaceLabSimulationPendingChecks(renderSpec) {
  const colorRequired =
    requiresFaceLabColorFidelity(renderSpec);

  return {
    identity_preservation: {
      status: "not_evaluated",
      findings: []
    },
    route_adherence: {
      status: "not_evaluated",
      findings: []
    },
    color_fidelity: {
      status:
        colorRequired
          ? "not_evaluated"
          : "not_applicable",
      findings: []
    },
    edit_scope: {
      status: "not_evaluated",
      findings: []
    }
  };
}

function summarizeRenderIntent(renderSpec) {
  return {
    identityLock: Array.isArray(renderSpec?.identityLock)
      ? [...renderSpec.identityLock]
      : [],
    operations: Array.isArray(renderSpec?.operations)
      ? renderSpec.operations.map((operation) => ({
          operationId:
            cleanString(operation?.operationId, 160),
          slotKey:
            cleanString(operation?.slotKey, 120),
          sourceMode:
            cleanString(operation?.sourceMode, 80),
          targetRegions:
            Array.isArray(operation?.targetRegions)
              ? operation.targetRegions
                  .filter((item) => typeof item === "string")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
          colorFidelityState:
            cleanString(
              operation?.colorAuthority?.fidelityState,
              80
            )
        }))
      : []
  };
}

function mergeFaceLabSimulationChecks(renderSpec, checks) {
  const pending =
    buildFaceLabSimulationPendingChecks(
      renderSpec
    );

  if (checks == null) {
    return {
      valid: true,
      checks: pending
    };
  }

  if (!isObject(checks)) {
    return {
      valid: false,
      reason: "checks_invalid"
    };
  }

  return {
    valid: true,
    checks: {
      ...pending,
      ...structuredClone(checks)
    }
  };
}

function normalizeCheckEvidenceRefs(values) {
  if (values == null) {
    return {
      valid: true,
      refs: []
    };
  }

  if (!Array.isArray(values)) {
    return {
      valid: false,
      reason:
        "check_evidence_refs_invalid"
    };
  }

  const refs = [];

  for (const value of values) {
    if (!isObject(value)) {
      return {
        valid: false,
        reason:
          "check_evidence_ref_invalid"
      };
    }

    const evidenceVersion =
      cleanString(
        value.evidenceVersion,
        120
      );
    const evidenceDigest =
      normalizeSha256(
        value.evidenceDigest
      );
    const checkIds =
      Array.isArray(value.checkIds)
        ? [
            ...new Set(
              value.checkIds
                .map((item) =>
                  cleanString(item, 80)
                )
                .filter(Boolean)
            )
          ].sort()
        : [];

    if (
      !evidenceVersion ||
      !evidenceDigest ||
      !checkIds.length
    ) {
      return {
        valid: false,
        reason:
          "check_evidence_ref_invalid"
      };
    }

    refs.push({
      evidenceVersion,
      evidenceDigest,
      checkIds
    });
  }

  return {
    valid: true,
    refs
  };
}

export function buildFaceLabSimulationEvidencePacket({
  caseId,
  analysis,
  rawState,
  locale = "ko",
  canonicalSourceImageBytes,
  outputImageBytes,
  responseMeta,
  checks = null,
  checkEvidenceRefs = null
} = {}) {
  const normalizedCaseId =
    cleanString(caseId, 120);

  if (!normalizedCaseId) {
    return invalid("case_id_missing");
  }

  if (
    !Buffer.isBuffer(canonicalSourceImageBytes) ||
    !canonicalSourceImageBytes.length
  ) {
    return invalid("canonical_source_image_missing");
  }

  if (
    !Buffer.isBuffer(outputImageBytes) ||
    !outputImageBytes.length
  ) {
    return invalid("output_image_missing");
  }

  if (!isObject(responseMeta)) {
    return invalid("response_meta_missing");
  }

  const reconstructed =
    reconstructFaceLabSimulationRenderAuthority({
      analysis,
      rawState,
      locale
    });

  if (reconstructed.status !== "ready") {
    return invalid(reconstructed.reason);
  }

  const responseSimulationVersion =
    cleanString(
      responseMeta.simulationVersion,
      120
    );
  const responseInstructionVersion =
    cleanString(
      responseMeta.instructionVersion,
      120
    );
  const responseRouteId =
    cleanString(responseMeta.routeId, 80);
  const responseLookId =
    cleanString(responseMeta.lookId, 120);
  const responseRenderSpecSha256 =
    normalizeSha256(
      responseMeta.renderSpecSha256
    );

  if (
    responseSimulationVersion !==
      FACE_LAB_AI_SIMULATION_VERSION
  ) {
    return invalid(
      "response_simulation_version_mismatch"
    );
  }

  if (
    responseInstructionVersion !==
      FACE_LAB_SIMULATION_INSTRUCTION_VERSION
  ) {
    return invalid(
      "response_instruction_version_mismatch"
    );
  }

  if (
    responseRouteId !==
      reconstructed.renderSpec.routeId ||
    responseLookId !==
      reconstructed.renderSpec.lookId
  ) {
    return invalid(
      "response_intent_mismatch"
    );
  }

  if (
    !responseRenderSpecSha256 ||
    responseRenderSpecSha256 !==
      reconstructed.renderSpecSha256
  ) {
    return invalid(
      "response_render_spec_digest_mismatch"
    );
  }

  const sourceImageSha256 =
    hashFaceLabAuthorityImage(
      canonicalSourceImageBytes
    );
  const outputImageSha256 =
    hashFaceLabAuthorityImage(
      outputImageBytes
    );

  if (
    !sourceImageSha256 ||
    !outputImageSha256
  ) {
    return invalid("image_hash_failed");
  }

  const mergedChecks =
    mergeFaceLabSimulationChecks(
      reconstructed.renderSpec,
      checks
    );

  if (!mergedChecks.valid) {
    return invalid(
      mergedChecks.reason
    );
  }

  const normalizedEvidenceRefs =
    normalizeCheckEvidenceRefs(
      checkEvidenceRefs
    );

  if (!normalizedEvidenceRefs.valid) {
    return invalid(
      normalizedEvidenceRefs.reason
    );
  }

  const evaluationEvidence = {
    caseId: normalizedCaseId,
    simulationVersion:
      responseSimulationVersion,
    sourceImageSha256,
    outputImageSha256,
    renderSpecVersion:
      reconstructed.renderSpec
        .renderSpecVersion,
    renderSpecSha256:
      reconstructed.renderSpecSha256,
    routeId:
      reconstructed.renderSpec.routeId,
    lookId:
      reconstructed.renderSpec.lookId,
    checks:
      mergedChecks.checks
  };

  const evaluation =
    adjudicateFaceLabSimulationEvidence({
      renderSpec:
        reconstructed.renderSpec,
      evidence:
        evaluationEvidence
    });

  if (evaluation.status === "invalid") {
    return invalid(
      "evaluation_evidence_invalid",
      {
        evaluationReason:
          evaluation.reason
      }
    );
  }

  return {
    packetVersion:
      FACE_LAB_SIMULATION_EVIDENCE_PACKET_VERSION,
    traceVersion:
      FACE_LAB_SIMULATION_EVIDENCE_TRACE_VERSION,
    status: "ready",
    reason: "evidence_packet_built",
    caseId: normalizedCaseId,
    locale:
      locale === "en" ? "en" : "ko",
    trace: {
      simulationVersion:
        responseSimulationVersion,
      instructionVersion:
        responseInstructionVersion,
      renderSpecVersion:
        reconstructed.renderSpec
          .renderSpecVersion,
      renderSpecSha256:
        reconstructed.renderSpecSha256,
      routeId:
        reconstructed.renderSpec.routeId,
      lookId:
        reconstructed.renderSpec.lookId,
      sourceImageSha256,
      outputImageSha256,
      analysisSha256:
        hashFaceLabAuthorityValue(analysis),
      faceLabV2StateSha256:
        hashFaceLabAuthorityValue(
          reconstructed.normalizedState
        )
    },
    intent: summarizeRenderIntent(
      reconstructed.renderSpec
    ),
    checkEvidenceRefs:
      normalizedEvidenceRefs.refs,
    evaluation,
    rawImagesIncluded: false
  };
}
