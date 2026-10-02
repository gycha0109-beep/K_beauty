import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  executeOpenAiChatJson
} from "../lib/server/openai-chat-runtime.js";
import {
  executeVisionProviderWithRetry,
  resolveVisionProviderBackoffMs,
  VISION_PROVIDER_FALLBACK_BACKOFF_MS,
  VISION_PROVIDER_MAX_ATTEMPTS,
  VISION_PROVIDER_MAX_BACKOFF_MS
} from "../lib/vision-observation-retry-core.js";

const body = {
  model: "gpt-5.6-luna",
  max_completion_tokens: 64,
  reasoning_effort: "none",
  temperature: 0,
  response_format: {
    type: "json_object"
  },
  messages: [
    {
      role: "user",
      content: "Return JSON only."
    }
  ]
};

let runtimeAttempts = 0;
let runtimeError = null;

try {
  await executeOpenAiChatJson({
    apiKey: "sk-test-not-real",
    body,
    stage: "vision-observation",
    fetchImpl: async () => {
      runtimeAttempts += 1;
      return new Response(
        JSON.stringify({
          error: {
            message:
              "rate limited fixture"
          }
        }),
        {
          status: 429,
          headers: {
            "content-type":
              "application/json",
            "retry-after-ms":
              "1250"
          }
        }
      );
    },
    logEvent: () => {}
  });
} catch (error) {
  runtimeError = error;
}

assert.ok(runtimeError);
assert.equal(
  runtimeError.message,
  "provider_http_429"
);
assert.equal(
  runtimeError.providerStatus,
  429
);
assert.equal(
  runtimeError.providerBackoffMs,
  1250
);
assert.equal(
  runtimeAttempts,
  1,
  "shared OpenAI runtime must remain single-attempt"
);

const waits = [];
let visionAttempts = 0;

const recovered =
  await executeVisionProviderWithRetry({
    run: async () => {
      visionAttempts += 1;

      if (visionAttempts === 1) {
        const error =
          new Error(
            "provider_http_429"
          );
        Object.defineProperties(
          error,
          {
            providerStatus: {
              value: 429
            },
            providerBackoffMs: {
              value: 0
            }
          }
        );
        throw error;
      }

      return {
        status: 200,
        parsed: {
          ok: true
        }
      };
    },
    waitImpl: async (
      delayMs
    ) => {
      waits.push(delayMs);
    }
  });

assert.equal(
  VISION_PROVIDER_MAX_ATTEMPTS,
  2
);
assert.equal(
  recovered.attemptCount,
  2
);
assert.equal(
  visionAttempts,
  2
);
assert.deepEqual(
  waits,
  [0]
);
assert.deepEqual(
  recovered.runtime.parsed,
  {
    ok: true
  }
);

let exhaustedAttempts = 0;

await assert.rejects(
  () =>
    executeVisionProviderWithRetry({
      run: async () => {
        exhaustedAttempts += 1;
        const error =
          new Error(
            "provider_http_429"
          );
        Object.defineProperty(
          error,
          "providerStatus",
          {
            value: 429
          }
        );
        Object.defineProperty(
          error,
          "providerBackoffMs",
          {
            value: 0
          }
        );
        throw error;
      },
      waitImpl:
        async () => {}
    }),
  /provider_http_429/
);

assert.equal(
  exhaustedAttempts,
  2
);

let nonRetryAttempts = 0;

await assert.rejects(
  () =>
    executeVisionProviderWithRetry({
      run: async () => {
        nonRetryAttempts += 1;
        const error =
          new Error(
            "provider_http_503"
          );
        Object.defineProperty(
          error,
          "providerStatus",
          {
            value: 503
          }
        );
        throw error;
      },
      waitImpl:
        async () => {
          throw new Error(
            "must not wait"
          );
        }
    }),
  /provider_http_503/
);

assert.equal(
  nonRetryAttempts,
  1
);

assert.equal(
  resolveVisionProviderBackoffMs(
    new Error(
      "provider_http_429"
    )
  ),
  VISION_PROVIDER_FALLBACK_BACKOFF_MS
);

const hugeBackoff =
  new Error(
    "provider_http_429"
  );
Object.defineProperty(
  hugeBackoff,
  "providerBackoffMs",
  {
    value: 999_999
  }
);

assert.equal(
  resolveVisionProviderBackoffMs(
    hugeBackoff
  ),
  VISION_PROVIDER_MAX_BACKOFF_MS
);

const serviceSource =
  readFileSync(
    "lib/server/vision-observation-service.js",
    "utf8"
  );
const runtimeSource =
  readFileSync(
    "lib/server/openai-chat-runtime.js",
    "utf8"
  );

assert.ok(
  serviceSource.includes(
    "executeVisionProviderWithRetry"
  )
);
assert.ok(
  serviceSource.includes(
    "imageProviderAttemptCount: attemptCount"
  )
);
assert.equal(
  /maxRetries|retryCount|attempt\s*\+=|attempt\s*=\s*attempt\s*\+/i.test(
    runtimeSource
  ),
  false,
  "shared provider runtime must not gain retry orchestration"
);
assert.ok(
  runtimeSource.includes(
    "providerBackoffMs"
  )
);
assert.ok(
  runtimeSource.includes(
    '"retry-after-ms"'
  )
);
assert.ok(
  runtimeSource.includes(
    '"retry-after"'
  )
);

console.log(
  "FACE_LAB_VISION_PROVIDER_429_RETRY=PASS"
);
