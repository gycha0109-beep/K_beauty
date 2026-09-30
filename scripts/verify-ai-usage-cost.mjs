import assert from "node:assert/strict";
import {
  OPENAI_USAGE_PRICING_VERSION,
  createOpenAiUsageTelemetry,
  estimateOpenAiUsageCost
} from "../lib/ai-usage-cost.js";

const cost = estimateOpenAiUsageCost({
  model: "gpt-5.6-luna",
  inputTokens: 5_681,
  outputTokens: 1_135
});

assert.equal(
  OPENAI_USAGE_PRICING_VERSION,
  "openai-gpt-5.6-luna-standard-2026-09-30"
);
assert.equal(cost.pricingVersion, OPENAI_USAGE_PRICING_VERSION);
assert.equal(cost.estimatedCostNanoUsd, 2_498_200);
assert.equal(cost.estimatedCostUsd, 0.0024982);

const telemetry = createOpenAiUsageTelemetry({
  model: "gpt-5.6-luna",
  inputTokens: 5_681,
  outputTokens: 1_135,
  imageDetail: "high",
  now: new Date("2026-09-30T10:40:00.000Z")
});

assert.deepEqual(telemetry, {
  usageDayUtc: "2026-09-30",
  inputTokens: 5_681,
  outputTokens: 1_135,
  imageDetail: "high",
  pricingVersion: OPENAI_USAGE_PRICING_VERSION,
  estimatedCostNanoUsd: 2_498_200,
  estimatedCostUsd: 0.0024982
});

assert.deepEqual(
  estimateOpenAiUsageCost({
    model: "unknown-model",
    inputTokens: 10,
    outputTokens: 10
  }),
  {
    pricingVersion: null,
    estimatedCostNanoUsd: null,
    estimatedCostUsd: null
  }
);

assert.deepEqual(
  estimateOpenAiUsageCost({
    model: "gpt-5.6-luna",
    inputTokens: -1,
    outputTokens: 10
  }),
  {
    pricingVersion: null,
    estimatedCostNanoUsd: null,
    estimatedCostUsd: null
  }
);

console.log("AI_USAGE_COST_TELEMETRY=PASS");
