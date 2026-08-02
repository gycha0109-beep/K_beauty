import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  IMPORT_REPORT_SCHEMA_VERSION,
  createCandidateImportError,
  createCandidateImportWarning,
  validateCandidateImportRequest
} from "@bejewely/face-contracts";
import { stableStringify } from "../generation/canonicalize-generation-spec.js";
import { buildAssetManifest, buildCandidateIdentity, buildCandidateManifest } from "./build-candidate.js";
import { commitImportTransaction } from "./commit-import-transaction.js";
import {
  canonicalizeImageBuffer,
  fingerprintCanonicalBuffer,
  inspectImageBuffer
} from "./image-processing.js";
import { readAndVerifyGenerationArtifacts } from "./read-generation-artifacts.js";
import { findDuplicateReferences, readCandidateRegistry } from "./read-candidate-registry.js";
import { resolveSafeContainedFile } from "./resolve-safe-path.js";
import {
  assetRecordRelativePath,
  candidateManifestRelativePath,
  canonicalObjectRelativePath,
  promptObjectRelativePath,
  rawObjectRelativePath,
  specObjectRelativePath
} from "./storage-layout.js";

function report({ ok, mode, outcome = null, candidateId = null, assetId = null, errors = [], warnings = [], duplicateSummary = null, writesPerformed = 0 }) {
  return Object.freeze({
    schemaVersion: IMPORT_REPORT_SCHEMA_VERSION,
    ok,
    mode,
    outcome,
    proposedCandidateId: candidateId,
    assetId,
    validationErrors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    duplicateSummary,
    writesPerformed
  });
}

function collectWarnings(request, duplicates) {
  const warnings = [];
  if (request.providerRun.providerModelLabel === null) {
    warnings.push(createCandidateImportWarning("provider_model_unknown"));
  }
  if (request.providerRun.providerGenerationId === null) {
    warnings.push(createCandidateImportWarning("provider_generation_id_unknown"));
  }
  if (request.providerRun.generatedAt === null) {
    warnings.push(createCandidateImportWarning("generated_at_unknown"));
  }
  const mark = request.operatorHints.visibleExternalMark;
  if (mark.status === "present") {
    warnings.push(createCandidateImportWarning("external_mark_present", mark));
  } else if (mark.status === "unknown") {
    warnings.push(createCandidateImportWarning("external_mark_unknown", mark));
  }
  if (duplicates.exactCanonicalDuplicateOf.length) {
    warnings.push(createCandidateImportWarning("canonical_duplicate_found", duplicates.exactCanonicalDuplicateOf));
  }
  if (duplicates.nearestPerceptualCandidates.length) {
    warnings.push(createCandidateImportWarning("perceptual_neighbors_found", duplicates.nearestPerceptualCandidates));
  }
  return warnings;
}

function validateGenerationGrouping(request, finalizedSpec) {
  const errors = [];
  if (request.grouping.campaignId !== finalizedSpec.provenance.campaignId) {
    errors.push(createCandidateImportError("invalid_grouping_contract", "grouping.campaignId", "campaign_mismatch"));
  }
  const expectedKind = finalizedSpec.variation.pairingMode === "reference_edit" ? "reference_edit" : "independent";
  if (request.grouping.lineage.kind !== expectedKind) {
    errors.push(createCandidateImportError("invalid_grouping_contract", "grouping.lineage.kind", "variation_mismatch"));
  }
  return errors;
}

function sameStableValue(left, right) {
  return stableStringify(left) === stableStringify(right);
}

export async function importCandidate({
  request,
  mode,
  dataRoot,
  inboxRoot = path.join(dataRoot, "inbox"),
  generationArtifactRoot = path.join(dataRoot, "requests"),
  now = () => new Date().toISOString()
}) {
  if (!new Set(["dry_run", "confirm"]).has(mode)) {
    return report({
      ok: false,
      mode,
      errors: [createCandidateImportError("invalid_request_schema", "mode")]
    });
  }

  const validation = validateCandidateImportRequest(request);
  if (!validation.ok) {
    return report({ ok: false, mode, errors: validation.errors });
  }

  const [sourcePath, specPath, promptPath] = await Promise.all([
    resolveSafeContainedFile(inboxRoot, request.source.inboxRelativePath, "source.inboxRelativePath"),
    resolveSafeContainedFile(generationArtifactRoot, request.generationArtifact.finalizedSpecPath, "generationArtifact.finalizedSpecPath"),
    resolveSafeContainedFile(generationArtifactRoot, request.generationArtifact.compiledPromptPath, "generationArtifact.compiledPromptPath")
  ]);
  const pathErrors = [sourcePath, specPath, promptPath].flatMap((item) => item.errors || []);
  if (pathErrors.length) {
    return report({ ok: false, mode, errors: pathErrors });
  }

  const artifacts = await readAndVerifyGenerationArtifacts({
    finalizedSpecAbsolutePath: specPath.absolutePath,
    compiledPromptAbsolutePath: promptPath.absolutePath,
    expectedSpecDigest: request.generationArtifact.expectedSpecDigest,
    expectedPromptDigest: request.generationArtifact.expectedPromptDigest,
    providerRun: request.providerRun
  });
  if (!artifacts.ok) {
    return report({ ok: false, mode, errors: artifacts.errors });
  }

  const groupingErrors = validateGenerationGrouping(request, artifacts.finalizedSpec);
  if (groupingErrors.length) {
    return report({ ok: false, mode, errors: groupingErrors });
  }

  let rawBuffer;
  try {
    rawBuffer = await readFile(sourcePath.absolutePath);
  } catch (error) {
    return report({
      ok: false,
      mode,
      errors: [createCandidateImportError("source_not_found", "source.inboxRelativePath", error?.code || null)]
    });
  }

  const inspected = await inspectImageBuffer(rawBuffer, request.source.originalDownloadName);
  if (!inspected.ok) {
    return report({ ok: false, mode, errors: inspected.errors });
  }
  const canonicalized = await canonicalizeImageBuffer(rawBuffer);
  if (!canonicalized.ok) {
    return report({ ok: false, mode, errors: canonicalized.errors });
  }
  const fingerprint = await fingerprintCanonicalBuffer(canonicalized.canonical.buffer);
  const candidateIdentity = buildCandidateIdentity({
    request,
    inspection: inspected.inspection,
    compiledPrompt: artifacts.compiledPrompt
  });

  let registry;
  try {
    registry = await readCandidateRegistry(dataRoot);
  } catch (error) {
    return report({
      ok: false,
      mode,
      errors: [createCandidateImportError("atomic_commit_failed", "candidates", error?.message || null)]
    });
  }

  const existingCandidate = registry.find((item) => item.candidateId === candidateIdentity.candidateId) || null;
  const duplicates = existingCandidate?.duplicateReferences || findDuplicateReferences(
    registry,
    canonicalized.canonical.canonicalSha256,
    fingerprint.value,
    candidateIdentity.candidateId
  );
  const paths = Object.freeze({
    raw: rawObjectRelativePath(inspected.inspection.rawSha256, inspected.inspection.detectedFormat),
    canonical: canonicalObjectRelativePath(canonicalized.canonical.canonicalSha256),
    spec: specObjectRelativePath(request.generationArtifact.expectedSpecDigest),
    prompt: promptObjectRelativePath(request.generationArtifact.expectedPromptDigest),
    assetRecord: assetRecordRelativePath(inspected.inspection.assetId),
    candidateManifest: candidateManifestRelativePath(candidateIdentity.candidateId)
  });
  const registeredAt = existingCandidate?.registeredAt || now();
  const assetManifest = buildAssetManifest({
    inspection: inspected.inspection,
    canonical: canonicalized.canonical,
    fingerprint,
    paths,
    registeredAt
  });
  const candidateManifest = buildCandidateManifest({
    candidateIdentity,
    request,
    inspection: inspected.inspection,
    canonical: canonicalized.canonical,
    fingerprint,
    paths,
    duplicates,
    registeredAt
  });

  if (existingCandidate) {
    const expectedComparable = { ...candidateManifest, registeredAt: existingCandidate.registeredAt };
    if (!sameStableValue(existingCandidate, expectedComparable)) {
      return report({
        ok: false,
        mode,
        candidateId: candidateIdentity.candidateId,
        assetId: inspected.inspection.assetId,
        errors: [createCandidateImportError("candidate_identity_conflict", "candidateId")]
      });
    }
  }

  const warnings = collectWarnings(request, duplicates);
  const duplicateSummary = Object.freeze({
    exactCanonicalDuplicateOf: duplicates.exactCanonicalDuplicateOf,
    nearestPerceptualCandidates: duplicates.nearestPerceptualCandidates
  });

  if (mode === "dry_run") {
    return report({
      ok: true,
      mode,
      outcome: existingCandidate ? "existing_candidate" : "proposed_candidate",
      candidateId: candidateIdentity.candidateId,
      assetId: inspected.inspection.assetId,
      warnings,
      duplicateSummary,
      writesPerformed: 0
    });
  }

  const committed = await commitImportTransaction({
    dataRoot,
    paths,
    rawBuffer,
    canonicalBuffer: canonicalized.canonical.buffer,
    specEnvelope: artifacts.specEnvelope,
    promptEnvelope: artifacts.promptEnvelope,
    assetManifest,
    candidateManifest
  });
  if (!committed.ok) {
    return report({
      ok: false,
      mode,
      candidateId: candidateIdentity.candidateId,
      assetId: inspected.inspection.assetId,
      errors: committed.errors,
      warnings,
      duplicateSummary,
      writesPerformed: committed.writesPerformed
    });
  }
  return report({
    ok: true,
    mode,
    outcome: committed.outcome,
    candidateId: candidateIdentity.candidateId,
    assetId: inspected.inspection.assetId,
    warnings,
    duplicateSummary,
    writesPerformed: committed.writesPerformed
  });
}
