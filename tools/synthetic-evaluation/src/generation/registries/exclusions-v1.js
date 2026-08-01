import { EXCLUSION_POLICY_VERSION } from "@bejewely/face-contracts";

export const REFERENCE_PORTRAIT_EXCLUSIONS_V1 = Object.freeze([
  "beauty_filter",
  "airbrushed_skin",
  "heavy_retouching",
  "glam_makeup",
  "dramatic_lighting",
  "smile",
  "head_tilt",
  "side_view",
  "hair_occlusion",
  "stylized_rendering",
  "illustration",
  "text",
  "labels",
  "logo",
  "watermark",
  "symbol",
  "bare_shoulders"
]);

const EXCLUSION_REGISTRIES = Object.freeze({
  [EXCLUSION_POLICY_VERSION]: REFERENCE_PORTRAIT_EXCLUSIONS_V1
});

export function resolveExclusionRegistry(version) {
  return EXCLUSION_REGISTRIES[version] || null;
}
