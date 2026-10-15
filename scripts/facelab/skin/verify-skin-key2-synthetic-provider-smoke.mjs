import assert from "node:assert/strict";
import { runKey2SyntheticSmoke, KEY2_ENV_NAME } from "./skin-key2-synthetic-provider-smoke.mjs";

const secret = "key2-SENTINEL-DO-NOT-PRINT";
const prodSecret = "PRODUCTION-SENTINEL-DO-NOT-USE";
const healthyPayload = {
  choices: [{ finish_reason: "stop", message: { content: '{"probe":"synthetic_ok"}' } }],
  usage: { prompt_tokens: 31, completion_tokens: 12 }
};
let calls = 0;
const fakeSuccess = async (url, init) => {
  calls++;
  assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal(init.redirect, "manual");
  assert.equal(init.headers.Authorization, "Bearer " + secret);
  assert.equal(init.method, "POST");
  assert.ok(!init.headers.Authorization.includes(prodSecret));
  const request = JSON.parse(init.body);
  assert.equal(request.messages.length, 2);
  assert.equal(request.max_completion_tokens, 256);
  assert.equal(request.response_format.type, "json_object");
  assert.equal(JSON.stringify(request).includes("image_url"), false);
  assert.equal(JSON.stringify(request).includes("data:image"), false);
  return new Response(JSON.stringify(healthyPayload), {
    status: 200, headers: { "content-type": "application/json" }
  });
};
const ok = await runKey2SyntheticSmoke({
  environment: { OPENAI_API_KEY2: secret, OPENAI_API_KEY: prodSecret },
  fetchImpl: fakeSuccess
});
assert.equal(calls, 1);
assert.equal(ok.keyEnvName, KEY2_ENV_NAME);
assert.equal(ok.result, "SYNTHETIC_TEXT_CONNECTIVITY_PASSED");
assert.equal(ok.requestCount, 1);
assert.equal(ok.outputTokens, 12);
assert.equal(ok.actualSkinOrFacePhotoTested, false);
assert.equal(ok.usedProductionApiKeyFallback, false);
assert.equal(ok.productReady, false);
assert.equal(JSON.stringify(ok).includes(secret), false);
assert.equal(JSON.stringify(ok).includes(prodSecret), false);
assert.equal(JSON.stringify(ok).includes("synthetic_ok"), false);

const before = calls;
await assert.rejects(
  runKey2SyntheticSmoke({ environment: { OPENAI_API_KEY: prodSecret }, fetchImpl: fakeSuccess }),
  /dedicated_test_key2_unavailable/
);
assert.equal(calls, before, "missing key2 must never fall back or call the Provider");
await assert.rejects(
  runKey2SyntheticSmoke({ environment: { OPENAI_API_KEY2: "" }, fetchImpl: fakeSuccess }),
  /dedicated_test_key2_unavailable/
);
assert.equal(calls, before);

const incomplete = await runKey2SyntheticSmoke({
  environment: { OPENAI_API_KEY2: secret },
  fetchImpl: async () => new Response(JSON.stringify({
    choices: [{ finish_reason: "length", message: { content: '{"probe":"synthetic_ok"}' } }],
    usage: { prompt_tokens: 31, completion_tokens: 256 }
  }), { status: 200 })
});
assert.equal(incomplete.result, "SYNTHETIC_TEXT_CONNECTIVITY_INCOMPLETE");

await assert.rejects(runKey2SyntheticSmoke({
  environment: { OPENAI_API_KEY2: secret },
  fetchImpl: async () => new Response(
    JSON.stringify({ error: { message: "sensitive", code: "rate_limit_exceeded" } }),
    { status: 429 }
  )
}), /provider_http_429/);

await assert.rejects(runKey2SyntheticSmoke({
  environment: { OPENAI_API_KEY2: secret },
  fetchImpl: async () => new Response(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { content: "NOT JSON" } }]
  }), { status: 200 })
}), /provider_response_invalid/);

console.log("verify-skin-key2-synthetic-provider-smoke: PASS (mock transport only, no key access, no external Provider)");
