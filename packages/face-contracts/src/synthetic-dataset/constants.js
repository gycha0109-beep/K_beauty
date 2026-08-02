export const DATASET_SOURCE_REQUEST_SCHEMA_VERSION = "dataset-source-request-v1";
export const DATASET_SOURCE_SNAPSHOT_SCHEMA_VERSION = "dataset-source-snapshot-v1";
export const LEAKAGE_GRAPH_SCHEMA_VERSION = "leakage-graph-v1";
export const DATASET_SPLIT_PLAN_SCHEMA_VERSION = "dataset-split-plan-v1";
export const DATASET_SPLIT_ASSIGNMENT_SCHEMA_VERSION = "dataset-split-assignment-v1";
export const DATASET_LOCK_REVIEW_SCHEMA_VERSION = "dataset-lock-review-submission-v1";
export const DATASET_MEMBER_SCHEMA_VERSION = "dataset-member-record-v1";
export const DATASET_LOCK_BASIS_SCHEMA_VERSION = "dataset-lock-basis-v1";
export const DATASET_VERSION_MANIFEST_SCHEMA_VERSION = "dataset-version-manifest-v1";
export const DATASET_EXPOSURE_CLAIM_SCHEMA_VERSION = "dataset-exposure-claim-v1";
export const G5_HOLDOUT_RECORD_SCHEMA_VERSION = "g5-holdout-record-v1";
export const DATASET_VERSION_STATUS_EVENT_SCHEMA_VERSION = "dataset-version-status-event-v1";
export const G5_STATUS_EVENT_SCHEMA_VERSION = "g5-status-event-v1";
export const DATASET_ACTIVATION_MANIFEST_SCHEMA_VERSION = "dataset-activation-manifest-v1";
export const HOLDOUT_MATERIALIZATION_REQUEST_SCHEMA_VERSION = "holdout-materialization-request-v1";
export const REGRESSION_BASELINE_REQUEST_SCHEMA_VERSION = "regression-baseline-request-v1";
export const REGRESSION_BASELINE_REVIEW_SCHEMA_VERSION = "regression-baseline-review-v1";
export const REGRESSION_BASELINE_SCHEMA_VERSION = "regression-baseline-v1";

export const DATASET_SPLITS = Object.freeze(["train", "development", "validation", "test", "holdout"]);
export const DATASET_SPLIT_ORDER = Object.freeze(["holdout", "test", "validation", "development", "train"]);
export const DATASET_EXPOSURE_CLASS = Object.freeze({
  train: "optimization_exposed",
  development: "development_exposed",
  validation: "model_selection_exposed",
  test: "release_test_exposed",
  holdout: "sealed_holdout"
});
export const DATASET_COUPLING_KINDS = Object.freeze([
  "canonical_sha256",
  "campaign_series",
  "reference_lineage",
  "paired_edit_lineage",
  "reviewed_visual_similarity",
  "active_representative_alias"
]);
export const DATASET_VERSION_STATUS_EVENTS = Object.freeze(["activated", "retired", "invalidated", "superseded"]);
export const G5_STATUS_EVENTS = Object.freeze(["activated", "revoked", "superseded"]);
export const DATASET_LOCK_DECISIONS = Object.freeze(["approve_lock", "reject_lock"]);
export const DATASET_USE_SCOPE = "internal_evaluation_only";

export const DATASET_SOURCE_POLICY = Object.freeze({ id: "bejewely-dataset-source-policy-v1", version: "1.0.0" });
export const DATASET_GRAPH_POLICY = Object.freeze({ id: "bejewely-leakage-graph-policy-v1", version: "1.0.0" });
export const DATASET_SPLIT_POLICY = Object.freeze({ id: "bejewely-component-split-policy-v1", version: "1.0.0" });
export const DATASET_LOCK_POLICY = Object.freeze({ id: "bejewely-dataset-lock-policy-v1", version: "1.0.0" });
export const DATASET_ACTIVATION_POLICY = Object.freeze({ id: "bejewely-dataset-activation-policy-v1", version: "1.0.0" });
export const G5_HOLDOUT_POLICY = Object.freeze({ id: "bejewely-g5-holdout-policy-v1", version: "1.0.0" });
export const REGRESSION_BASELINE_POLICY = Object.freeze({ id: "bejewely-regression-baseline-policy-v1", version: "1.0.0" });
