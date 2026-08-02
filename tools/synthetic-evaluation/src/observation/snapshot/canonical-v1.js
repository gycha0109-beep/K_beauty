import { deepFreeze, sha256Hex, stableStringify } from "../../generation/canonicalize-generation-spec.js";

export const OBSERVATION_SOURCE = deepFreeze({
  repository: "gycha0109-beep/K_beauty",
  commitSha: "f050b1d5f72588a1ce6a0a8e5fa42b92d0a8a893",
  files: [
    { path: "lib/image-analysis-eligibility.js", blobSha: "d26786748bfdc10d8820d4853d0677c9d96236c1" },
    { path: "lib/face-lab-observation-contract.js", blobSha: "94315afc85f35e6bee3a5ea149895c875ed9d25a" },
    { path: "lib/vision-observation-contract.js", blobSha: "4d0956b96daa57c0e0bb3a0f6de15b69775a22ed" },
    { path: "lib/vision-observation-normalizer.js", blobSha: "9768c1fa284451c033e1aad02998e7cd6ae4cd9e" }
  ]
});

export const OBSERVATION_VERSIONS = deepFreeze({
  visionSchemaVersion: "vision-observation-v1",
  visionPromptVersion: "vision-observation-prompt-v1",
  faceSchemaVersion: "face-lab-observation-v1",
  facePromptVersion: "face-lab-observation-prompt-v1"
});

export const OBSERVATION_SEMANTIC_EXPORT = deepFreeze({
  eligibility: {
    statuses: ["eligible", "insufficient_evidence", "ineligible"],
    imageTypes: ["photorealistic_human", "non_photorealistic_human", "product", "animal", "document", "landscape", "other", "unknown"],
    faceFailureReasons: ["face_not_detected", "multiple_faces", "non_photorealistic_face", "face_too_small", "face_occluded", "face_angle_unsupported", "image_quality_insufficient", "eligibility_response_invalid", "unknown"],
    skinFailureReasons: ["skin_not_visible", "face_not_detected", "multiple_faces", "non_photorealistic_face", "face_too_small", "skin_occluded", "heavy_filter_or_editing", "lighting_insufficient", "image_quality_insufficient", "eligibility_response_invalid", "unknown"]
  },
  skin: {
    signalAxes: ["barrier", "dehydration", "oiliness", "redness", "acne", "pores", "uneven_tone", "uv"],
    observationKeys: ["oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"],
    areas: ["full_face", "t_zone", "forehead", "nose", "cheeks", "chin", "jawline", "eye_area", "unknown"],
    cues: ["surface_shine", "dry_texture", "visible_flaking", "red_appearance", "active_spots", "pore_visibility", "tone_variation", "surface_stress", "uncertain"],
    levels: ["low", "mild", "moderate", "high"],
    confidenceLevels: ["low", "medium", "high"]
  },
  face: {
    visibility: ["clear", "partial", "uncertain"],
    fieldFailureReasons: ["not_visible", "occluded", "angle_unsupported", "quality_insufficient", "ambiguous", "evidence_missing", "value_invalid"],
    quality: {
      faceVisibility: ["clear", "partial", "poor"],
      faceScale: ["adequate", "small", "too_large"],
      sharpness: ["clear", "soft", "blurred"],
      exposure: ["balanced", "underexposed", "overexposed", "mixed"],
      lightingUniformity: ["even", "uneven", "harsh"],
      whiteBalance: ["stable", "warm_cast", "cool_cast", "mixed_cast", "unknown"],
      filterOrEditing: ["none_detected", "possible", "heavy", "unknown"],
      makeupCoverage: ["none_or_light", "moderate", "heavy", "unknown"],
      structureSuitability: ["suitable", "limited", "unsuitable"],
      colorSuitability: ["suitable", "limited", "unsuitable"]
    },
    pose: {
      yaw: ["frontal", "slight_left", "slight_right", "profile_left", "profile_right", "unknown"],
      pitch: ["level", "up", "down", "unknown"],
      roll: ["level", "tilted", "unknown"]
    },
    occlusion: ["none", "partial", "heavy"],
    definitions: {
      outline: {
        faceShape: ["oval", "round", "square", "oblong", "heart", "diamond", "triangle", "mixed"],
        foreheadWidthVsCheek: ["narrower", "similar", "wider"],
        jawWidthVsCheek: ["narrower", "similar", "wider"],
        jawlineAngularity: ["soft", "moderate", "angular"],
        jawTaper: ["tapered", "balanced", "broad"],
        cheekboneProminence: ["subtle", "moderate", "prominent"]
      },
      vertical: {
        faceLengthBalance: ["short", "balanced", "long"],
        foreheadHeight: ["low", "balanced", "high"],
        midfaceLength: ["short", "balanced", "long"],
        lowerFaceLength: ["short", "balanced", "long"]
      },
      eyes: {
        eyeDirection: ["upturned", "level", "downturned", "mixed"],
        eyeLength: ["short", "medium", "long"],
        eyeOpenness: ["narrow", "medium", "wide"]
      },
      featureLayout: {
        featureScale: ["small", "medium", "large", "mixed"],
        featureConcentration: ["spread", "balanced", "centered"],
        focalFeatures: ["eyes", "brows", "nose", "lips", "cheekbones", "jawline", "forehead"]
      },
      visualLanguage: {
        straightCurveBalance: ["curved", "balanced", "straight"],
        contourDefinition: ["soft", "moderate", "defined"],
        featureContrast: ["low", "medium", "high"]
      },
      colorAppearance: {
        apparentTemperature: ["warm", "neutral", "cool"],
        apparentBrightness: ["low", "medium", "high"],
        apparentSaturation: ["muted", "balanced", "clear"]
      }
    },
    coreGroupMinimums: { outline: 3, vertical: 2, eyes: 2, featureLayout: 1, visualLanguage: 2 }
  }
});

function facePromptContract() {
  const scalar = (values) => ({ value: values.join(" | "), visibility: "clear | partial | uncertain", evidence: ["short visible fact"], unavailableReason: null });
  const array = (values) => ({ value: [`one or more of: ${values.join(" | ")}`], visibility: "clear | partial | uncertain", evidence: ["short visible fact"], unavailableReason: null });
  const definitions = OBSERVATION_SEMANTIC_EXPORT.face.definitions;
  return {
    quality: {
      faceVisibility: "clear | partial | poor",
      faceScale: "adequate | small | too_large",
      pose: { yaw: "frontal | slight_left | slight_right | profile_left | profile_right | unknown", pitch: "level | up | down | unknown", roll: "level | tilted | unknown" },
      occlusion: { forehead: "none | partial | heavy", brows: "none | partial | heavy", eyes: "none | partial | heavy", cheeks: "none | partial | heavy", jawline: "none | partial | heavy" },
      sharpness: "clear | soft | blurred",
      exposure: "balanced | underexposed | overexposed | mixed",
      lightingUniformity: "even | uneven | harsh",
      whiteBalance: "stable | warm_cast | cool_cast | mixed_cast | unknown",
      filterOrEditing: "none_detected | possible | heavy | unknown",
      makeupCoverage: "none_or_light | moderate | heavy | unknown",
      structureSuitability: "suitable | limited | unsuitable",
      colorSuitability: "suitable | limited | unsuitable",
      evidence: ["short visible fact"]
    },
    observations: Object.fromEntries(Object.entries(definitions).map(([group, fields]) => [
      group,
      Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, group === "featureLayout" && key === "focalFeatures" ? array(values) : scalar(values)]))
    ]))
  };
}

export function createPinnedObservationPrompt() {
  const skin = OBSERVATION_SEMANTIC_EXPORT.skin;
  const skinContract = {
    signals: Object.fromEntries(skin.signalAxes.map((axis) => [axis, "integer 0-5"])),
    observations: [{
      key: skin.observationKeys.join(" | "),
      area: skin.areas.join(" | "),
      cue: skin.cues.join(" | "),
      level: skin.levels.join(" | "),
      confidence: skin.confidenceLevels.join(" | ")
    }]
  };
  return `
You extract locale-neutral visible observations from one uploaded image.
Return only valid JSON. Do not use markdown. Do not add keys outside the contract.
This is not medical diagnosis, identity recognition, personality inference, attractiveness scoring, or physiognomy.

Required JSON shape:
{
  "schemaVersion": "vision-observation-v1",
  "eligibility": {
    "status": "eligible | insufficient_evidence | ineligible",
    "source": "vision",
    "imageType": "photorealistic_human | non_photorealistic_human | product | animal | document | landscape | other | unknown",
    "humanFaceCount": 1,
    "faceLabEligible": true,
    "skinAnalysisEligible": true,
    "faceLabFailureReason": null,
    "skinFailureReason": null,
    "confidence": 0.95,
    "evidence": ["short visible fact supporting the eligibility decision"]
  },
  "skin": ${JSON.stringify(skinContract, null, 2)},
  "face": ${JSON.stringify(facePromptContract(), null, 2)}
}

Global rules:
- Observe the image only. Do not use survey answers, locale, products, brands, recommendations, or user identity.
- Return enum tokens exactly as listed in the contract.
- Do not generate user-facing prose, product advice, hairstyle advice, color palettes, celebrity matches, archetypes, animal types, behavior, character, or emotional traits.
- Do not include image bytes, URLs, crops, base64, names, or identity claims.
- If the image is unclear, reduce confidence and mark unsupported fields uncertain instead of guessing.
- Skin and face sections are independent: one may be usable when the other is not.

Eligibility rules:
- Decide eligibility before producing any face or skin analysis.
- Classify the actual uploaded image. Do not assume it contains a person because the task asks for a face analysis.
- A product, animal, document, landscape, illustration, animation, painting, avatar, or 3D character is not a photorealistic human.
- Both analyses require exactly one real human face. Zero faces or an uncertain face count must not be eligible. More than one face uses multiple_faces.
- Face Lab may be eligible while skin analysis is not when facial structure is visible but skin is obscured, heavily filtered, poorly lit, or too low quality.
- Set status to eligible when at least one analysis is eligible, insufficient_evidence only for one photorealistic face that is unusable for both analyses, and ineligible otherwise.
- source must be vision. confidence must be between 0 and 1. evidence must contain at least one short visible fact.
- If an analysis is not eligible, return empty downstream text and arrays and zero skin signal scores for that analysis.

Skin rules:
- Every skin signal must be an integer from 0 to 5.
- Use 0 when the skin analysis is ineligible or a signal is unsupported.
- Return at most 4 skin observations.
- Observations must use only the listed key, area, cue, level, and confidence enums.
- Do not infer hydration, barrier state, acne disease, UV damage, or sensitivity beyond cautious visible cues.
- Makeup, filters, blur, lighting, and occlusion must reduce confidence.

Face rules:
- Return locale-neutral enum tokens exactly as listed.
- Describe only visible facial structure and image quality.
- Do not generate archetypes, animal types, affinity scores, personality, physiognomy, celebrity similarity, hairstyle, makeup, color palette, clothing, or final style recommendations.
- Every non-null observation requires at least one short visible evidence fact.
- Use null with uncertain visibility when the feature cannot be supported.
- focalFeatures.value must be an array of listed enum tokens; all other observation values are scalar enum tokens.
- faceVisibility poor must not be paired with structureSuitability suitable.
- Do not include image bytes, URLs, crops, base64 data, names, or identity claims.
`.trim();
}

export const OBSERVATION_SEMANTIC_EXPORT_DIGEST = sha256Hex(stableStringify(OBSERVATION_SEMANTIC_EXPORT));
export const OBSERVATION_PROMPT = createPinnedObservationPrompt();
export const OBSERVATION_PROMPT_DIGEST = sha256Hex(OBSERVATION_PROMPT);

const snapshotSemantic = {
  schemaVersion: "observation-contract-snapshot-v1",
  source: OBSERVATION_SOURCE,
  versions: OBSERVATION_VERSIONS,
  semanticExportDigest: OBSERVATION_SEMANTIC_EXPORT_DIGEST,
  promptDigest: OBSERVATION_PROMPT_DIGEST,
  capabilities: { eligibility: true, skinObservation: true, faceObservation: true, archetype: false, styling: false }
};
const snapshotDigest = sha256Hex(stableStringify(snapshotSemantic));

export const CANONICAL_OBSERVATION_SNAPSHOT = deepFreeze({
  ...snapshotSemantic,
  snapshotId: `obsc_${snapshotDigest.slice(0, 24)}`,
  snapshotDigest
});

export function verifyCanonicalObservationSnapshot(snapshot = CANONICAL_OBSERVATION_SNAPSHOT) {
  if (!snapshot || snapshot.schemaVersion !== "observation-contract-snapshot-v1") {
    return { ok: false, code: "contract_snapshot_missing" };
  }
  const semantic = {
    schemaVersion: snapshot.schemaVersion,
    source: snapshot.source,
    versions: snapshot.versions,
    semanticExportDigest: snapshot.semanticExportDigest,
    promptDigest: snapshot.promptDigest,
    capabilities: snapshot.capabilities
  };
  const digest = sha256Hex(stableStringify(semantic));
  if (digest !== snapshot.snapshotDigest || snapshot.snapshotId !== `obsc_${digest.slice(0, 24)}`) {
    return { ok: false, code: "contract_snapshot_digest_mismatch" };
  }
  if (snapshot.semanticExportDigest !== sha256Hex(stableStringify(OBSERVATION_SEMANTIC_EXPORT)) || snapshot.promptDigest !== sha256Hex(OBSERVATION_PROMPT)) {
    return { ok: false, code: "contract_source_version_mismatch" };
  }
  return { ok: true };
}
