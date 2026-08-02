import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  CANDIDATE_IMPORT_REQUEST_SCHEMA_VERSION
} from "@bejewely/face-contracts";
import {
  SKIN_CONTROL_FIXTURES,
  compileGenerationPrompt
} from "../../src/index.js";

export async function createTestImportEnvironment({ fixtureKey = "A", providerGenerationId = null } = {}) {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "bejewely-t3-"));
  const inboxRoot = path.join(dataRoot, "inbox");
  const requestRoot = path.join(dataRoot, "requests");
  await Promise.all([mkdir(inboxRoot, { recursive: true }), mkdir(requestRoot, { recursive: true })]);

  const compiled = compileGenerationPrompt({
    draftSpec: SKIN_CONTROL_FIXTURES[fixtureKey].spec,
    providerProfileId: "gemini-image-manual-v1"
  });
  if (!compiled.ok) {
    throw new Error(JSON.stringify(compiled.errors));
  }

  const imageName = "candidate.png";
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 128, g: 96, b: 64 }
    }
  }).png().toFile(path.join(inboxRoot, imageName));

  const finalizedSpecName = "finalized-spec.json";
  const compiledPromptName = "compiled-prompt.json";
  await writeFile(
    path.join(requestRoot, finalizedSpecName),
    `${JSON.stringify(compiled.canonicalSpec.finalizedSpec, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(requestRoot, compiledPromptName),
    `${JSON.stringify(compiled.compiledPrompt, null, 2)}\n`,
    "utf8"
  );

  const request = {
    schemaVersion: CANDIDATE_IMPORT_REQUEST_SCHEMA_VERSION,
    source: {
      inboxRelativePath: imageName,
      originalDownloadName: imageName
    },
    generationArtifact: {
      finalizedSpecPath: finalizedSpecName,
      compiledPromptPath: compiledPromptName,
      expectedSpecDigest: compiled.canonicalSpec.specDigest,
      expectedPromptDigest: compiled.compiledPrompt.promptDigest
    },
    providerRun: {
      providerProfileId: "gemini-image-manual-v1",
      providerProfileVersion: "1.0.0",
      executionMode: "manual_web",
      providerModelLabel: null,
      providerModelVersion: null,
      providerGenerationId,
      generatedAt: null,
      downloadedAt: "2026-08-02T00:00:00.000Z",
      exactReproductionAvailable: false
    },
    grouping: {
      campaignId: SKIN_CONTROL_FIXTURES[fixtureKey].spec.provenance.campaignId,
      campaignSeriesId: "series-001",
      conditionId: fixtureKey,
      lineage: {
        kind: "independent",
        parentCandidateId: null
      }
    },
    operatorAttestation: {
      syntheticOnly: true,
      realPersonReferenceUsed: false,
      termsAndRightsReviewed: true,
      downloadedBy: "human_operator"
    },
    operatorHints: {
      visibleExternalMark: {
        status: "unknown",
        location: null,
        provenanceStatus: "unverified"
      },
      notes: null
    }
  };

  return {
    dataRoot,
    inboxRoot,
    requestRoot,
    imagePath: path.join(inboxRoot, imageName),
    finalizedSpecPath: path.join(requestRoot, finalizedSpecName),
    compiledPromptPath: path.join(requestRoot, compiledPromptName),
    compiled,
    request
  };
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
