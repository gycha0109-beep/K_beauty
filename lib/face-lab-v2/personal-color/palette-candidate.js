import { PERSONAL_COLOR_OBSERVATION_VERSION } from "./observation.js";

// M2-B: deterministic, non-diagnostic preview from the M2-A *observed* channels.
// This is not an undertone/season classifier or evidence of flattering colors.
export const PERSONAL_COLOR_PALETTE_CANDIDATE_VERSION = "face-lab-personal-color-palette-candidate-v1";

const CHANNEL_VALUES = Object.freeze({
  apparentTemperature: ["warm", "neutral", "cool"],
  apparentBrightness: ["low", "medium", "high"],
  apparentSaturation: ["muted", "balanced", "clear"]
});

const REFERENCE_FAMILIES = Object.freeze({
  warm: Object.freeze({
    low: ["espresso", "rust", "ochre"],
    medium: ["caramel", "warm_taupe", "terracotta"],
    high: ["ivory", "apricot", "sand"]
  }),
  neutral: Object.freeze({
    low: ["charcoal_brown", "plum", "stone"],
    medium: ["rose_beige", "taupe", "mauve"],
    high: ["soft_white", "oat", "dusty_rose"]
  }),
  cool: Object.freeze({
    low: ["navy", "plum", "slate"],
    medium: ["cool_taupe", "dusty_blue", "berry"],
    high: ["soft_white", "lavender", "powder_blue"]
  })
});

const EXECUTION_FAMILIES = Object.freeze({
  warm: Object.freeze({ lip: "peach_terracotta", blush: "apricot", hair: "warm_brown" }),
  neutral: Object.freeze({ lip: "rose_beige", blush: "muted_rose", hair: "neutral_brown" }),
  cool: Object.freeze({ lip: "berry_rose", blush: "cool_rose", hair: "ash_brown" })
});

function held(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_PALETTE_CANDIDATE_VERSION,
    status: "insufficient_evidence",
    source: null,
    reason,
    paletteCandidate: null,
    executionPreview: null,
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    styleColorExecution: null,
    confidence: null,
    productOrShadeMatches: [],
    sourceImagePersisted: false
  };
}

function readChannel(observation, key) {
  const field = observation?.channels?.[key];
  if (
    field?.status !== "available" ||
    field.source !== "vision_observation" ||
    !CHANNEL_VALUES[key].includes(field.value) ||
    !Array.isArray(field.evidence) ||
    !field.evidence.some((item) => typeof item === "string" && item.trim())
  ) {
    return null;
  }
  return { value: field.value, evidence: field.evidence.filter((item) => typeof item === "string" && item.trim()).slice(0, 8) };
}

/**
 * Produce *exploration metadata*, never an approved color match.
 * Input must be an intact, suitable M2-A observation; missing/uncertain axes
 * are not backfilled from targetStyle, presentation, archetype or route.
 * Visual swatches, actual shade matching and user-facing suitability claims
 * remain gated on measurement and independent validation.
 */
export function buildPersonalColorPaletteCandidate(observation) {
  if (
    observation?.schemaVersion !== PERSONAL_COLOR_OBSERVATION_VERSION ||
    observation.status !== "available" ||
    observation.source !== "vision_observation" ||
    observation.colorSuitability !== "suitable" ||
    observation.observedColorCount !== 3 ||
    observation.sourceImagePersisted !== false
  ) {
    return held("observation_not_eligible");
  }

  if (!Array.isArray(observation.qualityFlags) || observation.qualityFlags.length > 0) {
    return held("photo_quality_uncertain");
  }

  const channels = {};
  for (const key of Object.keys(CHANNEL_VALUES)) {
    const observed = readChannel(observation, key);
    if (!observed) return held("required_color_channel_missing");
    channels[key] = observed;
  }

  const contrastField = observation.channels?.featureContrast;
  const contrast = contrastField?.status === "available" &&
    contrastField.source === "vision_observation" &&
    ["low", "medium", "high"].includes(contrastField.value) &&
    Array.isArray(contrastField.evidence) &&
    contrastField.evidence.some((item) => typeof item === "string" && item.trim())
    ? contrastField.value
    : null;

  const temperature = channels.apparentTemperature.value;
  const brightness = channels.apparentBrightness.value;
  const saturation = channels.apparentSaturation.value;

  return {
    schemaVersion: PERSONAL_COLOR_PALETTE_CANDIDATE_VERSION,
    status: "exploratory",
    source: "vision_observation",
    reason: null,
    paletteCandidate: {
      status: "exploratory",
      authority: "photo_appearance_reference_only",
      temperature,
      brightness,
      saturation,
      contrast,
      familyTokens: [...REFERENCE_FAMILIES[temperature][brightness]],
      chromaDirection: saturation === "muted" ? "softened" : saturation === "clear" ? "clearer" : "balanced",
      evidenceByChannel: Object.fromEntries(
        Object.entries(channels).map(([key, value]) => [key, [...value.evidence]])
      )
    },
    executionPreview: {
      status: "exploratory",
      authority: "not_product_or_shade_advice",
      lipColorFamily: EXECUTION_FAMILIES[temperature].lip,
      blushColorFamily: EXECUTION_FAMILIES[temperature].blush,
      hairColorFamily: EXECUTION_FAMILIES[temperature].hair
    },
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    styleColorExecution: null,
    confidence: null,
    productOrShadeMatches: [],
    sourceImagePersisted: false
  };
}
