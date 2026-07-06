import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { reviewFunctionalExposureReadiness } from "../lib/functional-exposure-readiness-review.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const EXPOSURE_AUDIT_PATH = path.join(CAPTURE_DIR, "candidate-exposure-audit.json");
const REPLAY_SUMMARY_PATH = path.join(CAPTURE_DIR, "replay-summary.json");
const JSON_OUTPUT = path.join(CAPTURE_DIR, "exposure-readiness-review.json");
const MD_OUTPUT = path.join(CAPTURE_DIR, "exposure-readiness-review.md");

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function ensurePrerequisites() {
  if (!await readJsonIfPresent(REPLAY_SUMMARY_PATH)) {
    execFileSync(process.execPath, ["scripts/replay-functional-shadow-captures.mjs"], {
      cwd: process.cwd(),
      stdio: "ignore",
      env: process.env
    });
  }

  if (!await readJsonIfPresent(EXPOSURE_AUDIT_PATH)) {
    execFileSync(process.execPath, ["scripts/run-functional-candidate-exposure-audit.mjs"], {
      cwd: process.cwd(),
      stdio: "ignore",
      env: process.env
    });
  }
}

function topEntries(distribution = {}, limit = 5) {
  return Object.entries(distribution)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

function renderDistribution(distribution = {}) {
  const entries = Object.entries(distribution);

  if (!entries.length) return ["- none"];
  return entries.map(([key, value]) => `- ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
}

function renderMarkdown(review) {
  return [
    "# Functional Exposure Readiness Review",
    "",
    "Shadow-only review for CandidatePolicy integration readiness. This is not runtime approval.",
    "",
    "## Review Scope",
    `- included confidence: ${review.reviewScope.includedConfidence.join(", ")}`,
    `- included captures: ${review.aggregate.includedCaptureCount}`,
    `- reviewed candidates: ${review.aggregate.reviewedCandidateCount}`,
    "",
    "## Aggregate",
    ...renderDistribution(review.aggregate.exposureStatusDistribution),
    "",
    "## Hidden Reason Review",
    `- hidden count: ${review.hiddenReasonReview.hiddenCount}`,
    `- safe_low_risk hidden count: ${review.hiddenReasonReview.safeLowRiskHiddenCount}`,
    "- evaluator hard filter reasons:",
    ...renderDistribution(review.hiddenReasonReview.evaluatorHardFilterReasonDistribution),
    "- recent instability guard reasons:",
    ...renderDistribution(review.hiddenReasonReview.recentInstabilityGuardReasonDistribution),
    "- safe_low_risk hidden reasons:",
    ...renderDistribution(review.hiddenReasonReview.safeLowRiskHiddenReasonDistribution),
    "- safe_low_risk hidden by ranking goal:",
    ...renderDistribution(review.hiddenReasonReview.safeLowRiskHiddenByRankingGoal),
    "- safe_low_risk hidden by safety goal:",
    ...renderDistribution(review.hiddenReasonReview.safeLowRiskHiddenBySafetyGoal),
    "- safe_low_risk hidden by recommendation guard:",
    ...renderDistribution(review.hiddenReasonReview.safeLowRiskHiddenByRecommendationGuard),
    "- blocked source split:",
    ...renderDistribution(review.hiddenReasonReview.hiddenBlockedSourceDistribution),
    "- safe_low_risk hidden blocked source split:",
    ...renderDistribution(review.hiddenReasonReview.safeLowRiskHiddenBlockedSourceDistribution),
    "",
    "## Collapsed Review",
    `- collapsed count: ${review.collapsedReview.collapsedCount}`,
    `- collapsed total ratio: ${review.collapsedReview.collapsedTotalRatio}`,
    `- duplicate/supports_goal flipped to hidden: ${review.collapsedReview.duplicateOrSupportsGoalFlippedToHiddenCount}`,
    `- collapsed/hidden overlap: ${review.collapsedReview.collapsedHiddenOverlapCount}`,
    "- safety metadata profile:",
    ...renderDistribution(review.collapsedReview.collapsedSafetyMetadataProfileDistribution),
    "- category:",
    ...renderDistribution(review.collapsedReview.collapsedCategoryDistribution),
    "- functional profile:",
    ...renderDistribution(review.collapsedReview.collapsedFunctionalProfileDistribution),
    "- guard decision:",
    ...renderDistribution(review.collapsedReview.collapsedGuardDecisionDistribution),
    "- implementation hint:",
    ...renderDistribution(review.collapsedReview.collapsedImplementationHintDistribution),
    "",
    "## Integration Readiness",
    `- status: ${review.integrationReadiness.status}`,
    `- runtime approval: ${review.integrationReadiness.runtimeApproval}`,
    `- allowed next step: ${review.integrationReadiness.allowedNextStep}`,
    "",
    "## Limitations",
    ...renderDistribution(Object.fromEntries(review.limitations.map((item) => [item, true]))),
    "",
    "## Next Action",
    `- ${review.nextAction}`
  ].join("\n");
}

await ensurePrerequisites();

const exposureAudit = await readJsonIfPresent(EXPOSURE_AUDIT_PATH);
const replaySummary = await readJsonIfPresent(REPLAY_SUMMARY_PATH);
const review = reviewFunctionalExposureReadiness({ exposureAudit, replaySummary });

await mkdir(CAPTURE_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(review, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(review), "utf8");

const topHiddenReasons = topEntries(
  review.hiddenReasonReview.safeLowRiskHiddenReasonDistribution,
  5
).map(([reason, count]) => `${reason}:${count}`);

console.log("functional-exposure-readiness-review summary");
console.log(JSON.stringify({
  highConfidenceCaptureCount: review.aggregate.includedCaptureCount,
  primary: review.aggregate.exposureStatusDistribution.primary_candidate || 0,
  contextual: review.aggregate.exposureStatusDistribution.contextual_candidate || 0,
  collapsed: review.aggregate.exposureStatusDistribution.collapsed_candidate || 0,
  hidden: review.aggregate.exposureStatusDistribution.hidden_candidate || 0,
  insufficient: review.aggregate.exposureStatusDistribution.insufficient_evidence_candidate || 0,
  safeLowRiskHiddenCount: review.hiddenReasonReview.safeLowRiskHiddenCount,
  topHiddenReasons,
  integrationReadiness: review.integrationReadiness.status,
  limitations: review.limitations,
  nextAction: review.nextAction
}, null, 2));
