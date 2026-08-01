export const CANDIDATE_IMPORT_ERROR_CODES = Object.freeze([
  "invalid_request_schema",
  "unsafe_source_path",
  "source_not_found",
  "symlink_forbidden",
  "unsupported_file_format",
  "mime_decode_mismatch",
  "animated_asset_forbidden",
  "image_decode_failed",
  "file_size_limit_exceeded",
  "dimension_limit_exceeded",
  "pixel_limit_exceeded",
  "dimension_below_minimum",
  "generation_artifact_missing",
  "generation_artifact_invalid",
  "generation_artifact_identity_conflict",
  "spec_digest_mismatch",
  "prompt_digest_mismatch",
  "provider_profile_mismatch",
  "provider_execution_mode_forbidden",
  "synthetic_attestation_required",
  "rights_review_required",
  "sensitive_provenance_forbidden",
  "invalid_grouping_contract",
  "parent_candidate_missing",
  "reference_capability_required",
  "canonicalization_failed",
  "candidate_identity_conflict",
  "storage_lock_unavailable",
  "atomic_commit_failed"
]);

export const CANDIDATE_IMPORT_WARNING_CODES = Object.freeze([
  "provider_model_unknown",
  "provider_generation_id_unknown",
  "generated_at_unknown",
  "external_mark_present",
  "external_mark_unknown",
  "canonical_duplicate_found",
  "perceptual_neighbors_found"
]);

export function createCandidateImportError(code, path, detail = null) {
  if (!CANDIDATE_IMPORT_ERROR_CODES.includes(code)) {
    throw new TypeError(`Unknown candidate import error code: ${code}`);
  }
  return Object.freeze({ code, path, detail });
}

export function createCandidateImportWarning(code, detail = null) {
  if (!CANDIDATE_IMPORT_WARNING_CODES.includes(code)) {
    throw new TypeError(`Unknown candidate import warning code: ${code}`);
  }
  return Object.freeze({ code, detail });
}
