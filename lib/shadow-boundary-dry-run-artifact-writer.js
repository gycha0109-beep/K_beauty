import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateShadowRuntimeDryRunArtifact } from "./shadow-runtime-dry-run-artifact-schema.js";

export const SHADOW_BOUNDARY_DRY_RUN_ARTIFACT_WRITER_VERSION = "2026-07-10.phase39";

const OUTPUT_SUBDIRECTORY = ["tmp", "shadow-boundary-dry-run"];

function isWriterEnabled(envLike = {}) {
  return (
    envLike?.NODE_ENV === "development" &&
    envLike?.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1"
  );
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
