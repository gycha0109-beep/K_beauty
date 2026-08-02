import { readFile } from "node:fs/promises";
import {
  candidateManifestRelativePath,
  promptObjectRelativePath,
  specObjectRelativePath
} from "../import/storage-layout.js";
import { resolveSafeContainedFile } from "../import/resolve-safe-path.js";
import { resolveCandidateIntent } from "./intent-resolver.js";

function parseJson(text, code, path) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, errors: Object.freeze([{ code, path, detail: "invalid_json" }]) };
  }
}

export async function readAndResolveCandidateIntent({ dataRoot, candidateId }) {
  const manifestRelativePath = candidateManifestRelativePath(candidateId);
  const manifestFile = await resolveSafeContainedFile(dataRoot, manifestRelativePath, "candidateManifest");
  if (!manifestFile.ok) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "candidate_manifest_integrity_invalid", path: "candidateManifest", detail: null }]) });
  }
  let manifestText;
  try {
    manifestText = await readFile(manifestFile.absolutePath, "utf8");
  } catch {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "candidate_manifest_integrity_invalid", path: "candidateManifest", detail: null }]) });
  }
  const manifestParsed = parseJson(manifestText, "candidate_manifest_integrity_invalid", "candidateManifest");
  if (!manifestParsed.ok) return manifestParsed;
  const manifest = manifestParsed.value;
  const specDigest = manifest.generation?.specDigest;
  const promptDigest = manifest.generation?.promptDigest;
  const expectedSpecPath = typeof specDigest === "string" ? specObjectRelativePath(specDigest) : null;
  const expectedPromptPath = typeof promptDigest === "string" ? promptObjectRelativePath(promptDigest) : null;
  if (
    !expectedSpecPath ||
    !expectedPromptPath ||
    manifest.candidateId !== candidateId ||
    manifest.generation?.artifactReferences?.spec?.objectRelativePath !== expectedSpecPath ||
    manifest.generation?.artifactReferences?.compiledPrompt?.objectRelativePath !== expectedPromptPath
  ) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "candidate_manifest_integrity_invalid", path: "generation.artifactReferences", detail: null }]) });
  }
  const [specFile, promptFile] = await Promise.all([
    resolveSafeContainedFile(dataRoot, expectedSpecPath, "generation.spec"),
    resolveSafeContainedFile(dataRoot, expectedPromptPath, "generation.prompt")
  ]);
  if (!specFile.ok || !promptFile.ok) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "generation_spec_integrity_invalid", path: "generation", detail: null }]) });
  }
  let specText;
  let promptText;
  try {
    [specText, promptText] = await Promise.all([
      readFile(specFile.absolutePath, "utf8"),
      readFile(promptFile.absolutePath, "utf8")
    ]);
  } catch {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "generation_spec_integrity_invalid", path: "generation", detail: null }]) });
  }
  const specParsed = parseJson(specText, "generation_spec_integrity_invalid", "generation.spec");
  const promptParsed = parseJson(promptText, "generation_spec_integrity_invalid", "generation.prompt");
  if (!specParsed.ok || !promptParsed.ok) return Object.freeze({ ok: false, errors: Object.freeze([...(specParsed.errors || []), ...(promptParsed.errors || [])]) });
  const finalizedSpec = specParsed.value?.finalizedSpec || specParsed.value;
  const compiledPrompt = promptParsed.value?.compiledPrompt || promptParsed.value;
  const resolved = resolveCandidateIntent({ candidateManifest: manifest, finalizedSpec, compiledPrompt });
  if (!resolved.ok) return resolved;
  return Object.freeze({ ok: true, candidateManifest: manifest, finalizedSpec, compiledPrompt, intent: resolved.intent });
}
