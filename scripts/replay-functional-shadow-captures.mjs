import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFunctionalCandidateAudit } from "../lib/functional-candidate-audit.js";
import { compareFunctionalShadowResults } from "../lib/functional-shadow-comparison.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");

function increment(map, key) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function listCaptureFiles() {
  try {
    const entries = await readdir(CAPTURE_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".json"))
      .filter((name) => !["replay-summary.json", "aggregate-summary.json", "summary.json"].includes(name))
      .sort()
      .map((name) => path.join(CAPTURE_DIR, name));
  } catch {
    return [];
  }
}

async function readFixture(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function buildAuditForFixture(fixture) {
  return buildFunctionalCandidateAudit({
    products: Array.isArray(fixture?.candidateSource?.products)
      ? fixture.candidateSource.products
      : [],
    surveyContract: {
      skinState: fixture?.survey?.skinState || {},
      goals: fixture?.survey?.goals || {},
      safety: fixture?.survey?.safety || {},
      behavior: fixture?.survey?.behavior || {},
      preferences: fixture?.survey?.preferences || {},
      sunscreen: fixture?.survey?.sunscreen || {}
    },
    goalPolicy: fixture?.goalPolicy || {},
    options: {
      includeBlocked: true,
      includeInsufficientData: true,
      maxRankedCandidates: 20
    }
  });
}

function renderMarkdown(summary) {
  return [
    "# Functional Shadow Replay Summary",
    "",
    `- total captures: ${summary.totalCaptureCount}`,
    `- replayed: ${summary.replayedCount}`,
    `- failed/skipped: ${summary.failedCount} / ${summary.skippedCount}`,
    `- topPick match rate: ${summary.topPickMatchRate}`,
    `- average overlap rate: ${summary.averageOverlapRate}`,
    "",
    "## Comparison Confidence",
    ...Object.entries(summary.comparisonConfidenceDistribution).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Divergence Types",
    ...Object.entries(summary.divergenceTypeDistribution).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Limitations",
    ...summary.limitations.map((item) => `- ${item}`)
  ].join("\n");
}

const files = await listCaptureFiles();
const results = [];
const failed = [];
const skipped = [];
const comparisonConfidenceDistribution = { high: 0, medium: 0, low: 0 };
const divergenceTypeDistribution = {};
let overlapTotal = 0;
let topPickComparableCount = 0;
let topPickMatchCount = 0;
let existingSelectedButBlockedCount = 0;
let existingSelectedButInsufficientDataCount = 0;
let functionalTopCandidateMissingCount = 0;

for (const filePath of files) {
  try {
    const fixture = await readFixture(filePath);

    if (!fixture || fixture.captureVersion !== "v1") {
      skipped.push({ filePath, reason: "unsupported_capture_version" });
      continue;
    }

    const functionalAudit = buildAuditForFixture(fixture);
    const comparison = compareFunctionalShadowResults({
      existingSnapshot: fixture.existingRecommendationSnapshot || {},
      functionalAudit
    });
    const confidence = comparison.comparisonSummary.comparisonConfidence;

    increment(comparisonConfidenceDistribution, confidence);
    comparison.divergences.forEach((item) => increment(divergenceTypeDistribution, item.type));
    overlapTotal += comparison.comparisonSummary.overlapRate;

    if (comparison.topPickComparison.existingTopPickId && comparison.topPickComparison.functionalTopPickId) {
      topPickComparableCount += 1;
      if (comparison.topPickComparison.matches) {
        topPickMatchCount += 1;
      }
    }

    existingSelectedButBlockedCount += comparison.candidateStatusComparison.existingSelectedButBlocked.length;
    existingSelectedButInsufficientDataCount += comparison.candidateStatusComparison.existingSelectedButInsufficientData.length;
    functionalTopCandidateMissingCount += comparison.candidateStatusComparison.functionalTopCandidatesNotInExisting.length;
    results.push({
      captureId: fixture.captureId || null,
      capturedAt: fixture.capturedAt || null,
      fileName: path.basename(filePath),
      candidateSourceCompleteness: fixture.candidateSource?.completeness || "unknown",
      comparison
    });
  } catch (error) {
    failed.push({
      filePath,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

results.sort((left, right) => {
  const capturedDelta = String(left.capturedAt || "").localeCompare(String(right.capturedAt || ""));
  return capturedDelta || String(left.captureId || "").localeCompare(String(right.captureId || ""));
});

const limitations = [];

if (results.length < 5) {
  limitations.push("sample_size_too_low_for_policy_conclusion");
}

if ((comparisonConfidenceDistribution.low || 0) > 0) {
  limitations.push("low_confidence_comparisons_present");
}

const summary = {
  generatedAt: new Date().toISOString(),
  totalCaptureCount: files.length,
  replayedCount: results.length,
  failedCount: failed.length,
  skippedCount: skipped.length,
  comparisonConfidenceDistribution,
  topPickMatchRate: topPickComparableCount ? round(topPickMatchCount / topPickComparableCount) : 0,
  averageOverlapRate: results.length ? round(overlapTotal / results.length) : 0,
  existingSelectedButBlockedCount,
  existingSelectedButInsufficientDataCount,
  functionalTopCandidateMissingCount,
  divergenceTypeDistribution,
  limitations,
  results,
  failed,
  skipped
};

await mkdir(CAPTURE_DIR, { recursive: true });
await writeFile(path.join(CAPTURE_DIR, "replay-summary.json"), JSON.stringify(summary, null, 2), "utf8");
await writeFile(path.join(CAPTURE_DIR, "replay-summary.md"), renderMarkdown(summary), "utf8");

console.log("functional-shadow-capture replay summary");
console.log(JSON.stringify({
  totalCaptureCount: summary.totalCaptureCount,
  replayedCount: summary.replayedCount,
  failedCount: summary.failedCount,
  skippedCount: summary.skippedCount,
  comparisonConfidenceDistribution: summary.comparisonConfidenceDistribution,
  topPickMatchRate: summary.topPickMatchRate,
  averageOverlapRate: summary.averageOverlapRate,
  existingSelectedButBlockedCount,
  existingSelectedButInsufficientDataCount,
  functionalTopCandidateMissingCount,
  divergenceTypeDistribution
}, null, 2));
