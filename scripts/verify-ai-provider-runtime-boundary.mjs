import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  executeOpenAiChatJson,
  OPENAI_CHAT_COMPLETIONS_URL
} from "../lib/server/openai-chat-runtime.js";

const body = {
  model: "gpt-4o-mini",
  max_tokens: 64,
  temperature: 0,
  response_format: { type: "json_object" },
  messages: [{ role: "user", content: "Return JSON only." }]
};

function providerResponse(content, { status = 200, headers = {} } = {}) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 4, completion_tokens: 3 }
    }),
    { status, headers: { "content-type": "application/json", ...headers } }
  );
}

async function expectReject(run, pattern) {
  let error = null;
  try {
    await run();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, "expected provider runtime failure");
  assert.match(String(error.message || error), pattern);
}

const successCalls = [];
const successLogs = [];
const success = await executeOpenAiChatJson({
  apiKey: "sk-test-not-real",
  body,
  stage: "product-explanations",
  fetchImpl: async (url, init) => {
    successCalls.push({ url, init });
    return providerResponse('{"ok":true}');
  },
  logEvent: (event) => successLogs.push(event)
});

assert.deepEqual(success.parsed, { ok: true });
assert.equal(success.status, 200);
assert.equal(successCalls.length, 1, "provider runtime must perform exactly one request");
assert.equal(successCalls[0].url, OPENAI_CHAT_COMPLETIONS_URL);
assert.equal(successCalls[0].init.redirect, "manual");
assert.ok(successCalls[0].init.signal instanceof AbortSignal);
assert.equal(successCalls[0].init.headers.Authorization, "Bearer sk-test-not-real");
assert.equal(successLogs.length, 0, "successful low-level runtime must leave success logging to the owning semantic caller");

const scenarios = [
  {
    name: "redirect",
    response: () => new Response("", { status: 302, headers: { location: "https://example.invalid/" } }),
    error: /provider_redirect_rejected/,
    category: "redirect_rejected"
  },
  {
    name: "declared oversized response",
    response: () => providerResponse('{"ok":true}', { headers: { "content-length": "4096" } }),
    options: { maxResponseBytes: 1024 },
    error: /response_too_large/,
    category: "response_too_large"
  },
  {
    name: "http failure",
    response: () => new Response('{"error":"unavailable"}', { status: 503 }),
    error: /provider_http_503/,
    category: "http_error"
  },
  {
    name: "invalid provider envelope",
    response: () => new Response("not-json", { status: 200 }),
    error: /provider_response_invalid/,
    category: "invalid_response"
  },
  {
    name: "empty provider content",
    response: () => providerResponse(""),
    error: /provider_response_empty/,
    category: "empty_response"
  }
];

for (const scenario of scenarios) {
  let attempts = 0;
  const logs = [];

  await expectReject(
    () =>
      executeOpenAiChatJson({
        apiKey: "sk-test-not-real",
        body,
        stage: "vision-observation",
        ...(scenario.options || {}),
        fetchImpl: async () => {
          attempts += 1;
          return scenario.response();
        },
        logEvent: (event) => logs.push(event)
      }),
    scenario.error
  );

  assert.equal(attempts, 1, `${scenario.name}: provider runtime must not retry`);
  assert.equal(logs.length, 1, `${scenario.name}: failure must emit one bounded provider event`);
  assert.equal(logs[0].errorCategory, scenario.category);
  assert.equal(JSON.stringify(logs).includes("sk-test-not-real"), false);
  assert.equal(JSON.stringify(logs).includes("Return JSON only."), false);
}

{
  let attempts = 0;
  const logs = [];
  await expectReject(
    () =>
      executeOpenAiChatJson({
        apiKey: "sk-test-not-real",
        body,
        stage: "provider_request",
        fetchImpl: async () => {
          attempts += 1;
          throw new Error("synthetic network failure");
        },
        logEvent: (event) => logs.push(event)
      }),
    /synthetic network failure/
  );
  assert.equal(attempts, 1);
  assert.equal(logs[0]?.errorCategory, "request_failed");
}

const runtimeSource = await readFile(new URL("../lib/server/openai-chat-runtime.js", import.meta.url), "utf8");
const visionSource = await readFile(new URL("../lib/server/vision-observation-service.js", import.meta.url), "utf8");
const analyzeSource = await readFile(new URL("../app/api/analyze/route.js", import.meta.url), "utf8");

assert.equal(
  runtimeSource.split("https://api.openai.com/v1/chat/completions").length - 1,
  1,
  "shared runtime must be the only canonical Analyze OpenAI endpoint owner"
);
assert.equal(visionSource.includes("https://api.openai.com/v1/chat/completions"), false);
assert.equal(analyzeSource.includes("https://api.openai.com/v1/chat/completions"), false);
assert.match(visionSource, /executeOpenAiChatJson\(/);
assert.match(analyzeSource, /executeOpenAiChatJson\(/);
assert.match(runtimeSource, /new AbortController\(\)/);
assert.match(runtimeSource, /redirect: "manual"/);
assert.match(runtimeSource, /totalBytes > maxResponseBytes/);
assert.match(runtimeSource, /reader\.cancel\("response_too_large"\)/);
assert.equal(
  /maxRetries|retryAfter|retryCount|attempt\s*\+=|attempt\s*=\s*attempt\s*\+/i.test(runtimeSource),
  false,
  "shared provider runtime must remain single-attempt"
);
assert.equal(
  /\b(?:prompt|rawText|rawContent|responseBody|imageDataUrl|token|apiKey)\s*:/i.test(
    runtimeSource.match(/emitFailure\([\s\S]*?\n\s*}\);/g)?.join("\n") || ""
  ),
  false,
  "failure logs must not receive provider/user payload material"
);

console.log("AI_PROVIDER_RUNTIME_BOUNDARY=PASS");
