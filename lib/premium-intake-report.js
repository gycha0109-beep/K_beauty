import { rebuildPremiumDecisionState } from "@/lib/premium-decision-state";
import { sanitizePremiumIntake } from "@/lib/premium-intake";

export function enrichPremiumReportWithIntake(report, input, locale = "ko") {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return report;
  }

  const premiumIntake = sanitizePremiumIntake(input);

  return rebuildPremiumDecisionState(
    {
      ...report,
      premiumIntake
    },
    {
      locale,
      source: "full_report_premium_intake"
    }
  );
}
