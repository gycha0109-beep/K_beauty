import {
  COMPILED_PROMPT_SCHEMA_VERSION,
  FACE_FEATURE_CUE_REGISTRIES,
  PROMPT_COMPILER_VERSION
} from "@bejewely/face-contracts";
import { deepFreeze, finalizeGenerationSpec, sha256Hex, stableStringify } from "./canonicalize-generation-spec.js";
import { resolveProviderProfile } from "./providers/provider-profiles.js";
import { resolveExclusionRegistry } from "./registries/exclusions-v1.js";

const EXCLUSION_PROSE = Object.freeze({
  beauty_filter: "beauty filters",
  airbrushed_skin: "airbrushed or flawless skin",
  heavy_retouching: "heavy retouching",
  glam_makeup: "glam makeup",
  dramatic_lighting: "dramatic lighting",
  smile: "smiling",
  head_tilt: "head tilt",
  side_view: "side view",
  hair_occlusion: "hair covering the face",
  stylized_rendering: "stylized rendering",
  illustration: "illustration",
  text: "text",
  labels: "labels",
  logo: "logos",
  watermark: "watermarks",
  symbol: "symbols",
  bare_shoulders: "bare shoulders"
});

const FEATURE_PROMPT = Object.freeze({
  faceShape: Object.freeze({
    oval: "an oval visible face outline",
    round: "a round visible face outline",
    square: "a square visible face outline",
    oblong: "an oblong visible face outline",
    heart: "a heart-shaped visible face outline",
    diamond: "a diamond-shaped visible face outline",
    triangle: "a triangular visible face outline",
    mixed: "a visibly mixed face-outline shape without one dominant canonical shape"
  }),
  jawlineAngularity: Object.freeze({
    soft: "a soft jawline contour",
    moderate: "a moderately defined jawline contour",
    angular: "an angular jawline contour"
  }),
  jawTaper: Object.freeze({
    tapered: "a visibly tapered jaw toward the chin",
    balanced: "a balanced jaw taper",
    broad: "a visibly broad jaw taper toward the lower face"
  }),
  cheekboneProminence: Object.freeze({
    subtle: "subtle visible cheekbone prominence",
    moderate: "moderate visible cheekbone prominence",
    prominent: "prominent visible cheekbones"
  }),
  faceLengthBalance: Object.freeze({
    short: "a visibly short face-length balance",
    balanced: "a balanced face-length proportion",
    long: "a visibly long face-length balance"
  }),
  eyeDirection: Object.freeze({
    upturned: "an upturned visible eye direction",
    level: "a level visible eye direction",
    downturned: "a downturned visible eye direction",
    mixed: "a visibly mixed eye direction between the two eyes"
  }),
  eyeLength: Object.freeze({
    short: "visibly short horizontal eye length",
    medium: "medium horizontal eye length",
    long: "visibly long horizontal eye length"
  }),
  eyeOpenness: Object.freeze({
    narrow: "narrow visible eye openness",
    medium: "medium visible eye openness",
    wide: "wide visible eye openness"
  }),
  featureScale: Object.freeze({
    small: "predominantly small visible facial feature scale",
    medium: "predominantly medium visible facial feature scale",
    large: "predominantly large visible facial feature scale",
    mixed: "a visibly mixed facial feature scale without one dominant size"
  }),
  featureConcentration: Object.freeze({
    spread: "facial features visibly distributed toward a spread layout",
    balanced: "a balanced visible facial feature layout",
    centered: "facial features visibly concentrated toward the center"
  }),
  straightCurveBalance: Object.freeze({
    curved: "a predominantly curved facial line balance",
    balanced: "a balanced straight-and-curved facial line mix",
    straight: "a predominantly straight facial line balance"
  }),
  contourDefinition: Object.freeze({
    soft: "soft visible facial contour definition",
    moderate: "moderate visible facial contour definition",
    defined: "clearly defined visible facial contours"
  }),
  featureContrast: Object.freeze({
    low: "low visible feature contrast",
    medium: "medium visible feature contrast",
    high: "high visible feature contrast"
  })
});

const PRESENTATION_PROSE = Object.freeze({
  feminine: "feminine",
  masculine: "masculine",
  androgynous: "androgynous"
});

function createBaseSections(spec) {
  const regional = spec.subject.regionalAppearanceHint === "korean_appearance_hint"
    ? " with a Korean appearance hint"
    : "";
  return [
    `Create a realistic documentary-style reference portrait of one synthetic adult person in their ${spec.subject.adultAgeBand}${regional}, with ${PRESENTATION_PROSE[spec.subject.presentation]} presentation.`,
    "Show a direct frontal head-and-shoulders portrait with the full head, neck, and upper shoulders visible. The person looks straight at the camera with a neutral expression. Use a plain light-gray background, soft even diffuse lighting, natural white balance, sharp facial focus, and a square 1:1 composition.",
    "Use dark brown to black hair tied back and kept completely away from the forehead and cheeks. The person wears a plain medium-gray crew-neck top. No glasses, jewelry, visible accessories, or visible makeup."
  ];
}

function error(code, path) {
  return Object.freeze({ code, path });
}

function compileFeatureSection(featureIntent) {
  if (!featureIntent) {
    return null;
  }
  if (!FACE_FEATURE_CUE_REGISTRIES[featureIntent.cueProfileVersion]) {
    return null;
  }
  const phrases = Object.keys(featureIntent.cues)
    .sort()
    .map((axis) => {
      const cue = featureIntent.cues[axis];
      const phrase = FEATURE_PROMPT[axis]?.[cue.value];
      return cue.strength === "subtle" ? `${phrase} at subtle strength` : phrase;
    });
  return phrases.length
    ? `Use only these controlled visible facial cues: ${phrases.join("; ")}. Keep them realistic and not exaggerated.`
    : null;
}

function compileSkinSection(skinIntent) {
  const redness = skinIntent.redness.severity === "mild";
  const blemishes = skinIntent.blemishes.severity === "mild";

  if (!redness && !blemishes) {
    return "Preserve natural clear skin with visible pores and normal tonal variation. Do not make the skin flawless, airbrushed, or plastic. Show no noticeable diffuse redness on the cheeks or around the nose and no visible inflamed or discrete blemishes.";
  }
  if (redness && !blemishes) {
    return "Preserve natural unretouched skin texture and visible pores. Show mild diffuse redness limited to both cheeks and the sides of the nose. Do not show pimples, pustules, inflamed spots, or discrete blemishes anywhere on the face. Keep the redness subtle, realistic, and clearly observable.";
  }
  if (!redness && blemishes) {
    return "Preserve natural unretouched skin texture and visible pores with an otherwise even skin tone. Show only three to five small, subtle, discrete blemishes on the cheeks and chin. Do not add diffuse redness on the cheeks or around the nose.";
  }
  return "Preserve natural unretouched skin texture and visible pores. Show mild diffuse redness limited to both cheeks and the sides of the nose, plus only three to five small, subtle, discrete blemishes on the cheeks and chin. Keep the two cues realistic, clearly distinguishable, and not severe.";
}

function compileReferenceSection(variation) {
  if (variation.pairingMode !== "reference_edit") {
    return null;
  }
  return "Use the supplied reference image as the identity and composition source. Keep identity, framing, pose, gaze, expression, hair, clothing, background, lighting, and camera perspective unchanged. Modify only the requested skin cues.";
}

function compileExclusions(exclusions) {
  return exclusions.map((token) => EXCLUSION_PROSE[token]);
}

function createOperatorInstructions(profile, finalizedSpec) {
  const instructions = [
    "Generate one candidate image only; the output remains a candidate and is not an observed label or Gold asset.",
    "Record the actual Provider surface, model label, generation time, and output filename during candidate import."
  ];
  if (profile.executionMode === "manual_web") {
    instructions.unshift("Copy the positive prompt exactly into the manual Provider surface without adding free-text instructions.");
  }
  if (profile.status === "reference_only") {
    instructions.push("This profile is reference-only and must not be selected as the default campaign generation path.");
  }
  instructions.push(`Associate the output with finalized spec ${finalizedSpec.specId}.`);
  return instructions;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function compileGenerationPrompt({ draftSpec, providerProfileId }) {
  const finalized = finalizeGenerationSpec(draftSpec);
  if (!finalized.ok) {
    return Object.freeze({ ok: false, errors: finalized.errors });
  }

  const profile = resolveProviderProfile(providerProfileId);
  if (!profile) {
    return Object.freeze({ ok: false, errors: Object.freeze([error("unsupported_provider_profile", "providerProfileId")]) });
  }
  if (profile.status === "disabled") {
    return Object.freeze({ ok: false, errors: Object.freeze([error("provider_profile_disabled", "providerProfileId")]) });
  }
  if (draftSpec.variation.pairingMode === "reference_edit" && !profile.capabilities.referenceImage) {
    return Object.freeze({ ok: false, errors: Object.freeze([error("reference_capability_required", "variation.pairingMode")]) });
  }

  const exclusions = resolveExclusionRegistry(draftSpec.exclusionPolicyVersion);
  if (!exclusions) {
    return Object.freeze({ ok: false, errors: Object.freeze([error("unsafe_exclusion_override", "exclusionPolicyVersion")]) });
  }

  const sections = createBaseSections(draftSpec);
  const feature = compileFeatureSection(draftSpec.featureIntent);
  if (feature) {
    sections.push(feature);
  }
  sections.push(compileSkinSection(draftSpec.skinIntent));
  sections.push("Keep realistic facial structure, slight natural asymmetry, and analysis-friendly photographic detail. This is not a beauty advertisement, fashion editorial, diagnostic image, or identity claim.");
  const reference = compileReferenceSection(draftSpec.variation);
  if (reference) {
    sections.push(reference);
  }

  const exclusionPhrases = compileExclusions(exclusions);
  let negativePrompt = null;
  if (profile.capabilities.separateNegativePrompt) {
    negativePrompt = exclusionPhrases.join(", ");
  } else {
    sections.push(`Do not add ${exclusionPhrases.join(", ")}.`);
  }
  sections.push("Create a clean, neutral, analysis-friendly reference photograph with no text or interface elements.");

  const promptWithoutDigest = {
    schemaVersion: COMPILED_PROMPT_SCHEMA_VERSION,
    specId: finalized.finalizedSpec.specId,
    specDigest: finalized.specDigest,
    compilerVersion: PROMPT_COMPILER_VERSION,
    templateVersion: profile.templateVersion,
    providerProfile: {
      id: profile.id,
      version: profile.version,
      executionMode: profile.executionMode
    },
    content: {
      positivePrompt: sections.join("\n\n"),
      negativePrompt,
      operatorInstructions: createOperatorInstructions(profile, finalized.finalizedSpec),
      parameterHints: clone(profile.parameterHints)
    }
  };
  const promptDigest = sha256Hex(stableStringify(promptWithoutDigest));
  const compiledPrompt = deepFreeze({ ...promptWithoutDigest, promptDigest });

  return Object.freeze({
    ok: true,
    canonicalSpec: deepFreeze({
      finalizedSpec: finalized.finalizedSpec,
      canonicalJson: finalized.canonicalJson,
      specDigest: finalized.specDigest
    }),
    compiledPrompt
  });
}
