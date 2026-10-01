import { logProviderRuntimeEvent } from "./provider-runtime-log.js";

export const OPENAI_IMAGE_EDITS_URL =
  "https://api.openai.com/v1/images/edits";

export const OPENAI_IMAGE_EDIT_MODEL =
  "gpt-image-2.5-sunburst";

export const OPENAI_IMAGE_EDIT_TIMEOUT_MS =
  180_000;

export const OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES =
  20 * 1024 * 1024;

export const OPENAI_IMAGE_EDIT_MAX_RESPONSE_BYTES =
  32 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const ALLOWED_QUALITY = new Set([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "auto"
]);

const ALLOWED_SIZE = new Set([
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536"
]);

const ALLOWED_OUTPUT_FORMAT = new Set([
  "png",
  "jpeg",
  "webp"
]);

function imageMimeForOutputFormat(
  outputFormat
) {
  if (outputFormat === "jpeg") {
    return "image/jpeg";
  }

  if (outputFormat === "webp") {
    return "image/webp";
  }

  return "image/png";
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function matchesImageSignature(
  bytes,
  mimeType
) {
  if (!Buffer.isBuffer(bytes)) {
    return false;
  }

  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes
        .subarray(0, 4)
        .toString("ascii") === "RIFF" &&
      bytes
        .subarray(8, 12)
        .toString("ascii") === "WEBP"
    );
  }

  return false;
}

function emitRuntimeEvent({
  logEvent,
  stage,
  status,
  ok,
  model,
  startedAt,
  errorCategory = null,
  metadata = {}
}) {
  logEvent({
    stage,
    status,
    ok,
    provider: "openai",
    model,
    durationMs:
      Date.now() - startedAt,
    errorCategory,
    ...metadata
  });
}

function validateInputs({
  apiKey,
  imageBuffer,
  mimeType,
  instruction,
  model,
  quality,
  size,
  outputFormat,
  timeoutMs,
  maxInputBytes,
  maxResponseBytes,
  fetchImpl,
  logEvent
}) {
  if (
    typeof apiKey !== "string" ||
    !apiKey.trim()
  ) {
    throw new Error("api_key_missing");
  }

  if (
    !Buffer.isBuffer(imageBuffer) ||
    imageBuffer.length === 0
  ) {
    throw new Error(
      "image_buffer_invalid"
    );
  }

  if (
    !Number.isSafeInteger(maxInputBytes) ||
    maxInputBytes < 1024 ||
    maxInputBytes >
      50 * 1024 * 1024
  ) {
    throw new Error(
      "max_input_bytes_invalid"
    );
  }

  if (
    imageBuffer.length >
    maxInputBytes
  ) {
    throw new Error(
      "image_buffer_too_large"
    );
  }

  if (
    !ALLOWED_IMAGE_MIME_TYPES.has(
      mimeType
    )
  ) {
    throw new Error(
      "image_mime_type_invalid"
    );
  }

  if (
    !matchesImageSignature(
      imageBuffer,
      mimeType
    )
  ) {
    throw new Error(
      "image_signature_invalid"
    );
  }

  if (
    typeof instruction !== "string" ||
    !instruction.trim() ||
    instruction.length > 16_000
  ) {
    throw new Error(
      "simulation_instruction_invalid"
    );
  }

  if (
    typeof model !== "string" ||
    !model.trim()
  ) {
    throw new Error("model_invalid");
  }

  if (!ALLOWED_QUALITY.has(quality)) {
    throw new Error("quality_invalid");
  }

  if (!ALLOWED_SIZE.has(size)) {
    throw new Error("size_invalid");
  }

  if (
    !ALLOWED_OUTPUT_FORMAT.has(
      outputFormat
    )
  ) {
    throw new Error(
      "output_format_invalid"
    );
  }

  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1_000 ||
    timeoutMs > 5 * 60_000
  ) {
    throw new Error("timeout_invalid");
  }

  if (
    !Number.isSafeInteger(
      maxResponseBytes
    ) ||
    maxResponseBytes < 1024 ||
    maxResponseBytes >
      64 * 1024 * 1024
  ) {
    throw new Error(
      "max_response_bytes_invalid"
    );
  }

  if (
    typeof fetchImpl !== "function" ||
    typeof logEvent !== "function"
  ) {
    throw new Error(
      "provider_runtime_dependency_invalid"
    );
  }
}

async function readBoundedResponse(
  response,
  maxResponseBytes
) {
  const declaredLength =
    Number(
      response.headers.get(
        "content-length"
      )
    );

  if (
    Number.isFinite(
      declaredLength
    ) &&
    declaredLength >
      maxResponseBytes
  ) {
    throw new Error(
      "response_too_large"
    );
  }

  if (
    !response.body ||
    typeof response.body.getReader !==
      "function"
  ) {
    throw new Error(
      "response_body_unavailable"
    );
  }

  const reader =
    response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const {
        done,
        value
      } = await reader.read();

      if (done) break;

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        maxResponseBytes
      ) {
        await reader.cancel(
          "response_too_large"
        );
        throw new Error(
          "response_too_large"
        );
      }

      chunks.push(
        Buffer.from(value)
      );
    }
  } finally {
    reader.releaseLock();
  }

  return {
    rawText: Buffer.concat(
      chunks,
      totalBytes
    ).toString("utf8"),
    responseBytes: totalBytes
  };
}

function decodeProviderImage(
  value,
  maxInputBytes,
  expectedMimeType
) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length >
      Math.ceil(
        maxInputBytes * 4 / 3
      ) + 16
  ) {
    throw new Error(
      "provider_image_base64_invalid"
    );
  }

  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(
      value
    )
  ) {
    throw new Error(
      "provider_image_base64_invalid"
    );
  }

  const bytes =
    Buffer.from(value, "base64");

  if (
    !bytes.length ||
    bytes.length >
      maxInputBytes
  ) {
    throw new Error(
      "provider_image_bytes_invalid"
    );
  }

  const normalizedInput =
    value.replace(/=+$/, "");
  const normalizedOutput =
    bytes
      .toString("base64")
      .replace(/=+$/, "");

  if (
    normalizedInput !==
    normalizedOutput
  ) {
    throw new Error(
      "provider_image_base64_invalid"
    );
  }

  if (
    !matchesImageSignature(
      bytes,
      expectedMimeType
    )
  ) {
    throw new Error(
      "provider_image_signature_invalid"
    );
  }

  return bytes;
}

export async function executeOpenAiImageEdit({
  apiKey,
  imageBuffer,
  mimeType,
  instruction,
  model = OPENAI_IMAGE_EDIT_MODEL,
  quality = "high",
  size = "auto",
  outputFormat = "png",
  timeoutMs =
    OPENAI_IMAGE_EDIT_TIMEOUT_MS,
  maxInputBytes =
    OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES,
  maxResponseBytes =
    OPENAI_IMAGE_EDIT_MAX_RESPONSE_BYTES,
  fetchImpl = fetch,
  logEvent =
    logProviderRuntimeEvent
} = {}) {
  validateInputs({
    apiKey,
    imageBuffer,
    mimeType,
    instruction,
    model,
    quality,
    size,
    outputFormat,
    timeoutMs,
    maxInputBytes,
    maxResponseBytes,
    fetchImpl,
    logEvent
  });

  const controller =
    new AbortController();
  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );
  const startedAt = Date.now();
  let response = null;

  try {
    const form = new FormData();
    form.set("model", model);
    form.set(
      "prompt",
      instruction.trim()
    );
    form.set("quality", quality);
    form.set("size", size);
    form.set(
      "output_format",
      outputFormat
    );
    form.set("n", "1");

    const sourceBlob =
      new Blob(
        [imageBuffer],
        {
          type: mimeType
        }
      );

    form.append(
      "image[]",
      sourceBlob,
      `face-lab-source.${extensionForMimeType(mimeType)}`
    );

    try {
      response =
        await fetchImpl(
          OPENAI_IMAGE_EDITS_URL,
          {
            method: "POST",
            redirect: "manual",
            signal:
              controller.signal,
            headers: {
              Authorization:
                `Bearer ${apiKey.trim()}`
            },
            body: form
          }
        );
    } catch (error) {
      emitRuntimeEvent({
        logEvent,
        stage:
          "face-lab-simulation",
        status: null,
        ok: false,
        model,
        startedAt,
        errorCategory:
          error?.name ===
          "AbortError"
            ? "timeout"
            : "request_failed"
      });

      throw error;
    }

    if (
      [301, 302, 303, 307, 308]
        .includes(response.status)
    ) {
      emitRuntimeEvent({
        logEvent,
        stage:
          "face-lab-simulation",
        status: response.status,
        ok: false,
        model,
        startedAt,
        errorCategory:
          "redirect_rejected"
      });

      throw new Error(
        "provider_redirect_rejected"
      );
    }

    let rawText = "";
    let responseBytes = 0;

    try {
      const bounded =
        await readBoundedResponse(
          response,
          maxResponseBytes
        );

      rawText =
        bounded.rawText;
      responseBytes =
        bounded.responseBytes;
    } catch (error) {
      emitRuntimeEvent({
        logEvent,
        stage:
          "face-lab-simulation",
        status: response.status,
        ok: false,
        model,
        startedAt,
        errorCategory:
          error?.message ===
          "response_too_large"
            ? "response_too_large"
            : "invalid_response"
      });

      throw error;
    }

    if (!response.ok) {
      emitRuntimeEvent({
        logEvent,
        stage:
          "face-lab-simulation",
        status: response.status,
        ok: false,
        model,
        startedAt,
        errorCategory:
          "http_error",
        metadata: {
          responseBytes
        }
      });

      throw new Error(
        `provider_http_${response.status}`
      );
    }

    if (!rawText) {
      emitRuntimeEvent({
        logEvent,
        stage:
          "face-lab-simulation",
        status: response.status,
        ok: false,
        model,
        startedAt,
        errorCategory:
          "empty_response"
      });

      throw new Error(
        "provider_response_empty"
      );
    }

    let payload = null;
    let imageBytes = null;

    try {
      payload =
        JSON.parse(rawText);

      const base64 =
        payload?.data?.[0]
          ?.b64_json;

      imageBytes =
        decodeProviderImage(
          base64,
          maxInputBytes,
          imageMimeForOutputFormat(
            outputFormat
          )
        );
    } catch {
      emitRuntimeEvent({
        logEvent,
        stage:
          "face-lab-simulation",
        status: response.status,
        ok: false,
        model,
        startedAt,
        errorCategory:
          "invalid_response",
        metadata: {
          responseBytes
        }
      });

      throw new Error(
        "provider_response_invalid"
      );
    }

    const requestId =
      response.headers.get(
        "x-request-id"
      ) || null;

    emitRuntimeEvent({
      logEvent,
      stage:
        "face-lab-simulation",
      status: response.status,
      ok: true,
      model,
      startedAt,
      metadata: {
        responseBytes,
        outputBytes:
          imageBytes.length
      }
    });

    return {
      provider: "openai",
      model,
      status: response.status,
      requestId,
      imageBytes,
      mimeType:
        imageMimeForOutputFormat(
          outputFormat
        ),
      responseBytes,
      outputBytes:
        imageBytes.length,
      durationMs:
        Date.now() - startedAt,
      usage:
        isObject(payload?.usage)
          ? structuredClone(
              payload.usage
            )
          : null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}
