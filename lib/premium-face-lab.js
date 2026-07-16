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

function getStrictStructuredVisionInput(faceLabResult) {
  if (
    !faceLabResult ||
    typeof faceLabResult !== "object" ||
    Array.isArray(faceLabResult) ||
    faceLabResult.status !== AVAILABLE ||
    faceLabResult.source !== "vision" ||
    !faceLabResult.data ||
    typeof faceLabResult.data !== "object" ||
    Array.isArray(faceLabResult.data) ||
    (Object.prototype.hasOwnProperty.call(faceLabResult, "eligibility") &&
      faceLabResult.eligibility?.faceLabEligible !== true)
  ) {
    return null;
  }

  const structured = faceLabResult.data.structured;
  if (!structured || typeof structured !== "object" || Array.isArray(structured)) {
    return null;
  }

  const evidence = Object.values(structured).flatMap((field) => {
    const isAvailableVisionField =
      field &&
      typeof field === "object" &&
      !Array.isArray(field) &&
      field.status === AVAILABLE &&
      (field.source === "vision" || field.source === "derived_from_vision") &&
      field.value &&
      typeof field.value === "object" &&
      !Array.isArray(field.value);

    return isAvailableVisionField ? cleanStringList(field.evidence, 12) : [];
  });

  return evidence.length
    ? {
        data: faceLabResult.data,
        evidence: cleanStringList(evidence, 12)
      }
    : null;
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

  const strictInput = getStrictStructuredVisionInput(faceLabResult);

  if (strictInput) {
    const launch = buildFaceLabLaunchData(strictInput.data, locale);
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

  return buildUnavailablePremiumFaceLab(imageUrl, imageAlt);
}
