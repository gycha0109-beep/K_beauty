import {
  FACE_CONDITIONAL_FIELD_DEFINITIONS,
  FACE_CORE_FIELD_DEFINITIONS,
  SKIN_CONDITIONAL_FIELDS,
  SKIN_CORE_FIELDS
} from "./recommendation-feature-contract.js";

const LEVEL_ORDER = Object.freeze({ none: 0, mild: 1, moderate: 2, high: 3 });
const ORDER_LEVEL = Object.freeze(["none", "mild", "moderate", "high"]);

function availableValue(field) {
  return field?.status === "available" ? field.value : null;
}

function createDerived(status, value, inputFeatures, evidenceKeys = [], reason = null) {
  return {
    status,
    value: status === "available" ? value : null,
    inputFeatures: [...new Set(inputFeatures)],
    evidenceKeys: [...new Set(evidenceKeys)],
    unavailableReason: status === "available" ? null : reason || status,
    source: "derived_from_vision"
  };
}

function fieldEvidence(field) {
  return field?.status === "available" && Array.isArray(field.evidence) ? field.evidence : [];
}

function highestLevel(fields) {
  const available = fields.filter((field) => field?.status === "available" && field?.value?.level in LEVEL_ORDER);
  if (!available.length) return null;
  const maximum = Math.max(...available.map((field) => LEVEL_ORDER[field.value.level]));
  return ORDER_LEVEL[maximum];
}

function unavailableSupport(fields, inputFeatures) {
  const statuses = fields.map((field) => field?.status).filter(Boolean);
  const evidence = fields.flatMap(fieldEvidence);
  if (statuses.length > 0 && statuses.every((status) => status === "unsupported")) {
    return createDerived("unsupported", null, inputFeatures, evidence, "unsupported_from_single_photo");
  }
  if (statuses.includes("insufficient_evidence")) {
    return createDerived("insufficient_evidence", null, inputFeatures, evidence, "input_insufficient_evidence");
  }
  return createDerived("unavailable", null, inputFeatures, evidence, "input_unavailable");
}

function combineSupport(fields, inputFeatures, options = {}) {
  const available = fields.filter((field) => field?.status === "available");
  if (!available.length) {
    return unavailableSupport(fields, inputFeatures);
  }

  const positive = available.filter((field) => field?.value?.level !== "none");
  const incomplete = fields.some((field) => field?.status !== "available");
  if (!positive.length && incomplete && options.allowIncompleteAbsence !== true) {
    return createDerived(
      "insufficient_evidence",
      null,
      inputFeatures,
      available.flatMap(fieldEvidence),
      "absence_not_established_for_all_inputs"
    );
  }

  const level = options.resolveLevel
    ? options.resolveLevel(available)
    : highestLevel(available);
  if (!level) {
    return createDerived("insufficient_evidence", null, inputFeatures, [], "level_unresolved");
  }

  const observedAreas = [...new Set(available.flatMap((field) => field.value?.observedAreas || []))];
  const affectedAreas = level === "none"
    ? []
    : [...new Set(available.flatMap((field) => field.value?.affectedAreas || []))];
  const evidenceKeys = available.flatMap(fieldEvidence);

  return createDerived("available", {
    level,
    observedAreas,
    affectedAreas
  }, inputFeatures, evidenceKeys);
}

function deriveFaceStructureSuitability(atomic, eligibility) {
  const inputFeatures = [
    "atomic.quality.faceVisibility",
    "atomic.quality.faceScale",
    "atomic.quality.pose.yaw",
    "atomic.quality.pose.pitch",
    "atomic.quality.pose.roll",
    "atomic.quality.occlusion.eyes",
    "atomic.quality.occlusion.jawline",
    "atomic.quality.sharpness"
  ];
  if (eligibility?.faceLabEligible !== true) {
    return createDerived("unavailable", null, inputFeatures, [], "face_analysis_ineligible");
  }

  const visibility = availableValue(atomic.quality.faceVisibility);
  const scale = availableValue(atomic.quality.faceScale);
  const yaw = availableValue(atomic.quality.pose.yaw);
  const pitch = availableValue(atomic.quality.pose.pitch);
  const roll = availableValue(atomic.quality.pose.roll);
  const eyeOcclusion = availableValue(atomic.quality.occlusion.eyes);
  const jawOcclusion = availableValue(atomic.quality.occlusion.jawline);
  const sharpness = availableValue(atomic.quality.sharpness);
  const values = [visibility, scale, yaw, pitch, roll, eyeOcclusion, jawOcclusion, sharpness];
  if (values.some((value) => value === null)) {
    return createDerived("insufficient_evidence", null, inputFeatures, [], "quality_input_missing");
  }

  const evidence = [
    atomic.quality.faceVisibility,
    atomic.quality.faceScale,
    atomic.quality.pose.yaw,
    atomic.quality.pose.pitch,
    atomic.quality.pose.roll,
    atomic.quality.occlusion.eyes,
    atomic.quality.occlusion.jawline,
    atomic.quality.sharpness
  ].flatMap(fieldEvidence);

  const unsuitable = visibility === "poor" ||
    ["profile_left", "profile_right"].includes(yaw) ||
    eyeOcclusion === "heavy" ||
    jawOcclusion === "heavy" ||
    sharpness === "blurred";
  if (unsuitable) return createDerived("available", "unsuitable", inputFeatures, evidence);

  const limited = visibility === "partial" ||
    scale !== "adequate" ||
    yaw !== "frontal" ||
    pitch !== "level" ||
    roll !== "level" ||
    eyeOcclusion === "partial" ||
    jawOcclusion === "partial" ||
    sharpness === "soft";
  return createDerived("available", limited ? "limited" : "suitable", inputFeatures, evidence);
}

function deriveSkinTextureSuitability(atomic, eligibility) {
  const inputFeatures = [
    "atomic.quality.sharpness",
    "atomic.quality.lightingUniformity",
    "atomic.quality.filterOrEditing",
    "atomic.quality.makeupCoverage",
    "atomic.quality.occlusion.cheeks"
  ];
  if (eligibility?.skinAnalysisEligible !== true) {
    return createDerived("unavailable", null, inputFeatures, [], "skin_analysis_ineligible");
  }

  const sharpness = availableValue(atomic.quality.sharpness);
  const lighting = availableValue(atomic.quality.lightingUniformity);
  const filter = availableValue(atomic.quality.filterOrEditing);
  const makeup = availableValue(atomic.quality.makeupCoverage);
  const cheeks = availableValue(atomic.quality.occlusion.cheeks);
  if ([sharpness, lighting, filter, makeup, cheeks].some((value) => value === null)) {
    return createDerived("insufficient_evidence", null, inputFeatures, [], "quality_input_missing");
  }

  const evidence = [
    atomic.quality.sharpness,
    atomic.quality.lightingUniformity,
    atomic.quality.filterOrEditing,
    atomic.quality.makeupCoverage,
    atomic.quality.occlusion.cheeks
  ].flatMap(fieldEvidence);

  if (
    sharpness === "blurred" ||
    filter === "heavy" ||
    makeup === "heavy" ||
    cheeks === "heavy"
  ) {
    return createDerived("available", "unsuitable", inputFeatures, evidence);
  }

  const limited = sharpness === "soft" ||
    lighting === "harsh" ||
    ["possible", "unknown"].includes(filter) ||
    ["moderate", "unknown"].includes(makeup) ||
    cheeks === "partial";
  return createDerived("available", limited ? "limited" : "suitable", inputFeatures, evidence);
}

function deriveSkinColourSuitability(atomic, eligibility) {
  const inputFeatures = [
    "atomic.quality.exposure",
    "atomic.quality.lightingUniformity",
    "atomic.quality.whiteBalance",
    "atomic.quality.filterOrEditing",
    "atomic.quality.makeupCoverage"
  ];
  if (eligibility?.skinAnalysisEligible !== true) {
    return createDerived("unavailable", null, inputFeatures, [], "skin_analysis_ineligible");
  }

  const exposure = availableValue(atomic.quality.exposure);
  const lighting = availableValue(atomic.quality.lightingUniformity);
  const whiteBalance = availableValue(atomic.quality.whiteBalance);
  const filter = availableValue(atomic.quality.filterOrEditing);
  const makeup = availableValue(atomic.quality.makeupCoverage);
  if ([exposure, lighting, whiteBalance, filter, makeup].some((value) => value === null)) {
    return createDerived("insufficient_evidence", null, inputFeatures, [], "quality_input_missing");
  }

  const evidence = [
    atomic.quality.exposure,
    atomic.quality.lightingUniformity,
    atomic.quality.whiteBalance,
    atomic.quality.filterOrEditing,
    atomic.quality.makeupCoverage
  ].flatMap(fieldEvidence);

  if (
    exposure !== "balanced" ||
    lighting === "harsh" ||
    whiteBalance === "mixed_cast" ||
    filter === "heavy" ||
    makeup === "heavy"
  ) {
    return createDerived("available", "unsuitable", inputFeatures, evidence);
  }

  const limited = lighting === "uneven" ||
    ["warm_cast", "cool_cast"].includes(whiteBalance) ||
    ["possible", "unknown"].includes(filter) ||
    ["moderate", "unknown"].includes(makeup);
  return createDerived("available", limited ? "limited" : "suitable", inputFeatures, evidence);
}

function deriveCoverage(fields, expectedNames) {
  const availableNames = expectedNames.filter((name) => fields[name]?.status === "available");
  const unavailableNames = expectedNames.filter((name) => fields[name]?.status !== "available");
  return {
    status: "available",
    value: {
      availableCount: availableNames.length,
      totalCount: expectedNames.length,
      ratio: expectedNames.length ? Number((availableNames.length / expectedNames.length).toFixed(6)) : 0,
      availableFields: availableNames,
      unavailableFields: unavailableNames
    },
    inputFeatures: expectedNames,
    evidenceKeys: availableNames.flatMap((name) => fieldEvidence(fields[name])),
    unavailableReason: null,
    source: "derived_from_vision"
  };
}

function deriveSurfaceStress(atomicSkin) {
  const dry = atomicSkin.visibleDryTexture;
  const flaking = atomicSkin.visibleFlaking;
  const redness = atomicSkin.visibleRedness;
  const textureFields = [dry, flaking];
  const textureAvailable = textureFields.filter((field) => field?.status === "available");
  const texturePositive = textureAvailable.some((field) => field.value?.level !== "none");
  const textureAbsenceEstablished = textureFields.every(
    (field) => field?.status === "available" && field.value?.level === "none"
  );

  if (!texturePositive && !textureAbsenceEstablished) {
    return createDerived(
      "insufficient_evidence",
      null,
      ["visibleDryTexture", "visibleFlaking", "visibleRedness"],
      [...textureAvailable, redness].flatMap(fieldEvidence),
      "texture_disruption_evidence_required"
    );
  }

  return combineSupport(
    [dry, flaking, redness],
    ["visibleDryTexture", "visibleFlaking", "visibleRedness"],
    {
      allowIncompleteAbsence: texturePositive,
      resolveLevel(available) {
        const textureLevel = highestLevel(available.filter((field) => field === dry || field === flaking)) || "none";
        const rednessLevel = redness?.status === "available" ? redness.value.level : "none";
        if (textureLevel === "none" && rednessLevel !== "none") return "mild";
        if (textureLevel === "none") return "none";
        return ORDER_LEVEL[Math.max(LEVEL_ORDER[textureLevel], Math.min(LEVEL_ORDER[rednessLevel], 2))];
      }
    }
  );
}

export function buildDerivedRecommendationFeatures(canonicalBundle) {
  const atomic = canonicalBundle.atomic;
  const eligibility = canonicalBundle.eligibility;
  const faceStructureSuitability = deriveFaceStructureSuitability(atomic, eligibility);
  const skinTextureSuitability = deriveSkinTextureSuitability(atomic, eligibility);
  const skinColourSuitability = deriveSkinColourSuitability(atomic, eligibility);

  const providerStructure = canonicalBundle.compatibilityInputs?.providerSuitability?.structureSuitability || null;
  const providerColor = canonicalBundle.compatibilityInputs?.providerSuitability?.colorSuitability || null;

  return {
    suitability: {
      faceStructureSuitability,
      skinTextureSuitability,
      skinColourSuitability
    },
    coverage: {
      faceCoreCoverage: deriveCoverage(atomic.face, Object.keys(FACE_CORE_FIELD_DEFINITIONS)),
      faceConditionalCoverage: deriveCoverage(atomic.face, Object.keys(FACE_CONDITIONAL_FIELD_DEFINITIONS)),
      skinCoreCoverage: deriveCoverage(atomic.skin, SKIN_CORE_FIELDS),
      skinConditionalCoverage: deriveCoverage(atomic.skin, SKIN_CONDITIONAL_FIELDS)
    },
    skinSupport: {
      visibleShineSupport: combineSupport([atomic.skin.visibleSurfaceShine], ["visibleSurfaceShine"]),
      visibleDryTextureSupport: combineSupport(
        [atomic.skin.visibleDryTexture, atomic.skin.visibleFlaking],
        ["visibleDryTexture", "visibleFlaking"]
      ),
      visibleRednessSupport: combineSupport([atomic.skin.visibleRedness], ["visibleRedness"]),
      visibleLocalizedSpotSupport: combineSupport([atomic.skin.visibleLocalizedSpots], ["visibleLocalizedSpots"]),
      visiblePoreSupport: combineSupport([atomic.skin.visiblePores], ["visiblePores"]),
      visibleToneVariationSupport: combineSupport([atomic.skin.visibleToneVariation], ["visibleToneVariation"]),
      visibleSurfaceStressSupport: deriveSurfaceStress(atomic.skin),
      uvSupport: createDerived("unsupported", null, [], [], "unsupported_from_single_photo")
    },
    suitabilityComparison: {
      providerStructureSuitability: providerStructure,
      derivedFaceStructureSuitability: faceStructureSuitability.value,
      structureAgreement: providerStructure !== null && faceStructureSuitability.status === "available"
        ? providerStructure === faceStructureSuitability.value
        : null,
      providerColorSuitability: providerColor,
      derivedSkinColourSuitability: skinColourSuitability.value,
      colorAgreement: providerColor !== null && skinColourSuitability.status === "available"
        ? providerColor === skinColourSuitability.value
        : null,
      productionAffecting: false
    }
  };
}
