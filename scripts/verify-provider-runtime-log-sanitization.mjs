import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildProviderRuntimeLogEvent,
  logProviderRuntimeEvent
} from "../lib/provider-runtime-log.js";
import { SAFE_PROVIDER_MODELS } from "../lib/security/error-redaction.js";

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
assert.deepEqual([...SAFE_PROVIDER_MODELS].sort(), ["gpt-4o", "gpt-4o-mini"]);

for (const model of [
  "unknown-model",
  "sk-SEC12_FAKE_MODEL_SECRET",
  "sk-proj-SEC12_FAKE_MODEL_SECRET",
  "eyJhbGciOiJIUzI1NiJ9.SEC12_FAKE_PAYLOAD.SEC12_FAKE_SIGNATURE",
  "Bearer SEC12_FAKE_TOKEN"
]) {
  const descriptor = buildProviderRuntimeLogEvent({
    stage: "photo-evidence",
    status: 503,
    ok: false,
    provider: "openai",
    model,
    durationMs: 3
  });
  assert.equal(descriptor.model, "unknown");

  const modelCapture = [];
  logProviderRuntimeEvent({ ok: false, provider: "openai", model }, {
    warn(label, payload) {
      modelCapture.push({ label, payload });
    }
  });
  assert.equal(JSON.stringify(modelCapture).includes(model), false);
  assert.equal(Object.hasOwn(modelCapture[0].payload, "model"), false);
}

const captured = [];
const hostileEvent = Object.defineProperties({}, {
  stage: { get: () => "provider\r\nAuthorization: Bearer secret-token" },
  status: { get: () => 503 },
  ok: { get: () => false },
  provider: { get: () => "openai" },
  model: { get: () => "gpt-4o-mini" },
  durationMs: { get: () => 8 },
  prompt: { get: () => "private prompt text" },
  responseBody: { get: () => "private provider response" },
  token: { get: () => "access-token-value" }
});

assert.doesNotThrow(() => logProviderRuntimeEvent(hostileEvent, {
  warn(label, payload) {
    captured.push({ label, payload });
  }
}));
assert.equal(captured.length, 1);
assert.equal(captured[0].label, "[security-event]");
assert.deepEqual(Object.keys(captured[0].payload).sort(), [
  "category",
  "dependency",
  "durationMs",
  "event",
  "model",
  "ok",
  "operation",
  "provider",
  "severity",
  "status"
].sort());
assert.doesNotMatch(JSON.stringify(captured), /secret-token|private prompt|provider response|access-token/i);
assert.equal(buildProviderRuntimeLogEvent(hostileEvent).stage, "provider_request");
assert.doesNotThrow(() => logProviderRuntimeEvent({ ok: false }, {
  get warn() {
    throw new Error("sink failure");
  }
}));

for (const routePath of routePaths) {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /logProviderRuntimeEvent\(/, `${routePath.pathname} must use the provider log allowlist.`);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)\(/, `${routePath.pathname} must not use raw console logging.`);
  assert.doesNotMatch(
    source,
    /logAnalyze\(\s*["'][^"']+["']\s*,/,
    `${routePath.pathname} must not pass raw payloads to logAnalyze.`
  );
  assert.doesNotMatch(source, /\bpreview\s*:/i, `${routePath.pathname} must not log provider previews.`);
  assert.doesNotMatch(source, /\bcontentPreview\s*:/i, `${routePath.pathname} must not log provider content previews.`);

  const providerLogCalls = source.match(/logProviderRuntimeEvent\(\{[\s\S]*?\n\s*\}\);/g) || [];
  assert.ok(providerLogCalls.length > 0, `${routePath.pathname} must expose provider log call descriptors.`);
  for (const field of forbiddenLogFields) {
    const fieldPattern = new RegExp(`\\b${field}\\s*:`, "i");
    for (const call of providerLogCalls) {
      assert.doesNotMatch(call, fieldPattern, `${routePath.pathname} must not pass ${field} to provider logs.`);
    }
  }
}

console.log("verify-provider-runtime-log-sanitization passed");
