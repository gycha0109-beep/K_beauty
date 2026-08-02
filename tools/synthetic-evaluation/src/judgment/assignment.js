import {
  BLIND_JUDGMENT_ASSIGNMENT_SCHEMA_VERSION,
  JUDGMENT_AXIS_REGISTRY,
  validateBlindJudgmentAssignment,
  validateBlindJudgmentInput
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

function semanticFromAssignment(value) {
  return {
    schemaVersion: value.schemaVersion,
    candidateId: value.candidateId,
    observationRunId: value.observationRunId,
    observationDigest: value.observationDigest,
    canonicalAsset: value.canonicalAsset,
    registry: value.registry
  };
}

export function createBlindJudgmentAssignment(blindInput, { issuedAt = new Date().toISOString() } = {}) {
  const validation = validateBlindJudgmentInput(blindInput);
  if (!validation.ok) return validation;
  if (!Number.isFinite(Date.parse(issuedAt))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_assignment_invalid", path: "issuedAt", detail: null }]) });
  }
  const semantic = {
    schemaVersion: BLIND_JUDGMENT_ASSIGNMENT_SCHEMA_VERSION,
    candidateId: blindInput.candidateId,
    observationRunId: blindInput.observationRunId,
    observationDigest: blindInput.observationDigest,
    canonicalAsset: {
      sha256: blindInput.canonicalAsset.sha256,
      objectRelativePath: blindInput.canonicalAsset.objectRelativePath
    },
    registry: {
      id: JUDGMENT_AXIS_REGISTRY.registryId,
      version: JUDGMENT_AXIS_REGISTRY.registryVersion
    }
  };
  const assignmentDigest = sha256Hex(stableStringify(semantic));
  const assignment = deepFreeze({
    ...semantic,
    assignmentId: `jasn_${assignmentDigest.slice(0, 24)}`,
    issuedAt,
    assignmentDigest
  });
  return Object.freeze({ ok: true, assignment });
}

export function verifyBlindJudgmentAssignmentIntegrity(assignment) {
  const validation = validateBlindJudgmentAssignment(assignment);
  if (!validation.ok) return false;
  const digest = sha256Hex(stableStringify(semanticFromAssignment(assignment)));
  return assignment.assignmentDigest === digest && assignment.assignmentId === `jasn_${digest.slice(0, 24)}`;
}
