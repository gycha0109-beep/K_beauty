import {
  CAMPAIGN_REPORT_SCHEMA_VERSION,
  REPORT_REVIEW_SUBMISSION_SCHEMA_VERSION,
  REPORT_REVISION_LINK_SCHEMA_VERSION,
  T8_FORBIDDEN_CLAIM_PATTERN,
  validateCampaignReport,
  validateInterpretationClaim,
  validateReportReviewSubmission,
  validateReportRevisionLink
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { REPORT_LIMITATIONS, REPORT_POLICY } from "./policy.js";
import { verifyCampaignEvidenceSnapshotIntegrity, verifyCampaignMetricSetIntegrity } from "./derive.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semanticDigest(value, omitted) {
  const semantic = { ...value };
  for (const key of omitted) delete semantic[key];
  return sha256Hex(stableStringify(semantic));
}

function metricRecord(metricSet, metricId) {
  const [kind, name] = metricId.split(":");
  if (kind === "stage") return metricSet.stageMetrics[name] || null;
  if (kind === "terminal") {
    const count = metricSet.terminalOutcomes[name];
    return Number.isInteger(count) ? { numerator: count, denominator: 20 * metricSet.runCount, fractionLabel: `${count}/${20 * metricSet.runCount}`, percent: Math.round((count / (20 * metricSet.runCount)) * 1000) / 10 } : null;
  }
  if (kind === "failure") {
    const count = metricSet.failureGroups[name];
    return Number.isInteger(count) ? { numerator: count, denominator: 20 * metricSet.runCount, fractionLabel: `${count}/${20 * metricSet.runCount}`, percent: Math.round((count / (20 * metricSet.runCount)) * 1000) / 10 } : null;
  }
  return null;
}

function directStatement(subject, record) {
  return `${subject}: ${record.fractionLabel} (${record.percent.toFixed(1)}%).`;
}

function createClaim({ claimId, claimType, subject, statement, sourceMetricIds, sourceSlotIds = [], comparisonDirection = "none" }) {
  if (T8_FORBIDDEN_CLAIM_PATTERN.test(statement)) return failure("report_claim_invalid", "statement", "forbidden_language");
  const semantic = {
    claimId,
    claimType,
    subject,
    statement,
    sourceMetricIds: [...sourceMetricIds].sort(),
    sourceSlotIds: [...sourceSlotIds].sort(),
    comparisonDirection,
    authority: "descriptive_only"
  };
  const claim = deepFreeze({ ...semantic, claimDigest: sha256Hex(stableStringify(semantic)) });
  return validateInterpretationClaim(claim).ok ? Object.freeze({ ok: true, claim }) : failure("report_claim_invalid", "$", "contract");
}

export function deriveInterpretationClaims(metricSet) {
  if (!verifyCampaignMetricSetIntegrity(metricSet)) return failure("report_metric_set_invalid", "metricSet");
  const claims = [];
  for (const name of Object.keys(metricSet.stageMetrics).sort()) {
    const record = metricRecord(metricSet, `stage:${name}`);
    const built = createClaim({ claimId: `stage_${name}`, claimType: "direct_rate", subject: name, statement: directStatement(name, record), sourceMetricIds: [`stage:${name}`] });
    if (!built.ok) return built;
    claims.push(built.claim);
  }
  for (const name of Object.keys(metricSet.terminalOutcomes).sort()) {
    const record = metricRecord(metricSet, `terminal:${name}`);
    const built = createClaim({ claimId: `terminal_${name}`, claimType: "direct_count", subject: name, statement: directStatement(name, record), sourceMetricIds: [`terminal:${name}`] });
    if (!built.ok) return built;
    claims.push(built.claim);
  }
  for (const name of Object.keys(metricSet.failureGroups).sort()) {
    const count = metricSet.failureGroups[name];
    if (count === 0) continue;
    const record = metricRecord(metricSet, `failure:${name}`);
    const built = createClaim({ claimId: `pattern_${name}`, claimType: "operational_pattern", subject: name, statement: directStatement(name, record), sourceMetricIds: [`failure:${name}`] });
    if (!built.ok) return built;
    claims.push(built.claim);
  }
  if (metricSet.comparison) {
    for (const [name, delta] of Object.entries(metricSet.comparison.stageDeltas).sort(([left], [right]) => left.localeCompare(right))) {
      const statement = `${name}: provider A ${delta.providerA}/20, provider B ${delta.providerB}/20, A-minus-B ${delta.countDeltaAminusB} slots (${delta.percentagePointDeltaAminusB.toFixed(1)} percentage points).`;
      const built = createClaim({ claimId: `comparison_${name}`, claimType: "descriptive_difference", subject: name, statement, sourceMetricIds: [`comparison:stage:${name}`], comparisonDirection: "provider_a_minus_b" });
      if (!built.ok) return built;
      claims.push(built.claim);
    }
  }
  return Object.freeze({ ok: true, claims: deepFreeze(claims.sort((left, right) => left.claimId.localeCompare(right.claimId))) });
}

export function verifyInterpretationClaimAgainstMetrics(claim, metricSet) {
  if (!validateInterpretationClaim(claim).ok || T8_FORBIDDEN_CLAIM_PATTERN.test(claim.statement)) return false;
  const { claimDigest, ...semantic } = claim;
  if (claimDigest !== sha256Hex(stableStringify(semantic))) return false;
  if (claim.sourceMetricIds.length !== 1 || claim.sourceSlotIds.length !== 0) return false;
  const metricId = claim.sourceMetricIds[0];
  if (metricId.startsWith("comparison:stage:")) {
    const name = metricId.slice("comparison:stage:".length);
    const delta = metricSet.comparison?.stageDeltas?.[name];
    if (!delta) return false;
    const expected = `${name}: provider A ${delta.providerA}/20, provider B ${delta.providerB}/20, A-minus-B ${delta.countDeltaAminusB} slots (${delta.percentagePointDeltaAminusB.toFixed(1)} percentage points).`;
    return claim.statement === expected && claim.claimType === "descriptive_difference";
  }
  const record = metricRecord(metricSet, metricId);
  if (!record) return false;
  return claim.statement === directStatement(claim.subject, record);
}

export function createReportReviewSubmission({ sourceSnapshot, metricSet, reviewPackage, reviewerId, reviewedAt = new Date().toISOString() }) {
  if (!verifyCampaignEvidenceSnapshotIntegrity(sourceSnapshot) || !verifyCampaignMetricSetIntegrity(metricSet) || !TOKEN.test(reviewerId || "") || !Number.isFinite(Date.parse(reviewedAt)) || new Date(reviewedAt).toISOString() !== reviewedAt || reviewPackage.sourceSnapshotDigest !== sourceSnapshot.sourceSnapshotDigest || reviewPackage.packageDigest === undefined) return failure("report_review_submission_invalid", "$", null);
  const semantic = {
    schemaVersion: REPORT_REVIEW_SUBMISSION_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    metricSetDigest: metricSet.metricSetDigest,
    reviewPackageDigest: reviewPackage.packageDigest,
    reviewerId,
    checks: {
      sourceIntegrityReviewed: true,
      denominatorReviewed: true,
      claimsReviewed: true,
      holdsVisible: true,
      contactSheetsReviewed: true
    }
  };
  const submission = deepFreeze({ ...semantic, reviewedAt, submissionDigest: sha256Hex(stableStringify(semantic)) });
  return validateReportReviewSubmission(submission).ok ? Object.freeze({ ok: true, submission }) : failure("report_review_submission_invalid", "$", "contract");
}

export function verifyReportReviewSubmissionIntegrity(submission) {
  if (!validateReportReviewSubmission(submission).ok) return false;
  return submission.submissionDigest === semanticDigest(submission, ["reviewedAt", "submissionDigest"]);
}

export function buildCampaignReport({ sourceSnapshot, metricSet, reviewPackage, reviewSubmission, predecessorReportDigest = null }) {
  if (!verifyCampaignEvidenceSnapshotIntegrity(sourceSnapshot) || !verifyCampaignMetricSetIntegrity(metricSet) || !verifyReportReviewSubmissionIntegrity(reviewSubmission)) return failure("campaign_report_invalid", "source");
  if (metricSet.sourceSnapshotDigest !== sourceSnapshot.sourceSnapshotDigest || reviewPackage.sourceSnapshotDigest !== sourceSnapshot.sourceSnapshotDigest || reviewSubmission.sourceSnapshotDigest !== sourceSnapshot.sourceSnapshotDigest || reviewSubmission.metricSetDigest !== metricSet.metricSetDigest || reviewSubmission.reviewPackageDigest !== reviewPackage.packageDigest) return failure("campaign_report_invalid", "references");
  if (!(predecessorReportDigest === null || /^[a-f0-9]{64}$/.test(predecessorReportDigest))) return failure("campaign_report_invalid", "predecessorReportDigest");
  const claimsResult = deriveInterpretationClaims(metricSet);
  if (!claimsResult.ok) return claimsResult;
  const sourceRuns = sourceSnapshot.sourceRuns;
  const semantic = {
    schemaVersion: CAMPAIGN_REPORT_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    reportMode: sourceSnapshot.reportScope,
    title: sourceSnapshot.reportScope === "single_run" ? "Bejewely Synthetic Pilot Campaign Report" : "Bejewely Synthetic Pilot Provider Comparison Report",
    scope: {
      campaignRunIds: sourceRuns.map((run) => run.campaignRunId).sort(),
      comparisonGroupId: sourceRuns[0].comparisonGroupId,
      primaryDenominatorPerRun: 20,
      closedAtByRun: Object.fromEntries(sourceRuns.map((run) => [run.campaignRunId, run.closedAt]).sort(([left], [right]) => left.localeCompare(right)))
    },
    metricSetDigest: metricSet.metricSetDigest,
    reviewPackageDigest: reviewPackage.packageDigest,
    reportReviewDigest: reviewSubmission.submissionDigest,
    interpretationClaims: claimsResult.claims,
    limitations: [...REPORT_LIMITATIONS],
    g4TimeBoundary: {
      mode: "as_of_closeout",
      currentStatusAppendixIncluded: false,
      statusVerifiedAt: null
    },
    predecessorReportDigest,
    reportPolicy: REPORT_POLICY
  };
  const report = deepFreeze({ ...semantic, reportDigest: sha256Hex(stableStringify(semantic)) });
  return validateCampaignReport(report).ok ? Object.freeze({ ok: true, report }) : failure("campaign_report_invalid", "$", "contract");
}

export function verifyCampaignReportIntegrity(report, metricSet = null) {
  if (!validateCampaignReport(report).ok || report.reportDigest !== semanticDigest(report, ["reportDigest"])) return false;
  if (metricSet) {
    if (!verifyCampaignMetricSetIntegrity(metricSet) || report.metricSetDigest !== metricSet.metricSetDigest || !report.interpretationClaims.every((claim) => verifyInterpretationClaimAgainstMetrics(claim, metricSet))) return false;
  }
  return true;
}

export function createReportRevisionLink({ predecessorReport, successorReport, reasonCode, linkedAt = new Date().toISOString() }) {
  if (!verifyCampaignReportIntegrity(predecessorReport) || !verifyCampaignReportIntegrity(successorReport) || predecessorReport.sourceSnapshotDigest !== successorReport.sourceSnapshotDigest || successorReport.predecessorReportDigest !== predecessorReport.reportDigest || !Number.isFinite(Date.parse(linkedAt)) || new Date(linkedAt).toISOString() !== linkedAt) return failure("report_revision_link_invalid", "$", null);
  const semantic = {
    schemaVersion: REPORT_REVISION_LINK_SCHEMA_VERSION,
    sourceSnapshotDigest: predecessorReport.sourceSnapshotDigest,
    predecessorReportDigest: predecessorReport.reportDigest,
    successorReportDigest: successorReport.reportDigest,
    reasonCode
  };
  const link = deepFreeze({ ...semantic, linkedAt, linkDigest: sha256Hex(stableStringify(semantic)) });
  return validateReportRevisionLink(link).ok ? Object.freeze({ ok: true, link }) : failure("report_revision_link_invalid", "$", "contract");
}

export function verifyReportRevisionLinkIntegrity(link) {
  if (!validateReportRevisionLink(link).ok) return false;
  return link.linkDigest === semanticDigest(link, ["linkedAt", "linkDigest"]);
}
