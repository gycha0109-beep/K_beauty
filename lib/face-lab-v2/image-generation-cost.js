export const FACE_LAB_IMAGE_COST_PRICING_VERSION =
  "openai-gpt-image-2.5-direct-images-2026-10-03";

const NANO_USD_PER_IMAGE_INPUT_TOKEN = 8_000;
const NANO_USD_PER_TEXT_INPUT_TOKEN = 5_000;
const NANO_USD_PER_IMAGE_OUTPUT_TOKEN = 30_000;

function tokenCount(value) {
  return Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

export function normalizeFaceLabImageUsage(
  usage
) {
  if (
    !usage ||
    typeof usage !== "object" ||
    Array.isArray(usage)
  ) {
    return null;
  }

  const inputTokens =
    tokenCount(
      usage.input_tokens
    );
  const inputImageTokens =
    tokenCount(
      usage
        .input_tokens_details
        ?.image_tokens
    );
  const inputTextTokens =
    tokenCount(
      usage
        .input_tokens_details
        ?.text_tokens
    );
  const outputTokens =
    tokenCount(
      usage.output_tokens
    );
  const outputImageTokens =
    tokenCount(
      usage
        .output_tokens_details
        ?.image_tokens
    );
  const totalTokens =
    tokenCount(
      usage.total_tokens
    );

  if (
    inputTokens === null &&
    inputImageTokens === null &&
    inputTextTokens === null &&
    outputTokens === null &&
    outputImageTokens === null &&
    totalTokens === null
  ) {
    return null;
  }

  return {
    inputTokens,
    inputImageTokens,
    inputTextTokens,
    outputTokens,
    outputImageTokens,
    totalTokens
  };
}

export function estimateFaceLabImageCost(
  usage
) {
  const normalized =
    normalizeFaceLabImageUsage(
      usage
    );

  if (!normalized) {
    return null;
  }

  const detailedInputKnown =
    normalized.inputImageTokens !==
      null ||
    normalized.inputTextTokens !==
      null;

  const inputNanoUsd =
    detailedInputKnown
      ? (
          (
            normalized
              .inputImageTokens ||
            0
          ) *
            NANO_USD_PER_IMAGE_INPUT_TOKEN +
          (
            normalized
              .inputTextTokens ||
            0
          ) *
            NANO_USD_PER_TEXT_INPUT_TOKEN
        )
      : (
          (
            normalized.inputTokens ||
            0
          ) *
          NANO_USD_PER_IMAGE_INPUT_TOKEN
        );

  const outputNanoUsd =
    (
      normalized.outputImageTokens ??
      normalized.outputTokens ??
      0
    ) *
    NANO_USD_PER_IMAGE_OUTPUT_TOKEN;

  return {
    pricingVersion:
      FACE_LAB_IMAGE_COST_PRICING_VERSION,
    usage: normalized,
    estimatedCostNanoUsd:
      inputNanoUsd +
      outputNanoUsd
  };
}
