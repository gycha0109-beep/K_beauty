import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildProviderRuntimeLogEvent } from "../lib/provider-runtime-log.js";

const routePaths = [
  new URL("../app/api/analyze/route.js", import.meta.url),
  new URL("../app/api/face-reading/route.js", import.meta.url)
];
const forbiddenLogFields = ["preview", "contentPreview", "rawText", "rawContent", "responseBody", "prompt", "imageDataUrl", "token", "apiKey"];

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
  assert.match(source, /logProviderRuntimeEvent\(/, `${routePath.pathname} must use the provider log allowlist.`);
  assert.doesNotMatch(source, /\bpreview\s*:/i, `${routePath.pathname} must not log provider previews.`);
  assert.doesNotMatch(source, /\bcontentPreview\s*:/i, `${routePath.pathname} must not log provider content previews.`);
  for (const field of forbiddenLogFields) {
    const directLogPattern = new RegExp(`(?:logAnalyze|console\\.(?:log|info|warn|error))\\([\\s\\S]{0,220}\\b${field}\\b`, "i");
    assert.doesNotMatch(source, directLogPattern, `${routePath.pathname} must not directly log ${field}.`);
  }
}

console.log("verify-provider-runtime-log-sanitization passed");
