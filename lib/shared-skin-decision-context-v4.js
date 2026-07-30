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

function text(value) {
  return String(value || "").normalize("NFKC").trim();
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

function getSelections(currentProducts) {
  if (Array.isArray(currentProducts)) return currentProducts;
  return Array.isArray(currentProducts?.selections) ? currentProducts.selections : [];
}

function buildConcernState(context = {}) {
  const priorityAxis = text(context?.skinState?.priorityAxis) || null;
  const priorityScore = Number(context?.skinState?.priorityScore || 0);
  const scores = context?.skinState?.concernScores && typeof context.skinState.concernScores === "object"
    ? { ...context.skinState.concernScores }
    : {};
  const knownAxes = CONCERN_AXES.filter((axis) =>
    Object.prototype.hasOwnProperty.call(scores, axis) &&
    Number.isFinite(Number(scores[axis]))
  );
  const unknownAxes = CONCERN_AXES.filter((axis) => !knownAxes.includes(axis));
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

function buildExplicitReactionLinks(report = {}) {
  const links = Array.isArray(report?.currentProductReactionLinks)
    ? report.currentProductReactionLinks
    : [];
  return links
    .map((item) => ({
      productId: text(item?.productId || item?.product_id) || null,
      category: text(item?.category) || null,
      evidenceKey: text(item?.evidenceKey) || "explicit_product_reaction_link"
    }))
    .filter((item) => item.productId || item.category);
}

function enrichProductExposureState(report = {}, context = {}) {
  const base = context?.productExposureState && typeof context.productExposureState === "object"
    ? context.productExposureState
    : {};
  const answers = context?.survey?.answers || {};
  const condition = context?.conditionSignalState || {};
  const rows = Array.isArray(base.rows) ? base.rows : [];
  const selections = getSelections(report?.currentProducts);
  const recentProductChange = yesNoUnknown(
    answers?.recentlyChangedProduct ?? condition?.recentProductChange
  );
  const productReaction = yesNoUnknown(
    answers?.productReaction ?? answers?.recentProductReaction ?? condition?.productReaction
  );
  const explicitLinks = buildExplicitReactionLinks(report);
  const linkedRows = rows.filter((row) =>
    explicitLinks.some((link) =>
      (link.productId && row?.productId && link.productId === text(row.productId)) ||
      (link.category && row?.category && link.category === text(row.category))
    )
  );
  const explicitRecentSelections = selections.filter((selection) =>
    selection?.introducedRecently === true ||
    selection?.recentlyIntroduced === true ||
    selection?.isRecentExposure === true
  );
  const recentRows = rows.filter((row) =>
    explicitRecentSelections.some((selection) =>
      (selection?.productId && row?.productId && text(selection.productId) === text(row.productId)) ||
      (!selection?.productId && selection?.category && text(selection.category) === text(row.category))
    )
  );

  return {
    ...base,
    recentExposureState: recentRows.length
      ? "linked"
      : recentProductChange === "yes" ? "reported_unlinked"
      : recentProductChange === "no" ? "none_reported" : "unknown",
    recentExposures: recentRows,
    reactionLinkState: linkedRows.length
      ? "linked"
      : productReaction === "yes" ? "unresolved"
      : productReaction === "no" ? "none_reported" : "unknown",
    reactionLinkedExposures: linkedRows,
    unknownExposurePresent: Number(base.unknownProductCount || 0) > 0,
    concentrationOrStrengthInferred: false
  };
}

function buildUncertaintyState({
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
  if (survey?.completeness !== "available") reasons.push("survey_answers_not_persisted");
  if (photo.status === "unknown") reasons.push("photo_availability_unknown");
  if (photo.status === "not_provided") reasons.push("photo_not_provided");
  if (["unavailable", "insufficient_evidence"].includes(photo.status)) {
    reasons.push("photo_analysis_unavailable");
  }
  if (productExposureState.unknownExposurePresent) {
    reasons.push("current_product_evidence_incomplete");
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
  concernState,
  photo,
  productExposureState,
  uncertaintyState
}) {
  return [
    ...(Array.isArray(base) ? base : []),
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
  const concernState = buildConcernState(base.context);
  const photo = buildPhotoState(report, base.context);
  const productExposureState = enrichProductExposureState(report, base.context);
  const uncertaintyState = buildUncertaintyState({
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
    concernState,
    photo,
    productExposureState,
    uncertaintyState
  };
  context.evidenceLedger = appendEvidenceLedger(base.context.evidenceLedger, {
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
