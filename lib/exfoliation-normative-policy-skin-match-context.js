import { buildSharedSkinDecisionContext } from "./shared-skin-decision-context-v4.js";

export const EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_VERSION =
  "exfoliation-normative-policy-skin-match-context-v1";

const RAW_SKIN_MATCH_HIGH_CONCERN_THRESHOLD = 18;
const SENSITIVE_AXES = Object.freeze(["barrier", "redness", "acne", "dehydration"]);

function finiteNumber(value) {
  const parsed = Number(value?.total ?? value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function rebuildRawSkinMatchSafetyState(context = {}) {
  const concernScores = context?.skinState?.concernScores || {};
  const exposure = context?.productExposureState || {};
  const previous = context?.safetyState || {};
  const highSensitiveAxes = SENSITIVE_AXES.filter(
    (axis) => finiteNumber(concernScores[axis]) >= RAW_SKIN_MATCH_HIGH_CONCERN_THRESHOLD
  );
  const sensitivePriority = previous.sensitivePriority === true;
  const sensitiveBurden = sensitivePriority || highSensitiveAxes.length > 0;
  const activeBurden = Boolean(
    (sensitiveBurden && exposure.activeExposurePresent) ||
      (Array.isArray(exposure.duplicateActiveAxes) && exposure.duplicateActiveAxes.length > 0) ||
      exposure.highCautionExposureCount
  );
  const recentSkinChange = previous.recentSkinChange || "unknown";
  const recentlyChangedProduct = previous.recentlyChangedProduct || "unknown";
  const stabilizeFirst = Boolean(
    activeBurden || recentSkinChange === "yes" || recentlyChangedProduct === "yes"
  );

  return {
    ...previous,
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
    reasonCodes: unique([
      ...(sensitivePriority ? ["sensitive_priority"] : []),
      ...(highSensitiveAxes.length ? ["high_sensitive_axis"] : []),
      ...(exposure.activeExposurePresent ? ["active_exposure_present"] : []),
      ...(Array.isArray(exposure.duplicateActiveAxes) && exposure.duplicateActiveAxes.length
        ? ["duplicate_active_axis"]
        : []),
      ...(exposure.highCautionExposureCount ? ["high_caution_exposure"] : []),
      ...(recentSkinChange === "yes" ? ["recent_skin_change"] : []),
      ...(recentlyChangedProduct === "yes" ? ["recent_product_change"] : [])
    ])
  };
}

function rebuildSafetyLedger(evidenceLedger, safetyState) {
  return (Array.isArray(evidenceLedger) ? evidenceLedger : []).map((row) =>
    row?.key === "safety_level" ? { ...row, value: safetyState.level } : row
  );
}

export function buildExfoliationNormativePolicySkinMatchContext(report = {}) {
  const shared = buildSharedSkinDecisionContext(report, {
    source: "exfoliation_normative_policy_skin_match_context"
  });
  const baseContext = shared?.context || {};
  const safetyState = rebuildRawSkinMatchSafetyState(baseContext);

  return Object.freeze({
    ...baseContext,
    safetyState: Object.freeze(safetyState),
    evidenceLedger: rebuildSafetyLedger(baseContext.evidenceLedger, safetyState),
    metadata: Object.freeze({
      ...(baseContext.metadata || {}),
      concernScoreScale: "skin_match_raw",
      concernScoreHighThreshold: RAW_SKIN_MATCH_HIGH_CONCERN_THRESHOLD,
      concernScoreAuthority: "skin_match_decision_engine_raw_score_card",
      contextAdapterVersion: EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_VERSION
    })
  });
}
