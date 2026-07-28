import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveEvaluatorRecentInstabilityBoundaryPolicy } from "../lib/evaluator-recent-instability-boundary-policy.js";
import {
  resolveCliDirectory,
  resolveGeneratedAt
} from "./lib/verifier-cli-options.mjs";

const CAPTURE_DIR = resolveCliDirectory(
  "--capture-dir",
  process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
    path.join(process.cwd(), "tmp", "functional-shadow-captures")
);
const OUTPUT_DIR = resolveCliDirectory("--output-dir", path.join(process.cwd(), "tmp"));
const EXPOSURE_AUDIT_PATH = path.join(CAPTURE_DIR, "candidate-exposure-audit.json");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-actual-coverage.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-actual-coverage.md");

const ARTIFACT_JSON = new Set([
  "replay-summary.json",
  "aggregate-summary.json",
  "summary.json",
  "divergence-policy-review.json",
  "safety-review-packet.json",
  "safety-review-analysis.json",
  "recent-instability-guard-matrix.json",
  "candidate-exposure-audit.json",
  "exposure-readiness-review.json",
  "evaluator-hard-block-review.json",
  "evaluator-recent-instability-boundary-shadow.json"
]);

const STRONG_CAUTION_TAGS = new Set([
  "high_irritation_caution",
  "strong_active_caution",
  "retinoid_overlap_watch",
  "multiple_active_overlap_watch",
  "peeling_risk",
  "barrier_stress_watch",
  "sensitizing_active_watch"
]);

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function increment(map, key, amount = 1) {
  const normalized = normalizeText(key) || "unknown";
  map[normalized] = (map[normalized] || 0) + amount;
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function mergeDistribution(target, source = {}) {
  for (const [key, value] of Object.entries(source)) {
    increment(target, key, value);
  }
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function ensureExposureAudit() {
  const existing = await readJsonIfPresent(EXPOSURE_AUDIT_PATH);
  const hasRows = existing?.fixtureAudits?.some((fixture) => Array.isArray(fixture.candidateReviewRows));

  if (!hasRows) {
    execFileSync(process.execPath, [
      "scripts/run-functional-candidate-exposure-audit.mjs",
      "--capture-dir",
      CAPTURE_DIR
    ], {
      cwd: process.cwd(),
      stdio: "ignore",
      env: process.env
    });
  }
}

async function scanCaptureFiles() {
  const summary = {
    totalFilesScanned: 0,
    completeProductRowFixturesUsed: 0,
    excludedFixtureCounts: {}
  };

  let entries = [];
  try {
    entries = await readdir(CAPTURE_DIR, { withFileTypes: true });
  } catch {
    summary.captureDirectoryPresent = false;
    summary.excludedFixtureCounts = {};
    return summary;
  }

  summary.captureDirectoryPresent = true;

  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  summary.totalFilesScanned = jsonFiles.length;

  for (const name of jsonFiles) {
    if (ARTIFACT_JSON.has(name)) {
      increment(summary.excludedFixtureCounts, "analysis_or_summary_artifact");
      continue;
    }

    const fixture = await readJsonIfPresent(path.join(CAPTURE_DIR, name));
    if (!fixture || fixture.captureVersion !== "v1") {
      increment(summary.excludedFixtureCounts, "malformed_or_non_capture_json");
      continue;
    }

    const source = fixture.candidateSource || {};
    if (source.completeness === "complete" && source.candidateIdentityMode === "product_row") {
      summary.completeProductRowFixturesUsed += 1;
    } else if (source.completeness === "final_results_only") {
      increment(summary.excludedFixtureCounts, "final_results_only");
    } else {
      increment(summary.excludedFixtureCounts, source.completeness || "unsupported_capture_source");
    }
  }

  summary.excludedFixtureCounts = sortObject(summary.excludedFixtureCounts);
  return summary;
}

function axesFromRow(row = {}) {
  const axes = [];
  if (row.activeAxisPresent) axes.push({ axis: "exfoliation", source: "actual_candidate_review_row" });
  if (row.stabilizingAxisPresent) axes.push({ axis: "hydration", source: "actual_candidate_review_row" });
  return axes;
}

function surveySafetyFromRow(row = {}) {
  return {
    sensitivityRisk: row?.safetyContext?.highSensitivity ? "high" : "medium",
    recentSkinChange: row?.safetyContext?.recentInstability ? "yes" : "no",
    recentlyChangedProduct: row?.safetyContext?.recentInstability ? "yes" : "no"
  };
}

function goalPolicyFromRow(row = {}, fixture = {}) {
  return {
    rankingGoal: row.rankingGoal || fixture?.rankingContext?.rankingGoal || null,
    safetyGoal: row.safetyGoal || fixture?.rankingContext?.safetyGoal || null,
    recommendationGuard: row.recommendationGuard || fixture?.rankingContext?.recommendationGuard || null,
    highSensitivity: row?.safetyContext?.highSensitivity === true,
    recentInstability: row?.safetyContext?.recentInstability === true
  };
}

function productFromRow(row = {}) {
  return {
    id: row.productId || null,
    category: row.category || null,
    irritation_risk: row.irritationRisk === "unknown" ? null : row.irritationRisk,
    sensitivity_safe: typeof row.sensitivitySafe === "boolean" ? row.sensitivitySafe : null
  };
}

function productProfileFromRow(row = {}) {
  return {
    evaluable: row.profileEvaluable !== false,
    categoryRole: row.category || null,
    functionalAxes: axesFromRow(row),
    cautionTags: Array.isArray(row.cautionTags) ? row.cautionTags : []
  };
}

function candidateEvaluationFromRow(row = {}) {
  return {
    productId: row.productId || null,
    hardFilterStatus: row.hardFilterStatus || null,
    hardFilterReasons: Array.isArray(row.hardFilterReasons) ? row.hardFilterReasons : [],
    confidence: row.confidence || "unknown"
  };
}

function hasRecentInstabilityBoundaryReason(row = {}) {
  return row.hardFilterStatus === "blocked" &&
    Array.isArray(row.hardFilterReasons) &&
    row.hardFilterReasons.includes("recent_instability_active_limited");
}

function hasStrongCaution(row = {}) {
  return Array.isArray(row.cautionTags) &&
    row.cautionTags.some((tag) => STRONG_CAUTION_TAGS.has(normalizeText(tag)));
}

function isSerumCategory(row = {}) {
  const category = normalizeText(row.category);
  return category === "serum" || category === "serum_ampoule" || category === "ampoule";
}

function isMetadataIncomplete(row = {}) {
  return row.safetyMetadataProfile === "metadata_incomplete" ||
    row.irritationRisk === "unknown" ||
    row.sensitivitySafe == null ||
    row.profileEvaluable === false ||
    row.activeAxisPresent !== true && row.stabilizingAxisPresent !== true;
}

function applyPolicy(row, fixture) {
  return resolveEvaluatorRecentInstabilityBoundaryPolicy({
    candidateEvaluation: candidateEvaluationFromRow(row),
    surveySafety: surveySafetyFromRow(row),
    goalPolicy: goalPolicyFromRow(row, fixture),
    product: productFromRow(row),
    productProfile: productProfileFromRow(row)
  });
}

function createGapBucket() {
  return {
    observed: false,
    status: "not_observed_in_current_actual_captures",
    totalRows: 0,
    boundaryApplicableRows: 0,
    safeMetadataRows: 0,
    unsafeMetadataRows: 0,
    strongCautionRows: 0,
    decisionDistribution: {},
    categoryDistribution: {},
    safetyMetadataProfileDistribution: {},
    reasonDistribution: {}
  };
}

function addRowToBucket(bucket, row, policy) {
  bucket.observed = true;
  bucket.status = "observed_in_current_actual_captures";
  bucket.totalRows += 1;
  if (hasRecentInstabilityBoundaryReason(row)) bucket.boundaryApplicableRows += 1;
  if (row.safetyMetadataProfile === "safe_low_risk" || row.safetyMetadataProfile === "safe_medium_risk") {
    bucket.safeMetadataRows += 1;
  }
  if (row.safetyMetadataProfile === "unsafe_high_risk" ||
    row.irritationRisk === "high" ||
    row.sensitivitySafe === false) {
    bucket.unsafeMetadataRows += 1;
  }
  if (hasStrongCaution(row)) bucket.strongCautionRows += 1;
  increment(bucket.decisionDistribution, policy.boundaryDecision);
  increment(bucket.categoryDistribution, row.category);
  increment(bucket.safetyMetadataProfileDistribution, row.safetyMetadataProfile);
  for (const reason of policy.reasons || []) {
    increment(bucket.reasonDistribution, reason);
  }
}

function finalizeBucket(bucket) {
  return {
    ...bucket,
    decisionDistribution: sortObject(bucket.decisionDistribution),
    categoryDistribution: sortObject(bucket.categoryDistribution),
    safetyMetadataProfileDistribution: sortObject(bucket.safetyMetadataProfileDistribution),
    reasonDistribution: sortObject(bucket.reasonDistribution)
  };
}

function buildLimitations(gapCoverage) {
  const limitations = [];

  for (const [key, value] of Object.entries(gapCoverage)) {
    if (!value.observed) {
      limitations.push(`${key}:not_observed_in_current_actual_captures`);
    }
  }

  limitations.push("actual_capture_distribution_may_not_represent_real_users");
  limitations.push("coverage_collection_does_not_approve_runtime_policy_change");
  return limitations.sort();
}

function renderMarkdown(output) {
  const gapLines = Object.entries(output.gapCoverage).flatMap(([key, value]) => [
    `### ${key}`,
    `- status: ${value.status}`,
    `- total rows: ${value.totalRows}`,
    `- boundary applicable rows: ${value.boundaryApplicableRows}`,
    `- decisions: ${JSON.stringify(value.decisionDistribution)}`
  ]);

  return [
    "# Evaluator Boundary Actual Coverage",
    "",
    output.actualEvidenceAvailable
      ? "This is actual complete-capture coverage collection. It is not runtime policy approval and does not change evaluator, CandidatePolicy, UI, API, DB, Supabase, product data, capture fixtures, or existing recommendations."
      : "No actual complete product-row capture is available in this clean checkout. The artifact records that absence fail-closed and does not claim actual coverage or runtime policy approval.",
    "",
    "## Capture Summary",
    `- total JSON files scanned: ${output.captureSummary.totalFilesScanned}`,
    `- complete product-row fixtures used: ${output.captureSummary.completeProductRowFixturesUsed}`,
    `- excluded fixture/artifact counts: ${JSON.stringify(output.captureSummary.excludedFixtureCounts)}`,
    "",
    "## Candidate Summary",
    `- total candidate rows: ${output.candidateSummary.totalCandidateRows}`,
    `- boundary applicable rows: ${output.candidateSummary.boundaryApplicableRows}`,
    `- reviewed rows: ${output.candidateSummary.reviewedRows}`,
    "",
    "## Gap Coverage",
    ...gapLines,
    "",
    "## Decision Summary",
    `- ${JSON.stringify(output.decisionSummary)}`,
    "",
    "## Limitations",
    ...output.limitations.map((item) => `- ${item}`),
    "",
    "## Runtime",
    `- runtimeMutation: ${output.runtimeMutation}`
  ].join("\n");
}

await ensureExposureAudit();

const captureSummary = await scanCaptureFiles();
const candidateExposureAudit = await readJsonIfPresent(EXPOSURE_AUDIT_PATH);
const fixtureAudits = Array.isArray(candidateExposureAudit?.fixtureAudits)
  ? candidateExposureAudit.fixtureAudits
  : [];
const fixtureEvidenceAvailable =
  candidateExposureAudit?.evidenceType === "deterministic_contract_fixture";
const actualEvidenceAvailable =
  captureSummary.completeProductRowFixturesUsed > 0 && !fixtureEvidenceAvailable;
const rows = fixtureAudits.flatMap((fixture) =>
  (Array.isArray(fixture.candidateReviewRows) ? fixture.candidateReviewRows : [])
    .map((row) => ({ row, fixture }))
);
const highConfidenceRows = rows.filter(({ fixture }) => fixture.comparisonConfidence === "high");
const boundaryRows = highConfidenceRows.filter(({ row }) => hasRecentInstabilityBoundaryReason(row));
const gapCoverage = {
  activeLeaningOnly: createGapBucket(),
  metadataIncomplete: createGapBucket(),
  serumCategory: createGapBucket(),
  strongCaution: createGapBucket(),
  safeLowRiskHidden: createGapBucket()
};
const decisionSummary = {
  preserve_hard_block: 0,
  downgrade_to_collapsed_candidate: 0,
  requires_metadata_review: 0,
  not_applicable: 0
};
let highRiskCollapsedCount = 0;

for (const { row, fixture } of highConfidenceRows) {
  const policy = applyPolicy(row, fixture);

  if (hasRecentInstabilityBoundaryReason(row)) {
    increment(decisionSummary, policy.boundaryDecision);

    if (
      (row.safetyMetadataProfile === "unsafe_high_risk" || row.irritationRisk === "high" || row.sensitivitySafe === false) &&
      policy.boundaryDecision === "downgrade_to_collapsed_candidate"
    ) {
      highRiskCollapsedCount += 1;
    }
  }

  if (row.functionalProfile === "active_leaning" ||
    (row.activeAxisPresent === true && row.stabilizingAxisPresent !== true)) {
    addRowToBucket(gapCoverage.activeLeaningOnly, row, policy);
  }

  if (isMetadataIncomplete(row)) {
    addRowToBucket(gapCoverage.metadataIncomplete, row, policy);
  }

  if (isSerumCategory(row)) {
    addRowToBucket(gapCoverage.serumCategory, row, policy);
  }

  if (hasStrongCaution(row)) {
    addRowToBucket(gapCoverage.strongCaution, row, policy);
  }

  if (
    row.exposureStatus === "hidden_candidate" &&
    row.safetyMetadataProfile === "safe_low_risk" &&
    row.blockedBy?.evaluator === true &&
    hasRecentInstabilityBoundaryReason(row)
  ) {
    addRowToBucket(gapCoverage.safeLowRiskHidden, row, policy);
  }
}

for (const key of Object.keys(gapCoverage)) {
  gapCoverage[key] = finalizeBucket(gapCoverage[key]);
}

const output = {
  generatedAt: resolveGeneratedAt(),
  evidenceType: actualEvidenceAvailable
    ? "actual_complete_product_row_capture"
    : fixtureEvidenceAvailable
      ? "deterministic_contract_fixture"
    : "actual_capture_coverage_unavailable",
  actualEvidenceAvailable,
  fixtureEvidenceAvailable,
  captureSummary,
  candidateSummary: {
    totalCandidateRows: highConfidenceRows.length,
    boundaryApplicableRows: boundaryRows.length,
    reviewedRows: boundaryRows.length
  },
  gapCoverage,
  decisionSummary: sortObject(decisionSummary),
  highRiskProtection: {
    highRiskCollapsedCount,
    passed: highRiskCollapsedCount === 0
  },
  limitations: [
    ...buildLimitations(gapCoverage),
    ...(actualEvidenceAvailable ? [] : ["actual_complete_product_row_capture_not_available_in_clean_checkout"]),
    ...(fixtureEvidenceAvailable ? ["deterministic_fixture_is_not_actual_evidence"] : [])
  ].sort(),
  runtimeMutation: false
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(output), "utf8");

console.log("evaluator-boundary-actual-coverage summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  actualEvidenceAvailable: output.actualEvidenceAvailable,
  completeProductRowFixturesUsed: output.captureSummary.completeProductRowFixturesUsed,
  totalCandidateRows: output.candidateSummary.totalCandidateRows,
  boundaryApplicableRows: output.candidateSummary.boundaryApplicableRows,
  gapCoverage: Object.fromEntries(Object.entries(output.gapCoverage).map(([key, value]) => [
    key,
    {
      status: value.status,
      totalRows: value.totalRows,
      boundaryApplicableRows: value.boundaryApplicableRows,
      decisionDistribution: value.decisionDistribution
    }
  ])),
  highRiskProtection: output.highRiskProtection,
  limitations: output.limitations,
  runtimeMutation: output.runtimeMutation
}, null, 2));
