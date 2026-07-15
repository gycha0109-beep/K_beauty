export function buildRotatedPremiumReportPayload(premiumReport) {
  if (!premiumReport || typeof premiumReport !== "object" || Array.isArray(premiumReport)) {
    return null;
  }

  const {
    currentProducts,
    currentProductVerdicts,
    ...basePremiumReport
  } = premiumReport;

  return basePremiumReport;
}
