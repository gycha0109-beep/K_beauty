import { buildSharedSkinDecisionContext } from "./shared-skin-decision-context-v4.js";

export const EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_ADAPTER_VERSION =
  "exfoliation-normative-policy-skin-match-context-adapter-v1";

const SKIN_MATCH_RAW_HIGH_CONCERN_THRESHOLD = 18;
const SENSITIVE_AXES = Object.freeze(["barrier", "redness", "acne", "dehydration"]);

function finiteNumber(value) {
  const parsed = Number(value?.total ?? value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rebuildSkinMatchRawSafetyState(context) {
  const concernScores = context?.skinState?.concernScores || {};
  const productExposureState = context?.productExposureState || {};
  const previousSafetyState = context?.safetyState || {};
  const highSensitiveAxes = SENSITIVE_AXES.filter(
    (axis) => finiteNumber(concernScores[axis]) >= SKIN_MATCH_RAW_HIGH_CONCERN_THRESHOLD
  );
  const sensitivePriority = previousSafetyState.sensitivePriority === true;
  const sensitiveBurden = sensitivePriority || highSensitiveAxes.length > 0;
  const recentSkinChange = previousSafetyState.recentSkinChange || "unknown";
  const recentlyChangedProduct = previousSafetyState.recentlyChangedProduct || "unknown";
  const activeBurden = Boolean(
    (sensitiveBurden && productExposureState.activeExposurePresent) ||
      (Array.isArray(productExposureState.duplicateActiveAxes) &&
        productExposureState.duplicateActiveAxes.length) ||
      productExposureState.highCautionExposureCount
  );
  const stabilizeFirst = Boolean(
    activeBurden || recentSkinChange === "yes" || recentlyChangedProduct === "yes"
  );

  return {
    ...previousSafetyState,
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
      ...(Array.isArray(productExposureState.duplicateActiveAxes) &&
      productExposureState.duplicateActiveAxes.length
        ? ["duplicate_active_axis"]
        : []),
      ...(productExposureState.highCautionExposureCount ? ["high_caution_exposure"] : []),
      ...(recentSkinChange === "yes" ? ["recent_skin_change"] : []),
      ...(recentlyChangedProduct === "yes" ? ["recent_product_change"] : [])
    ]
  };
}

function rebuildEvidenceLedger(evidenceLedger, safetyState) {
  return (Array.isArray(evidenceLedger) ? evidenceLedger : []).map((row) =>
    row?.key === "safety_level" ? { ...row, value: safetyState.level } : row
  );
}

export function buildExfoliationNormativePolicySkinMatchContext(report = {}) {
  const shared = buildSharedSkinDecisionContext(report);
  const baseContext = shared?.context || {};
  const safetyState = rebuildSkinMatchRawSafetyState(baseContext);

  return Object.freeze({
    ...baseContext,
    safetyState: Object.freeze(safetyState),
    evidenceLedger: rebuildEvidenceLedger(baseContext.evidenceLedger, safetyState),
    metadata: Object.freeze({
      ...(baseContext.metadata || {}),
      concernScoreScale: "skin_match_raw",
      concernScoreHighThresholdSource: "skin_match_decision_engine_existing_boundary",
      adapterVersion: EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_ADAPTER_VERSION
    })
  });
}
