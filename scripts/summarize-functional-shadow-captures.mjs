import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const REPLAY_SUMMARY_PATH = path.join(CAPTURE_DIR, "replay-summary.json");

function increment(map, key, value = 1) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + value;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function readReplaySummary() {
  try {
    return JSON.parse(await readFile(REPLAY_SUMMARY_PATH, "utf8"));
  } catch {
    return null;
  }
}

function buildPolicySignals({ replay, confidenceDistribution, divergenceTypeDistribution, categoryComparison }) {
  const signals = [];
  const highConfidenceResults = (replay?.results || []).filter(
    (item) => item?.comparison?.comparisonSummary?.comparisonConfidence === "high"
  );

  if ((divergenceTypeDistribution.existing_selected_but_blocked || 0) > 0 && highConfidenceResults.length > 0) {
    signals.push("existing_selected_but_blocked_seen_in_high_confidence_comparison");
  }

  if ((divergenceTypeDistribution.functional_top_candidate_missing_from_existing || 0) > 0) {
    signals.push("functional_top_candidate_missing_from_existing_observed");
  }

  Object.entries(categoryComparison.insufficientData || {}).forEach(([category, count]) => {
    if (count >= 2) {
      signals.push(`category_repeated_insufficient_data:${category}`);
    }
  });

  if ((confidenceDistribution.low || 0) > (confidenceDistribution.high || 0) + (confidenceDistribution.medium || 0)) {
    signals.push("source_completeness_too_low_for_policy_conclusion");
  }

  return signals;
}

function buildLimitations(replay, confidenceDistribution) {
  const limitations = [...(replay?.limitations || [])];

  if (!replay) {
    limitations.push("replay_summary_missing_run_replay_first");
  }

  if ((replay?.validComparisons || replay?.replayedCount || 0) < 5) {
    limitations.push("sample_size_too_low_for_policy_conclusion");
  }

  if ((confidenceDistribution.low || 0) > 0) {
    limitations.push("low_confidence_comparisons_must_not_drive_strong_policy_changes");
  }

  return Array.from(new Set(limitations));
}

function renderMarkdown(summary) {
  return [
    "# Functional Shadow Capture Aggregate",
    "",
    `- total captures: ${summary.totalCaptures}`,
    `- valid comparisons: ${summary.validComparisons}`,
    `- topPick match rate: ${summary.topPickMatchRate}`,
    `- average overlap rate: ${summary.averageOverlapRate}`,
    "",
    "## Confidence",
    ...Object.entries(summary.comparisonConfidenceDistribution).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Divergences",
    ...Object.entries(summary.divergenceTypeDistribution).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Policy Signals",
    ...(summary.policySignals.length ? summary.policySignals : ["none"]).map((item) => `- ${item}`),
    "",
    "## Limitations",
    ...summary.limitations.map((item) => `- ${item}`)
  ].join("\n");
}

const replay = await readReplaySummary();
const results = Array.isArray(replay?.results) ? replay.results : [];
const comparisonConfidenceDistribution = {
  high: replay?.comparisonConfidenceDistribution?.high || 0,
  medium: replay?.comparisonConfidenceDistribution?.medium || 0,
  low: replay?.comparisonConfidenceDistribution?.low || 0
};
const candidateSourceCompletenessDistribution = {
  ...(replay?.candidateSourceCompletenessDistribution || {})
};
const candidateSourceStageDistribution = {
  ...(replay?.candidateSourceStageDistribution || {})
};
const candidateIdentityModeDistribution = {
  ...(replay?.candidateIdentityModeDistribution || {})
};
const divergenceTypeDistribution = { ...(replay?.divergenceTypeDistribution || {}) };
const blockedReasonDistribution = {};
const categoryComparison = {
  existing: {},
  functionalRanked: {},
  functionalBlocked: {},
  insufficientData: {}
};

results.forEach((result) => {
  const comparison = result?.comparison || {};

  Object.entries(comparison.categoryComparison?.existing || {}).forEach(([key, value]) =>
    increment(categoryComparison.existing, key, value)
  );
  Object.entries(comparison.categoryComparison?.functionalRanked || {}).forEach(([key, value]) =>
    increment(categoryComparison.functionalRanked, key, value)
  );
  Object.entries(comparison.categoryComparison?.functionalBlocked || {}).forEach(([key, value]) =>
    increment(categoryComparison.functionalBlocked, key, value)
  );
  Object.entries(comparison.categoryComparison?.functionalInsufficientData || {}).forEach(([key, value]) =>
    increment(categoryComparison.insufficientData, key, value)
  );
  (comparison.divergences || []).forEach((item) => {
    if (item.type === "existing_selected_but_blocked") {
      (item.reasons || []).forEach((reason) => increment(blockedReasonDistribution, reason));
    }
  });
});

const summary = {
  generatedAt: new Date().toISOString(),
  totalCaptures: replay?.totalCaptureCount || 0,
  validComparisons: replay?.replayedCount || 0,
  comparisonConfidenceDistribution,
  candidateSourceCompletenessDistribution,
  candidateSourceStageDistribution,
  candidateIdentityModeDistribution,
  topPickMatchRate: replay?.topPickMatchRate || 0,
  averageOverlapRate: replay?.averageOverlapRate || 0,
  divergenceTypeDistribution,
  blockedReasonDistribution,
  categoryComparison,
  policySignals: buildPolicySignals({
    replay,
    confidenceDistribution: comparisonConfidenceDistribution,
    divergenceTypeDistribution,
    categoryComparison
  }),
  limitations: buildLimitations(replay, comparisonConfidenceDistribution)
};

summary.topPickMatchRate = round(summary.topPickMatchRate);
summary.averageOverlapRate = round(summary.averageOverlapRate);

await mkdir(CAPTURE_DIR, { recursive: true });
await writeFile(path.join(CAPTURE_DIR, "aggregate-summary.json"), JSON.stringify(summary, null, 2), "utf8");
await writeFile(path.join(CAPTURE_DIR, "aggregate-summary.md"), renderMarkdown(summary), "utf8");

console.log("functional-shadow-capture aggregate summary");
console.log(JSON.stringify(summary, null, 2));
