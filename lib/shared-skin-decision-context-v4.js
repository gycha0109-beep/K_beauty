import {
  buildSharedSkinDecisionContext as buildSharedSkinDecisionContextV3
} from "./shared-skin-decision-context.js";

const CONTEXT_VERSION = "shared-skin-decision-context-v4";
const CONCERN_AXES = Object.freeze([
  "barrier",
  "redness",
  "dehydration",
  "oiliness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
]);
const SKIN_TYPES = new Set(["dry", "oily", "combination", "normal", "sensitive"]);
const SENSITIVITY_LEVELS = new Set(["low", "medium", "high", "very_high"]);

function text(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map(stableSortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableSortObject(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value));
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function yesNoUnknown(value) {
  const normalized = text(value).toLowerCase();
  if (value === true || ["yes", "true", "1"].includes(normalized)) return "yes";
  if (value === false || ["no", "false", "0"].includes(normalized)) return "no";
  return "unknown";
}

function getRawConcernScores(report = {}, context = {}) {
  const candidates = [
    report?.freeResult?.scoring?.concernScores,
    report?.freeResult?.scoreCard?.concernScores,
    report?.freeResult?.concernScores,
    report?.decisionBundle?.context?.concernState?.scores,
    context?.skinState?.concernScores
  ];
  return candidates.find((candidate) =>
    candidate && typeof candidate === "object" && !Array.isArray(candidate)
  ) || {};
}

function rawScoreValue(value) {
  if (value && typeof value === "object") {
    return rawScoreValue(value.total ?? value.score ?? value.value);
  }
  return value;
}

function knownScore(source, axis) {
  if (!Object.prototype.hasOwnProperty.call(source, axis)) return false;
  const raw = rawScoreValue(source[axis]);
  if (raw === null || raw === undefined) return false;
  if (typeof raw === "string" && !raw.trim()) return false;
  return Number.isFinite(Number(raw));
}

function scoreOrNull(source, axis) {
  return knownScore(source, axis) ? Number(rawScoreValue(source[axis])) : null;
}

function buildSkinState(report = {}, context = {}) {
  const rawScores = getRawConcernScores(report, context);
  const answers = context?.survey?.answers || {};
  const rawSkinType = text(answers?.skinType).toLowerCase();
  const rawSensitivity = text(answers?.sensitivity || answers?.sensitivityLevel).toLowerCase();

  return {
    ...context.skinState,
    skinType: SKIN_TYPES.has(rawSkinType) ? rawSkinType : "unknown",
    sensitivity: SENSITIVITY_LEVELS.has(rawSensitivity) ? rawSensitivity : "unknown",
    drynessBurden: scoreOrNull(rawScores, "dehydration"),
    rednessBurden: scoreOrNull(rawScores, "redness"),
    oilinessBurden: scoreOrNull(rawScores, "oiliness"),
    acneBurden: scoreOrNull(rawScores, "acne"),
    barrierBurden: scoreOrNull(rawScores, "barrier"),
    textureBurden: scoreOrNull(rawScores, "pores"),
    toneBurden: scoreOrNull(rawScores, "uneven_tone"),
    uvPriority: scoreOrNull(rawScores, "uv")
  };
}

function buildConcernState(report = {}, context = {}) {
  const rawScores = getRawConcernScores(report, context);
  const priorityAxis = text(context?.skinState?.priorityAxis) || null;
  const priorityScore = Number(context?.skinState?.priorityScore || 0);
  const scores = Object.fromEntries(
    CONCERN_AXES.map((axis) => [axis, scoreOrNull(rawScores, axis)])
  );
  const knownAxes = CONCERN_AXES.filter((axis) => scores[axis] !== null);
  const unknownAxes = CONCERN_AXES.filter((axis) => scores[axis] === null);
  const alignment = text(context?.photo?.observations?.surveyAlignment?.status).toLowerCase();

  return {
    priorityAxis,
    priorityScore: Number.isFinite(priorityScore) ? priorityScore : 0,
    scores,
    knownAxes,
    unknownAxes,
    completeness: knownAxes.length === CONCERN_AXES.length
      ? "complete"
      : knownAxes.length ? "partial" : "minimal",
    surveyPhotoAlignment: ["aligned", "partial", "conflict"].includes(alignment)
      ? alignment
      : "unknown"
  };
}

function normalizePhotoStatus(value) {
  const normalized = text(value).toLowerCase();
  if (["available", "eligible", "analyzed"].includes(normalized)) return "available";
  if (["not_provided", "missing", "no_photo"].includes(normalized)) return "not_provided";
  if (["unavailable", "analysis_failed", "failed"].includes(normalized)) return "unavailable";
  if (["insufficient_evidence", "insufficient"].includes(normalized)) return "insufficient_evidence";
  return "unknown";
}

function buildPhotoState(report = {}, context = {}) {
  const previous = report?.decisionBundle?.context?.photo;
  const explicit =
    report?.photoEvidenceState ||
    report?.freeResult?.photoEvidenceState ||
    previous ||
    {};
  const observations = context?.photo?.observations || null;
  const explicitStatus = normalizePhotoStatus(explicit?.status || explicit?.availability);
  const status = observations ? "available" : explicitStatus;
  const failureReason = status === "unavailable" || status === "insufficient_evidence"
    ? text(explicit?.failureReason || explicit?.unavailableReason) || "unspecified"
    : null;

  return {
    status,
    source: observations
      ? text(explicit?.source || report?.photoObservationsSource) || "persisted_observations"
      : text(explicit?.source) || null,
    failureReason,
    observations,
    evidenceAvailable: Boolean(observations),
    factsMayBeInferred: false
  };
}

function groupFunctionalAxes(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    for (const axis of Array.isArray(row?.functionalAxes) ? row.functionalAxes : []) {
      const key = text(axis?.axis).toLowerCase();
      if (!key) continue;
      const current = grouped.get(key) || {
        productIds: [],
        exposureCount: 0,
        activeExposureCount: 0,
        strengths: [],
        confidences: []
      };
      if (row?.productId && !current.productIds.includes(row.productId)) {
        current.productIds.push(row.productId);
      }
      current.exposureCount += 1;
      if ((row?.activeAxes || []).includes(key)) current.activeExposureCount += 1;
      if (axis?.strength && !current.strengths.includes(axis.strength)) {
        current.strengths.push(axis.strength);
      }
      if (axis?.confidence && !current.confidences.includes(axis.confidence)) {
        current.confidences.push(axis.confidence);
      }
      grouped.set(key, current);
    }
  }
  return Object.fromEntries(
    Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([axis, value]) => [axis, {
        ...value,
        productIds: [...value.productIds].sort(),
        strengths: [...value.strengths].sort(),
        confidences: [...value.confidences].sort()
      }])
  );
}

function enrichProductExposureState(context = {}) {
  const base = context?.productExposureState && typeof context.productExposureState === "object"
    ? context.productExposureState
    : {};
  const answers = context?.survey?.answers || {};
  const condition = context?.conditionSignalState || {};
  const rows = Array.isArray(base.rows) ? base.rows : [];
  const selectedProducts = rows.filter((row) => row?.sourceState === "selected");
  const unknownProducts = rows.filter((row) =>
    row?.sourceState === "not_in_db" ||
    (row?.sourceState === "selected" && !row?.evaluable)
  );
  const unusedSlots = rows.filter((row) => row?.sourceState === "not_using");
  const unansweredSlots = rows.filter((row) => row?.sourceState === "unanswered");
  const recentProductChange = yesNoUnknown(
    answers?.recentlyChangedProduct ?? condition?.recentProductChange
  );
  const productReaction = yesNoUnknown(
    answers?.productReaction ?? answers?.recentProductReaction ?? condition?.productReaction
  );
  const unknownExposurePresent = unknownProducts.length > 0 || unansweredSlots.length > 0;

  return {
    ...base,
    selectedProducts,
    unknownProducts,
    unusedSlots,
    unansweredSlots,
    functionalAxes: groupFunctionalAxes(selectedProducts),
    uncertainAxes: [],
    uncertainAxisReasons: unknownExposurePresent
      ? ["product_functional_axes_unresolved"]
      : [],
    recentExposureState: recentProductChange === "yes"
      ? "reported_unlinked"
      : recentProductChange === "no" ? "none_reported" : "unknown",
    recentExposures: [],
    reactionLinkState: productReaction === "yes"
      ? "unresolved"
      : productReaction === "no" ? "none_reported" : "unknown",
    reactionLinkedExposures: [],
    unknownExposurePresent,
    concentrationOrStrengthInferred: false
  };
}

function buildUncertaintyState({
  skinState,
  concernState,
  survey,
  photo,
  productExposureState,
  environmentState,
  conditionSignalState
}) {
  const reasons = [];

  if (!concernState.priorityAxis) reasons.push("priority_axis_missing");
  if (concernState.completeness !== "complete") reasons.push("concern_evidence_incomplete");
  if (skinState.skinType === "unknown") reasons.push("skin_type_unknown");
  if (skinState.sensitivity === "unknown") reasons.push("sensitivity_unknown");
  if (survey?.completeness !== "available") reasons.push("survey_answers_not_persisted");
  if (photo.status === "unknown") reasons.push("photo_availability_unknown");
  if (photo.status === "not_provided") reasons.push("photo_not_provided");
  if (["unavailable", "insufficient_evidence"].includes(photo.status)) {
    reasons.push("photo_analysis_unavailable");
  }
  if (productExposureState.unknownProducts.length) {
    reasons.push("current_product_evidence_incomplete");
  }
  if (productExposureState.unansweredSlots.length) {
    reasons.push("current_product_usage_unanswered");
  }
  if (productExposureState.recentExposureState === "reported_unlinked") {
    reasons.push("recent_product_change_unlinked");
  }
  if (productExposureState.reactionLinkState === "unresolved") {
    reasons.push("product_reaction_link_unresolved");
  }
  if (environmentState?.completeness === "unknown") {
    reasons.push("environment_context_missing");
  }
  if (conditionSignalState?.completeness === "minimal") {
    reasons.push("condition_signal_context_minimal");
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const high = !concernState.priorityAxis || concernState.completeness === "minimal";

  return {
    level: high ? "high" : uniqueReasons.length ? "medium" : "low",
    reasons: uniqueReasons,
    confidenceCeiling: high ? "low" : uniqueReasons.length ? "medium" : "high",
    unknownPreserved: true,
    factsMayBeInferred: false
  };
}

function appendEvidenceLedger(base = [], {
  skinState,
  concernState,
  photo,
  productExposureState,
  uncertaintyState
}) {
  return [
    ...(Array.isArray(base) ? base : []),
    {
      key: "skin_state",
      source: "survey_and_concern_scores",
      value: {
        skinType: skinState.skinType,
        sensitivity: skinState.sensitivity,
        burdenAxesKnown: CONCERN_AXES.filter((axis) => concernState.scores[axis] !== null)
      }
    },
    {
      key: "concern_state",
      source: "shared_context",
      value: {
        priorityAxis: concernState.priorityAxis,
        completeness: concernState.completeness,
        unknownAxes: concernState.unknownAxes
      }
    },
    {
      key: "photo_evidence_state",
      source: "photo",
      value: {
        status: photo.status,
        evidenceAvailable: photo.evidenceAvailable,
        failureReason: photo.failureReason
      }
    },
    {
      key: "recent_exposure_state",
      source: "survey_and_current_products",
      value: productExposureState.recentExposureState
    },
    {
      key: "reaction_link_state",
      source: "survey_and_current_products",
      value: productExposureState.reactionLinkState
    },
    {
      key: "uncertainty_state",
      source: "shared_context",
      value: {
        level: uncertaintyState.level,
        reasons: uncertaintyState.reasons,
        confidenceCeiling: uncertaintyState.confidenceCeiling
      }
    }
  ];
}

function hashableContext(context = {}) {
  return {
    version: context.version,
    skinState: context.skinState,
    concernState: context.concernState,
    survey: context.survey,
    photo: context.photo,
    productExposureState: context.productExposureState,
    safetyState: context.safetyState,
    routineBurdenState: context.routineBurdenState,
    environmentState: context.environmentState,
    conditionSignalState: context.conditionSignalState,
    uncertaintyState: context.uncertaintyState,
    evidenceLedger: context.evidenceLedger
  };
}

export function buildSharedSkinDecisionContext(report = {}, options = {}) {
  const base = buildSharedSkinDecisionContextV3(report, options);
  const skinState = buildSkinState(report, base.context);
  const concernState = buildConcernState(report, base.context);
  const photo = buildPhotoState(report, base.context);
  const productExposureState = enrichProductExposureState(base.context);
  const uncertaintyState = buildUncertaintyState({
    skinState,
    concernState,
    survey: base.context.survey,
    photo,
    productExposureState,
    environmentState: base.context.environmentState,
    conditionSignalState: base.context.conditionSignalState
  });
  const context = {
    ...base.context,
    version: CONTEXT_VERSION,
    skinState,
    concernState,
    photo,
    productExposureState,
    uncertaintyState
  };
  context.evidenceLedger = appendEvidenceLedger(base.context.evidenceLedger, {
    skinState,
    concernState,
    photo,
    productExposureState,
    uncertaintyState
  });

  const contextHash = hashText(stableStringify(hashableContext(context)));
  const previousBundle = report?.decisionBundle && typeof report.decisionBundle === "object"
    ? report.decisionBundle
    : {};
  const previousRevision = Math.max(0, Number(previousBundle.contextRevision) || 0);
  const sameVersion = previousBundle.contextVersion === CONTEXT_VERSION ||
    previousBundle?.context?.version === CONTEXT_VERSION;
  const contextRevision = sameVersion && text(previousBundle.contextHash) === contextHash && previousRevision > 0
    ? previousRevision
    : previousRevision + 1;

  return {
    context,
    contextHash,
    contextRevision
  };
}

export const SHARED_SKIN_DECISION_CONTEXT_VERSION = CONTEXT_VERSION;
