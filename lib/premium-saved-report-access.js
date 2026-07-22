const SAVED_PREMIUM_REPORT_ENTITLEMENTS = new Set(["paid", "admin_override"]);

export function hasSavedPremiumReportEntitlement(access) {
  return SAVED_PREMIUM_REPORT_ENTITLEMENTS.has(access?.entitlement || "none");
}

export function canReadSavedPremiumReport({ access, report, requestedReportId, userId } = {}) {
  return Boolean(
    userId &&
      requestedReportId &&
      hasSavedPremiumReportEntitlement(access) &&
      report?.id === requestedReportId &&
      report?.user_id === userId &&
      report?.report_type === "premium" &&
      report?.premium_report &&
      typeof report.premium_report === "object"
  );
}
