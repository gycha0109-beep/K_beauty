export const PROVIDER_PROFILES = Object.freeze({
  "gemini-image-manual-v1": Object.freeze({
    id: "gemini-image-manual-v1",
    version: "1.0.0",
    providerFamily: "gemini_image",
    executionMode: "manual_web",
    status: "active_pilot",
    capabilities: Object.freeze({
      separateNegativePrompt: false,
      referenceImage: false,
      seed: false,
      structuredParameters: false
    }),
    templateVersion: "reference-portrait-prose-v1",
    parameterHints: Object.freeze({})
  }),
  "gpt-image-manual-v1": Object.freeze({
    id: "gpt-image-manual-v1",
    version: "1.0.0",
    providerFamily: "gpt_image",
    executionMode: "manual_web",
    status: "active_pilot",
    capabilities: Object.freeze({
      separateNegativePrompt: false,
      referenceImage: false,
      seed: false,
      structuredParameters: false
    }),
    templateVersion: "reference-portrait-prose-v1",
    parameterHints: Object.freeze({})
  }),
  "sdxl-comfyui-reference-v1": Object.freeze({
    id: "sdxl-comfyui-reference-v1",
    version: "1.0.0",
    providerFamily: "sdxl_comfyui",
    executionMode: "local_workflow",
    status: "reference_only",
    capabilities: Object.freeze({
      separateNegativePrompt: true,
      referenceImage: false,
      seed: true,
      structuredParameters: true
    }),
    templateVersion: "reference-portrait-sdxl-v1",
    parameterHints: Object.freeze({
      width: 1024,
      height: 1024,
      steps: 30,
      cfg: 5.5,
      sampler: "dpmpp_2m",
      scheduler: "karras",
      skinLoraModelStrength: 0.4,
      skinLoraClipStrength: 0.2
    })
  })
});

export function resolveProviderProfile(id) {
  return PROVIDER_PROFILES[id] || null;
}
