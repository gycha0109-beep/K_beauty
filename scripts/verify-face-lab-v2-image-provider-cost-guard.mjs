import assert from "node:assert/strict";
import {
  executeOpenAiImageEdit,
  OPENAI_IMAGE_EDITS_URL
} from "../lib/openai-image-edit-runtime-core.js";

const pngBytes = Buffer.from(
  "89504e470d0a1a0a",
  "hex"
);

function imageResponse({
  status = 200,
  error = null,
  headers = {}
} = {}) {
  const payload =
    status >= 200 && status < 300
      ? {
          data: [
            {
              b64_json:
                pngBytes.toString(
                  "base64"
                )
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          }
        }
      : {
          error
        };

  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        "content-type":
          "application/json",
        ...headers
      }
    }
  );
}

async function expectReject(run) {
  try {
    await run();
  } catch (error) {
    return error;
  }

  assert.fail(
    "expected image provider failure"
  );
}

{
  let attempts = 0;
  const logs = [];

  const error =
    await expectReject(
      () =>
        executeOpenAiImageEdit({
          apiKey:
            "sk-image-test-not-real",
          imageBuffer:
            pngBytes,
          mimeType:
            "image/png",
          instruction:
            "Keep identity unchanged.",
          fetchImpl:
            async (url) => {
              attempts += 1;
              assert.equal(
                url,
                OPENAI_IMAGE_EDITS_URL
              );
              return imageResponse({
                status: 429,
                error: {
                  message:
                    "quota fixture",
                  type:
                    "insufficient_quota",
                  code:
                    "credit_balance_exhausted"
                }
              });
            },
          logEvent:
            (event) =>
              logs.push(event)
        })
    );

  assert.equal(
    attempts,
    1,
    "quota exhaustion must never spend a second image request"
  );
  assert.match(
    error.message,
    /provider_http_429/
  );
  assert.equal(
    error.providerErrorCode,
    "credit_balance_exhausted"
  );
  assert.equal(
    error.providerErrorType,
    "insufficient_quota"
  );
  assert.equal(
    error.providerRetryable,
    false
  );
  assert.equal(
    logs.length,
    1
  );
  assert.equal(
    logs[0].errorCategory,
    "http_error"
  );
  assert.equal(
    logs[0]
      .providerErrorCode,
    "credit_balance_exhausted"
  );
  assert.equal(
    logs[0]
      .providerErrorType,
    "insufficient_quota"
  );
  assert.equal(
    logs[0].retryable,
    false
  );
}

{
  let attempts = 0;
  const logs = [];

  const result =
    await executeOpenAiImageEdit({
      apiKey:
        "sk-image-test-not-real",
      imageBuffer:
        pngBytes,
      mimeType:
        "image/png",
      instruction:
        "Keep identity unchanged.",
      fetchImpl:
        async () => {
          attempts += 1;

          if (attempts === 1) {
            return imageResponse({
              status: 429,
              error: {
                message:
                  "rate fixture",
                type:
                  "rate_limit_error",
                code:
                  "rate_limit_exceeded"
              },
              headers: {
                "retry-after-ms":
                  "0"
              }
            });
          }

          return imageResponse();
        },
      logEvent:
        (event) =>
          logs.push(event)
    });

  assert.equal(
    attempts,
    2,
    "transient rate limit may use the one bounded retry"
  );
  assert.equal(
    result.status,
    200
  );
  assert.equal(
    logs[0]
      .errorCategory,
    "rate_limited_retry"
  );
  assert.equal(
    logs[0]
      .providerErrorCode,
    "rate_limit_exceeded"
  );
  assert.equal(
    logs[0].retryable,
    true
  );
  assert.equal(
    logs.at(-1)?.ok,
    true
  );
}

for (const serialized of [
  JSON.stringify({
    secret:
      "sk-image-test-not-real"
  })
]) {
  assert.equal(
    JSON.stringify(serialized)
      .includes(
        "Keep identity unchanged."
      ),
    false
  );
}

console.log(
  "FACE_LAB_IMAGE_PROVIDER_COST_GUARD=PASS"
);
