import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_MODEL_POLICY_VERSION,
  OPENAI_RUNTIME_MODELS,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "../lib/ai-model-policy.js";

const SELF_PATH = "scripts/verify-ai-luna-only-model-policy.mjs";

const SCANNED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".toml"
]);

const NON_RUNTIME_PROVIDER_PROFILE_IDS = new Set([
  "gpt-image-manual-v1",
  "gemini-image-manual-v1"
]);

const GENERAL_MODEL_PATTERN =
  /\b(?:gpt-(?:4o(?:-mini)?|4\.1(?:-[a-z0-9.-]+)?|5(?:\.[0-9]+)?(?:-[a-z0-9.-]+)?)|o[134]-[a-z0-9.-]+|gemini-[a-z0-9._-]+|claude-[a-z0-9._-]+)\b/gi;

const FORBIDDEN_MODEL_OVERRIDE_TOKENS = Object.freeze([
  "PRODUCT_QUERY_INTENT_MODEL",
  "AI_PROVIDER_SMOKE_MODEL"
]);

const TEST_SENTINEL_EXEMPTIONS = Object.freeze({
  "scripts/verify-sec12-error-log-boundary.mjs": new Set([
    "GPT-5.6-LUNA",
    "gpt-5.6-luna-custom"
  ])
});

function isScannableFile(file) {
  if (file === SELF_PATH) return false;
  if (file.startsWith("docs/")) return false;
  if (file.startsWith("fixtures/")) return false;

  const base = path.basename(file);
  if (base.startsWith(".env")) return true;
  if (base === "Dockerfile" || base.startsWith("Dockerfile.")) return true;

  return SCANNED_EXTENSIONS.has(path.extname(file).toLowerCase());
}

const trackedFiles = execFileSync(
  "git",
  ["ls-files"],
  { encoding: "utf8" }
)
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter(isScannableFile);

const modelViolations = [];
const overrideViolations = [];

for (const file of trackedFiles) {
  const source = fs.readFileSync(file, "utf8");

  for (const match of source.matchAll(GENERAL_MODEL_PATTERN)) {
    const token = match[0];

    if (
      token === OPENAI_RUNTIME_MODEL ||
      NON_RUNTIME_PROVIDER_PROFILE_IDS.has(token) ||
      TEST_SENTINEL_EXEMPTIONS[file]?.has(token)
    ) {
      continue;
    }

    modelViolations.push({ file, token });
  }

  for (const token of FORBIDDEN_MODEL_OVERRIDE_TOKENS) {
    if (source.includes(token)) {
      overrideViolations.push({ file, token });
    }
  }
}

const productQuerySource = fs.readFileSync(
  "lib/server/product-query-intent-service.js",
  "utf8"
);
const smokeSource = fs.readFileSync(
  "scripts/run-ai-provider-live-smoke.mjs",
  "utf8"
);
const analyzeSource = fs.readFileSync(
  "app/api/analyze/route.js",
  "utf8"
);
const visionSource = fs.readFileSync(
  "lib/server/vision-observation-service.js",
  "utf8"
);

assert.equal(
  OPENAI_RUNTIME_MODEL_POLICY_VERSION,
  "openai-runtime-model-policy-v1"
);
assert.equal(OPENAI_RUNTIME_MODEL, "gpt-5.6-luna");
assert.equal(OPENAI_RUNTIME_REASONING_EFFORT, "none");
assert.deepEqual([...OPENAI_RUNTIME_MODELS], ["gpt-5.6-luna"]);

assert.deepEqual(
  modelViolations,
  [],
  "non-Luna general LLM model tokens remain in tracked executable/config sources:\n" +
    modelViolations
      .map((item) => `${item.file}: ${item.token}`)
      .join("\n")
);

assert.deepEqual(
  overrideViolations,
  [],
  "runtime model override paths remain:\n" +
    overrideViolations
      .map((item) => `${item.file}: ${item.token}`)
      .join("\n")
);

assert.equal(
  productQuerySource.includes("options.model ||"),
  false,
  "Product Query must not bypass the Luna-only policy through a caller model override"
);
assert.equal(
  smokeSource.includes("AI_PROVIDER_SMOKE_MODEL"),
  false,
  "live smoke must exercise the same Luna model as Production"
);
assert.ok(
  analyzeSource.includes("OPENAI_RUNTIME_REASONING_EFFORT") &&
    analyzeSource.includes(
      "reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT"
    )
);
assert.ok(
  visionSource.includes("OPENAI_RUNTIME_REASONING_EFFORT") &&
    visionSource.includes(
      "reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT"
    )
);
assert.ok(
  productQuerySource.includes("OPENAI_RUNTIME_REASONING_EFFORT") &&
    productQuerySource.includes("effort: OPENAI_RUNTIME_REASONING_EFFORT")
);

console.log(JSON.stringify({
  ok: true,
  policyVersion: OPENAI_RUNTIME_MODEL_POLICY_VERSION,
  model: OPENAI_RUNTIME_MODEL,
  reasoningEffort: OPENAI_RUNTIME_REASONING_EFFORT,
  scannedTrackedSourceCount: trackedFiles.length,
  allowedNonRuntimeProviderProfileIds: [
    ...NON_RUNTIME_PROVIDER_PROFILE_IDS
  ],
  testSentinelExemptionFiles: Object.keys(TEST_SENTINEL_EXEMPTIONS)
}, null, 2));
