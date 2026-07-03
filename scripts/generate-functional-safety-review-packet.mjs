import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFunctionalSafetyReviewPacket } from "../lib/functional-safety-review-packet.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const REPLAY_SUMMARY_PATH = path.join(CAPTURE_DIR, "replay-summary.json");
const POLICY_REVIEW_PATH = path.join(CAPTURE_DIR, "divergence-policy-review.json");

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error(`Missing or unreadable ${label}: ${filePath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function renderDistribution(title, distribution) {
  const entries = Object.entries(distribution || {});
  return [
    `## ${title}`,
    ...(entries.length ? entries.map(([key, value]) => `- ${key}: ${value}`) : ["- none"])
  ];
}

function renderMarkdown(packet) {
  return [
    "# Functional Safety Review Packet",
    "",
    "No automatic policy change was applied.",
    "",
    "## Scope",
    `- total replay results: ${packet.reviewScope.totalReplayResults}`,
    `- included confidence: ${packet.reviewScope.includedConfidence.join(", ")}`,
    `- eligible cases: ${packet.reviewScope.eligibleSafetyCases}`,
    "",
    ...renderDistribution("Hard Filter Reasons", packet.aggregate.casesByHardFilterReason),
    "",
    ...renderDistribution("Categories", packet.aggregate.casesByCategory),
    "",
    "## Review Readiness",
    `- ready: ${packet.aggregate.reviewReadiness.ready}`,
    ...(packet.aggregate.reviewReadiness.blockers.length
      ? packet.aggregate.reviewReadiness.blockers.map((item) => `- blocker: ${item}`)
      : ["- blockers: none"]),
    "",
    "## Cases",
    ...(packet.cases.length
      ? packet.cases.map((item) => [
          `### ${item.caseId}`,
          `- category: ${item.category || "unknown"}`,
          `- rankingGoal / safetyGoal: ${item.userContext.rankingGoal || "unknown"} / ${item.userContext.safetyGoal || "unknown"}`,
          `- guard: ${item.userContext.recommendationGuard || "unknown"}`,
          `- hardFilterReasons: ${item.filterDecision.hardFilterReasons.join("; ")}`,
          `- allowed outcomes: ${item.allowedReviewOutcomes.join(", ")}`,
          "- initial outcome: null"
        ].join("\n"))
      : ["- no eligible cases"]),
    "",
    "## Packet Questions",
    ...packet.reviewQuestions.map((item) => `- ${item}`),
    "",
    "## Limitations",
    ...packet.limitations.map((item) => `- ${item}`)
  ].flat().join("\n");
}

const replaySummary = await readJson(REPLAY_SUMMARY_PATH, "replay summary");
const divergencePolicyReview = await readJson(POLICY_REVIEW_PATH, "divergence policy review");
const packet = buildFunctionalSafetyReviewPacket({
  replaySummary,
  divergencePolicyReview
});

await mkdir(CAPTURE_DIR, { recursive: true });
await writeFile(path.join(CAPTURE_DIR, "safety-review-packet.json"), JSON.stringify(packet, null, 2), "utf8");
await writeFile(path.join(CAPTURE_DIR, "safety-review-packet.md"), renderMarkdown(packet), "utf8");

console.log("functional-safety-review-packet summary");
console.log(JSON.stringify({
  eligibleCaseCount: packet.cases.length,
  casesByHardFilterReason: packet.aggregate.casesByHardFilterReason,
  casesByCategory: packet.aggregate.casesByCategory,
  reviewReadiness: packet.aggregate.reviewReadiness,
  metadataBlockers: packet.aggregate.reviewReadiness.blockers,
  note: "No automatic policy change was applied."
}, null, 2));
