import assert from "node:assert/strict";
import {
  executeOpenAiChatJson
} from "../lib/server/openai-chat-runtime.js";
import { logProviderRuntimeEvent } from "../lib/provider-runtime-log.js";

const apiKey = process.env.OPENAI_API_KEY || "";
assert.ok(apiKey, "OPENAI_API_KEY is required for the explicit live-provider smoke");

const model = process.env.AI_PROVIDER_SMOKE_MODEL || "gpt-4o-mini";
const runtime = await executeOpenAiChatJson({
  apiKey,
  stage: "provider_request",
  timeoutMs: 60_000,
  body: {
    model,
    max_tokens: 80,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Return exactly one small JSON object. Do not include markdown."
      },
      {
        role: "user",
        content: '{"contract":"ai-provider-runtime-live-smoke-v1","expected":true}'
      }
    ]
  }
});

assert.equal(runtime.parsed?.contract, "ai-provider-runtime-live-smoke-v1");
assert.equal(runtime.parsed?.expected, true);

logProviderRuntimeEvent({
  stage: "provider_request",
  status: runtime.status,
  ok: true,
  provider: "openai",
  model,
  durationMs: runtime.durationMs
});

console.log("AI_PROVIDER_LIVE_SMOKE=PASS");
