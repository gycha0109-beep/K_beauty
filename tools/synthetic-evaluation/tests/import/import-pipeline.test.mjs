import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createBlindCandidateInput } from "@bejewely/face-contracts";
import { importCandidate } from "../../src/index.js";
import { clone, createTestImportEnvironment } from "./helpers.mjs";

async function pathExists(value) {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}

function importOptions(environment, request, mode, nowValue = "2026-08-02T01:00:00.000Z") {
  return {
    request,
    mode,
    dataRoot: environment.dataRoot,
    inboxRoot: environment.inboxRoot,
    generationArtifactRoot: environment.requestRoot,
    now: () => nowValue
  };
}

async function readManifest(environment, candidateId) {
  return JSON.parse(await readFile(path.join(environment.dataRoot, "candidates", candidateId, "manifest.json"), "utf8"));
}

test("dry-run performs no persistent writes", async () => {
  const environment = await createTestImportEnvironment();
  const result = await importCandidate(importOptions(environment, environment.request, "dry_run"));
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "proposed_candidate");
  assert.equal(result.writesPerformed, 0);
  assert.equal(await pathExists(path.join(environment.dataRoot, "candidates")), false);
  assert.equal(await pathExists(path.join(environment.dataRoot, "objects")), false);
});

test("confirm registers G0 candidate and blind projection hides intent", async () => {
  const environment = await createTestImportEnvironment();
  const result = await importCandidate(importOptions(environment, environment.request, "confirm"));
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "registered_candidate");
  assert.ok(result.writesPerformed >= 6);

  const manifest = await readManifest(environment, result.proposedCandidateId);
  assert.equal(manifest.state, "G0_GENERATED");
  assert.equal(manifest.generation.specDigest, environment.compiled.canonicalSpec.specDigest);
  assert.equal(manifest.operatorHints.visibleExternalMark.provenanceStatus, "unverified");

  const blind = createBlindCandidateInput(manifest);
  assert.deepEqual(Object.keys(blind).sort(), ["candidateId", "canonicalAsset"]);
  assert.equal("conditionId" in blind, false);
  assert.equal("providerRun" in blind, false);
  assert.equal("promptDigest" in blind, false);
});

test("retry is idempotent and preserves original registration time", async () => {
  const environment = await createTestImportEnvironment();
  const first = await importCandidate(importOptions(environment, environment.request, "confirm", "2026-08-02T01:00:00.000Z"));
  const second = await importCandidate(importOptions(environment, environment.request, "confirm", "2026-08-03T01:00:00.000Z"));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.outcome, "existing_candidate");
  assert.equal(second.writesPerformed, 0);
  const manifest = await readManifest(environment, first.proposedCandidateId);
  assert.equal(manifest.registeredAt, "2026-08-02T01:00:00.000Z");
});

test("same image with different generation provenance becomes a new candidate and records duplicate warning", async () => {
  const environment = await createTestImportEnvironment({ providerGenerationId: "generation-001" });
  const first = await importCandidate(importOptions(environment, environment.request, "confirm"));
  assert.equal(first.ok, true);

  const secondRequest = clone(environment.request);
  secondRequest.providerRun.providerGenerationId = "generation-002";
  const second = await importCandidate(importOptions(environment, secondRequest, "confirm", "2026-08-02T02:00:00.000Z"));
  assert.equal(second.ok, true);
  assert.notEqual(second.proposedCandidateId, first.proposedCandidateId);
  assert.ok(second.warnings.some((warning) => warning.code === "canonical_duplicate_found"));
  assert.deepEqual(second.duplicateSummary.exactCanonicalDuplicateOf, [first.proposedCandidateId]);
});

test("tampered prompt artifact fails before candidate registration", async () => {
  const environment = await createTestImportEnvironment();
  const prompt = JSON.parse(await readFile(environment.compiledPromptPath, "utf8"));
  prompt.content.positivePrompt += " tampered";
  await writeFile(environment.compiledPromptPath, `${JSON.stringify(prompt)}\n`, "utf8");

  const result = await importCandidate(importOptions(environment, environment.request, "confirm"));
  assert.equal(result.ok, false);
  assert.ok(result.validationErrors.some((error) => error.code === "prompt_digest_mismatch"));
  assert.equal(await pathExists(path.join(environment.dataRoot, "candidates")), false);
});

test("visible external mark remains a warning and does not block G0 registration", async () => {
  const environment = await createTestImportEnvironment();
  const request = clone(environment.request);
  request.operatorHints.visibleExternalMark = {
    status: "present",
    location: "bottom_right",
    provenanceStatus: "unverified"
  };
  const result = await importCandidate(importOptions(environment, request, "confirm"));
  assert.equal(result.ok, true);
  const warning = result.warnings.find((item) => item.code === "external_mark_present");
  assert.equal(warning.detail.provenanceStatus, "unverified");
});
