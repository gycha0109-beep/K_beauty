import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveEvaluatorRecentInstabilityBoundaryPolicy } from "../lib/evaluator-recent-instability-boundary-policy.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const EXPOSURE_AUDIT_PATH = path.join(CAPTURE_DIR, "candidate-exposure-audit.json");
const JSON_OUTPUT = path.join(CAPTURE_DIR, "evaluator-recent-instability-boundary-shadow.json");
const MD_OUTPUT = path.join(CAPTURE_DIR, "evaluator-recent-instability-boundary-shadow.md");
const REVIEW_DOC = path.join(
  process.cwd(),
  "docs",
  "reviews",
  "evaluator-recent-instability-boundary-shadow-20260703.md"
);

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

function incrementNested(map, group, key) {
  const normalizedGroup = normalizeText(group) || "unknown";
  if (!map[normalizedGroup]) map[normalizedGroup] = {};
  increment(map[normalizedGroup], key);
}

function sortNested(input = {}) {
  return Object.fromEntries(
    Object.entries(input)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, sortObject(value)])
  );
}

function addReasons(distribution, reasons = []) {
  for (const reason of Array.isArray(reasons) ? reasons : []) {
    increment(distribution, reason);
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
  if (!await readJsonIfPresent(EXPOSURE_AUDIT_PATH)) {
    execFileSync(process.execPath, ["scripts/run-functional-candidate-exposure-audit.mjs"], {
      cwd: process.cwd(),
      stdio: "ignore",
      env: process.env
    });
  }
}

function axesFromRow(row = {}) {
  const axes = [];
  if (row.activeAxisPresent) {
    axes.push({ axis: "exfoliation", source: "candidate_review_row" });
  }
  if (row.stabilizingAxisPresent) {
    axes.push({ axis: "hydration", source: "candidate_review_row" });
  }
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
    irritation_risk: row.irritationRisk || null,
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

function targetRows(candidateExposureAudit = {}) {
  const rows = [];

  for (const fixture of Array.isArray(candidateExposureAudit.fixtureAudits) ? candidateExposureAudit.fixtureAudits : []) {
    if (fixture?.comparisonConfidence !== "high") continue;

    for (const row of Array.isArray(fixture.candidateReviewRows) ? fixture.candidateReviewRows : []) {
      const reasons = Array.isArray(row.hardFilterReasons) ? row.hardFilterReasons : [];
      if (
        row.exposureStatus === "hidden_candidate" &&
        row.blockedBy?.evaluator === true &&
        row.hardFilterStatus === "blocked" &&
        reasons.includes("recent_instability_active_limited")
      ) {
        rows.push({ row, fixture });
      }
    }
  }

  return rows.sort((left, right) =>
    String(left.row.category || "").localeCompare(String(right.row.category || "")) ||
    String(left.fixture.captureId || "").localeCompare(String(right.fixture.captureId || "")) ||
    String(left.row.productId || "").localeCompare(String(right.row.productId || ""))
  );
}

function makeCase({ row, fixture, policy }) {
  return {
    captureId: fixture.captureId || null,
    productId: row.productId || null,
    category: row.category || "unknown",
    safetyMetadataProfile: row.safetyMetadataProfile || "unknown",
    functionalProfile: row.functionalProfile || "unknown",
    exposureStatus: row.exposureStatus || "unknown",
    hardFilterStatus: row.hardFilterStatus || "unknown",
    hardFilterReasons: Array.isArray(row.hardFilterReasons) ? [...row.hardFilterReasons].sort() : [],
    guardDecision: row.guardDecision || null,
    guardReasons: Array.isArray(row.guardReasons) ? [...row.guardReasons].sort() : [],
    irritationRisk: row.irritationRisk || "unknown",
    sensitivitySafe: typeof row.sensitivitySafe === "boolean" ? row.sensitivitySafe : null,
    profileEvaluable: row.profileEvaluable !== false,
    activeAxisPresent: row.activeAxisPresent === true,
    stabilizingAxisPresent: row.stabilizingAxisPresent === true,
    cautionTags: Array.isArray(row.cautionTags) ? [...row.cautionTags].sort() : [],
    rankingGoal: row.rankingGoal || fixture?.rankingContext?.rankingGoal || null,
    safetyGoal: row.safetyGoal || fixture?.rankingContext?.safetyGoal || null,
    recommendationGuard: row.recommendationGuard || fixture?.rankingContext?.recommendationGuard || null,
    boundaryDecision: policy.boundaryDecision,
    boundaryConfidence: policy.confidence,
    boundaryReasons: policy.reasons,
    futureIntegrationHint: policy.futureIntegrationHint
  };
}

function buildLimitations(cases = []) {
  const limitations = [];
  const categories = new Set(cases.map((item) => item.category).filter(Boolean));
  const functionalProfiles = new Set(cases.map((item) => item.functionalProfile).filter(Boolean));

  if (!cases.length) limitations.push("no_high_confidence_recent_instability_hard_block_cases");
  if (!functionalProfiles.has("active_leaning")) limitations.push("active_leaning_only_profile_not_observed");
  if (!categories.has("serum")) limitations.push("serum_category_not_observed");
  if (!cases.some((item) => item.safetyMetadataProfile === "metadata_incomplete")) {
    limitations.push("metadata_incomplete_cases_not_observed");
  }
  if (!cases.some((item) => item.cautionTags.length > 0 && item.boundaryDecision === "preserve_hard_block")) {
    limitations.push("strong_caution_metadata_comparison_not_observed");
  }

  return limitations.sort();
}

function summarize(cases = []) {
  const summary = {
    reviewedCount: cases.length,
    preserveHardBlockCount: 0,
    downgradeToCollapsedCount: 0,
    requiresMetadataReviewCount: 0,
    notApplicableCount: 0,
    safeLowRiskHidden: {
      reviewedCount: 0,
      preserveHardBlockCount: 0,
      downgradeToCollapsedCount: 0,
      requiresMetadataReviewCount: 0,
      notApplicableCount: 0
    },
    highRiskCollapsedCount: 0,
    byCategory: {},
    byFunctionalProfile: {},
    bySafetyMetadataProfile: {},
    reasonDistribution: {},
    futureIntegrationHintDistribution: {},
    limitations: []
  };

  for (const item of cases) {
    if (item.boundaryDecision === "preserve_hard_block") summary.preserveHardBlockCount += 1;
    if (item.boundaryDecision === "downgrade_to_collapsed_candidate") summary.downgradeToCollapsedCount += 1;
    if (item.boundaryDecision === "requires_metadata_review") summary.requiresMetadataReviewCount += 1;
    if (item.boundaryDecision === "not_applicable") summary.notApplicableCount += 1;
    if (item.safetyMetadataProfile === "safe_low_risk") {
      summary.safeLowRiskHidden.reviewedCount += 1;
      if (item.boundaryDecision === "preserve_hard_block") summary.safeLowRiskHidden.preserveHardBlockCount += 1;
      if (item.boundaryDecision === "downgrade_to_collapsed_candidate") summary.safeLowRiskHidden.downgradeToCollapsedCount += 1;
      if (item.boundaryDecision === "requires_metadata_review") summary.safeLowRiskHidden.requiresMetadataReviewCount += 1;
      if (item.boundaryDecision === "not_applicable") summary.safeLowRiskHidden.notApplicableCount += 1;
    }
    if (item.safetyMetadataProfile === "unsafe_high_risk" &&
      item.boundaryDecision === "downgrade_to_collapsed_candidate") {
      summary.highRiskCollapsedCount += 1;
    }
    incrementNested(summary.byCategory, item.category, item.boundaryDecision);
    incrementNested(summary.byFunctionalProfile, item.functionalProfile, item.boundaryDecision);
    incrementNested(summary.bySafetyMetadataProfile, item.safetyMetadataProfile, item.boundaryDecision);
    addReasons(summary.reasonDistribution, item.boundaryReasons);
    increment(summary.futureIntegrationHintDistribution, item.futureIntegrationHint);
  }

  summary.byCategory = sortNested(summary.byCategory);
  summary.byFunctionalProfile = sortNested(summary.byFunctionalProfile);
  summary.bySafetyMetadataProfile = sortNested(summary.bySafetyMetadataProfile);
  summary.reasonDistribution = sortObject(summary.reasonDistribution);
  summary.futureIntegrationHintDistribution = sortObject(summary.futureIntegrationHintDistribution);
  summary.limitations = buildLimitations(cases);

  return summary;
}

function renderDistribution(distribution = {}) {
  const entries = Object.entries(distribution);
  if (!entries.length) return ["- none"];
  return entries.map(([key, value]) => `- ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
}

function renderMarkdown({ summary, cases }) {
  return [
    "# Evaluator Recent-Instability Boundary Shadow Review",
    "",
    "This is a shadow-only policy review. It does not change evaluator hard filters, score, CandidatePolicy runtime, UI, API response, DB, Supabase, product data, or existing recommendations.",
    "",
    "## Review Scope",
    "- source: tmp/functional-shadow-captures/candidate-exposure-audit.json",
    "- included confidence: high",
    "- target: evaluator blocked candidates with `recent_instability_active_limited`",
    `- reviewed count: ${summary.reviewedCount}`,
    "",
    "## Actual Evidence",
    `- safe_low_risk hidden reviewed: ${summary.safeLowRiskHidden.reviewedCount}`,
    `- preserved hard block: ${summary.preserveHardBlockCount}`,
    `- downgraded to collapsed candidate: ${summary.downgradeToCollapsedCount}`,
    `- metadata review: ${summary.requiresMetadataReviewCount}`,
    `- not applicable: ${summary.notApplicableCount}`,
    `- high-risk collapsed count: ${summary.highRiskCollapsedCount}`,
    "",
    "## Virtual Reclassification Result",
    "- safe_low_risk hidden:",
    `  - preserve_hard_block: ${summary.safeLowRiskHidden.preserveHardBlockCount}`,
    `  - downgrade_to_collapsed_candidate: ${summary.safeLowRiskHidden.downgradeToCollapsedCount}`,
    `  - requires_metadata_review: ${summary.safeLowRiskHidden.requiresMetadataReviewCount}`,
    `  - not_applicable: ${summary.safeLowRiskHidden.notApplicableCount}`,
    "",
    "## Category Distribution",
    ...renderDistribution(summary.byCategory),
    "",
    "## Functional Profile Distribution",
    ...renderDistribution(summary.byFunctionalProfile),
    "",
    "## Safety Metadata Profile Distribution",
    ...renderDistribution(summary.bySafetyMetadataProfile),
    "",
    "## Reason Distribution",
    ...renderDistribution(summary.reasonDistribution),
    "",
    "## Limitations",
    ...summary.limitations.map((item) => `- ${item}`),
    "",
    "## Runtime Conclusion",
    "- No runtime policy was applied.",
    "- The shadow boundary can deterministically identify candidates where broad recent-instability blocking conflicts with favorable product-level safety metadata.",
    "- This is evidence for a future policy task, not proof that the existing evaluator is wrong.",
    "",
    "## Next Conditions",
    "- Add active-leaning-only comparison samples.",
    "- Add metadata-incomplete comparison samples.",
    "- Add serum category samples.",
    "- Add high-risk or strong-caution metadata samples to verify preservation behavior.",
    "",
    "## Case Sample",
    ...cases.slice(0, 8).map((item) =>
      `- ${item.category} / ${item.safetyMetadataProfile} / ${item.functionalProfile} -> ${item.boundaryDecision}`
    )
  ].join("\n");
}

await ensureExposureAudit();

const candidateExposureAudit = await readJsonIfPresent(EXPOSURE_AUDIT_PATH);
const cases = targetRows(candidateExposureAudit)
  .map(({ row, fixture }) => {
    const policy = resolveEvaluatorRecentInstabilityBoundaryPolicy({
      candidateEvaluation: candidateEvaluationFromRow(row),
      surveySafety: surveySafetyFromRow(row),
      goalPolicy: goalPolicyFromRow(row, fixture),
      product: productFromRow(row),
      productProfile: productProfileFromRow(row)
    });

    return makeCase({ row, fixture, policy });
  });
const summary = summarize(cases);
const output = {
  reviewVersion: "evaluator-recent-instability-boundary-shadow-v1",
  generatedAt: new Date().toISOString(),
  source: "candidate-exposure-audit",
  reviewScope: {
    includedConfidence: ["high"],
    targetCriteria: [
      "comparisonConfidence=high",
      "blockedBy.evaluator=true",
      "hardFilterStatus=blocked",
      "hardFilterReasons includes recent_instability_active_limited"
    ],
    runtimeChangeApplied: false
  },
  summary,
  cases
};

await mkdir(CAPTURE_DIR, { recursive: true });
await mkdir(path.dirname(REVIEW_DOC), { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
const markdown = renderMarkdown({ summary, cases });
await writeFile(MD_OUTPUT, markdown, "utf8");
await writeFile(REVIEW_DOC, markdown, "utf8");

console.log("evaluator-recent-instability-boundary-shadow summary");
console.log(JSON.stringify({
  reviewedCount: summary.reviewedCount,
  preserveHardBlockCount: summary.preserveHardBlockCount,
  downgradeToCollapsedCount: summary.downgradeToCollapsedCount,
  requiresMetadataReviewCount: summary.requiresMetadataReviewCount,
  notApplicableCount: summary.notApplicableCount,
  safeLowRiskHidden: summary.safeLowRiskHidden,
  highRiskCollapsedCount: summary.highRiskCollapsedCount,
  byCategory: summary.byCategory,
  byFunctionalProfile: summary.byFunctionalProfile,
  bySafetyMetadataProfile: summary.bySafetyMetadataProfile,
  limitations: summary.limitations
}, null, 2));
