import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SKIN_CONTROL_FIXTURES,
  compileGenerationPrompt,
  createPairedSkinEditDraft
} from "../src/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readSnapshot(name) {
  return fs.readFile(path.join(testDirectory, "snapshots", name), "utf8");
}

test("Gemini manual A/B/C/D prompts match frozen snapshots", async () => {
  for (const key of Object.keys(SKIN_CONTROL_FIXTURES)) {
    const result = compileGenerationPrompt({
      draftSpec: SKIN_CONTROL_FIXTURES[key].spec,
      providerProfileId: "gemini-image-manual-v1"
    });
    assert.equal(result.ok, true);
    assert.equal(result.compiledPrompt.content.negativePrompt, null);
    assert.equal(
      `${result.compiledPrompt.content.positivePrompt}\n`,
      await readSnapshot(`gemini-${key}.txt`)
    );
  }
});

test("same semantic input compiles byte-identically", () => {
  const first = compileGenerationPrompt({
    draftSpec: clone(SKIN_CONTROL_FIXTURES.D.spec),
    providerProfileId: "gpt-image-manual-v1"
  });
  const second = compileGenerationPrompt({
    draftSpec: clone(SKIN_CONTROL_FIXTURES.D.spec),
    providerProfileId: "gpt-image-manual-v1"
  });
  assert.deepEqual(first, second);
});

test("subject age and presentation are compiled from the spec", () => {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.subject.adultAgeBand = "40s";
  draft.subject.presentation = "androgynous";
  draft.subject.regionalAppearanceHint = null;
  const result = compileGenerationPrompt({
    draftSpec: draft,
    providerProfileId: "gpt-image-manual-v1"
  });
  assert.equal(result.ok, true);
  assert.match(result.compiledPrompt.content.positivePrompt, /synthetic adult person in their 40s, with androgynous presentation/);
  assert.doesNotMatch(result.compiledPrompt.content.positivePrompt, /Korean appearance hint/);
});

test("SDXL reference profile emits separate exclusions and fixed parameter hints", () => {
  const result = compileGenerationPrompt({
    draftSpec: SKIN_CONTROL_FIXTURES.B.spec,
    providerProfileId: "sdxl-comfyui-reference-v1"
  });
  assert.equal(result.ok, true);
  assert.match(result.compiledPrompt.content.negativePrompt, /beauty filters/);
  assert.equal(result.compiledPrompt.content.parameterHints.steps, 30);
  assert.equal(result.compiledPrompt.content.parameterHints.skinLoraModelStrength, 0.4);
  assert.ok(result.compiledPrompt.content.operatorInstructions.some((item) => item.includes("reference-only")));
});

test("current profiles fail closed for reference edit capability", () => {
  const paired = createPairedSkinEditDraft(
    clone(SKIN_CONTROL_FIXTURES.B.spec.skinIntent),
    "candidate_reference_01"
  );
  for (const providerProfileId of [
    "gemini-image-manual-v1",
    "gpt-image-manual-v1",
    "sdxl-comfyui-reference-v1"
  ]) {
    const result = compileGenerationPrompt({ draftSpec: paired, providerProfileId });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      { code: "reference_capability_required", path: "variation.pairingMode" }
    ]);
  }
});

test("unsupported profiles fail closed and no prompt artifact is returned", () => {
  const result = compileGenerationPrompt({
    draftSpec: SKIN_CONTROL_FIXTURES.A.spec,
    providerProfileId: "unknown-provider"
  });
  assert.deepEqual(result, {
    ok: false,
    errors: [{ code: "unsupported_provider_profile", path: "providerProfileId" }]
  });
});

test("compiled prompts never emit raw animal archetype tokens", () => {
  const result = compileGenerationPrompt({
    draftSpec: SKIN_CONTROL_FIXTURES.D.spec,
    providerProfileId: "gemini-image-manual-v1"
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.compiledPrompt.content.positivePrompt, /\b(?:cat|rabbit|fox|dog|wolf|dinosaur)\b/i);
});

test("finalized and compiled artifacts are deeply immutable", () => {
  const result = compileGenerationPrompt({
    draftSpec: SKIN_CONTROL_FIXTURES.A.spec,
    providerProfileId: "gemini-image-manual-v1"
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.canonicalSpec.finalizedSpec), true);
  assert.equal(Object.isFrozen(result.canonicalSpec.finalizedSpec.skinIntent), true);
  assert.equal(Object.isFrozen(result.compiledPrompt.content), true);
  assert.throws(() => {
    result.compiledPrompt.content.parameterHints.width = 1;
  }, TypeError);
});
