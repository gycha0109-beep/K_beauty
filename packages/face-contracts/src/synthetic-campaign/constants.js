export const PILOT_CAMPAIGN_PLAN_SCHEMA_VERSION = "pilot-campaign-plan-v1";
export const PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION = "pilot-campaign-plan-v2";
export const PILOT_SOURCE_FREEZE_SCHEMA_VERSION = "pilot-source-freeze-v1";
export const PILOT_CAMPAIGN_RUN_SCHEMA_VERSION = "pilot-campaign-run-v1";
export const PILOT_SLOT_SCHEMA_VERSION = "pilot-slot-v1";
export const PILOT_DIVERSIFIED_SLOT_SCHEMA_VERSION = "pilot-slot-v2";
export const GENERATION_WORK_PACKET_SCHEMA_VERSION = "generation-work-packet-v1";
export const GENERATION_HANDOFF_SCHEMA_VERSION = "generation-handoff-v1";
export const PILOT_CAMPAIGN_EVENT_SCHEMA_VERSION = "pilot-campaign-event-v1";
export const PILOT_CHECKPOINT_APPROVAL_SCHEMA_VERSION = "pilot-checkpoint-approval-v1";
export const PILOT_CAMPAIGN_PROJECTION_SCHEMA_VERSION = "pilot-campaign-projection-v1";
export const PILOT_DIVERSIFIED_CAMPAIGN_PROJECTION_SCHEMA_VERSION = "pilot-campaign-projection-v2";
export const PILOT_CAMPAIGN_CLOSEOUT_SCHEMA_VERSION = "pilot-campaign-closeout-v1";
export const PILOT_WAVE_CANCELLATION_SCHEMA_VERSION = "pilot-wave-cancellation-v1";

export const PILOT_QUESTION_ID = "skin-control-abcd-e2e-v1";
export const PILOT_FIXTURE_SET_ID = "skin-control-abcd-v1";
export const PILOT_PURPOSE = "skin_cue_control";

export const PILOT_ALLOWED_PROVIDER_PROFILES = Object.freeze([
  "gemini-image-manual-v1",
  "gpt-image-manual-v1"
]);

export const PILOT_CONDITIONS = Object.freeze({
  A: Object.freeze({ fixtureId: "A_clean", primarySlots: 5, waveAllocation: Object.freeze([1, 2, 2]) }),
  B: Object.freeze({ fixtureId: "B_redness_only", primarySlots: 5, waveAllocation: Object.freeze([1, 2, 2]) }),
  C: Object.freeze({ fixtureId: "C_blemishes_only", primarySlots: 5, waveAllocation: Object.freeze([1, 2, 2]) }),
  D: Object.freeze({ fixtureId: "D_combined", primarySlots: 5, waveAllocation: Object.freeze([1, 2, 2]) })
});

export const PILOT_BUDGET = Object.freeze({
  primaryGenerationSlots: 20,
  technicalGenerationRetryReserve: 10,
  maxGenerationAttemptsTotal: 30,
  maxGenerationAttemptsPerSlot: 2,
  maxAuthoritativeObservationRuns: 20,
  maxObservationRecoveryRuns: 10,
  maxObservationRunsTotal: 30,
  requiredPrimaryReviewersPerCandidate: 2,
  maxAdjudicationsPerCandidate: 1,
  maxPromotionReviewsPerEligibleCandidate: 1
});

export const PILOT_DIVERSIFIED_BUDGET = Object.freeze({
  primaryGenerationSlots: 8,
  technicalGenerationRetryReserve: 4,
  maxGenerationAttemptsTotal: 12,
  maxGenerationAttemptsPerSlot: 2,
  maxAuthoritativeObservationRuns: 8,
  maxObservationRecoveryRuns: 4,
  maxObservationRunsTotal: 12,
  requiredPrimaryReviewersPerCandidate: 2,
  maxAdjudicationsPerCandidate: 1,
  maxPromotionReviewsPerEligibleCandidate: 1
});

export const PILOT_SUBJECT_AGE_BANDS = Object.freeze(["20s", "30s", "40s", "50s"]);
export const PILOT_SUBJECT_PRESENTATIONS = Object.freeze(["feminine", "masculine", "androgynous"]);
export const PILOT_SUBJECT_REGIONAL_APPEARANCE_HINTS = Object.freeze([null, "korean_appearance_hint"]);
export const PILOT_WAVE_CANCELLATION_REASONS = Object.freeze(["subject_diversity_contract_reissue"]);

export const GENERATION_RETRY_ALLOWED_REASONS = Object.freeze([
  "provider_no_output",
  "provider_refusal_without_asset",
  "local_transfer_incomplete",
  "asset_unreadable",
  "asset_format_unsupported_before_registration"
]);

export const GENERATION_RETRY_FORBIDDEN_REASONS = Object.freeze([
  "capture_quality_low",
  "observation_ineligible",
  "cue_mismatch",
  "judgment_disagreement",
  "alignment_misaligned",
  "promotion_held",
  "promotion_rejected"
]);

export const OBSERVATION_RECOVERY_ALLOWED_REASONS = Object.freeze([
  "provider_transport_failure",
  "provider_contract_parse_failure",
  "execution_claim_failed_before_observation_publication"
]);

export const OBSERVATION_RECOVERY_FORBIDDEN_OUTCOMES = Object.freeze([
  "observed_bundle",
  "valid_ineligible_observation"
]);

export const GENERATION_HANDOFF_OUTCOMES = Object.freeze([
  "asset_ready",
  "provider_no_output",
  "provider_refusal_without_asset",
  "local_transfer_incomplete"
]);

export const PILOT_EVENT_TYPES = Object.freeze([
  "run_started",
  "wave_issued",
  "wave_cancelled",
  "generation_packet_issued",
  "generation_handoff_registered",
  "generation_retry_reserved",
  "candidate_registered",
  "observation_authorization_recorded",
  "observation_registered",
  "judgment_assignment_issued",
  "judgment_consensus_sealed",
  "alignment_registered",
  "promotion_preflight_registered",
  "promotion_decision_registered",
  "slot_terminal",
  "checkpoint_requested",
  "checkpoint_approved",
  "checkpoint_stopped",
  "run_paused",
  "run_resumed",
  "run_closed"
]);

export const PILOT_TERMINAL_OUTCOMES = Object.freeze([
  "promoted_g4",
  "retained_g3_negative_control",
  "promotion_held",
  "promotion_rejected",
  "generation_failed_no_asset",
  "candidate_import_failed",
  "observation_valid_ineligible",
  "observation_failed",
  "judgment_incomplete",
  "cancelled_budget_exhausted",
  "cancelled_campaign_stop",
  "cancelled_operator",
  "cancelled_ungenerated_wave"
]);

export const PILOT_IMMEDIATE_STOP_REASONS = Object.freeze([
  "real_person_reference_detected",
  "synthetic_only_attestation_invalid",
  "source_artifact_integrity_invalid",
  "campaign_source_freeze_drift",
  "provider_profile_disabled_or_changed",
  "systemic_external_mark_present",
  "registered_candidate_replacement_attempted",
  "campaign_event_chain_invalid",
  "budget_hard_cap_exceeded"
]);

export const PILOT_PAUSE_REASONS = Object.freeze([
  "provider_rights_scope_uncertain",
  "repeated_exact_duplicates",
  "perceptual_leakage_review_required",
  "source_policy_changed",
  "condition_wide_observation_failure",
  "reviewer_role_separation_unavailable"
]);

export const PILOT_REASON_CODES = Object.freeze([
  "campaign_plan_valid",
  "campaign_source_freeze_valid",
  "campaign_source_freeze_drift",
  "campaign_provider_profile_invalid",
  "campaign_matrix_invalid",
  "campaign_subject_matrix_invalid",
  "campaign_budget_invalid",
  "generation_asset_ready",
  "provider_no_output",
  "provider_refusal_without_asset",
  "local_transfer_incomplete",
  "asset_unreadable",
  "asset_format_unsupported_before_registration",
  "generation_retry_reserved",
  "generation_retry_not_allowed",
  "generation_attempt_budget_exhausted",
  "candidate_registered_to_slot",
  "registered_candidate_replacement_attempted",
  "candidate_import_failed",
  "observation_authorization_required",
  "observation_registered",
  "observation_valid_ineligible",
  "provider_transport_failure",
  "provider_contract_parse_failure",
  "execution_claim_failed_before_observation_publication",
  "observation_recovery_reserved",
  "observation_recovery_not_allowed",
  "observation_budget_exhausted",
  "judgment_reviews_pending",
  "consensus_sealed",
  "promotion_policy_reviews_pending",
  "promotion_review_pending",
  "checkpoint_continue",
  "checkpoint_pause",
  "checkpoint_stop",
  "subject_diversity_contract_reissue",
  "cancelled_ungenerated_wave",
  "systemic_external_mark_present",
  "real_person_reference_detected",
  "synthetic_only_attestation_invalid",
  "source_artifact_integrity_invalid",
  "provider_profile_disabled_or_changed",
  "campaign_event_chain_invalid",
  "budget_hard_cap_exceeded",
  "campaign_closed_complete",
  "campaign_closed_stopped",
  "slot_terminal_recorded"
]);

export const PILOT_TRACKS = Object.freeze(["T2", "T3", "T4", "T5", "T6", "T7"]);
