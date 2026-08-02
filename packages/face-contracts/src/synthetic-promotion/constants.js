export const PROMOTION_POLICY_ID = "bejewely-promotion-policy-v1";
export const PROMOTION_POLICY_VERSION = "1.0.0";
export const PROMOTION_USE_SCOPE = "internal_evaluation_only";

export const PROMOTION_SOURCE_SNAPSHOT_SCHEMA_VERSION = "promotion-source-snapshot-v1";
export const PROMOTION_OPERATOR_REATTESTATION_SCHEMA_VERSION = "promotion-operator-reattestation-v1";
export const USAGE_RIGHTS_REVIEW_SCHEMA_VERSION = "usage-rights-review-v1";
export const PROMOTION_ASSET_POLICY_REVIEW_SCHEMA_VERSION = "promotion-asset-policy-review-v1";
export const PROMOTION_LEAKAGE_REVIEW_SCHEMA_VERSION = "promotion-leakage-review-v1";
export const PROMOTION_EVIDENCE_BUNDLE_SCHEMA_VERSION = "promotion-evidence-bundle-v1";
export const PROMOTION_REVIEW_SUBMISSION_SCHEMA_VERSION = "promotion-review-submission-v1";
export const PROMOTION_DECISION_SCHEMA_VERSION = "promotion-decision-v1";
export const G4_GRADE_RECORD_SCHEMA_VERSION = "g4-grade-record-v1";
export const PROMOTION_STATUS_EVENT_SCHEMA_VERSION = "promotion-status-event-v1";

export const PROMOTION_SUPPORTED_G4_PURPOSES = Object.freeze([
  "capture_control",
  "skin_cue_control",
  "face_feature_control"
]);
export const PROMOTION_NON_GOLD_PURPOSES = Object.freeze([
  "paired_skin_edit",
  "mixed_control_pilot"
]);
export const PROMOTION_PREFLIGHT_STATUSES = Object.freeze([
  "eligible_for_promotion_review",
  "retained_g3_negative_control",
  "held_policy_review",
  "blocked"
]);
export const PROMOTION_REVIEW_DECISIONS = Object.freeze([
  "approve_g4",
  "hold",
  "reject"
]);
export const PROMOTION_DECISION_OUTCOMES = Object.freeze([
  "promoted_g4",
  "retained_g3_negative_control",
  "held",
  "rejected"
]);
export const PROMOTION_RIGHTS_STATUSES = Object.freeze(["approved", "denied", "uncertain"]);
export const PROMOTION_MARK_STATUSES = Object.freeze(["absent", "present", "uncertain"]);
export const PROMOTION_EXACT_DUPLICATE_DISPOSITIONS = Object.freeze([
  "unique",
  "representative_selected",
  "alias_retained_non_gold",
  "conflicting_claims_blocked"
]);
export const PROMOTION_PERCEPTUAL_DISPOSITIONS = Object.freeze([
  "no_review_candidates",
  "distinct_enough_for_internal_evaluation",
  "leakage_coupled",
  "uncertain"
]);
export const PROMOTION_COUPLING_KINDS = Object.freeze([
  "canonical",
  "campaign_series",
  "lineage",
  "reviewed_visual_similarity"
]);
export const PROMOTION_STATUS_EVENTS = Object.freeze(["activated", "revoked", "superseded"]);

export const PROMOTION_REASON_CODES = Object.freeze([
  "promotion_policy_pending_t6",
  "rights_review_uncertain",
  "external_mark_unknown",
  "perceptual_leakage_review_pending",
  "review_role_separation_unconfirmed",
  "newer_evidence_requires_review",
  "candidate_projection_history_unproven",
  "operator_hint_visual_conflict",
  "artifact_integrity_invalid",
  "candidate_observation_mismatch",
  "candidate_alignment_mismatch",
  "real_person_reference_prohibited",
  "rights_review_denied",
  "external_mark_present",
  "prohibited_transformation_detected",
  "unsupported_purpose",
  "paired_identity_unverified",
  "mixed_control_gold_disabled",
  "exact_duplicate_conflicting_claims",
  "fixture_observation_prohibited",
  "required_axis_not_agreed",
  "alignment_not_aligned",
  "promotion_review_rejected",
  "misaligned_negative_control_retained",
  "exact_duplicate_alias_retained",
  "pilot_only_retained"
]);
