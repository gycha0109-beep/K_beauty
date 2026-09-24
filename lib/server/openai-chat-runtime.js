import { logProviderRuntimeEvent } from "../provider-runtime-log.js";

export const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_PROVIDER_DEFAULT_TIMEOUT_MS = 120_000;
export const OPENAI_PROVIDER_DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.type === "text" ? item.text || "" : "";
    })
    .join("\n")
    .trim();
}

async function readBoundedResponse(response, maxResponseBytes) {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    throw new Error("response_too_large");
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("response_body_unavailable");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxResponseBytes) {
        await reader.cancel("response_too_large");
        throw new Error("response_too_large");
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

function validateRuntimeInputs({ apiKey, body, timeoutMs, maxResponseBytes, parseContent, fetchImpl, logEvent }) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("api_key_missing");
  }

  if (!body || typeof body !== "object" || typeof body.model !== "string" || !body.model.trim()) {
    throw new Error("provider_body_invalid");
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 10 * 60_000) {
    throw new Error("timeout_invalid");
  }

  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1_024 || maxResponseBytes > 4 * 1024 * 1024) {
    throw new Error("max_response_bytes_invalid");
  }

  if (typeof parseContent !== "function" || typeof fetchImpl !== "function" || typeof logEvent !== "function") {
    throw new Error("provider_runtime_dependency_invalid");
  }
}

function emitFailure({ logEvent, stage, status, model, startedAt, errorCategory }) {
  logEvent({
    stage,
    status,
    ok: false,
    provider: "openai",
    model,
    durationMs: Date.now() - startedAt,
    errorCategory
  });
}

export async function executeOpenAiChatJson({
  apiKey,
  body,
  stage,
  timeoutMs = OPENAI_PROVIDER_DEFAULT_TIMEOUT_MS,
  maxResponseBytes = OPENAI_PROVIDER_DEFAULT_MAX_RESPONSE_BYTES,
  parseContent = JSON.parse,
  fetchImpl = fetch,
  logEvent = logProviderRuntimeEvent
} = {}) {
  validateRuntimeInputs({
    apiKey,
    body,
    timeoutMs,
    maxResponseBytes,
    parseContent,
    fetchImpl,
    logEvent
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  let response;

  try {
    try {
      response = await fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      emitFailure({
        logEvent,
        stage,
        status: null,
        model: body.model,
        startedAt,
        errorCategory: error?.name === "AbortError" ? "timeout" : "request_failed"
      });
      throw error;
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      emitFailure({
        logEvent,
        stage,
        status: response.status,
        model: body.model,
        startedAt,
        errorCategory: "redirect_rejected"
      });
      throw new Error("provider_redirect_rejected");
    }

    let rawText;

    try {
      rawText = await readBoundedResponse(response, maxResponseBytes);
    } catch (error) {
      emitFailure({
        logEvent,
        stage,
        status: response.status,
        model: body.model,
        startedAt,
        errorCategory: error?.message === "response_too_large" ? "response_too_large" : "invalid_response"
      });
      throw error;
    }

    if (!response.ok) {
      emitFailure({
        logEvent,
        stage,
        status: response.status,
        model: body.model,
        startedAt,
        errorCategory: "http_error"
      });
      throw new Error(`provider_http_${response.status}`);
    }

    if (!rawText) {
      emitFailure({
        logEvent,
        stage,
        status: response.status,
        model: body.model,
        startedAt,
        errorCategory: "empty_response"
      });
      throw new Error("provider_response_empty");
    }

    let providerPayload;
    let content;
    let parsed;

    try {
      providerPayload = JSON.parse(rawText);
      content = extractTextContent(providerPayload?.choices?.[0]?.message?.content);

      if (!content) {
        throw new Error("empty_response");
      }

      parsed = parseContent(content);
    } catch (error) {
      const empty = error?.message === "empty_response";
      emitFailure({
        logEvent,
        stage,
        status: response.status,
        model: body.model,
        startedAt,
        errorCategory: empty ? "empty_response" : "invalid_response"
      });
      throw new Error(empty ? "provider_response_empty" : "provider_response_invalid");
    }

    return {
      parsed,
      providerPayload,
      status: response.status,
      durationMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}
