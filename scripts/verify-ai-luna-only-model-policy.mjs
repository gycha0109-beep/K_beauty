import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_MODEL_POLICY_VERSION,
  OPENAI_RUNTIME_MODELS,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "../lib/ai-model-policy.js";

const ROOTS = [
  ".github",
  "app",
  "apps",
  "components",
  "crawler",
  "lib",
  "packages",
  "scripts",
  "supabase",
  "test",
  "tests",
  "tools"
];

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml"
]);

const NON_MODEL_PROFILE_IDS = new Set([
  "gpt-image-manual-v1",
  "gemini-image-manual-v1"
]);

const MODEL_TOKEN_PATTERN =
  /\b(?:gpt|o[134]|gemini|claude)[a-z0-9._-]*\b/gi;

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];
const scanned = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, "utf8");
    scanned.push(file);

    const tokens = [...source.matchAll(MODEL_TOKEN_PATTERN)]
      .map((match) => match[0])
      .filter(Boolean);

    for (const token of tokens) {
      if (
        token === OPENAI_RUNTIME_MODEL ||
        NON_MODEL_PROFILE_IDS.has(token)
      ) {
        continue;
      }

      violations.push({
        file,
        token
      });
    }

    for (const bypass of [
      "PRODUCT_QUERY_INTENT_MODEL",
      "AI_PROVIDER_SMOKE_MODEL"
    ]) {
      if (source.includes(bypass)) {
        violations.push({
          file,
          token: bypass
        });
      }
    }
  }
}

assert.equal(
  OPENAI_RUNTIME_MODEL_POLICY_VERSION,
  "openai-runtime-model-policy-v1"
);
assert.equal(OPENAI_RUNTIME_MODEL, "gpt-5.6-luna");
assert.equal(OPENAI_RUNTIME_REASONING_EFFORT, "none");
assert.deepEqual([...OPENAI_RUNTIME_MODELS], ["gpt-5.6-luna"]);
assert.ok(scanned.length > 0);
assert.deepEqual(
  violations,
  [],
  "non-Luna AI model settings remain:\n" +
    violations
      .map((item) => `${item.file}: ${item.token}`)
      .join("\n")
);

console.log(JSON.stringify({
  ok: true,
  policyVersion: OPENAI_RUNTIME_MODEL_POLICY_VERSION,
  model: OPENAI_RUNTIME_MODEL,
  reasoningEffort: OPENAI_RUNTIME_REASONING_EFFORT,
  scannedFileCount: scanned.length,
  allowedNonModelProfileIds: [...NON_MODEL_PROFILE_IDS]
}, null, 2));
