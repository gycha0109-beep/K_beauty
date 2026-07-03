import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { reviewFunctionalDivergencePolicy } from "../lib/functional-divergence-policy-review.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const REPLAY_SUMMARY_PATH = path.join(CAPTURE_DIR, "replay-summary.json");

function renderList(items, renderItem) {
  return items.length ? items.map(renderItem) : ["- none"];
}

function renderMarkdown(review) {
  return [
    "# Functional Divergence Policy Review",
    "",
    "## Scope",
    `- total captures: ${review.reviewScope.totalCaptures}`,
    `- replay results: ${review.reviewScope.totalReplayResults}`,
    `- included comparisons: ${review.reviewScope.includedComparisonCount}`,
    `- excluded low confidence: ${review.reviewScope.excludedLowConfidenceCount}`,
    `- medium comparisons tracked separately: ${review.reviewScope.mediumComparisonCount}`,
    "",
    "## Aggregate",
    `- topPick mismatch count/rate: ${review.aggregate.topPickMismatchCount} / ${review.aggregate.topPickMismatchRate}`,
    `- existing selected blocked: ${review.aggregate.existingSelectedBlockedCount}`,
    `- existing selected ranked lower: ${review.aggregate.existingSelectedRankedLowerCount}`,
    `- functional top missing: ${review.aggregate.functionalTopMissingCount}`,
    "",
    "## Divergence Reviews",
    ...renderList(review.divergenceReviews, (item) =>
      `- ${item.type}: ${item.reviewStatus}, cases ${item.caseCount}, occurrences ${item.occurrenceCount}, rate ${item.repeatRate}`
    ),
    "",
    "## Safety Review",
    `- status: ${review.safetyReviews.reviewStatus}`,
    `- total safety conflicts: ${review.safetyReviews.totalSafetyConflicts}`,
    ...Object.entries(review.safetyReviews.byReason).map(([reason, count]) => `- ${reason}: ${count}`),
    "",
    "## Policy Candidates",
    ...renderList(review.policyCandidates, (item) =>
      `- ${item.type}: ${item.reviewQuestion} (${item.evidence.repeatCount}/${item.evidence.comparableCases})`
    ),
    "",
    "## Observation Only",
    ...renderList(review.observationOnly, (item) => `- ${item.type}: ${item.reason}`),
    "",
    "## Limitations",
    ...review.limitations.map((item) => `- ${item}`),
    "",
    "## Next Action",
    `- ${review.nextActionRecommendation}`
  ].join("\n");
}

let replaySummary;

try {
  replaySummary = JSON.parse(await readFile(REPLAY_SUMMARY_PATH, "utf8"));
} catch (error) {
  console.error(`Missing or unreadable replay summary: ${REPLAY_SUMMARY_PATH}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const review = reviewFunctionalDivergencePolicy({ replaySummary });

await mkdir(CAPTURE_DIR, { recursive: true });
await writeFile(
  path.join(CAPTURE_DIR, "divergence-policy-review.json"),
  JSON.stringify(review, null, 2),
  "utf8"
);
await writeFile(
  path.join(CAPTURE_DIR, "divergence-policy-review.md"),
  renderMarkdown(review),
  "utf8"
);

console.log("functional-divergence-policy-review summary");
console.log(JSON.stringify({
  includedHighConfidenceCount: review.reviewScope.includedComparisonCount,
  topPickMismatchRate: review.aggregate.topPickMismatchRate,
  existingSelectedBlockedCount: review.aggregate.existingSelectedBlockedCount,
  policyReviewCandidateCount: review.policyCandidates.length,
  safetyReviewRequiredCount: review.safetyReviews.totalSafetyConflicts,
  observationOnlyCount: review.observationOnly.length,
  comparisonLimitationCount: review.divergenceReviews.filter((item) => item.reviewStatus === "comparison_limit").length,
  nextActionRecommendation: review.nextActionRecommendation
}, null, 2));
