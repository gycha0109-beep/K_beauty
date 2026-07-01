import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";

const AVAILABLE = "available";
const UNAVAILABLE = "unavailable";

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : null;
}

function cleanStringList(values, limit) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map(cleanString).filter(Boolean))].slice(0, limit);
}

function sanitizeStyleDirections(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const key = cleanString(item.key);
      const title = cleanString(item.title);
      const summary = cleanString(item.summary);

      if (!key || !title || !summary) {
        return null;
      }

      return {
        key: key || `style-${index + 1}`,
        title,
        summary
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function buildRawStyleDirections(faceLabResult, locale = "ko") {
  const directDirections = sanitizeStyleDirections(faceLabResult?.styleDirections);
  if (directDirections.length) {
    return directDirections;
  }

  const recommendationLines = cleanStringList(
    [
      ...(Array.isArray(faceLabResult?.features?.face_shape_hairstyle?.recommendations)
        ? faceLabResult.features.face_shape_hairstyle.recommendations
        : []),
      ...(Array.isArray(faceLabResult?.features?.color_tone_recommendation?.recommendations)
        ? faceLabResult.features.color_tone_recommendation.recommendations
        : [])
    ],
    3
  );

  return recommendationLines.map((summary, index) => ({
    key: `raw-style-direction-${index + 1}`,
    title: locale === "en" ? `Style direction ${index + 1}` : `표현 방향 ${index + 1}`,
    summary
  }));
}

function buildRawDisplaySummary(faceLabResult, options = {}) {
  const locale = options.locale === "en" ? "en" : "ko";
  const impressionTitle = cleanString(
    faceLabResult?.impressionTitle ||
      faceLabResult?.base_data?.impressionTitle ||
      faceLabResult?.faceMood?.primary ||
      faceLabResult?.features?.physiognomy?.headline_result ||
      faceLabResult?.features?.physiognomy?.headline_label
  );
  const impressionSummary = cleanString(
    faceLabResult?.impressionSummary ||
      faceLabResult?.faceSummary ||
      faceLabResult?.faceMood?.impression ||
      faceLabResult?.features?.physiognomy?.overall_impression ||
      faceLabResult?.features?.face_shape_hairstyle?.summary ||
      faceLabResult?.features?.color_tone_recommendation?.summary
  );
  const keywords = cleanStringList(
    [
      ...(Array.isArray(faceLabResult?.keywords) ? faceLabResult.keywords : []),
      ...(Array.isArray(faceLabResult?.styleKeywords) ? faceLabResult.styleKeywords : []),
      ...(Array.isArray(faceLabResult?.faceMood?.keywords) ? faceLabResult.faceMood.keywords : []),
      ...(Array.isArray(faceLabResult?.base_data?.embedding) ? faceLabResult.base_data.embedding : []),
      ...(Array.isArray(faceLabResult?.base_data?.landmarks) ? faceLabResult.base_data.landmarks : []),
      ...(Array.isArray(faceLabResult?.features?.physiognomy?.interpretation_axes)
        ? faceLabResult.features.physiognomy.interpretation_axes
        : [])
    ],
    4
  );
  const styleDirections = buildRawStyleDirections(faceLabResult, locale);

  return sanitizePremiumFaceLabSummary({
    status: AVAILABLE,
    imageUrl: options.imageUrl,
    imageAlt: options.imageAlt,
    impressionTitle,
    impressionSummary,
    keywords,
    styleDirections,
    caution: cleanString(faceLabResult?.caution)
  });
}

function hasRawDisplaySignal(faceLabResult) {
  if (!faceLabResult || typeof faceLabResult !== "object" || Array.isArray(faceLabResult)) {
    return false;
  }

  if (faceLabResult.status === AVAILABLE || faceLabResult.status === UNAVAILABLE) {
    return sanitizePremiumFaceLabSummary(faceLabResult).status === AVAILABLE;
  }

  return buildRawDisplaySummary(faceLabResult).status === AVAILABLE;
}

export function buildUnavailablePremiumFaceLab(imageUrl = null, imageAlt = null) {
  return {
    status: UNAVAILABLE,
    imageUrl: cleanString(imageUrl),
    imageAlt: cleanString(imageAlt),
    impressionTitle: null,
    impressionSummary: null,
    keywords: [],
    styleDirections: [],
    caution: null
  };
}

export function sanitizePremiumFaceLabSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return buildUnavailablePremiumFaceLab();
  }

  const status = summary.status === AVAILABLE ? AVAILABLE : UNAVAILABLE;
  const sanitized = {
    status,
    imageUrl: cleanString(summary.imageUrl),
    imageAlt: cleanString(summary.imageAlt),
    impressionTitle: cleanString(summary.impressionTitle),
    impressionSummary: cleanString(summary.impressionSummary),
    keywords: cleanStringList(summary.keywords, 4),
    styleDirections: sanitizeStyleDirections(summary.styleDirections),
    caution: cleanString(summary.caution)
  };

  if (
    sanitized.status !== AVAILABLE ||
    (!sanitized.impressionTitle &&
      !sanitized.impressionSummary &&
      !sanitized.keywords.length &&
      !sanitized.styleDirections.length)
  ) {
    return {
      ...sanitized,
      status: UNAVAILABLE,
      impressionTitle: null,
      impressionSummary: null,
      keywords: [],
      styleDirections: [],
      caution: null
    };
  }

  return sanitized;
}

function buildDirectionsFromLaunch(paid, locale = "ko") {
  const directions = [];
  const hairDirections = cleanStringList(paid?.hairDirections, 3);

  hairDirections.forEach((summary, index) => {
    directions.push({
      key: `style-direction-${index + 1}`,
      title: locale === "en" ? `Style direction ${index + 1}` : `표현 방향 ${index + 1}`,
      summary
    });
  });

  return directions;
}

export function buildPremiumFaceLabSummary(faceLabResult, options = {}) {
  const locale = options.locale === "en" ? "en" : "ko";
  const imageUrl = cleanString(options.imageUrl);
  const imageAlt = cleanString(options.imageAlt);

  if (!faceLabResult || typeof faceLabResult !== "object" || Array.isArray(faceLabResult)) {
    return buildUnavailablePremiumFaceLab(imageUrl, imageAlt);
  }

  if (faceLabResult.status === AVAILABLE || faceLabResult.status === UNAVAILABLE) {
    return sanitizePremiumFaceLabSummary({
      ...faceLabResult,
      imageUrl: faceLabResult.imageUrl || imageUrl,
      imageAlt: faceLabResult.imageAlt || imageAlt
    });
  }

  if (faceLabResult.structured && typeof faceLabResult.structured === "object") {
    const launch = buildFaceLabLaunchData(faceLabResult, locale);
    const paid = launch?.paid || {};
    const mood = paid.faceMood || {};
    const structuredSummary = {
      status: AVAILABLE,
      imageUrl,
      imageAlt,
      impressionTitle: cleanString(mood.primary),
      impressionSummary: cleanString(mood.impression) || cleanString(paid.faceSummary),
      keywords: cleanStringList([...(mood.keywords || paid.styleKeywords || [])], 4),
      styleDirections: buildDirectionsFromLaunch(paid, locale),
      caution: null
    };

    return sanitizePremiumFaceLabSummary(structuredSummary);
  }

  if (!hasRawDisplaySignal(faceLabResult)) {
    return buildUnavailablePremiumFaceLab(imageUrl, imageAlt);
  }

  const rawSummary = buildRawDisplaySummary(faceLabResult, { locale, imageUrl, imageAlt });
  const launch = buildFaceLabLaunchData(faceLabResult, locale);
  const paid = launch?.paid || {};
  const mood = paid.faceMood || {};
  const summary = {
    status: AVAILABLE,
    imageUrl,
    imageAlt,
    impressionTitle: cleanString(mood.primary) || rawSummary.impressionTitle,
    impressionSummary: cleanString(mood.impression) || cleanString(paid.faceSummary) || rawSummary.impressionSummary,
    keywords: cleanStringList([...(mood.keywords || paid.styleKeywords || []), ...rawSummary.keywords], 4),
    styleDirections: buildDirectionsFromLaunch(paid, locale).length
      ? buildDirectionsFromLaunch(paid, locale)
      : rawSummary.styleDirections,
    caution: null
  };

  return sanitizePremiumFaceLabSummary(summary);
}
