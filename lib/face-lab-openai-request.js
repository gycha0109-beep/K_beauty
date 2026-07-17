export const FACE_LAB_OPENAI_MAX_COMPLETION_TOKENS = 1400;
export const FACE_LAB_OPENAI_IMAGE_DETAIL = "low";

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }

  return value;
}

export function buildFaceLabOpenAiRequest({
  model,
  systemPrompt,
  userText,
  imageDataUrl
} = {}) {
  return {
    model: requireNonEmptyString(model, "model"),
    max_completion_tokens: FACE_LAB_OPENAI_MAX_COMPLETION_TOKENS,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: requireNonEmptyString(systemPrompt, "systemPrompt")
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: requireNonEmptyString(userText, "userText")
          },
          {
            type: "image_url",
            image_url: {
              url: requireNonEmptyString(imageDataUrl, "imageDataUrl"),
              detail: FACE_LAB_OPENAI_IMAGE_DETAIL
            }
          }
        ]
      }
    ]
  };
}
