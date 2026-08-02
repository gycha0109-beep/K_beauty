import { readFile } from "node:fs/promises";
import {
  COMPILED_PROMPT_SCHEMA_VERSION,
  createCandidateImportError
} from "@bejewely/face-contracts";
import {
  finalizeGenerationSpec,
  sha256Hex,
  stableStringify
} from "../generation/canonicalize-generation-spec.js";
import { resolveProviderProfile } from "../generation/providers/provider-profiles.js";

function parseJson(text, path) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      errors: [createCandidateImportError("generation_artifact_invalid", path, "invalid_json")]
    };
  }
}

function canonicalEnvelope(value) {
  return `${stableStringify(value)}\n`;
}

export async function readAndVerifyGenerationArtifacts({
  finalizedSpecAbsolutePath,
  compiledPromptAbsolutePath,
  expectedSpecDigest,
  expectedPromptDigest,
  providerRun
}) {
  let specText;
  let promptText;
  try {
    [specText, promptText] = await Promise.all([
      readFile(finalizedSpecAbsolutePath, "utf8"),
      readFile(compiledPromptAbsolutePath, "utf8")
    ]);
  } catch (error) {
    return {
      ok: false,
      errors: [createCandidateImportError("generation_artifact_missing", "generationArtifact", error?.code || null)]
    };
  }

  const parsedSpec = parseJson(specText, "generationArtifact.finalizedSpecPath");
  const parsedPrompt = parseJson(promptText, "generationArtifact.compiledPromptPath");
  if (!parsedSpec.ok || !parsedPrompt.ok) {
    return { ok: false, errors: [...(parsedSpec.errors || []), ...(parsedPrompt.errors || [])] };
  }

  const finalizedSpec = parsedSpec.value?.finalizedSpec || parsedSpec.value;
  if (!finalizedSpec || typeof finalizedSpec !== "object" || Array.isArray(finalizedSpec)) {
    return {
      ok: false,
      errors: [createCandidateImportError("generation_artifact_invalid", "generationArtifact.finalizedSpecPath")]
    };
  }
  const { specId, specDigest, ...draftSpec } = finalizedSpec;
  const rebuiltSpec = finalizeGenerationSpec(draftSpec);
  if (!rebuiltSpec.ok) {
    return {
      ok: false,
      errors: [createCandidateImportError("generation_artifact_invalid", "generationArtifact.finalizedSpecPath", rebuiltSpec.errors)]
    };
  }
  if (specDigest !== expectedSpecDigest || rebuiltSpec.specDigest !== expectedSpecDigest) {
    return {
      ok: false,
      errors: [createCandidateImportError("spec_digest_mismatch", "generationArtifact.expectedSpecDigest")]
    };
  }
  if (specId !== rebuiltSpec.finalizedSpec.specId) {
    return {
      ok: false,
      errors: [createCandidateImportError("generation_artifact_invalid", "generationArtifact.finalizedSpecPath", "spec_id_mismatch")]
    };
  }

  const compiledPrompt = parsedPrompt.value?.compiledPrompt || parsedPrompt.value;
  if (
    !compiledPrompt ||
    typeof compiledPrompt !== "object" ||
    Array.isArray(compiledPrompt) ||
    compiledPrompt.schemaVersion !== COMPILED_PROMPT_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      errors: [createCandidateImportError("generation_artifact_invalid", "generationArtifact.compiledPromptPath")]
    };
  }
  const { promptDigest, ...promptWithoutDigest } = compiledPrompt;
  const rebuiltPromptDigest = sha256Hex(stableStringify(promptWithoutDigest));
  if (promptDigest !== expectedPromptDigest || rebuiltPromptDigest !== expectedPromptDigest) {
    return {
      ok: false,
      errors: [createCandidateImportError("prompt_digest_mismatch", "generationArtifact.expectedPromptDigest")]
    };
  }
  if (
    compiledPrompt.specId !== specId ||
    compiledPrompt.specDigest !== expectedSpecDigest
  ) {
    return {
      ok: false,
      errors: [createCandidateImportError("generation_artifact_invalid", "generationArtifact", "prompt_spec_reference_mismatch")]
    };
  }

  const profile = resolveProviderProfile(compiledPrompt.providerProfile?.id);
  if (!profile) {
    return {
      ok: false,
      errors: [createCandidateImportError("provider_profile_mismatch", "providerRun.providerProfileId")]
    };
  }
  if (
    compiledPrompt.providerProfile.id !== providerRun.providerProfileId ||
    compiledPrompt.providerProfile.version !== providerRun.providerProfileVersion ||
    compiledPrompt.providerProfile.executionMode !== providerRun.executionMode ||
    profile.version !== providerRun.providerProfileVersion
  ) {
    return {
      ok: false,
      errors: [createCandidateImportError("provider_profile_mismatch", "providerRun")]
    };
  }
  if (draftSpec.variation?.pairingMode === "reference_edit" && !profile.capabilities.referenceImage) {
    return {
      ok: false,
      errors: [createCandidateImportError("reference_capability_required", "grouping.lineage.kind")]
    };
  }

  return {
    ok: true,
    finalizedSpec: rebuiltSpec.finalizedSpec,
    compiledPrompt,
    providerProfile: profile,
    specEnvelope: canonicalEnvelope(rebuiltSpec.finalizedSpec),
    promptEnvelope: canonicalEnvelope(compiledPrompt)
  };
}
