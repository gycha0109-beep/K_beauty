import assert from "node:assert/strict";
import test from "node:test";
import { executeBoundedOpenAIObservation, ObservationTransportError } from "../../src/observation/openai-transport.js";

const base = {
  apiKey: "test-key",
  imageBuffer: Buffer.from("image"),
  model: "gpt-4o-mini",
  prompt: "prompt",
  limits: { timeoutMs: 1000, maxResponseBytes: 1024, maxOutputTokens: 256 }
};

async function rejectedCode(fetchImpl) {
  try {
    await executeBoundedOpenAIObservation({ ...base, fetchImpl });
    assert.fail("expected rejection");
  } catch (error) {
    assert.equal(error instanceof ObservationTransportError, true);
    return error;
  }
}

test("redirect, oversized response, and invalid JSON are separated without retry", async () => {
  let calls = 0;
  let error = await rejectedCode(async () => {
    calls += 1;
    return new Response("", { status: 302, headers: { location: "https://example.invalid" } });
  });
  assert.equal(error.code, "provider_redirect_rejected");
  assert.equal(calls, 1);

  calls = 0;
  error = await rejectedCode(async () => {
    calls += 1;
    return new Response("{}", { status: 200, headers: { "content-length": "2048" } });
  });
  assert.equal(error.code, "provider_response_too_large");
  assert.equal(calls, 1);

  calls = 0;
  error = await rejectedCode(async () => {
    calls += 1;
    return new Response("not-json", { status: 200 });
  });
  assert.equal(error.code, "provider_response_invalid_json");
  assert.equal(calls, 1);
});

test("missing credential fails before an image-bearing attempt", async () => {
  let calls = 0;
  const error = await rejectedCode(async () => { calls += 1; return new Response("{}"); });
  assert.equal(calls, 1);
  assert.equal(error.attemptCount, 1);

  try {
    await executeBoundedOpenAIObservation({ ...base, apiKey: "", fetchImpl: async () => { calls += 1; } });
    assert.fail("expected rejection");
  } catch (missing) {
    assert.equal(missing.code, "provider_credential_missing");
    assert.equal(missing.attemptCount, 0);
  }
});
