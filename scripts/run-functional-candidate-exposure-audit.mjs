import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFunctionalCandidateExposureAudit } from "../lib/functional-candidate-exposure-audit.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const JSON_OUTPUT = path.join(CAPTURE_DIR, "candidate-exposure-audit.json");
const MD_OUTPUT = path.join(CAPTURE_DIR, "candidate-exposure-audit.md");
const NON_CAPTURE_JSON = new Set([
  "replay-summary.json",
  "aggregate-summary.json",
  "summary.json",
  "divergence-policy-review.json",
  "safety-review-packet.json",
  "safety-review-analysis.json",
  "recent-instability-guard-matrix.json",
  "candidate-exposure-audit.json"
]);

function increment(map, key, amount = 1) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + amount;
}

function mergeDistribution(target, source = {}) {
  for (const [key, value] of Object.entries(source)) {
    increment(target, key, value);
  }
}

function mergeGroupedDistribution(target, source = {}) {
  for (const [group, distribution] of Object.entries(source)) {
    if (!target[group]) target[group] = {};
    mergeDistribution(target[group], distribution);
  }
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function sortGrouped(input = {}) {
  return Object.fromEntries(
    Object.entries(input)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, sortObject(value)])
  );
}

async function listCaptureFiles() {
  const entries = await readdir(CAPTURE_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".json") && !NON_CAPTURE_JSON.has(name))
    .sort()
    .map((name) => path.join(CAPTURE_DIR, name));
}

function surveyContractFromFixture(fixture) {
  return {
    skinState: fixture?.survey?.skinState || {},
    goals: fixture?.survey?.goals || {},
    safety: fixture?.survey?.safety || {},
    behavior: fixture?.survey?.behavior || {},
    preferences: fixture?.survey?.preferences || {},
    sunscreen: fixture?.survey?.sunscreen || {}
  };
}

function renderDistribution(title, distribution) {
  return [
    `## ${title}`,
    ...Object.entries(distribution || {}).map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  ];
}

function renderMarkdown(summary) {
  return [
    "# Functional Candidate Exposure Audit",
    "",
    "Shadow-only exposure grouping. This does not replace existing recommendation results.",
    "",
    `- complete captures: ${summary.completeCaptureCount}`,
    `- excluded fixtures: ${summary.excludedFixtureCount}`,
    `- total evaluated product rows: ${summary.totalEvaluatedProductRows}`,
    `- primary/contextual/collapsed/hidden/insufficient: ${summary.totalPrimaryCount}/${summary.totalContextualCount}/${summary.totalCollapsedCount}/${summary.totalHiddenCount}/${summary.totalInsufficientEvidenceCount}`,
    "",
    ...renderDistribution("Exposure Status Distribution", summary.exposureStatusDistribution),
    "",
    ...renderDistribution("Category Distribution", summary.categoryDistribution),
    "",
    ...renderDistribution("Safety Metadata Profile Distribution", summary.safetyMetadataProfileDistribution),
    "",
    ...renderDistribution("Functional Profile Distribution", summary.functionalProfileDistribution),
    "",
    ...renderDistribution("Current Product Relation Distribution", summary.currentProductRelationDistribution),
    "",
    "## Policy Notes",
    ...summary.policyNotes.map((note) => `- ${note}`)
  ].join("\n");
}

const files = await listCaptureFiles();
const fixtureAudits = [];
const excludedFixtures = [];
const aggregate = {
  completeCaptureCount: 0,
  excludedFixtureCount: 0,
  excludedFixturesByReason: {},
  totalEvaluatedProductRows: 0,
  totalPrimaryCount: 0,
  totalContextualCount: 0,
  totalCollapsedCount: 0,
  totalHiddenCount: 0,
  totalInsufficientEvidenceCount: 0,
  exposureStatusDistribution: {},
  userMessageTypeDistribution: {},
  guardLevelDistribution: {},
  implementationHintDistribution: {},
  categoryDistribution: {},
  functionalProfileDistribution: {},
  safetyMetadataProfileDistribution: {},
  currentProductRelationDistribution: {},
  policyNotes: [
    "This result is shadow-only audit output.",
    "It does not replace existing recommendation results.",
    "Collapsed candidate is not a product-unsuitable judgment.",
    "Insufficient evidence is not lower product quality.",
    "Hidden candidate may reflect current-condition and safety-guard exposure exclusion."
  ]
};

for (const filePath of files) {
  let fixture;
  try {
    fixture = JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    excludedFixtures.push({ reason: "malformed_fixture" });
    increment(aggregate.excludedFixturesByReason, "malformed_fixture");
    continue;
  }

  const candidateSource = fixture?.candidateSource || {};
  const products = Array.isArray(candidateSource.products) ? candidateSource.products : [];

  if (
    fixture?.captureVersion !== "v1" ||
    candidateSource.completeness !== "complete" ||
    candidateSource.candidateIdentityMode !== "product_row" ||
    products.length === 0
  ) {
    const reason = candidateSource.completeness || "unsupported_fixture";
    excludedFixtures.push({ captureId: fixture?.captureId || null, reason });
    increment(aggregate.excludedFixturesByReason, reason);
    continue;
  }

  const audit = buildFunctionalCandidateExposureAudit({
    products,
    surveyContract: surveyContractFromFixture(fixture),
    goalPolicy: fixture.goalPolicy || {},
    currentProductFindings: null
  });

  aggregate.completeCaptureCount += 1;
  aggregate.totalEvaluatedProductRows += audit.summary.evaluatedCount;
  aggregate.totalPrimaryCount += audit.summary.primaryCount;
  aggregate.totalContextualCount += audit.summary.contextualCount;
  aggregate.totalCollapsedCount += audit.summary.collapsedCount;
  aggregate.totalHiddenCount += audit.summary.hiddenCount;
  aggregate.totalInsufficientEvidenceCount += audit.summary.insufficientEvidenceCount;
  mergeDistribution(aggregate.exposureStatusDistribution, audit.summary.exposureStatusDistribution);
  mergeDistribution(aggregate.userMessageTypeDistribution, audit.summary.userMessageTypeDistribution);
  mergeDistribution(aggregate.guardLevelDistribution, audit.summary.guardLevelDistribution);
  mergeDistribution(aggregate.implementationHintDistribution, audit.summary.implementationHintDistribution);
  mergeGroupedDistribution(aggregate.categoryDistribution, audit.summary.categoryDistribution);
  mergeGroupedDistribution(aggregate.functionalProfileDistribution, audit.summary.functionalProfileDistribution);
  mergeGroupedDistribution(aggregate.safetyMetadataProfileDistribution, audit.summary.safetyMetadataProfileDistribution);
  mergeGroupedDistribution(aggregate.currentProductRelationDistribution, audit.summary.currentProductRelationDistribution);
  fixtureAudits.push({
    captureId: fixture.captureId || null,
    sourceStage: candidateSource.sourceStage || "unknown",
    sourceCount: candidateSource.sourceCount || products.length,
    rankingContext: audit.summary.rankingContext,
    counts: {
      primary: audit.summary.primaryCount,
      contextual: audit.summary.contextualCount,
      collapsed: audit.summary.collapsedCount,
      hidden: audit.summary.hiddenCount,
      insufficientEvidence: audit.summary.insufficientEvidenceCount
    },
    exposureStatusDistribution: audit.summary.exposureStatusDistribution,
    categoryDistribution: audit.summary.categoryDistribution,
    safetyMetadataProfileDistribution: audit.summary.safetyMetadataProfileDistribution
  });
}

aggregate.excludedFixtureCount = excludedFixtures.length;
aggregate.excludedFixturesByReason = sortObject(aggregate.excludedFixturesByReason);
aggregate.exposureStatusDistribution = sortObject(aggregate.exposureStatusDistribution);
aggregate.userMessageTypeDistribution = sortObject(aggregate.userMessageTypeDistribution);
aggregate.guardLevelDistribution = sortObject(aggregate.guardLevelDistribution);
aggregate.implementationHintDistribution = sortObject(aggregate.implementationHintDistribution);
aggregate.categoryDistribution = sortGrouped(aggregate.categoryDistribution);
aggregate.functionalProfileDistribution = sortGrouped(aggregate.functionalProfileDistribution);
aggregate.safetyMetadataProfileDistribution = sortGrouped(aggregate.safetyMetadataProfileDistribution);
aggregate.currentProductRelationDistribution = sortGrouped(aggregate.currentProductRelationDistribution);
fixtureAudits.sort((left, right) => String(left.captureId || "").localeCompare(String(right.captureId || "")));

const output = {
  auditVersion: "functional-candidate-exposure-audit-v1",
  generatedAt: new Date().toISOString(),
  aggregate,
  fixtureAudits,
  excludedFixtures
};

await mkdir(CAPTURE_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(aggregate), "utf8");

console.log("functional-candidate-exposure-audit summary");
console.log(JSON.stringify({
  completeCaptureCount: aggregate.completeCaptureCount,
  excludedFixtureCount: aggregate.excludedFixtureCount,
  totalEvaluatedProductRows: aggregate.totalEvaluatedProductRows,
  primary: aggregate.totalPrimaryCount,
  contextual: aggregate.totalContextualCount,
  collapsed: aggregate.totalCollapsedCount,
  hidden: aggregate.totalHiddenCount,
  insufficientEvidence: aggregate.totalInsufficientEvidenceCount,
  exposureStatusDistribution: aggregate.exposureStatusDistribution,
  categoryDistribution: aggregate.categoryDistribution,
  safetyMetadataProfileDistribution: aggregate.safetyMetadataProfileDistribution,
  currentProductRelationDistribution: aggregate.currentProductRelationDistribution,
  policyNotes: aggregate.policyNotes
}, null, 2));
