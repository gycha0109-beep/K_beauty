export const OPENAI_USAGE_PRICING_VERSION =
  "openai-gpt-5.6-luna-standard-2026-09-30";

export const OPENAI_USAGE_PRICING = Object.freeze({
  "gpt-5.6-luna": Object.freeze({
    inputNanoUsdPerToken: 200,
    outputNanoUsdPerToken: 1200
  })
});

function safeTokenCount(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function estimateOpenAiUsageCost({
  model,
  inputTokens,
  outputTokens
} = {}) {
  const pricing = OPENAI_USAGE_PRICING[model];
  const safeInputTokens = safeTokenCount(inputTokens);
  const safeOutputTokens = safeTokenCount(outputTokens);

  if (!pricing || safeInputTokens === null || safeOutputTokens === null) {
    return {
      pricingVersion: null,
      estimatedCostNanoUsd: null,
      estimatedCostUsd: null
    };
  }

  const estimatedCostNanoUsd =
    safeInputTokens * pricing.inputNanoUsdPerToken +
    safeOutputTokens * pricing.outputNanoUsdPerToken;

  return {
    pricingVersion: OPENAI_USAGE_PRICING_VERSION,
    estimatedCostNanoUsd,
    estimatedCostUsd: Number((estimatedCostNanoUsd / 1_000_000_000).toFixed(8))
  };
}

export function createOpenAiUsageTelemetry({
  model,
  inputTokens,
  outputTokens,
  imageDetail = null,
  now = new Date()
} = {}) {
  const safeInputTokens = safeTokenCount(inputTokens);
  const safeOutputTokens = safeTokenCount(outputTokens);
  const cost = estimateOpenAiUsageCost({
    model,
    inputTokens: safeInputTokens,
    outputTokens: safeOutputTokens
  });
  const timestamp = now instanceof Date && Number.isFinite(now.getTime())
    ? now
    : new Date();

  return {
    usageDayUtc: timestamp.toISOString().slice(0, 10),
    inputTokens: safeInputTokens,
    outputTokens: safeOutputTokens,
    imageDetail:
      ["low", "high", "original", "auto"].includes(imageDetail)
        ? imageDetail
        : null,
    ...cost
  };
}
