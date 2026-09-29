import assert from "node:assert/strict";
import fs from "node:fs";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_MODEL_POLICY_VERSION,
  OPENAI_RUNTIME_MODELS,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "../lib/ai-model-policy.js";

const RUNTIME_MODEL_OWNERS = Object.freeze([
  "app/api/analyze/route.js",
  "app/api/face-reading/route.js",
  "lib/server/vision-observation-service.js",
  "lib/server/product-query-intent-service.js",
  "lib/security/error-redaction.js",
  "lib/product-query-operational-observability.mjs",
  "lib/product-query-beta-operational-readiness-contract.mjs",
  "scripts/run-ai-provider-live-smoke.mjs"
]);

const FORBIDDEN_GENERAL_MODEL_PATTERN =
  /\b(?:gpt-4o(?:-mini)?|gpt-4\.1(?:-mini|-nano)?|gpt-5(?:\.[0-9]+)?(?:-(?:mini|nano|sol|terra|luna))?|o[134](?:-[a-z0-9.-]+)?|gemini-[0-9][a-z0-9._-]*|claude-[0-9][a-z0-9._-]*)\b/gi;

const violations = [];

for (const file of RUNTIME_MODEL_OWNERS) {
  const source = fs.readFileSync(file, "utf8");
  const matches = [...source.matchAll(FORBIDDEN_GENERAL_MODEL_PATTERN)]
    .map((match) => match[0])
    .filter((token) => token !== OPENAI_RUNTIME_MODEL);

  for (const token of matches) {
    violations.push({ file, token });
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
  violations,
  [],
  "non-Luna runtime model settings remain:\n" +
    violations.map((item) => `${item.file}: ${item.token}`).join("\n")
);

assert.equal(
  productQuerySource.includes("PRODUCT_QUERY_INTENT_MODEL"),
  false,
  "Product Query must not bypass the Luna-only policy through an env model override"
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
    analyzeSource.includes("reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT")
);
assert.ok(
  visionSource.includes("OPENAI_RUNTIME_REASONING_EFFORT") &&
    visionSource.includes("reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT")
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
  runtimeModelOwnerCount: RUNTIME_MODEL_OWNERS.length
}, null, 2));
