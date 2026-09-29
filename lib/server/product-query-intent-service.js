import "server-only";

import { resolveOpenAiApiKey } from "@/lib/openai-env-diagnostics";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "@/lib/ai-model-policy";
import { canonicalizeProductQuerySemanticOwnership } from "@/lib/product-query-intent-semantic-ownership.mjs";
import {
  PRODUCT_QUERY_INTENT_JSON_SCHEMA,
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
  buildRecommendationAnswersFromProductQueryIntent,
  validateProductQueryIntent
} from "@/lib/product-query-intent-contract.mjs";
import {
  PRODUCT_QUERY_PROVIDER_RETRY_POLICY,
  executeBoundedProductQueryProviderRetry
} from "@/lib/product-query-provider-retry-policy.mjs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = OPENAI_RUNTIME_MODEL;
const MAX_QUERY_LENGTH = 500;
const REQUEST_TIMEOUT_MS =
  PRODUCT_QUERY_PROVIDER_RETRY_POLICY.perAttemptTimeoutMs;
const DEFAULT_MAX_OUTPUT_TOKENS = 600;
const EXPERIMENTAL_MAX_OUTPUT_TOKENS = new Set([400, 600, 800]);

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
- Semantic ownership: one explicit semantic claim should populate only its primary schema role. Do NOT duplicate one phrase into multiple fields merely because the concepts are related. Populate multiple related fields only when the query states distinct claims for each role.
- skin_type describes the user's stated skin TYPE or plain type/tendency. "oily skin" / "지성 피부" / "기름지는 피부" maps to skin_type=oily by itself. This ownership is mandatory even when the wording describes a tendency such as skin that gets oily. Do not move that claim to concerns. Populate concerns=["oiliness"] only when oiliness, shine, or sebum is separately framed as a problem, concern, or reduction goal.
- Sensitivity ownership precedence:
  1. A plain type/tendency statement such as "sensitive skin", "민감 피부", "민감성 피부", or "피부가 민감한 편" maps to skin_type=sensitive and sensitivity=null.
  2. A single degree-bearing general-skin sensitivity statement such as "피부가 매우 민감하다", "많이 민감한 피부", or an explicit sensitivity level maps to sensitivity=high and MUST NOT also populate skin_type. The degree-bearing claim owns sensitivity.
  3. Populate both skin_type=sensitive and sensitivity only when the query independently states both the skin type and a separate degree/reactivity claim, for example "민감성 피부이고 자극에도 매우 민감하다".
- do NOT infer sensitivity="high" merely from skin_type=sensitive, and do not duplicate one sensitivity phrase into both fields.
- sensitivity describes general SKIN sensitivity only. Eye-area sensitivity (for example, "눈이 예민", "눈가가 민감") maps to eye_sensitive and MUST NOT populate sensitivity unless the query separately states that the skin itself is sensitive.
- Product-family words establish category first. "젤 타입 보습제" or "젤 보습제" maps to category=moisturizer_gel and texture=null. A category noun such as cream/크림 or gel/젤 that names the requested product family MUST NOT also populate texture unless the query separately expresses an independent texture/form preference. Example: "젤 보습제인데 워터리한 제형" maps to category=moisturizer_gel and texture=watery.
- Desired product properties are not user conditions. Do NOT convert a request for a moisturizing, matte, soothing, brightening, or similar product property into concerns, skin_type, or sensitivity unless the query separately states that condition about the user's skin.
- preferred_finish is the user's explicitly desired end-feel or finish of the requested product: fresh, natural, dewy, or soft_matte. This is a product preference, not a current skin condition. For cleansers, a clearly desired clean/fresh/rinsed-off after-feel belongs to preferred_finish=fresh; do not turn that desired outcome into post_wash_feeling.
- post_wash_feeling describes only the user's explicitly stated CURRENT observed skin state after cleansing: tight, comfortable, or still_oily. Do not infer it from a desired cleanser result.
- afternoon_skin_change describes only an explicitly stated current later-day pattern: more_oily, more_dry, red_or_irritated, or mostly_same. Do not infer it from skin_type.
- very_sensitive_period is true only when the query explicitly says the user is temporarily or unusually more sensitive/reactive than usual. It is separate from the stable sensitivity level.
- If both an explicit desired finish and an observed skin-state signal are present, preserve both in their own fields. Do not collapse one into the other.
- Explicit unsupported concepts are not ambiguity and must not disappear. Preserve the unsupported concept in unresolved_terms and set confidence=low while keeping supported structured fields neutral. Example: "노트북 추천해줘" keeps a short normalized laptop concept in unresolved_terms.
- A vague personalization request with no supported product/category/skin/preference concept and no explicit unsupported concept is ambiguity, not an unresolved concept: keep supported structured fields null/empty, unresolved_terms empty, and confidence low.
- White-cast avoidance and tone-up preference are independent dimensions. "백탁은 싫지만 얼굴은 밝아 보였으면" / "no white cast but I want a brighter-looking complexion" maps to white_cast_hate=true AND tone_up_wanted=true. White-cast avoidance alone MUST NOT imply tone_up_wanted=false.
- When the query contains incompatible positive and negative preferences for the SAME semantic dimension, do not choose a side. Neutralize the affected structured field(s) to null, preserve a short conflict phrase in unresolved_terms, set confidence to low, and keep conflicted fields out of ranking signals. Rejecting tone-up while separately asking for a definite tone-up effect is a tone_up_wanted conflict: tone_up_wanted MUST be null, never true or false.
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

function resolveMaxOutputTokens(value) {
  if (value == null) return DEFAULT_MAX_OUTPUT_TOKENS;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || !EXPERIMENTAL_MAX_OUTPUT_TOKENS.has(numeric)) {
    throw createError("PRODUCT_QUERY_AI_OUTPUT_BUDGET_INVALID");
  }
  return numeric;
}

function normalizeIncompleteReason(value) {
  if (value === "max_output_tokens") return "max_output_tokens";
  if (value === "content_filter") return "content_filter";
  if (typeof value === "string" && value.trim()) return "other";
  return "unknown";
}

function hasRefusal(response) {
  return Array.isArray(response?.output) && response.output.some((item) =>
    item?.type === "message" &&
    Array.isArray(item.content) &&
    item.content.some((part) => part?.type === "refusal")
  );
}

async function requestProductQueryIntentPayload({
  apiKey,
  model,
  normalizedQuery,
  maxOutputTokens,
  timeoutMs
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
        reasoning: {
          effort: OPENAI_RUNTIME_REASONING_EFFORT
        },
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
        max_output_tokens: maxOutputTokens,
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
    const error = createError("PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE");
    error.incompleteReason = normalizeIncompleteReason(
      payload?.incomplete_details?.reason
    );
    throw error;
  }

  if (hasRefusal(payload)) {
    throw createError("PRODUCT_QUERY_AI_REFUSED");
  }

  return payload;
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

  const model = DEFAULT_MODEL;

  const maxOutputTokens = resolveMaxOutputTokens(options.maxOutputTokens);
  const retryEnabled = options.incompleteRetry !== false;

  const providerResult = await executeBoundedProductQueryProviderRetry(
    ({ attemptTimeoutMs }) =>
      requestProductQueryIntentPayload({
        apiKey,
        model,
        normalizedQuery,
        maxOutputTokens,
        timeoutMs: attemptTimeoutMs
      }),
    { retryEnabled }
  );
  const payload = providerResult.value;

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

  candidate = canonicalizeProductQuerySemanticOwnership(normalizedQuery, candidate);

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
    providerAttempts: providerResult.providerAttempts,
    providerRetryUsed: providerResult.providerRetryUsed,
    intent: validation.value,
    adapter: buildRecommendationAnswersFromProductQueryIntent(validation.value)
  });
}

export const PRODUCT_QUERY_INTENT_SERVICE_LIMITS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  totalProviderDeadlineMs: PRODUCT_QUERY_PROVIDER_RETRY_POLICY.totalDeadlineMs,
  maxProviderAttempts: PRODUCT_QUERY_PROVIDER_RETRY_POLICY.maxAttempts,
  retryIncompleteOnly: true,
  retryContentFilterIncomplete: false,
  retryDelayMs: PRODUCT_QUERY_PROVIDER_RETRY_POLICY.retryDelayMs,
  defaultModel: DEFAULT_MODEL,
  defaultMaxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  experimentalMaxOutputTokens: Object.freeze(
    Array.from(EXPERIMENTAL_MAX_OUTPUT_TOKENS).sort((a, b) => a - b)
  ),
  persistence: "none",
  profileMerge: false,
  productSelection: false
});
