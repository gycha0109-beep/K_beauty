import "server-only";

import { resolveOpenAiApiKey } from "@/lib/openai-env-diagnostics";
import {
  PRODUCT_QUERY_INTENT_JSON_SCHEMA,
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
  buildRecommendationAnswersFromProductQueryIntent,
  validateProductQueryIntent
} from "@/lib/product-query-intent-contract.mjs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_QUERY_LENGTH = 500;
const REQUEST_TIMEOUT_MS = 8000;

const SYSTEM_INSTRUCTIONS = `
You extract product-search intent for BEJEWELY.

Rules:
- Use ONLY facts explicitly stated in the current query.
- Never infer or import a saved user profile, analysis result, prior conversation, age, gender, diagnosis, or medical state.
- Never choose products, product IDs, brands, scores, rankings, Product Facts, ingredients, or claims.
- Map only to the supplied schema vocabulary.
- If the user asks for a concept outside the schema, preserve a short normalized phrase in unresolved_terms instead of guessing a nearby field.
- concerns contains at most two concerns in the order emphasized by the query.
- If category is sunscreen, sunscreen_intent cannot be false.
- sensitivity describes general SKIN sensitivity only. Eye-area sensitivity (for example, "눈이 예민", "눈가가 민감") maps to eye_sensitive and MUST NOT populate sensitivity unless the query separately states that the skin itself is sensitive.
- Null means the query did not establish the field.
- This is intent extraction, not skincare advice.
`.trim();

function createError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeQuery(query) {
  if (typeof query !== "string") {
    throw createError("PRODUCT_QUERY_TEXT_INVALID");
  }

  const normalized = query.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > MAX_QUERY_LENGTH) {
    throw createError("PRODUCT_QUERY_TEXT_INVALID");
  }
  return normalized;
}

function hasRefusal(response) {
  return Array.isArray(response?.output) && response.output.some((item) =>
    item?.type === "message" &&
    Array.isArray(item.content) &&
    item.content.some((part) => part?.type === "refusal")
  );
}

function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) {
    return "";
  }

  const chunks = [];
  for (const item of response.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("").trim();
}

export async function extractProductQueryIntent(query, options = {}) {
  const normalizedQuery = normalizeQuery(query);
  const { apiKey } = resolveOpenAiApiKey();
  if (!apiKey) {
    throw createError("PRODUCT_QUERY_AI_UNAVAILABLE");
  }

  const model = String(
    options.model || process.env.PRODUCT_QUERY_INTENT_MODEL || DEFAULT_MODEL
  ).trim() || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            role: "system",
            content: SYSTEM_INSTRUCTIONS
          },
          {
            role: "user",
            content: normalizedQuery
          }
        ],
        max_output_tokens: 400,
        text: {
          format: {
            type: "json_schema",
            name: "bejewely_product_query_intent",
            strict: true,
            schema: PRODUCT_QUERY_INTENT_JSON_SCHEMA
          }
        }
      }),
      signal: controller.signal
    });
  } catch (cause) {
    const error = createError(
      cause?.name === "AbortError"
        ? "PRODUCT_QUERY_AI_TIMEOUT"
        : "PRODUCT_QUERY_AI_REQUEST_FAILED"
    );
    error.cause = cause;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw createError("PRODUCT_QUERY_AI_REQUEST_FAILED");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createError("PRODUCT_QUERY_AI_RESPONSE_INVALID");
  }

  if (payload?.status !== "completed") {
    throw createError("PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE");
  }
  if (hasRefusal(payload)) {
    throw createError("PRODUCT_QUERY_AI_REFUSED");
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw createError("PRODUCT_QUERY_AI_RESPONSE_INVALID");
  }

  let candidate;
  try {
    candidate = JSON.parse(outputText);
  } catch {
    throw createError("PRODUCT_QUERY_AI_RESPONSE_INVALID");
  }

  const validation = validateProductQueryIntent(candidate);
  if (!validation.ok) {
    const error = createError("PRODUCT_QUERY_AI_SCHEMA_REJECTED");
    error.details = validation.errors;
    throw error;
  }

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    provider: "openai",
    model,
    provenance: "query_only",
    intent: validation.value,
    adapter: buildRecommendationAnswersFromProductQueryIntent(validation.value)
  });
}

export const PRODUCT_QUERY_INTENT_SERVICE_LIMITS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  defaultModel: DEFAULT_MODEL,
  persistence: "none",
  profileMerge: false,
  productSelection: false
});
