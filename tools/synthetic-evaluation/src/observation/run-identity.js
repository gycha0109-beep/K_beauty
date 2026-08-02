import { sha256Hex, stableStringify } from "../generation/canonicalize-generation-spec.js";

export function buildObservationRunIdentity({ request, snapshot, modeProfile }) {
  const semanticPayload = {
    candidateId: request.candidate.candidateId,
    canonicalSha256: request.candidate.canonicalAsset.sha256,
    canonicalTransformPolicyVersion: request.candidate.canonicalAsset.transformPolicyVersion,
    adapterProfileId: request.adapterProfile.id,
    adapterProfileVersion: request.adapterProfile.version,
    contractSnapshotDigest: snapshot.snapshotDigest,
    executionMode: request.execution.mode,
    provider: modeProfile.provider,
    model: request.execution.requestedModel,
    replicateOrdinal: request.execution.replicateOrdinal
  };
  const runDigest = sha256Hex(stableStringify(semanticPayload));
  return Object.freeze({ semanticPayload: Object.freeze(semanticPayload), runDigest, runId: `obs_${runDigest.slice(0, 24)}` });
}
