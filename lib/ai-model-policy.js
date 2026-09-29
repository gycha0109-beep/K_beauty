export const OPENAI_RUNTIME_MODEL_POLICY_VERSION =
  "openai-runtime-model-policy-v1";

export const OPENAI_RUNTIME_MODEL = "gpt-5.6-luna";

export const OPENAI_RUNTIME_REASONING_EFFORT = "none";

export const OPENAI_RUNTIME_MODELS = Object.freeze([
  OPENAI_RUNTIME_MODEL
]);

export function resolveOpenAiRuntimeModel() {
  return OPENAI_RUNTIME_MODEL;
}
