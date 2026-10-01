import {
  FACE_LAB_IDENTITY_LOCK,
  FACE_LAB_RENDER_SPEC_VERSION
} from "../render-adapter.js";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../simulation-service-core.js";

export const FACE_LAB_SIMULATION_EVALUATION_VERSION =
  "face-lab-simulation-evaluation-v1";

export const FACE_LAB_SIMULATION_EVALUATION_CHECKS = Object.freeze([
  "identity_preservation",
  "route_adherence",
  "color_fidelity",
  "edit_scope"
]);

export const FACE_LAB_SIMULATION_EVALUATION_STATUSES = Object.freeze([
  "pass",
  "review",
  "fail",
  "not_evaluated",
  "not_applicable"
]);

export const FACE_LAB_SIMULATION_FAILURE_SOURCES = Object.freeze([
  "render_spec",
  "instruction_builder",
  "provider",
  "evaluation_uncertain"
]);

export const FACE_LAB_SIMULATION_FAILURE_TAXONOMY = Object.freeze({
  IDENTITY_MAJOR_DRIFT: Object.freeze({
    checkId: "identity_preservation",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  IDENTITY_MINOR_DRIFT: Object.freeze({
    checkId: "identity_preservation",
    severity: "review",
    defaultFailureSource: "evaluation_uncertain"
  }),
  ROUTE_OPERATION_MISSED: Object.freeze({
    checkId: "route_adherence",
    severity: "review",
    defaultFailureSource: "evaluation_uncertain"
  }),
  ROUTE_OPERATION_CONTRADICTED: Object.freeze({
    checkId: "route_adherence",
    severity: "review",
    defaultFailureSource: "evaluation_uncertain"
  }),
  COLOR_OFF_TARGET: Object.freeze({
    checkId: "color_fidelity",
    severity: "review",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_FACE_STRUCTURE: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_BACKGROUND: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_CLOTHING: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_BODY: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_HEAD_POSE: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_CAMERA_PERSPECTIVE: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_EXPRESSION: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_LIGHTING_DIRECTION: Object.freeze({
    checkId: "edit_scope",
    severity: "hard",
    defaultFailureSource: "evaluation_uncertain"
  }),
  SCOPE_UNREQUESTED_BEAUTIFICATION: Object.freeze({
    checkId: "edit_scope",
    severity: "review",
    defaultFailureSource: "evaluation_uncertain"
  }),
  OVER_EDITED: Object.freeze({
    checkId: "edit_scope",
    severity: "review",
    defaultFailureSource: "evaluation_uncertain"
  }),
  UNDER_EDITED: Object.freeze({
    checkId: "route_adherence",
    severity: "review",
    defaultFailureSource: "evaluation_uncertain"
  }),
  PROVIDER_ARTIFACT: Object.freeze({
    checkId: "edit_scope",
    severity: "review",
    defaultFailureSource: "provider"
  }),
  IMAGE_QUALITY: Object.freeze({
    checkId: "edit_scope",
    severity: "review",
    defaultFailureSource: "provider"
  })
});

const STATUS_SET = new Set(FACE_LAB_SIMULATION_EVALUATION_STATUSES);
const FAILURE_SOURCE_SET = new Set(FACE_LAB_SIMULATION_FAILURE_SOURCES);
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

function hasObjectValues(value) {
  return isObject(value) &&
    Object.values(value).some((item) => {
      if (Array.isArray(item)) return item.length > 0;
      if (isObject(item)) return Object.keys(item).length > 0;
      return item !== null && item !== undefined && item !== "";
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

export function requiresFaceLabColorFidelity(renderSpec) {
  return Array.isArray(renderSpec?.operations) &&
    renderSpec.operations.some((operation) =>
      colorAuthorityHasIntent(operation?.colorAuthority)
    );
}

function invalid(reason, details = {}) {
  return {
    evaluationVersion: FACE_LAB_SIMULATION_EVALUATION_VERSION,
    status: "invalid",
    verdict: "not_evaluated",
    reason,
    requiredChecks: [...FACE_LAB_SIMULATION_EVALUATION_CHECKS],
    hardFailures: [],
    reviewFindings: [],
    ...details
  };
}

function validateRenderSpec(renderSpec) {
  if (!isObject(renderSpec)) {
    return { valid: false, reason: "render_spec_missing" };
  }

  if (
    renderSpec.status !== "ready" ||
    renderSpec.renderSpecVersion !== FACE_LAB_RENDER_SPEC_VERSION
  ) {
    return { valid: false, reason: "render_spec_not_ready" };
  }

  if (
    !cleanString(renderSpec.routeId, 80) ||
    !cleanString(renderSpec.lookId, 120)
  ) {
    return { valid: false, reason: "render_spec_identity_missing" };
  }

  if (
    !Array.isArray(renderSpec.operations) ||
    !renderSpec.operations.length
  ) {
    return { valid: false, reason: "render_spec_operations_missing" };
  }

  const identityLock = new Set(
    Array.isArray(renderSpec.identityLock)
      ? renderSpec.identityLock
      : []
  );

  if (
    FACE_LAB_IDENTITY_LOCK.some((item) => !identityLock.has(item))
  ) {
    return { valid: false, reason: "render_spec_identity_lock_incomplete" };
  }

  return { valid: true, reason: null };
}

function normalizeFinding(value, checkId) {
  if (!isObject(value)) {
    return { valid: false, reason: "finding_not_object" };
  }

  const code = cleanString(value.code, 80);
  const taxonomy = code
    ? FACE_LAB_SIMULATION_FAILURE_TAXONOMY[code]
    : null;

  if (!taxonomy) {
    return { valid: false, reason: "finding_code_unknown" };
  }

  if (taxonomy.checkId !== checkId) {
    return { valid: false, reason: "finding_check_mismatch" };
  }

  const failureSource =
    cleanString(value.failureSource, 80) ||
    taxonomy.defaultFailureSource;

  if (!FAILURE_SOURCE_SET.has(failureSource)) {
    return { valid: false, reason: "finding_failure_source_invalid" };
  }

  const targetRef = cleanString(value.targetRef, 160);
  const note = cleanString(value.note, 500);
  const evidenceRefs = Array.isArray(value.evidenceRefs)
    ? [...new Set(
        value.evidenceRefs
          .map((item) => cleanString(item, 160))
          .filter(Boolean)
      )].slice(0, 12)
    : [];

  return {
    valid: true,
    finding: {
      code,
      checkId,
      severity: taxonomy.severity,
      failureSource,
      targetRef,
      note,
      evidenceRefs
    }
  };
}

function normalizeCheck(value, checkId, { colorRequired }) {
  if (!isObject(value)) {
    return { valid: false, reason: "check_missing" };
  }

  const status = cleanString(value.status, 40);

  if (!STATUS_SET.has(status)) {
    return { valid: false, reason: "check_status_invalid" };
  }

  if (
    status === "not_applicable" &&
    (checkId !== "color_fidelity" || colorRequired)
  ) {
    return { valid: false, reason: "check_not_applicable_invalid" };
  }

  if (
    checkId === "color_fidelity" &&
    !colorRequired &&
    status !== "not_applicable" &&
    status !== "not_evaluated"
  ) {
    return { valid: false, reason: "color_check_must_be_not_applicable" };
  }

  const rawFindings = Array.isArray(value.findings)
    ? value.findings
    : [];

  const findings = [];

  for (const rawFinding of rawFindings) {
    const normalized = normalizeFinding(rawFinding, checkId);
    if (!normalized.valid) {
      return normalized;
    }
    findings.push(normalized.finding);
  }

  if (
    ["pass", "not_evaluated", "not_applicable"].includes(status) &&
    findings.length
  ) {
    return { valid: false, reason: "check_status_findings_conflict" };
  }

  if (["review", "fail"].includes(status) && !findings.length) {
    return { valid: false, reason: "check_findings_required" };
  }

  const hasHardFinding = findings.some(
    (finding) => finding.severity === "hard"
  );

  if (hasHardFinding && status !== "fail") {
    return { valid: false, reason: "hard_finding_requires_fail" };
  }

  if (
    ["identity_preservation", "edit_scope"].includes(checkId) &&
    status === "fail" &&
    !hasHardFinding
  ) {
    return {
      valid: false,
      reason: "hard_gate_fail_requires_hard_finding"
    };
  }

  return {
    valid: true,
    check: {
      checkId,
      status,
      findings
    }
  };
}

export function validateFaceLabSimulationEvidence({
  renderSpec,
  evidence
} = {}) {
  const renderValidation = validateRenderSpec(renderSpec);
  if (!renderValidation.valid) return renderValidation;

  if (!isObject(evidence)) {
    return { valid: false, reason: "evidence_missing" };
  }

  const caseId = cleanString(evidence.caseId, 120);
  const simulationVersion = cleanString(evidence.simulationVersion, 120);
  const sourceImageSha256 = normalizeSha256(evidence.sourceImageSha256);
  const outputImageSha256 = normalizeSha256(evidence.outputImageSha256);

  if (!caseId) {
    return { valid: false, reason: "case_id_missing" };
  }

  if (!simulationVersion) {
    return { valid: false, reason: "simulation_version_missing" };
  }

  if (simulationVersion !== FACE_LAB_AI_SIMULATION_VERSION) {
    return { valid: false, reason: "simulation_version_mismatch" };
  }

  if (!sourceImageSha256 || !outputImageSha256) {
    return { valid: false, reason: "image_hash_invalid" };
  }

  if (
    evidence.renderSpecVersion !== renderSpec.renderSpecVersion ||
    evidence.routeId !== renderSpec.routeId ||
    evidence.lookId !== renderSpec.lookId
  ) {
    return { valid: false, reason: "evidence_intent_mismatch" };
  }

  if (!isObject(evidence.checks)) {
    return { valid: false, reason: "checks_missing" };
  }

  const colorRequired = requiresFaceLabColorFidelity(renderSpec);
  const checks = {};

  for (const checkId of FACE_LAB_SIMULATION_EVALUATION_CHECKS) {
    const normalized = normalizeCheck(
      evidence.checks[checkId],
      checkId,
      { colorRequired }
    );

    if (!normalized.valid) {
      return {
        valid: false,
        reason: normalized.reason,
        invalidCheckId: checkId
      };
    }

    checks[checkId] = normalized.check;
  }

  const unknownCheckIds = Object.keys(evidence.checks)
    .filter((checkId) =>
      !FACE_LAB_SIMULATION_EVALUATION_CHECKS.includes(checkId)
    );

  if (unknownCheckIds.length) {
    return {
      valid: false,
      reason: "unknown_check_id",
      unknownCheckIds
    };
  }

  return {
    valid: true,
    reason: null,
    normalized: {
      caseId,
      simulationVersion,
      sourceImageSha256,
      outputImageSha256,
      renderSpecVersion: renderSpec.renderSpecVersion,
      routeId: renderSpec.routeId,
      lookId: renderSpec.lookId,
      colorFidelityRequired: colorRequired,
      checks
    }
  };
}

function allFindings(checks) {
  return FACE_LAB_SIMULATION_EVALUATION_CHECKS.flatMap(
    (checkId) => checks[checkId]?.findings || []
  );
}

export function adjudicateFaceLabSimulationEvidence({
  renderSpec,
  evidence
} = {}) {
  const validated = validateFaceLabSimulationEvidence({
    renderSpec,
    evidence
  });

  if (!validated.valid) {
    return invalid(validated.reason, {
      invalidCheckId: validated.invalidCheckId || null,
      unknownCheckIds: validated.unknownCheckIds || []
    });
  }

  const normalized = validated.normalized;
  const checks = normalized.checks;
  const findings = allFindings(checks);

  const hardFailures = findings.filter(
    (finding) => finding.severity === "hard"
  );

  const identityStatus = checks.identity_preservation.status;
  const editScopeStatus = checks.edit_scope.status;
  const hasHardGateFailure =
    identityStatus === "fail" ||
    editScopeStatus === "fail" ||
    hardFailures.length > 0;

  const hasIncompleteCheck = FACE_LAB_SIMULATION_EVALUATION_CHECKS.some(
    (checkId) => checks[checkId].status === "not_evaluated"
  );

  const hasReviewState = FACE_LAB_SIMULATION_EVALUATION_CHECKS.some(
    (checkId) => ["review", "fail"].includes(checks[checkId].status)
  );

  let verdict = "pass";

  if (hasHardGateFailure) {
    verdict = "fail";
  } else if (hasIncompleteCheck) {
    verdict = "not_evaluated";
  } else if (hasReviewState) {
    verdict = "review";
  }

  return {
    evaluationVersion: FACE_LAB_SIMULATION_EVALUATION_VERSION,
    status: "evaluated",
    verdict,
    reason:
      verdict === "fail"
        ? "hard_gate_failed"
        : verdict === "not_evaluated"
          ? "required_check_pending"
          : verdict === "review"
            ? "quality_review_required"
            : "all_applicable_checks_passed",
    caseId: normalized.caseId,
    simulationVersion: normalized.simulationVersion,
    sourceImageSha256: normalized.sourceImageSha256,
    outputImageSha256: normalized.outputImageSha256,
    renderSpecVersion: normalized.renderSpecVersion,
    routeId: normalized.routeId,
    lookId: normalized.lookId,
    colorFidelityRequired: normalized.colorFidelityRequired,
    requiredChecks: [...FACE_LAB_SIMULATION_EVALUATION_CHECKS],
    checks,
    hardFailures,
    reviewFindings: findings.filter(
      (finding) => finding.severity === "review"
    )
  };
}
