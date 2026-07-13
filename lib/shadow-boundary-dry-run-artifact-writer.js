import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildExistingRecommendationSnapshot } from "./functional-shadow-adapter.js";
import { resolveLocalShadowProviderStub } from "./local-shadow-provider-stub.js";
import { validateShadowRuntimeDryRunArtifact } from "./shadow-runtime-dry-run-artifact-schema.js";

export const SHADOW_BOUNDARY_DRY_RUN_ARTIFACT_WRITER_VERSION = "2026-07-10.phase39";

const OUTPUT_SUBDIRECTORY = ["tmp", "shadow-boundary-dry-run"];
const LOCAL_ROUTE_RUNS_SUBDIRECTORY = ["tmp", "isolated-shadow-route-runs"];
const RECOMMENDATION_EVIDENCE_VERSION = "2026-07-13.phase45";
const POLICY_EVIDENCE_VERSION = "2026-07-13.phase46";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOMMENDATION_CONDITIONS = new Set(["off", "on"]);
const FORBIDDEN_RECOMMENDATION_KEYS = new Set([
  "name",
  "brand",
  "purchaseurl",
  "url",
  "buylink",
  "price",
  "pricemin",
  "pricemax",
  "pricerange",
  "summary",
  "description",
  "review",
  "reviewtext",
  "form",
  "rawform",
  "image",
  "imageurl",
  "base64",
  "pii",
  "token",
  "secret"
]);

function isWriterEnabled(envLike = {}) {
  return (
    envLike?.NODE_ENV === "development" &&
    envLike?.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1"
  );
}

function isLocalRecommendationEvidenceEnabled(envLike = {}) {
  return (
    envLike?.NODE_ENV === "development" &&
    envLike?.LOCAL_SHADOW_RECOMMENDATION_EVIDENCE === "1" &&
    resolveLocalShadowProviderStub({ env: envLike }).enabled
  );
}

function isLocalPolicyEvidenceEnabled(envLike = {}) {
  return isLocalRecommendationEvidenceEnabled(envLike) &&
    envLike?.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1" &&
    envLike?.DEV_ONLY_BOUNDARY_POLICY_SHADOW === "1";
}

function normalizeSuffix(value) {
  const normalized = String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return normalized || "shadow";
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().replace(/[:.]/g, "-");
}

function isWithinOutputRoot(candidate, outputRoot) {
  const relative = path.relative(outputRoot, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recommendationCondition(envLike = {}) {
  return envLike?.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1" ? "on" : "off";
}

function resolveLocalRecommendationEvidenceDirectory(envLike = {}) {
  const runDirectory = typeof envLike?.LOCAL_SHADOW_RUN_DIRECTORY === "string"
    ? path.resolve(envLike.LOCAL_SHADOW_RUN_DIRECTORY)
    : null;
  const comparisonRunId = String(envLike?.LOCAL_SHADOW_COMPARISON_RUN_ID || "").trim();
  const runsRoot = path.resolve(process.cwd(), ...LOCAL_ROUTE_RUNS_SUBDIRECTORY);

  if (!runDirectory || !isWithinOutputRoot(runDirectory, runsRoot)) {
    return null;
  }
  if (!existsSync(path.join(runDirectory, ".phase43-isolated-run"))) {
    return null;
  }
  if (!UUID_PATTERN.test(comparisonRunId)) {
    return null;
  }

  return {
    comparisonRunId,
    condition: recommendationCondition(envLike),
    directory: path.join(runDirectory, "route-comparison", comparisonRunId)
  };
}

function hasForbiddenRecommendationField(value) {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenRecommendationField);
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(([key, child]) => {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return FORBIDDEN_RECOMMENDATION_KEYS.has(normalized) || hasForbiddenRecommendationField(child);
  });
}

function recommendationIdEvidence(recommendationResult = {}) {
  const snapshot = buildExistingRecommendationSnapshot(recommendationResult);
  return {
    topPickId: normalizeId(snapshot.topPick?.productId),
    supportingProductIdsInOrder: snapshot.supportingProducts.map((item) => item.productId),
    budgetAlternativeIdsInOrder: snapshot.budgetAlternatives.map((item) => item.productId)
  };
}

export function validateLocalShadowRecommendationEvidence(evidence = {}, {
  comparisonRunId = null,
  condition = null
} = {}) {
  const errors = [];
  const expectedCondition = condition || evidence.condition;

  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return { valid: false, errors: ["evidence_not_object"] };
  }
  if (evidence.evidenceType !== "local_shadow_recommendation_snapshot") errors.push("invalid_evidence_type");
  if (evidence.schemaVersion !== RECOMMENDATION_EVIDENCE_VERSION) errors.push("invalid_schema_version");
  if (!UUID_PATTERN.test(String(evidence.comparisonRunId || ""))) errors.push("invalid_comparison_run_id");
  if (comparisonRunId && evidence.comparisonRunId !== comparisonRunId) errors.push("comparison_run_id_mismatch");
  if (!RECOMMENDATION_CONDITIONS.has(evidence.condition)) errors.push("invalid_condition");
  if (condition && evidence.condition !== condition) errors.push("condition_mismatch");
  if (!Object.prototype.hasOwnProperty.call(evidence, "topPickId")) errors.push("missing_top_pick_id");
  if (!Array.isArray(evidence.supportingProductIdsInOrder)) errors.push("missing_supporting_product_ids");
  if (!Array.isArray(evidence.budgetAlternativeIdsInOrder)) errors.push("missing_budget_alternative_ids");
  if (evidence.topPickId !== null && !normalizeId(evidence.topPickId)) errors.push("invalid_top_pick_id");
  if (Array.isArray(evidence.supportingProductIdsInOrder) && evidence.supportingProductIdsInOrder.some((id) => !normalizeId(id))) {
    errors.push("invalid_supporting_product_id");
  }
  if (Array.isArray(evidence.budgetAlternativeIdsInOrder) && evidence.budgetAlternativeIdsInOrder.some((id) => !normalizeId(id))) {
    errors.push("invalid_budget_alternative_id");
  }
  if (evidence.forbiddenFieldDetected !== false) errors.push("forbidden_field_detected");
  if (hasForbiddenRecommendationField(evidence)) errors.push("forbidden_field_present");
  if (expectedCondition && evidence.condition !== expectedCondition) errors.push("unexpected_condition");

  return { valid: errors.length === 0, errors };
}

export function validateLocalShadowPolicyEvidence(evidence = {}, { comparisonRunId = null } = {}) {
  const errors = [];
  const artifactValidation = validateShadowRuntimeDryRunArtifact(evidence?.artifact || {});
  if (hasForbiddenRecommendationField(evidence)) errors.push("forbidden_field_present");

  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) errors.push("evidence_not_object");
  if (evidence.evidenceType !== "local_shadow_boundary_policy_execution") errors.push("invalid_evidence_type");
  if (evidence.schemaVersion !== POLICY_EVIDENCE_VERSION) errors.push("invalid_schema_version");
  if (!UUID_PATTERN.test(String(evidence.comparisonRunId || ""))) errors.push("invalid_comparison_run_id");
  if (comparisonRunId && evidence.comparisonRunId !== comparisonRunId) errors.push("comparison_run_id_mismatch");
  if (evidence.condition !== "on") errors.push("invalid_condition");
  if (evidence.runtimeConnected !== false) errors.push("runtime_connected_not_false");
  for (const field of ["candidateCount", "boundaryHintCount", "receiverCount"]) {
    if (!Number.isInteger(evidence[field]) || evidence[field] < 0) errors.push(`invalid_${field}`);
  }
  if (!evidence.violationCounts || typeof evidence.violationCounts !== "object") errors.push("missing_violation_counts");
  if (!artifactValidation.valid) errors.push("invalid_shadow_artifact");

  return { valid: errors.length === 0, errors };
}

function safeErrors(errors = []) {
  return errors.map((error) => ({
    code: String(error?.code || "artifact_validation_failed"),
    path: String(error?.path || "")
  }));
}

export function resolveShadowBoundaryDryRunOutputDir(outputDir) {
  const outputRoot = path.resolve(process.cwd(), ...OUTPUT_SUBDIRECTORY);
  const resolved = outputDir ? path.resolve(outputDir) : outputRoot;
  return isWithinOutputRoot(resolved, outputRoot) ? resolved : null;
}

export function sanitizeShadowBoundaryDryRunArtifactForWrite(artifact = {}) {
  const candidate = {
    ...artifact,
    evidenceType: "shadow_runtime_dry_run"
  };
  const sourceValidation = validateShadowRuntimeDryRunArtifact(candidate);
  if (!sourceValidation.valid) {
    return {
      valid: false,
      artifact: null,
      errors: safeErrors(sourceValidation.errors)
    };
  }

  const sanitized = {
    schemaVersion: candidate.schemaVersion,
    helperVersion: candidate.helperVersion,
    writerVersion: SHADOW_BOUNDARY_DRY_RUN_ARTIFACT_WRITER_VERSION,
    evidenceType: candidate.evidenceType,
    dryRunOnly: candidate.dryRunOnly,
    runtimeConnected: candidate.runtimeConnected,
    routeInvoked: candidate.routeInvoked,
    supabaseWriteExecuted: candidate.supabaseWriteExecuted,
    runtimeMutation: candidate.runtimeMutation,
    baseline: candidate.baseline,
    shadow: candidate.shadow,
    comparison: candidate.comparison,
    killConditionSummary: candidate.killConditionSummary,
    evidenceSeparation: candidate.evidenceSeparation,
    artifactSanitization: candidate.artifactSanitization,
    limitations: Array.isArray(candidate.limitations) ? candidate.limitations : []
  };
  const sanitizedValidation = validateShadowRuntimeDryRunArtifact(sanitized);

  return {
    valid: sanitizedValidation.valid,
    artifact: sanitizedValidation.valid ? sanitized : null,
    errors: safeErrors(sanitizedValidation.errors)
  };
}

export async function writeShadowBoundaryDryRunArtifact({
  artifact,
  outputDir,
  envLike = process.env,
  timestamp = new Date(),
  safeSuffix = `process-${process.pid}`,
  fileSystem = { mkdir, writeFile }
} = {}) {
  if (!isWriterEnabled(envLike)) {
    return {
      attempted: false,
      written: false,
      skipped: true,
      skipReason: "shadow_dry_run_writer_disabled",
      filePath: null,
      runtimeMutation: false,
      supabaseWriteExecuted: false
    };
  }

  const resolvedOutputDir = resolveShadowBoundaryDryRunOutputDir(outputDir);
  if (!resolvedOutputDir) {
    return {
      attempted: false,
      written: false,
      skipped: true,
      skipReason: "output_dir_outside_local_tmp_boundary",
      filePath: null,
      runtimeMutation: false,
      supabaseWriteExecuted: false
    };
  }

  const sanitization = sanitizeShadowBoundaryDryRunArtifactForWrite(artifact);
  if (!sanitization.valid) {
    return {
      attempted: false,
      written: false,
      skipped: true,
      skipReason: "artifact_schema_or_forbidden_field_validation_failed",
      validationErrors: sanitization.errors,
      filePath: null,
      runtimeMutation: false,
      supabaseWriteExecuted: false
    };
  }

  const safeTimestamp = normalizeTimestamp(timestamp);
  if (!safeTimestamp) {
    return {
      attempted: false,
      written: false,
      skipped: true,
      skipReason: "invalid_artifact_timestamp",
      filePath: null,
      runtimeMutation: false,
      supabaseWriteExecuted: false
    };
  }

  const fileName = `${safeTimestamp}-${normalizeSuffix(safeSuffix)}.json`;
  const absoluteFilePath = path.join(resolvedOutputDir, fileName);
  const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).replace(/\\/g, "/");

  try {
    await fileSystem.mkdir(resolvedOutputDir, { recursive: true });
    await fileSystem.writeFile(
      absoluteFilePath,
      `${JSON.stringify(sanitization.artifact, null, 2)}\n`,
      "utf8"
    );

    return {
      attempted: true,
      written: true,
      skipped: false,
      skipReason: null,
      filePath: relativeFilePath,
      runtimeMutation: false,
      supabaseWriteExecuted: false
    };
  } catch {
    return {
      attempted: true,
      written: false,
      skipped: false,
      skipReason: "artifact_write_failed_non_blocking",
      filePath: null,
      runtimeMutation: false,
      supabaseWriteExecuted: false
    };
  }
}

export async function writeLocalShadowRecommendationEvidence({
  recommendationResult,
  envLike = process.env,
  fileSystem = { mkdir, writeFile }
} = {}) {
  if (!isLocalRecommendationEvidenceEnabled(envLike)) {
    return { attempted: false, written: false, skipped: true, skipReason: "local_recommendation_evidence_disabled" };
  }

  const target = resolveLocalRecommendationEvidenceDirectory(envLike);
  if (!target || !RECOMMENDATION_CONDITIONS.has(target.condition)) {
    return { attempted: false, written: false, skipped: true, skipReason: "local_recommendation_evidence_context_invalid" };
  }

  const evidence = {
    evidenceType: "local_shadow_recommendation_snapshot",
    schemaVersion: RECOMMENDATION_EVIDENCE_VERSION,
    comparisonRunId: target.comparisonRunId,
    condition: target.condition,
    ...recommendationIdEvidence(recommendationResult),
    forbiddenFieldDetected: false
  };
  const validation = validateLocalShadowRecommendationEvidence(evidence, target);
  if (!validation.valid) {
    return { attempted: false, written: false, skipped: true, skipReason: "local_recommendation_evidence_validation_failed" };
  }

  const filePath = path.join(target.directory, `recommendation-flag-${target.condition}.json`);
  try {
    await fileSystem.mkdir(target.directory, { recursive: true });
    await fileSystem.writeFile(filePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return {
      attempted: true,
      written: true,
      skipped: false,
      skipReason: null,
      filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/")
    };
  } catch {
    return { attempted: true, written: false, skipped: false, skipReason: "local_recommendation_evidence_write_failed" };
  }
}

export async function writeLocalShadowPolicyEvidence({
  artifact,
  policyShadow,
  envLike = process.env,
  fileSystem = { mkdir, writeFile }
} = {}) {
  if (!isLocalPolicyEvidenceEnabled(envLike)) {
    return { attempted: false, written: false, skipped: true, skipReason: "local_policy_evidence_disabled" };
  }

  const target = resolveLocalRecommendationEvidenceDirectory(envLike);
  const sanitized = sanitizeShadowBoundaryDryRunArtifactForWrite(artifact);
  if (!target || !sanitized.valid) {
    return { attempted: false, written: false, skipped: true, skipReason: "local_policy_evidence_context_or_artifact_invalid" };
  }

  const evidence = {
    evidenceType: "local_shadow_boundary_policy_execution",
    schemaVersion: POLICY_EVIDENCE_VERSION,
    comparisonRunId: target.comparisonRunId,
    condition: "on",
    runtimeConnected: false,
    candidateCount: Number(policyShadow?.candidateCount || 0),
    boundaryHintCount: Array.isArray(policyShadow?.boundaryHints) ? policyShadow.boundaryHints.length : 0,
    receiverCount: Array.isArray(policyShadow?.receivers) ? policyShadow.receivers.length : 0,
    violationCounts: policyShadow?.violationCounts || {},
    artifact: sanitized.artifact
  };
  if (!validateLocalShadowPolicyEvidence(evidence, { comparisonRunId: target.comparisonRunId }).valid) {
    return { attempted: false, written: false, skipped: true, skipReason: "local_policy_evidence_validation_failed" };
  }

  const directory = path.join(target.directory, "policy");
  const filePath = path.join(directory, "policy-flag-on.json");
  try {
    await fileSystem.mkdir(directory, { recursive: true });
    await fileSystem.writeFile(filePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { attempted: true, written: true, skipped: false, skipReason: null, filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/") };
  } catch {
    return { attempted: true, written: false, skipped: false, skipReason: "local_policy_evidence_write_failed" };
  }
}
