export const SOLO_ASSESSMENT_POLICY_SCHEMA_VERSION = "solo-assessment-policy-v1";
export const SOLO_WAVE_SESSION_SCHEMA_VERSION = "solo-wave-session-v1";
export const TARGET_WITHHELD_REVIEW_ITEM_SCHEMA_VERSION = "target-withheld-review-item-v1";
export const SOLO_SCREENING_CLAIM_SCHEMA_VERSION = "solo-screening-claim-v1";
export const SOLO_TARGET_WITHHELD_SCREENING_SCHEMA_VERSION = "solo-target-withheld-screening-v1";
export const SOLO_INTENT_REVEAL_RECEIPT_SCHEMA_VERSION = "solo-intent-reveal-receipt-v1";
export const SOLO_INTENT_ASSESSMENT_SCHEMA_VERSION = "solo-intent-assessment-v1";
export const SOLO_WAVE_ASSESSMENT_ROW_SCHEMA_VERSION = "solo-wave-assessment-row-v1";
export const SOLO_WAVE_ASSESSMENT_SET_SCHEMA_VERSION = "solo-wave-assessment-set-v1";
export const SOLO_WAVE_BRIEF_SCHEMA_VERSION = "solo-wave-brief-v1";
export const SOLO_CHECKPOINT_LINK_SCHEMA_VERSION = "solo-checkpoint-link-v1";

export const SOLO_ASSESSMENT_AUTHORITY = "operator_exploratory_assessment";
export const SOLO_REPORT_AUTHORITY = "t11_solo_exploratory";
export const SOLO_POLICY_ID = "bejewely-solo-pilot-assessment-v1";
export const SOLO_POLICY_VERSION = "1.0.0";

export const SOLO_WAVE_SLOT_COUNTS = Object.freeze({ 1: 4, 2: 8, 3: 8 });
export const SOLO_WAVE_CONDITION_COUNTS = Object.freeze({
  1: Object.freeze({ A: 1, B: 1, C: 1, D: 1 }),
  2: Object.freeze({ A: 2, B: 2, C: 2, D: 2 }),
  3: Object.freeze({ A: 2, B: 2, C: 2, D: 2 })
});

export const SOLO_SLOT_READINESS = Object.freeze([
  "assessable_observed",
  "assessable_valid_ineligible",
  "technical_no_asset",
  "technical_import_failure",
  "technical_observation_failure",
  "cancelled",
  "not_ready"
]);

export const SOLO_TRI_STATE = Object.freeze(["confirmed", "rejected", "uncertain"]);
export const SOLO_REVIEWABILITY = Object.freeze(["reviewable", "unreviewable", "uncertain"]);
export const SOLO_PRESENCE = Object.freeze(["none", "mild", "moderate_or_higher", "uncertain"]);
export const SOLO_BLEMISH_COUNT_BANDS = Object.freeze(["none", "one_to_two", "three_to_five", "six_plus", "uncertain"]);
export const SOLO_ARTIFACT_STATES = Object.freeze(["absent", "present", "uncertain"]);
export const SOLO_TARGET_RELATIONS = Object.freeze(["exact_match", "under_target", "over_target", "contradictory", "unverifiable"]);
export const SOLO_USABILITY = Object.freeze(["usable", "usable_with_caution", "unusable", "not_assessable"]);
export const SOLO_OPERATIONAL_DISPOSITIONS = Object.freeze([
  "retain_exploratory",
  "retain_negative_or_edge_case",
  "pause_and_replan_next_run",
  "stop_for_integrity_or_safety"
]);
export const SOLO_DECISIONS = Object.freeze(["continue", "pause", "stop"]);
export const SOLO_T5_STATUS = Object.freeze(["not_started", "incomplete", "present_but_not_used"]);
export const SOLO_ROW_AUTHORITIES = Object.freeze([SOLO_ASSESSMENT_AUTHORITY, "technical_source_only"]);

export const SOLO_REDNESS_REGIONS = Object.freeze(["left_cheek", "right_cheek", "sides_of_nose", "other"]);
export const SOLO_BLEMISH_REGIONS = Object.freeze(["left_cheek", "right_cheek", "chin", "other"]);

export const SOLO_EXCLUDED_FIELDS = Object.freeze([
  "slotId",
  "conditionId",
  "fixtureId",
  "generationSpec",
  "compiledPrompt",
  "intendedSkinCue",
  "providerGenerationMetadata"
]);

export const SOLO_LIMITATIONS = Object.freeze([
  "single_operator",
  "prior_target_knowledge_possible",
  "not_independent_consensus",
  "not_gold_evidence",
  "not_population_evidence"
]);

export const SOLO_REASON_CODES = Object.freeze([
  "solo_source_verified",
  "solo_source_not_ready",
  "solo_wave_not_issued",
  "solo_wave_slot_count_invalid",
  "solo_t7_projection_invalid",
  "solo_candidate_source_invalid",
  "solo_observation_source_invalid",
  "solo_target_withholding_invalid",
  "solo_existing_t5_consensus_blocks_session",
  "solo_screening_reviewable",
  "solo_screening_unreviewable",
  "solo_capture_issue",
  "solo_skin_cue_issue",
  "solo_artifact_issue",
  "solo_target_exact_match",
  "solo_target_under",
  "solo_target_over",
  "solo_target_unverifiable",
  "solo_intent_source_conflict",
  "solo_retain_exploratory",
  "solo_retain_negative_or_edge_case",
  "solo_pause_and_replan",
  "solo_stop_integrity_or_safety",
  "solo_wave_continue",
  "solo_wave_pause",
  "solo_wave_stop",
  "solo_no_same_slot_quality_retry",
  "solo_single_operator_acknowledged",
  "solo_no_consensus_claim_acknowledged",
  "solo_no_gold_claim_acknowledged",
  "solo_checkpoint_decision_match"
]);
