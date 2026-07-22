import { rebuildPremiumDecisionState } from "./premium-decision-state.js";

export function buildRotatedPremiumReportPayload(premiumReport) {
  if (!premiumReport || typeof premiumReport !== "object" || Array.isArray(premiumReport)) {
    return null;
  }

  const {
    currentProducts,
    currentProductVerdicts,
    ...basePremiumReport
  } = premiumReport;

  if (!premiumReport.decisionBundle) {
    return basePremiumReport;
  }

  return rebuildPremiumDecisionState(
    {
      ...basePremiumReport,
      currentProducts: null,
      currentProductVerdicts: []
    },
    {
      locale: premiumReport.decisionBundle.locale || "ko",
      source: "premium_report_session_rotation"
    }
  );
}
