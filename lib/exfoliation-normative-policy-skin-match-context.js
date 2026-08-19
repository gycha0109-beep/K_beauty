import { buildSharedSkinDecisionContext } from "./shared-skin-decision-context-v4.js";

export const EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_VERSION =
  "exfoliation-normative-policy-skin-match-context-v1";

const RAW_SKIN_MATCH_HIGH_CONCERN_THRESHOLD = 18;

export function buildExfoliationNormativePolicySkinMatchContext(report = {}) {
  const shared = buildSharedSkinDecisionContext(report, {
    source: "exfoliation_normative_policy_skin_match_context",
    concernScoreScale: "skin_match_raw"
  });
  const baseContext = shared?.context || {};

  return Object.freeze({
    ...baseContext,
    metadata: Object.freeze({
      ...(baseContext.metadata || {}),
      concernScoreScale: "skin_match_raw",
      concernScoreHighThreshold: RAW_SKIN_MATCH_HIGH_CONCERN_THRESHOLD,
      concernScoreAuthority: "skin_match_decision_engine_raw_score_card",
      contextAdapterVersion: EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_VERSION
    })
  });
}
