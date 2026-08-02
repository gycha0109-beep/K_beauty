const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export class ObservationTransportError extends Error {
  constructor(code, category, attemptCount = 1) {
    super(code);
    this.name = "ObservationTransportError";
    this.code = code;
    this.category = category;
    this.attemptCount = attemptCount;
  }
}

async function readBoundedText(response, maxBytes) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ObservationTransportError("provider_response_too_large", "response_too_large");
  if (!response.body || typeof response.body.getReader !== "function") throw new ObservationTransportError("provider_response_invalid_json", "response_body_unavailable");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response_too_large");
        throw new ObservationTransportError("provider_response_too_large", "response_too_large");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function extractContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => item?.type === "text" ? item.text || "" : typeof item === "string" ? item : "").join("\n").trim();
}

function safeToken(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function executeBoundedOpenAIObservation({ apiKey, imageBuffer, model, prompt, limits, fetchImpl = fetch }) {
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new ObservationTransportError("provider_credential_missing", "credential", 0);
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) throw new ObservationTransportError("canonical_asset_missing", "input", 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  let response;
  try {
    response = await fetchImpl(OPENAI_URL, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: limits.maxOutputTokens,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the canonical locale-neutral observation bundle from this synthetic evaluation image." },
              { type: "image_url", image_url: { url: `data:image/png;base64,${imageBuffer.toString("base64")}` } }
            ]
          }
        ]
      })
    });
  } catch (error) {
    clearTimeout(timer);
    if (error?.name === "AbortError") throw new ObservationTransportError("provider_timeout", "timeout");
    if (error instanceof ObservationTransportError) throw error;
    throw new ObservationTransportError("provider_http_error", "request_failed");
  }
  clearTimeout(timer);
  if ([301, 302, 303, 307, 308].includes(response.status)) throw new ObservationTransportError("provider_redirect_rejected", "redirect_rejected");
  const rawText = await readBoundedText(response, limits.maxResponseBytes);
  if (!response.ok) throw new ObservationTransportError("provider_http_error", `http_${response.status}`);
  let envelope;
  let parsed;
  try {
    envelope = JSON.parse(rawText);
    const content = extractContent(envelope);
    if (!content) throw new Error("empty");
    parsed = JSON.parse(content);
  } catch {
    throw new ObservationTransportError("provider_response_invalid_json", "invalid_json");
  }
  return Object.freeze({
    rawObservation: parsed,
    telemetry: Object.freeze({
      provider: "openai",
      model,
      imageProviderAttemptCount: 1,
      inputTokens: safeToken(envelope?.usage?.prompt_tokens),
      outputTokens: safeToken(envelope?.usage?.completion_tokens)
    })
  });
}
