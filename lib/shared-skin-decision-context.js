import { resolveProductFunctionalProfile } from "./product-functional-profile.js";

const CONTEXT_VERSION = "shared-skin-decision-context-v1";
const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const SENSITIVE_AXES = new Set(["barrier", "redness", "acne", "dehydration"]);
const CONFIDENCE_RANK = { none: 0, low: 1, medium: 2, high: 3 };
const STRENGTH_RANK = { none: 0, low: 1, medium: 2, high: 3 };

function normalizeText(value) {
  return String(value || "").normalize("NFKC").trim();
}

function parseFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rankAtLeast(value, ranks, minimum) {
  return (ranks[value] || 0) >= (ranks[minimum] || 0);
}

function stableSortObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortObject);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

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

function getFreeResult(report = {}) {
  return report?.freeResult && typeof report.freeResult === "object"
    ? report.freeResult
    : {};
}

function getPriority(freeResult = {}, previousContext = {}) {
  const axis = normalizeText(
    freeResult?.priority?.axis ||
      freeResult?.priority?.concern ||
      previousContext?.skinState?.priorityAxis ||
      freeResult?.mainConcern
  );
  const score = parseFiniteNumber(
    freeResult?.priority?.score || previousContext?.skinState?.priorityScore
  );

  return {
    axis: axis || null,
    score
  };
}

function getConcernScores(freeResult = {}, previousContext = {}) {
  const source =
    freeResult?.scoring?.concernScores ||
    previousContext?.skinState?.concernScores ||
    {};

  return Object.fromEntries(
    Object.entries(source)
      .map(([axis, value]) => {
        const total = parseFiniteNumber(value?.total ?? value);
        return normalizeText(axis) ? [normalizeText(axis), total] : null;
      })
      .filter(Boolean)
  );
}

function getSurveyAnswers(report = {}, freeResult = {}, previousContext = {}) {
  const candidates = [
    previousContext?.survey?.answers,
    freeResult?.answers,
    freeResult?.form,
    report?.answers
  ];

  return candidates.find(
    (candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)
  ) || {};
}

function getSelections(currentProducts) {
  if (Array.isArray(currentProducts)) {
    return currentProducts;
  }

  return Array.isArray(currentProducts?.selections) ? currentProducts.selections : [];
}

function normalizeFunctionalAxes(profile) {
  return (Array.isArray(profile?.functionalAxes) ? profile.functionalAxes : [])
    .map((axis) => ({
      axis: normalizeText(axis?.axis) || null,
      strength: normalizeText(axis?.strength).toLowerCase() || "none",
      confidence: normalizeText(axis?.confidence).toLowerCase() || "none"
    }))
    .filter((axis) => axis.axis);
}

function isMeaningfulActiveAxis(axis, categoryRole) {
  if (!ACTIVE_AXES.has(axis?.axis)) {
    return false;
  }

  if (!["functional_leave_on", "hydration_base"].includes(categoryRole)) {
    return false;
  }

  return (
    rankAtLeast(axis.confidence, CONFIDENCE_RANK, "medium") &&
    rankAtLeast(axis.strength, STRENGTH_RANK, "low")
  );
}

function buildExposureRows(currentProducts) {
  return getSelections(currentProducts).map((selection) => {
    const sourceState = normalizeText(selection?.status).toLowerCase() || "unanswered";
    const snapshot = selection?.productSnapshot || selection?.product || null;
    const category = normalizeText(snapshot?.category || selection?.category) || null;
    const productId = normalizeText(
      snapshot?.id || selection?.productId || selection?.product_id
    ) || null;

    if (sourceState !== "selected" || !snapshot || typeof snapshot !== "object") {
      return {
        sourceState,
        category,
        productId,
        evaluable: false,
        categoryRole: null,
        functionalAxes: [],
        cautionTags: [],
        activeAxes: [],
        activeExposure: false
      };
    }

    const profile = resolveProductFunctionalProfile({
      ...snapshot,
      id: snapshot.id || selection.productId || selection.product_id,
      category: snapshot.category || selection.category
    });
    const functionalAxes = normalizeFunctionalAxes(profile);
    const activeAxes = functionalAxes
      .filter((axis) => isMeaningfulActiveAxis(axis, profile.categoryRole))
      .map((axis) => axis.axis);

    return {
      sourceState,
      category,
      productId,
      evaluable: Boolean(profile.evaluable),
      categoryRole: profile.categoryRole || null,
      functionalAxes,
      cautionTags: Array.isArray(profile.cautionTags) ? [...profile.cautionTags] : [],
      activeAxes,
      activeExposure: activeAxes.length > 0
    };
  });
}

function getDuplicateActiveAxes(exposureRows) {
  const counts = new Map();

  exposureRows
    .filter((row) => row.sourceState === "selected" && row.activeExposure)
    .forEach((row) => {
      row.activeAxes.forEach((axis) => counts.set(axis, (counts.get(axis) || 0) + 1));
    });

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([axis]) => axis)
    .sort();
}

function getScaleThreshold(scores) {
  const maximum = Math.max(...Object.values(scores).map(parseFiniteNumber), 0);
  return maximum > 40 ? 70 : 18;
}

function buildProductExposureState(currentProducts) {
  const rows = buildExposureRows(currentProducts);
  const duplicateActiveAxes = getDuplicateActiveAxes(rows);
  const selectedRows = rows.filter((row) => row.sourceState === "selected");
  const activeRows = selectedRows.filter((row) => row.activeExposure);
  const highCautionRows = selectedRows.filter((row) =>
    row.cautionTags.some((tag) => ["irritation_risk_watch", "sensitive_use_watch"].includes(tag))
  );

  return {
    rows,
    selectedCount: selectedRows.length,
    evaluableSelectedCount: selectedRows.filter((row) => row.evaluable).length,
    unknownProductCount: rows.filter((row) =>
      row.sourceState === "not_in_db" ||
      (row.sourceState === "selected" && !row.evaluable)
    ).length,
    activeExposureCount: activeRows.length,
    activeExposurePresent: activeRows.length > 0,
    duplicateActiveAxes,
    highCautionExposureCount: highCautionRows.length
  };
}

function buildSafetyState({ priority, concernScores, productExposureState, surveyAnswers }) {
  const highThreshold = getScaleThreshold(concernScores);
  const highSensitiveAxes = ["barrier", "redness", "acne", "dehydration"].filter(
    (axis) => parseFiniteNumber(concernScores[axis]) >= highThreshold
  );
  const sensitivePriority = SENSITIVE_AXES.has(priority.axis);
  const sensitiveBurden = sensitivePriority || highSensitiveAxes.length > 0;
  const recentSkinChange = normalizeText(surveyAnswers?.recentSkinChange).toLowerCase() || "unknown";
  const recentlyChangedProduct = normalizeText(
    surveyAnswers?.recentlyChangedProduct
  ).toLowerCase() || "unknown";
  const activeBurden = Boolean(
    (sensitiveBurden && productExposureState.activeExposurePresent) ||
      productExposureState.duplicateActiveAxes.length ||
      productExposureState.highCautionExposureCount
  );
  const stabilizeFirst = Boolean(
    activeBurden || recentSkinChange === "yes" || recentlyChangedProduct === "yes"
  );

  return {
    level: stabilizeFirst ? "stabilize_first" : sensitiveBurden ? "caution" : "stable",
    sensitiveBurden,
    sensitivePriority,
    highSensitiveAxes,
    activeBurden,
    activeExpansionAllowed: !stabilizeFirst,
    exfoliationExpansionAllowed: !stabilizeFirst && !sensitiveBurden,
    protectionMustMaintain: true,
    recentSkinChange,
    recentlyChangedProduct,
    reasonCodes: [
      ...(sensitivePriority ? ["sensitive_priority"] : []),
      ...(highSensitiveAxes.length ? ["high_sensitive_axis"] : []),
      ...(productExposureState.activeExposurePresent ? ["active_exposure_present"] : []),
      ...(productExposureState.duplicateActiveAxes.length ? ["duplicate_active_axis"] : []),
      ...(productExposureState.highCautionExposureCount ? ["high_caution_exposure"] : []),
      ...(recentSkinChange === "yes" ? ["recent_skin_change"] : []),
      ...(recentlyChangedProduct === "yes" ? ["recent_product_change"] : [])
    ]
  };
}

function buildEvidenceLedger({ priority, concernScores, productExposureState, safetyState }) {
  return [
    {
      key: "priority_axis",
      source: "free_result",
      value: priority.axis
    },
    ...Object.entries(concernScores).map(([axis, total]) => ({
      key: `concern_score:${axis}`,
      source: "free_result",
      value: total
    })),
    {
      key: "active_exposure_count",
      source: "current_products",
      value: productExposureState.activeExposureCount
    },
    {
      key: "duplicate_active_axes",
      source: "current_products",
      value: productExposureState.duplicateActiveAxes
    },
    {
      key: "safety_level",
      source: "shared_context",
      value: safetyState.level
    }
  ];
}

export function buildSharedSkinDecisionContext(report = {}, options = {}) {
  const previousBundle = report?.decisionBundle && typeof report.decisionBundle === "object"
    ? report.decisionBundle
    : {};
  const previousContext = previousBundle?.context && typeof previousBundle.context === "object"
    ? previousBundle.context
    : {};
  const freeResult = getFreeResult(report);
  const priority = getPriority(freeResult, previousContext);
  const concernScores = getConcernScores(freeResult, previousContext);
  const surveyAnswers = getSurveyAnswers(report, freeResult, previousContext);
  const productExposureState = buildProductExposureState(report.currentProducts);
  const safetyState = buildSafetyState({
    priority,
    concernScores,
    productExposureState,
    surveyAnswers
  });
  const hashPayload = {
    priority,
    concernScores,
    surveyAnswers,
    productExposureState,
    safetyState,
    routineStructure: report?.routineStructure || null,
    photoObservations: report?.photoObservations || null
  };
  const contextHash = hashText(stableStringify(hashPayload));
  const previousHash = normalizeText(previousBundle.contextHash);
  const previousRevision = Math.max(0, parseFiniteNumber(previousBundle.contextRevision));
  const contextRevision = previousHash === contextHash && previousRevision > 0
    ? previousRevision
    : previousRevision + 1;
  const surveyAvailable = Object.keys(surveyAnswers).length > 0;
  const warnings = [
    ...(!priority.axis ? ["priority_axis_missing"] : []),
    ...(!Object.keys(concernScores).length ? ["concern_scores_missing"] : []),
    ...(!surveyAvailable ? ["survey_answers_not_persisted"] : []),
    ...(productExposureState.unknownProductCount ? ["current_product_evidence_incomplete"] : [])
  ];

  const context = {
    version: CONTEXT_VERSION,
    skinState: {
      priorityAxis: priority.axis,
      priorityScore: priority.score,
      concernScores
    },
    survey: {
      answers: surveyAnswers,
      completeness: surveyAvailable ? "available" : "not_persisted"
    },
    photo: {
      observations: report?.photoObservations || null
    },
    productExposureState,
    safetyState,
    routineState: {
      structure: report?.routineStructure || null
    },
    evidenceLedger: buildEvidenceLedger({
      priority,
      concernScores,
      productExposureState,
      safetyState
    }),
    metadata: {
      source: normalizeText(options.source) || "premium_report",
      warnings
    }
  };

  return {
    context,
    contextHash,
    contextRevision
  };
}

export const SHARED_SKIN_DECISION_CONTEXT_VERSION = CONTEXT_VERSION;
