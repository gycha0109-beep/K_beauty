import {
  createImageAnalysisEligibilityPromptContract,
  createImageAnalysisEligibilityRules
} from "./image-analysis-eligibility.js";
import {
  createFaceLabObservationPromptContract,
  createFaceLabObservationPromptRules
} from "./face-lab-observation-contract.js";

export const VISION_OBSERVATION_SCHEMA_VERSION = "vision-observation-v1";
export const VISION_OBSERVATION_PROMPT_VERSION = "vision-observation-prompt-v1";

export const VISION_SKIN_SIGNAL_AXES = Object.freeze([
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
]);

export const VISION_SKIN_OBSERVATION_KEYS = Object.freeze([
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier"
]);

export const VISION_SKIN_AREAS = Object.freeze([
  "full_face",
  "t_zone",
  "forehead",
  "nose",
  "cheeks",
  "chin",
  "jawline",
  "eye_area",
  "unknown"
]);

export const VISION_SKIN_CUES = Object.freeze([
  "surface_shine",
  "dry_texture",
  "visible_flaking",
  "red_appearance",
  "active_spots",
  "pore_visibility",
  "tone_variation",
  "surface_stress",
  "uncertain"
]);

export const VISION_SKIN_LEVELS = Object.freeze(["low", "mild", "moderate", "high"]);
export const VISION_CONFIDENCE_LEVELS = Object.freeze(["low", "medium", "high"]);

function createSkinPromptContract() {
  return {
    signals: Object.fromEntries(VISION_SKIN_SIGNAL_AXES.map((axis) => [axis, "integer 0-5"])),
    observations: [
      {
        key: VISION_SKIN_OBSERVATION_KEYS.join(" | "),
        area: VISION_SKIN_AREAS.join(" | "),
        cue: VISION_SKIN_CUES.join(" | "),
        level: VISION_SKIN_LEVELS.join(" | "),
        confidence: VISION_CONFIDENCE_LEVELS.join(" | ")
      }
    ]
  };
}

export function createVisionObservationPrompt() {
  const faceContract = createFaceLabObservationPromptContract();

  return `
You extract locale-neutral visible observations from one uploaded image.
Return only valid JSON. Do not use markdown. Do not add keys outside the contract.
This is not medical diagnosis, identity recognition, personality inference, attractiveness scoring, or physiognomy.

Required JSON shape:
{
  "schemaVersion": "${VISION_OBSERVATION_SCHEMA_VERSION}",
  ${createImageAnalysisEligibilityPromptContract()},
  "skin": ${JSON.stringify(createSkinPromptContract(), null, 2)},
  "face": ${JSON.stringify(faceContract, null, 2)}
}

Global rules:
- Observe the image only. Do not use survey answers, locale, products, brands, recommendations, or user identity.
- Return enum tokens exactly as listed in the contract.
- Do not generate user-facing prose, product advice, hairstyle advice, color palettes, celebrity matches, archetypes, animal types, behavior, character, or emotional traits.
- Do not include image bytes, URLs, crops, base64, names, or identity claims.
- If the image is unclear, reduce confidence and mark unsupported fields uncertain instead of guessing.
- Skin and face sections are independent: one may be usable when the other is not.

Eligibility rules:
${createImageAnalysisEligibilityRules()}

Skin rules:
- Every skin signal must be an integer from 0 to 5.
- Use 0 when the skin analysis is ineligible or a signal is unsupported.
- Return at most 4 skin observations.
- Observations must use only the listed key, area, cue, level, and confidence enums.
- Do not infer hydration, barrier state, acne disease, UV damage, or sensitivity beyond cautious visible cues.
- Makeup, filters, blur, lighting, and occlusion must reduce confidence.

Face rules:
${createFaceLabObservationPromptRules()}
`.trim();
}
