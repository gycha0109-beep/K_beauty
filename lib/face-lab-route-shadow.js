import { buildFaceLabStructuredData } from "@/lib/face-lab-launch";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanProviderString(value, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  const cleaned = value.trim().replace(/\s+/g, " ");
  if (
    !cleaned ||
    /^data:image\//i.test(cleaned) ||
    /base64,/i.test(cleaned)
  ) {
    return "";
  }

  return cleaned.slice(0, maxLength);
}

function cleanProviderList(value, limit, maxItemLength = 500) {
  return Array.isArray(value)
    ? value
        .map((item) => cleanProviderString(item, maxItemLength))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function cleanPresentationHint(value) {
  const normalized = cleanProviderString(value, 16).toLowerCase();
  return normalized === "masculine" ||
    normalized === "feminine" ||
    normalized === "neutral"
    ? normalized
    : "";
}

export function createFaceLabLegacyInsufficientPayload(
  parsed,
  locale,
  analysis
) {
  const baseData = isObject(parsed?.base_data) ? parsed.base_data : {};
  const features = isObject(parsed?.features) ? parsed.features : {};
  const physiognomy = isObject(features.physiognomy)
    ? features.physiognomy
    : {};
  const hairstyle = isObject(features.face_shape_hairstyle)
    ? features.face_shape_hairstyle
    : {};
  const colorTone = isObject(features.color_tone_recommendation)
    ? features.color_tone_recommendation
    : {};
  const colorValues = isObject(baseData.color_values)
    ? baseData.color_values
    : {};

  const safeLegacyPayload = {
    base_data: {
      landmarks: cleanProviderList(baseData.landmarks, 4),
      face_shape: cleanProviderString(baseData.face_shape),
      presentation_hint: cleanPresentationHint(baseData.presentation_hint),
      embedding: cleanProviderList(baseData.embedding, 4),
      color_values: {
        undertone: cleanProviderString(colorValues.undertone),
        brightness: cleanProviderString(colorValues.brightness),
        contrast: cleanProviderString(colorValues.contrast),
        saturation: cleanProviderString(colorValues.saturation)
      }
    },
    features: {
      physiognomy: {
        headline_label: cleanProviderString(physiognomy.headline_label),
        headline_result: cleanProviderString(physiognomy.headline_result),
        overall_impression: cleanProviderString(physiognomy.overall_impression),
        interpretation_axes: cleanProviderList(
          physiognomy.interpretation_axes,
          2
        ),
        feature_based_interpretation: cleanProviderList(
          physiognomy.feature_based_interpretation,
          4
        ),
        real_tendency: cleanProviderList(physiognomy.real_tendency, 2),
        strengths: cleanProviderList(physiognomy.strengths, 3),
        cautions: cleanProviderList(physiognomy.cautions, 2)
      },
      face_shape_hairstyle: {
        summary: cleanProviderString(hairstyle.summary),
        recommendations: cleanProviderList(hairstyle.recommendations, 3),
        avoid: cleanProviderList(hairstyle.avoid, 2)
      },
      lookalike_celebrities: {
        summary: "",
        matches: []
      },
      color_tone_recommendation: {
        summary: cleanProviderString(colorTone.summary),
        palette: cleanProviderList(colorTone.palette, 4),
        recommendations: cleanProviderList(colorTone.recommendations, 3),
        avoid: cleanProviderList(colorTone.avoid, 2)
      }
    }
  };

  return {
    ...safeLegacyPayload,
    structured: buildFaceLabStructuredData(safeLegacyPayload, locale),
    analysis
  };
}
