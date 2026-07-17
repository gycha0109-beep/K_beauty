// v2 keeps these exports as compatibility shims for older callers.
// Classification is now owned by lib/face-lab-hosted-evaluation.js.
export function hardenHostedEvaluationRecord(record) {
  return record;
}

export function hardenHostedEvaluationSummary(records, baseSummary) {
  void records;
  return baseSummary;
}

export function hardenHostedEvaluationReport(report) {
  return report;
}
