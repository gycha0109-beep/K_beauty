export const CANDIDATE_MANIFEST_SCHEMA_VERSION = "candidate-manifest-v1";
export const CANDIDATE_IDENTITY_SCHEMA_VERSION = "candidate-identity-v1";
export const CANDIDATE_GENERATED_STATE = "G0_GENERATED";
export const IMPORT_REPORT_SCHEMA_VERSION = "candidate-import-report-v1";

export function immutableCandidateProjection(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    candidateId: manifest.candidateId,
    candidateDigest: manifest.candidateDigest,
    state: manifest.state,
    asset: manifest.asset,
    generation: manifest.generation,
    grouping: manifest.grouping,
    operatorAttestation: manifest.operatorAttestation,
    operatorHints: manifest.operatorHints,
    duplicateReferences: manifest.duplicateReferences
  };
}
