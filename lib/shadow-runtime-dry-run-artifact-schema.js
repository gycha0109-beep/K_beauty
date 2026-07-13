export const SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION = "2026-07-10.phase31";

const ALLOWED_EVIDENCE_TYPES = new Set([
  "shadow_runtime_dry_run",
  "shadow_runtime_dry_run_schema_test"
]);

export const REQUIRED_SHADOW_ARTIFACT_FIELDS = [
  "schemaVersion",
  "evidenceType",
  "runtimeConnected",
  "dryRunOnly",
  "routeInvoked",
  "supabaseWriteExecuted",
  "runtimeMutation",
  "baseline",
  "shadow",
  "comparison",
  "evidenceSeparation",
  "artifactSanitization"
];

export const FORBIDDEN_SHADOW_ARTIFACT_FIELDS = [
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

const FORBIDDEN_KEY_NORMALIZED = new Set(
  FORBIDDEN_SHADOW_ARTIFACT_FIELDS.map((field) => normalizeKey(field))
);

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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
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

function scanForbiddenContent(artifact, errors) {
  walk(artifact, "", (value, currentPath) => {
    const key = currentPath.split(".").pop()?.replace(/\[\d+\]$/g, "") || "";
    const normalized = normalizeKey(key);
    if (FORBIDDEN_KEY_NORMALIZED.has(normalized)) {
      addError(
        errors,
        "forbidden_field_present",
        currentPath,
        "Forbidden shadow dry-run artifact field is present."
      );
    }

    if (typeof value === "string") {
      for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          addError(
            errors,
            "forbidden_value_present",
            currentPath,
            "Forbidden shadow dry-run artifact value pattern is present."
          );
          break;
        }
      }
    }
  });
}

function validateRequiredTopLevelFields(artifact, errors) {
  for (const field of REQUIRED_SHADOW_ARTIFACT_FIELDS) {
    if (!hasOwn(artifact, field)) {
      addError(errors, "missing_required_field", field, "Required top-level artifact field is missing.");
    }
  }
}

function validateRuntimeFlags(artifact, errors) {
  if (!ALLOWED_EVIDENCE_TYPES.has(artifact.evidenceType)) {
    addError(errors, "invalid_evidence_type", "evidenceType", "Invalid shadow dry-run evidenceType.");
  }
  if (artifact.runtimeConnected !== false) {
    addError(errors, "runtime_connected_not_false", "runtimeConnected", "runtimeConnected must remain false.");
  }
  if (artifact.dryRunOnly !== true) {
    addError(errors, "dry_run_only_not_true", "dryRunOnly", "dryRunOnly must be true.");
  }
  if (typeof artifact.routeInvoked !== "boolean") {
    addError(errors, "route_invoked_missing_boolean", "routeInvoked", "routeInvoked must be a boolean.");
  }
  if (artifact.supabaseWriteExecuted !== false) {
    addError(errors, "supabase_write_executed_not_false", "supabaseWriteExecuted", "supabaseWriteExecuted must remain false.");
  }
  if (artifact.runtimeMutation !== false) {
    addError(errors, "runtime_mutation_not_false", "runtimeMutation", "runtimeMutation must remain false.");
  }
}

function validateBaselineShadowSeparation(artifact, errors) {
  if (!artifact.baseline || typeof artifact.baseline !== "object" || Array.isArray(artifact.baseline)) {
    addError(errors, "baseline_missing", "baseline", "Baseline section must be a separated object.");
  }
  if (!artifact.shadow || typeof artifact.shadow !== "object" || Array.isArray(artifact.shadow)) {
    addError(errors, "shadow_missing", "shadow", "Shadow section must be a separated object.");
  }
  if (artifact.baseline && artifact.shadow && artifact.baseline === artifact.shadow) {
    addError(errors, "baseline_shadow_same_reference", "shadow", "Baseline and shadow sections must be separated.");
  }

  const separation = artifact.evidenceSeparation || {};
  if (separation.syntheticTreatedAsActualEvidence !== false) {
    addError(
      errors,
      "synthetic_treated_as_actual",
      "evidenceSeparation.syntheticTreatedAsActualEvidence",
      "Synthetic contract cases must not be recorded as actual evidence."
    );
  }
  if (separation.actualEvidenceBucket && separation.actualEvidenceBucket === separation.pureReplayEvidenceBucket) {
    addError(
      errors,
      "actual_pure_replay_bucket_mixed",
      "evidenceSeparation",
      "Actual evidence and pure replay evidence buckets must remain separate."
    );
  }
}

function validateComparisonGuards(artifact, errors) {
  const comparison = artifact.comparison || {};
  if (comparison.apiResponseShapeChanged !== false) {
    addError(errors, "api_response_shape_changed", "comparison.apiResponseShapeChanged", "API response shape changes are not allowed.");
  }
  if (comparison.recommendationResultChanged !== false) {
    addError(errors, "recommendation_result_changed", "comparison.recommendationResultChanged", "Recommendation result changes are not allowed.");
  }
  if (Number(comparison.dbWriteCount || 0) !== 0) {
    addError(errors, "db_write_count_not_zero", "comparison.dbWriteCount", "DB write count must be zero.");
  }
  if (Number(comparison.highRiskCollapsedReceiverCount || 0) !== 0) {
    addError(
      errors,
      "high_risk_collapsed_receiver_count_not_zero",
      "comparison.highRiskCollapsedReceiverCount",
      "High-risk collapsed receiver count must be zero."
    );
  }
  if (Number(comparison.metadataIncompleteCollapsedReceiverCount || 0) !== 0) {
    addError(
      errors,
      "metadata_incomplete_collapsed_receiver_count_not_zero",
      "comparison.metadataIncompleteCollapsedReceiverCount",
      "Metadata incomplete collapsed receiver count must be zero."
    );
  }
  if (Number(comparison.sensitivityUnsafeCollapsedReceiverCount || 0) !== 0) {
    addError(errors, "sensitivity_unsafe_collapsed_receiver_count_not_zero", "comparison.sensitivityUnsafeCollapsedReceiverCount", "Sensitivity-unsafe collapsed receiver count must be zero.");
  }
  if (Number(comparison.strongCautionCollapsedReceiverCount || 0) !== 0) {
    addError(errors, "strong_caution_collapsed_receiver_count_not_zero", "comparison.strongCautionCollapsedReceiverCount", "Strong-caution collapsed receiver count must be zero.");
  }
  if (Number(comparison.activeOnlyViolationCount || 0) !== 0) {
    addError(errors, "active_only_receiver_contract_violation_not_zero", "comparison.activeOnlyViolationCount", "Active-only receiver contract violation count must be zero.");
  }
}

function validateSanitization(artifact, errors) {
  const sanitization = artifact.artifactSanitization || {};
  if (sanitization.forbiddenFieldsPresent !== false) {
    addError(
      errors,
      "forbidden_fields_present_flag_not_false",
      "artifactSanitization.forbiddenFieldsPresent",
      "artifactSanitization.forbiddenFieldsPresent must be false."
    );
  }
  if (sanitization.fullApiResponseBodyDumped !== false) {
    addError(
      errors,
      "full_api_response_dumped",
      "artifactSanitization.fullApiResponseBodyDumped",
      "Full API response body dumps are forbidden."
    );
  }
  if (sanitization.envValuesPrinted !== false) {
    addError(
      errors,
      "env_values_printed",
      "artifactSanitization.envValuesPrinted",
      "Env or secret values must not be printed."
    );
  }
}

export function validateShadowRuntimeDryRunArtifact(artifact = {}) {
  const errors = [];
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    addError(errors, "artifact_not_object", "", "Artifact must be an object.");
    return {
      valid: false,
      errors,
      schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION
    };
  }

  validateRequiredTopLevelFields(artifact, errors);
  validateRuntimeFlags(artifact, errors);
  validateBaselineShadowSeparation(artifact, errors);
  validateComparisonGuards(artifact, errors);
  validateSanitization(artifact, errors);
  scanForbiddenContent(artifact, errors);

  return {
    valid: errors.length === 0,
    errors,
    schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
    summary: {
      evidenceType: artifact.evidenceType || null,
      runtimeConnected: artifact.runtimeConnected ?? null,
      dryRunOnly: artifact.dryRunOnly ?? null,
      routeInvoked: artifact.routeInvoked ?? null,
      supabaseWriteExecuted: artifact.supabaseWriteExecuted ?? null,
      runtimeMutation: artifact.runtimeMutation ?? null,
      baselineSeparated: Boolean(artifact.baseline && artifact.shadow && artifact.baseline !== artifact.shadow)
    }
  };
}
