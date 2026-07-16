import { classifyPremiumSnapshotReplay } from "@/lib/premium-report-snapshot";

export function classifyFinalizedPremiumSession(existingSavedReport, candidateReport) {
  if (!existingSavedReport?.premium_report) {
    return { status: "open", savedReport: null, replay: null };
  }

  const replay = classifyPremiumSnapshotReplay(
    existingSavedReport.premium_report,
    candidateReport
  );

  if (replay.status === "existing") {
    return { status: "existing", savedReport: existingSavedReport, replay };
  }

  return { status: "conflict", savedReport: existingSavedReport, replay };
}
