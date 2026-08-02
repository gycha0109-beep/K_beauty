export const CAMPAIGN_EVIDENCE_SNAPSHOT_SCHEMA_VERSION = "campaign-evidence-snapshot-v1";
export const CAMPAIGN_SLOT_EVIDENCE_ROW_SCHEMA_VERSION = "campaign-slot-evidence-row-v1";
export const CAMPAIGN_METRIC_SET_SCHEMA_VERSION = "campaign-metric-set-v1";
export const CAMPAIGN_REVIEW_PACKAGE_SCHEMA_VERSION = "campaign-review-package-v1";
export const CAMPAIGN_REPORT_SCHEMA_VERSION = "campaign-report-v1";
export const REPORT_REVIEW_SUBMISSION_SCHEMA_VERSION = "report-review-submission-v1";
export const REPORT_REVISION_LINK_SCHEMA_VERSION = "report-revision-link-v1";
export const CAMPAIGN_EXPORT_MANIFEST_SCHEMA_VERSION = "campaign-export-manifest-v1";
export const PROVIDER_COMPARISON_KEY_SCHEMA_VERSION = "provider-comparison-key-v1";

export const CAMPAIGN_REPORT_POLICY = Object.freeze({
  id: "bejewely-campaign-report-policy-v1",
  version: "1.0.0"
});

export const CAMPAIGN_METRIC_POLICY = Object.freeze({
  id: "bejewely-campaign-metric-policy-v1",
  version: "1.0.0"
});

export const T8_EXPORTER_ID = "bejewely-t8-exporter";
export const T8_EXPORTER_VERSION = "1.0.0";
export const T8_RENDERER_VERSION = "1.0.0";

export const T8_THUMBNAIL_POLICY = Object.freeze({
  id: "t8-thumbnail-display-v1",
  maxWidth: 512,
  maxHeight: 512,
  fit: "inside",
  withoutEnlargement: true,
  format: "png",
  crop: false,
  retouch: false,
  colorCorrection: false,
  metadataRetention: false
});

export const T8_STAGE_METRICS = Object.freeze([
  "issued_primary_slots",
  "asset_ready_handoffs",
  "registered_candidates",
  "authoritative_observations",
  "valid_ineligible",
  "sealed_consensus",
  "alignment_records",
  "promotion_decisions",
  "promoted_g4_as_of_closeout"
]);

export const T8_FAILURE_GROUPS = Object.freeze([
  "generation_technical",
  "candidate_import_technical",
  "observation_valid_ineligible",
  "observation_technical",
  "judgment_incomplete",
  "promotion_non_gold",
  "promotion_hold",
  "promotion_reject",
  "campaign_cancelled"
]);

export const T8_CLAIM_TYPES = Object.freeze([
  "direct_count",
  "direct_rate",
  "descriptive_difference",
  "operational_pattern",
  "limitation"
]);

export const T8_FORBIDDEN_CLAIM_PATTERN = /\b(?:better|worse|accurate|inaccurate|safe|unsafe|representative|superior|inferior|because|caused|led\s+to|clinical|diagnosis|disease|ethnicity|race|identity)\b/i;

export const T8_EXPORT_FILE_ROLES = Object.freeze(["source", "table", "thumbnail", "review", "report"]);
export const T8_AUDIENCE = "internal_review";
