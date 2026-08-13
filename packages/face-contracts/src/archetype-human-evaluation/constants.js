export const ARCHETYPE_REVIEW_ITEM_SCHEMA_VERSION = "face-lab-archetype-review-item-v1";
export const ARCHETYPE_REVIEW_SESSION_SCHEMA_VERSION = "face-lab-archetype-review-session-v1";
export const ARCHETYPE_HUMAN_ANNOTATION_SCHEMA_VERSION = "face-lab-archetype-human-annotation-v1";
export const ARCHETYPE_ANNOTATION_SET_SCHEMA_VERSION = "face-lab-archetype-annotation-set-v1";
export const ARCHETYPE_CONSENSUS_SCHEMA_VERSION = "face-lab-archetype-consensus-v1";
export const ARCHETYPE_ADJUDICATION_SCHEMA_VERSION = "face-lab-archetype-adjudication-v1";
export const ARCHETYPE_DATASET_MANIFEST_SCHEMA_VERSION = "face-lab-archetype-dataset-manifest-v1";

export const ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION = "1.0.0";
export const ARCHETYPE_EVIDENCE_TAG_REGISTRY_VERSION = "face-lab-archetype-human-evidence-tags-v1";

export const ARCHETYPE_TAXONOMY_KEYS = Object.freeze([
  "wolf",
  "cat",
  "puppy",
  "deer",
  "tofu",
  "potato",
  "dino"
]);

export const ARCHETYPE_EVIDENCE_TAGS = Object.freeze([
  "outline.overall_shape",
  "outline.jaw_structure",
  "vertical.face_length_balance",
  "eyes.direction",
  "eyes.length",
  "eyes.openness",
  "feature_layout.scale",
  "feature_layout.concentration",
  "visual_language.line_balance",
  "visual_language.contour_definition",
  "visual_language.feature_contrast"
]);

export const ARCHETYPE_SPLIT_ROLES = Object.freeze([
  "development",
  "validation",
  "locked_holdout"
]);

export const ARCHETYPE_EVIDENCE_CLASSES = Object.freeze(["human_annotated_real"]);
export const ARCHETYPE_WITHDRAWAL_STATES = Object.freeze([
  "active",
  "withdrawal_requested",
  "withdrawn",
  "tombstoned"
]);
export const ARCHETYPE_ASSESSABILITY_STATES = Object.freeze([
  "assessable",
  "uncertain_assessability",
  "not_assessable"
]);
export const ARCHETYPE_LABEL_STATES = Object.freeze([
  "ranked",
  "ambiguous",
  "uncertain",
  "not_assessable"
]);
export const ARCHETYPE_CONFIDENCE_VALUES = Object.freeze([
  "low",
  "medium",
  "high",
  "not_applicable"
]);
export const ARCHETYPE_SESSION_STATES = Object.freeze(["issued", "sealed"]);
export const ARCHETYPE_CONSENSUS_STATES = Object.freeze([
  "clear_consensus",
  "ambiguous_consensus",
  "insufficient_annotations",
  "not_assessable",
  "disagreement_high"
]);
export const ARCHETYPE_CONSENSUS_POLICY_STATES = Object.freeze([
  "specified",
  "not_yet_determined"
]);
export const ARCHETYPE_ADJUDICATION_OUTCOMES = Object.freeze([
  "affirm_consensus",
  "retain_ambiguity",
  "superseding_resolution",
  "not_assessable"
]);

export const ARCHETYPE_ASSESSABILITY_REASON_CODES = Object.freeze([
  "face_not_reviewable",
  "pose_blocks_structure",
  "crop_blocks_structure",
  "occlusion",
  "image_quality",
  "heavy_edit_or_filter_possible",
  "insufficient_visible_evidence",
  "archetype_boundary_ambiguous",
  "other_contract_defined_reason"
]);

export const ARCHETYPE_ADJUDICATION_REASON_CODES = Object.freeze([
  "consensus_supported",
  "ambiguity_preserved",
  "independent_evidence_resolution",
  "insufficient_visible_evidence",
  "review_item_not_assessable"
]);

export const ARCHETYPE_REQUIRED_BLIND_STATE = Object.freeze({
  generationTargetHidden: true,
  syntheticPromptHidden: true,
  engineOutputHidden: true,
  peerAnnotationsHidden: true,
  consensusHidden: true
});
