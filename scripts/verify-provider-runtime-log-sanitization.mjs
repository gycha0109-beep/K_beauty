import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { maskSecretText } from "../lib/openai-env-diagnostics.js";
import { buildProviderRuntimeLogEvent } from "../lib/provider-runtime-log.js";

const routePaths = [
  new URL("../app/api/analyze/route.js", import.meta.url),
  new URL("../app/api/face-reading/route.js", import.meta.url)
];
const forbiddenLogFields = ["preview", "contentPreview", "rawText", "rawContent", "responseBody", "prompt", "imageDataUrl", "token", "apiKey"];

assert.equal(
  maskSecretText("provider failed for sk-example-secret"),
  "provider failed for [REDACTED_OPENAI_KEY]"
);

const diagnosticsSource = await readFile(new URL("../lib/openai-env-diagnostics.js", import.meta.url), "utf8");
assert.doesNotMatch(diagnosticsSource, /ApiKeyPrefix/, "environment diagnostics must not expose key prefixes.");
assert.doesNotMatch(diagnosticsSource, /token\.slice\(/, "secret masking must not preserve key prefixes.");

const providerServiceSource = await readFile(
  new URL("../lib/server/vision-observation-service.js", import.meta.url),
  "utf8"
);
assert.match(providerServiceSource, /logProviderRuntimeEvent\(/, "Vision provider service must use the provider log allowlist.");

const event = buildProviderRuntimeLogEvent({
  stage: "photo-evidence",
  status: 200,
  ok: true,
  provider: "openai",
  model: "gpt-4o-mini",
  durationMs: 12.8,
  preview: "must-not-be-recorded",
  rawText: "must-not-be-recorded",
  prompt: "must-not-be-recorded"
});

assert.deepEqual(event, {
  stage: "photo-evidence",
  status: 200,
  ok: true,
  provider: "openai",
  model: "gpt-4o-mini",
  durationMs: 13
});

for (const routePath of routePaths) {
  const source = await readFile(routePath, "utf8");
  assert.doesNotMatch(source, /\bpreview\s*:/i, `${routePath.pathname} must not log provider previews.`);
  assert.doesNotMatch(source, /\bcontentPreview\s*:/i, `${routePath.pathname} must not log provider content previews.`);
  for (const field of forbiddenLogFields) {
    const loggedFieldPattern = new RegExp(`(?:logAnalyze|console\\.(?:log|info|warn|error))\\([\\s\\S]{0,220}\\b${field}\\s*:`, "i");
    const directArgumentPattern = new RegExp(`(?:logAnalyze|console\\.(?:log|info|warn|error))\\([^)]*(?:^|,)\\s*${field}\\s*[,)]`, "i");
    assert.doesNotMatch(source, loggedFieldPattern, `${routePath.pathname} must not log a ${field} field.`);
    assert.doesNotMatch(source, directArgumentPattern, `${routePath.pathname} must not log ${field} as an argument.`);
  }
}

console.log("verify-provider-runtime-log-sanitization passed");
