const ANALYSIS_STATUSES = new Set([
  "available",
  "partial",
  "insufficient_evidence",
  "unavailable"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalAnalysisValid(value) {
  return Boolean(
    isObject(value) &&
      value.schemaVersion === "face-lab-observation-v1" &&
      ANALYSIS_STATUSES.has(value.status) &&
      isObject(value.quality) &&
      isObject(value.observations) &&
      isObject(value.coverage) &&
      value?.privacy?.sourceImagePersisted === false
  );
}

export function hardenHostedEvaluationRecord(record, responsePayload) {
  const analysis = isObject(responsePayload?.data?.analysis)
    ? responsePayload.data.analysis
    : null;

  return {
    ...record,
    privacyAudit: {
      ...(record?.privacyAudit || {}),
      canonicalContractInvalid: Boolean(analysis && !isCanonicalAnalysisValid(analysis))
    }
  };
}

function removeIssue(issues, code) {
  return issues.filter((issue) => issue?.code !== code);
}

export function hardenHostedEvaluationSummary(records, baseSummary) {
  const safeRecords = Array.isArray(records) ? records : [];
  let canonicalContractFailures = 0;
  let eligibilityMismatches = 0;
  let requestFailures = 0;

  for (const record of safeRecords) {
    if (record?.privacyAudit?.canonicalContractInvalid) {
      canonicalContractFailures += 1;
    }
    if (
      record?.requestError ||
      !Number.isInteger(record?.httpStatus) ||
      record.httpStatus < 200 ||
      record.httpStatus >= 300
    ) {
      requestFailures += 1;
    }
    const observedEligibility = record?.eligibility
      ? (record.eligibility.faceLabEligible ? "eligible" : "ineligible")
      : null;
    if (observedEligibility !== record?.expectedEligibility) {
      eligibilityMismatches += 1;
    }
  }

  const previousRequestFailures = Number(baseSummary?.requestFailures || 0);
  const previousHardFailures = Number(baseSummary?.hardInvariantFailures || 0);
  const hardInvariantFailures =
    previousHardFailures - previousRequestFailures + requestFailures + canonicalContractFailures;
  let issues = Array.isArray(baseSummary?.issues)
    ? removeIssue(baseSummary.issues, "hard_invariant_failure")
    : [];
  if (hardInvariantFailures) {
    issues.unshift({
      severity: "P0",
      code: "hard_invariant_failure",
      count: hardInvariantFailures
    });
  }
  issues = removeIssue(issues, "eligibility_mismatch");
  if (eligibilityMismatches) {
    issues.push({
      severity: "P1",
      code: "eligibility_mismatch",
      count: eligibilityMismatches
    });
  }

  return {
    ...baseSummary,
    requestFailures,
    canonicalContractFailures,
    eligibilityMismatches,
    hardInvariantFailures,
    issues
  };
}

export function hardenHostedEvaluationReport(report, summary) {
  const insertion = [
    `- Canonical contract failures: ${summary.canonicalContractFailures}`,
    `- Eligibility mismatches: ${summary.eligibilityMismatches}`
  ].join("\n");
  const anchor = `- Total hard invariant failures: ${summary.hardInvariantFailures}`;
  return report.includes(anchor)
    ? report.replace(anchor, `${insertion}\n${anchor}`)
    : `${report.trim()}\n\n${insertion}\n`;
}
