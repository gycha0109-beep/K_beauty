import {
  SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  validateShadowRuntimeDryRunArtifact
} from "./shadow-runtime-dry-run-artifact-schema.js";
import { validateShadowDryRunSnapshot } from "./shadow-dry-run-snapshot-contract.js";

export const SHADOW_BOUNDARY_DRY_RUN_HELPER_VERSION = "2026-07-10.phase35";

const FUTURE_FLAG_NAMES = [
  "SHADOW_RUNTIME_BOUNDARY_DRY_RUN",
  "ANALYZE_SHADOW_BOUNDARY_DRY_RUN",
  "DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN"
];

const TRUE_FLAG_VALUES = new Set(["1", "true", "enabled", "on"]);

const REQUIRED_INPUT_FIELDS = [
  "baselineResponseShapeSnapshot",
  "baselineRecommendationSnapshot",
  "shadowBoundaryHintSnapshot",
  "shadowReceiverSnapshot",
  "comparisonSnapshot",
  "dryRunContext"
];

const FORBIDDEN_KEY_NAMES = [
  "product_name",
  "productName",
  "name",
  "brand",
  "purchase_url",
  "purchaseUrl",
  "buy_link",
  "buyLink",
  "review_text",
  "reviewText",
  "raw_form",
  "rawForm",
  "image",
  "image_url",
  "imageUrl",
  "base64",
  "pii",
  "email",
  "cookie",
  "user_agent",
  "userAgent",
  "env",
  "secret",
  "token",
  "apiKey",
  "full_api_response_body",
  "fullApiResponseBody",
  "apiResponseBody",
  "responseBody"
];

const FORBIDDEN_KEY_NORMALIZED = new Set(FORBIDDEN_KEY_NAMES.map(normalizeKey));
const FORBIDDEN_VALUE_PATTERNS = [
  /data:image\//i,
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /https?:\/\/[^\s")]+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /SUPABASE_[A-Z_]*=\S+/i,
  /NEXT_PUBLIC_SUPABASE_[A-Z_]*=\S+/i,
  /(?:secret|token|api[_-]?key)\s*[:=]\s*[A-Za-z0-9._-]{8,}/i
];

function normalizeKey(value) {
  return String(value || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function walk(value, path, visitor) {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, visitor));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walk(child, path ? `${path}.${key}` : key, visitor);
    }
  }
}

function scanForbidden(value, errors) {
  walk(value, "", (child, currentPath) => {
    const key = currentPath.split(".").pop()?.replace(/\[\d+\]$/g, "") || "";
    if (FORBIDDEN_KEY_NORMALIZED.has(normalizeKey(key))) {
      addError(errors, "forbidden_field_present", currentPath, "Forbidden dry-run helper field is present.");
    }

    if (typeof child === "string") {
      for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(child)) {
          addError(errors, "forbidden_value_present", currentPath, "Forbidden dry-run helper value is present.");
          break;
        }
      }
    }
  });
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeBoolean(value) {
  return Boolean(value);
}

export function isShadowBoundaryDryRunEnabled(envLike = {}) {
  if (!envLike || typeof envLike !== "object") {
    return false;
  }

  const production = String(envLike.NODE_ENV || "").toLowerCase() === "production";
  if (production) {
    return false;
  }

  return FUTURE_FLAG_NAMES.some((flagName) => TRUE_FLAG_VALUES.has(String(envLike[flagName] || "").toLowerCase()));
}

function validateDryRunContext(context, errors) {
  if (!isObject(context)) {
    addError(errors, "missing_dry_run_context", "dryRunContext", "dryRunContext is required.");
    return;
  }

  if (context.dryRunOnly !== true) {
    addError(errors, "dry_run_only_not_true", "dryRunContext.dryRunOnly", "dryRunOnly must be true.");
  }
  if (context.runtimeConnected !== false) {
    addError(errors, "runtime_connected_not_false", "dryRunContext.runtimeConnected", "runtimeConnected must remain false.");
  }
  if (context.routeInvoked !== false) {
    addError(errors, "route_invoked_not_false", "dryRunContext.routeInvoked", "routeInvoked must remain false.");
  }
  if (context.supabaseWriteExecuted !== false) {
    addError(
      errors,
      "supabase_write_executed_not_false",
      "dryRunContext.supabaseWriteExecuted",
      "supabaseWriteExecuted must remain false."
    );
  }
  if (context.runtimeMutation !== false) {
    addError(errors, "runtime_mutation_not_false", "dryRunContext.runtimeMutation", "runtimeMutation must remain false.");
  }
}

function validateSnapshotField(input, field, expectedType, errors) {
  const result = validateShadowDryRunSnapshot(input[field]);
  if (!result.valid) {
    addError(errors, "invalid_snapshot", field, `${field} failed snapshot validation.`);
    for (const error of result.errors) {
      addError(errors, error.code, `${field}.${error.path}`, error.message);
    }
    return;
  }
  if (input[field]?.snapshotType !== expectedType) {
    addError(errors, "unexpected_snapshot_type", field, `${field} must be ${expectedType}.`);
  }
}

export function validateShadowBoundaryDryRunInput(input = {}) {
  const errors = [];
  if (!isObject(input)) {
    addError(errors, "input_not_object", "", "Dry-run helper input must be an object.");
    return { valid: false, errors };
  }

  for (const field of REQUIRED_INPUT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      addError(errors, "missing_required_field", field, "Required dry-run helper input field is missing.");
    }
  }

  scanForbidden(input, errors);
  validateDryRunContext(input.dryRunContext, errors);

  if (input.baselineResponseShapeSnapshot) {
    validateSnapshotField(input, "baselineResponseShapeSnapshot", "baselineResponseShapeSnapshot", errors);
  }
  if (input.baselineRecommendationSnapshot) {
    validateSnapshotField(input, "baselineRecommendationSnapshot", "baselineRecommendationSnapshot", errors);
  }
  if (input.shadowBoundaryHintSnapshot) {
    validateSnapshotField(input, "shadowBoundaryHintSnapshot", "shadowBoundaryHintSnapshot", errors);
  }
  if (input.shadowReceiverSnapshot) {
    validateSnapshotField(input, "shadowReceiverSnapshot", "shadowReceiverSnapshot", errors);
  }
  if (input.comparisonSnapshot) {
    validateSnapshotField(input, "comparisonSnapshot", "comparisonSnapshot", errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function summarizeShadowBoundaryDryRunComparison(input = {}) {
  const comparison = input.comparisonSnapshot || {};
  const summary = {
    highRiskCollapsedReceiverCount: Number(comparison.highRiskCollapsedReceiverCount || 0),
    sensitivityUnsafeCollapsedReceiverCount: Number(comparison.sensitivityUnsafeCollapsedReceiverCount || 0),
    metadataIncompleteCollapsedReceiverCount: Number(comparison.metadataIncompleteCollapsedReceiverCount || 0),
    strongCautionCollapsedReceiverCount: Number(comparison.strongCautionCollapsedReceiverCount || 0),
    responseShapeChanged: normalizeBoolean(comparison.responseShapeChanged),
    recommendationChanged: normalizeBoolean(comparison.recommendationChanged),
    dbWriteCount: Number(comparison.dbWriteCount || 0),
    forbiddenFieldDetected: normalizeBoolean(comparison.forbiddenFieldDetected)
  };

  const blockedReasons = [
    summary.highRiskCollapsedReceiverCount > 0 ? "high_risk_collapsed_receiver_count_not_zero" : null,
    summary.sensitivityUnsafeCollapsedReceiverCount > 0 ? "sensitivity_unsafe_collapsed_receiver_count_not_zero" : null,
    summary.metadataIncompleteCollapsedReceiverCount > 0 ? "metadata_incomplete_collapsed_receiver_count_not_zero" : null,
    summary.strongCautionCollapsedReceiverCount > 0 ? "strong_caution_collapsed_receiver_count_not_zero" : null,
    summary.responseShapeChanged ? "response_shape_changed" : null,
    summary.recommendationChanged ? "recommendation_changed" : null,
    summary.dbWriteCount > 0 ? "db_write_count_not_zero" : null,
    summary.forbiddenFieldDetected ? "forbidden_field_detected" : null
  ].filter(Boolean);

  return {
    ...summary,
    blocked: blockedReasons.length > 0,
    blockedReasons
  };
}

export function buildShadowBoundaryDryRunArtifact(input = {}) {
  const validation = validateShadowBoundaryDryRunInput(input);
  if (!validation.valid) {
    return {
      schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
      helperVersion: SHADOW_BOUNDARY_DRY_RUN_HELPER_VERSION,
      evidenceType: "shadow_boundary_dry_run_helper_skeleton",
      dryRunOnly: true,
      runtimeConnected: false,
      routeInvoked: false,
      supabaseWriteExecuted: false,
      runtimeMutation: false,
      valid: false,
      validationErrors: validation.errors,
      artifactWritten: false
    };
  }

  const killConditionSummary = summarizeShadowBoundaryDryRunComparison(input);
  const artifact = {
    schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
    helperVersion: SHADOW_BOUNDARY_DRY_RUN_HELPER_VERSION,
    evidenceType: "shadow_boundary_dry_run_helper_skeleton",
    dryRunOnly: true,
    runtimeConnected: false,
    routeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    baseline: {
      baselineResponseShapeSnapshot: input.baselineResponseShapeSnapshot,
      baselineRecommendationSnapshot: input.baselineRecommendationSnapshot
    },
    shadow: {
      shadowBoundaryHintSnapshot: input.shadowBoundaryHintSnapshot,
      shadowReceiverSnapshot: input.shadowReceiverSnapshot
    },
    comparison: {
      ...input.comparisonSnapshot,
      apiResponseShapeChanged: Boolean(input.comparisonSnapshot.responseShapeChanged),
      recommendationResultChanged: Boolean(input.comparisonSnapshot.recommendationChanged),
      topPickChanged: Boolean(input.comparisonSnapshot.topPickChanged),
      supportingProductsChanged: Boolean(input.comparisonSnapshot.supportingProductsChanged),
      budgetAlternativesChanged: Boolean(input.comparisonSnapshot.budgetAlternativesChanged),
      dbWriteCount: Number(input.comparisonSnapshot.dbWriteCount || 0),
      highRiskCollapsedReceiverCount: Number(input.comparisonSnapshot.highRiskCollapsedReceiverCount || 0),
      metadataIncompleteCollapsedReceiverCount: Number(input.comparisonSnapshot.metadataIncompleteCollapsedReceiverCount || 0)
    },
    killConditionSummary,
    evidenceSeparation: {
      actualEvidenceBucket: "not_used_by_helper_skeleton",
      pureReplayEvidenceBucket: "not_used_by_helper_skeleton_pure_replay",
      syntheticCoverageBucket: "shadow_boundary_dry_run_helper_skeleton",
      syntheticTreatedAsActualEvidence: false
    },
    artifactSanitization: {
      forbiddenFieldsPresent: false,
      fullApiResponseBodyDumped: false,
      envValuesPrinted: false
    },
    artifactWritten: false,
    limitations: [
      "helper_skeleton_only_not_route_connected",
      "artifact_payload_returned_but_not_written",
      "does_not_call_evaluator_runtime",
      "does_not_call_candidate_policy_runtime",
      "does_not_call_api_analyze",
      "does_not_execute_supabase_write"
    ]
  };

  const schemaProbe = validateShadowRuntimeDryRunArtifact({
    ...artifact,
    evidenceType: "shadow_runtime_dry_run_schema_test"
  });

  return {
    ...artifact,
    artifactSchemaCompatibleWhenEvidenceTypeAdapted: schemaProbe.valid,
    artifactSchemaValidationErrors: schemaProbe.errors
  };
}
