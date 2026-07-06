import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { reviewFunctionalEvaluatorHardBlocks } from "../lib/functional-evaluator-hard-block-review.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const EXPOSURE_AUDIT_PATH = path.join(CAPTURE_DIR, "candidate-exposure-audit.json");
const JSON_OUTPUT = path.join(CAPTURE_DIR, "evaluator-hard-block-review.json");
const MD_OUTPUT = path.join(CAPTURE_DIR, "evaluator-hard-block-review.md");
const REVIEW_DOC = path.join(process.cwd(), "docs", "reviews", "functional-evaluator-hard-block-review-20260703.md");

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

function renderDistribution(distribution = {}) {
  const entries = Object.entries(distribution);
  if (!entries.length) return ["- none"];
  return entries.map(([key, value]) => `- ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
}

function renderMarkdown(review) {
  return [
    "# Functional Evaluator Hard Block Review",
    "",
    "This is a shadow-only policy review. It does not change evaluator hard filters, scores, CandidatePolicy runtime, UI, API response, DB, or product data.",
    "",
    "## Review Scope",
    `- audit version: ${review.reviewScope.auditVersion}`,
    `- included confidence: ${review.reviewScope.includedConfidence.join(", ")}`,
    `- included fixtures: ${review.reviewScope.includedFixtureCount}`,
    `- target criteria: ${review.reviewScope.targetCriteria.join("; ")}`,
    "",
    "## Evidence Source",
    "- tmp/functional-shadow-captures/candidate-exposure-audit.json",
    "- Candidate-level review rows generated from complete product-row shadow captures.",
    "",
    "## Evaluator Hard Block Rule Breakdown",
    `- reviewed cases: ${review.aggregate.reviewedCaseCount}`,
    `- safe_low_risk hidden count: ${review.aggregate.safeLowRiskHiddenCount}`,
    `- recent_instability_active_limited count: ${review.aggregate.recentInstabilityActiveLimitedCount}`,
    `- recent_instability_active_limited rate: ${review.aggregate.recentInstabilityActiveLimitedRate}`,
    `- evaluator only count: ${review.aggregate.evaluatorOnlyCount}`,
    `- guard overlap count: ${review.aggregate.guardOverlapCount}`,
    "- hard filter reasons:",
    ...renderDistribution(review.ruleBreakdown.hardFilterReasons),
    "- guard reasons:",
    ...renderDistribution(review.ruleBreakdown.guardReasons),
    "- blocked source:",
    ...renderDistribution(review.ruleBreakdown.blockedSource),
    "",
    "## Category Breakdown",
    ...renderDistribution(review.categoryBreakdown),
    "",
    "## Functional Profile Breakdown",
    ...renderDistribution(review.functionalProfileBreakdown),
    "",
    "## Safety Context Breakdown",
    ...renderDistribution(review.safetyContextBreakdown),
    "",
    "## Product Metadata Coverage",
    "- irritation risk:",
    ...renderDistribution(review.productMetadataCoverage.irritationRiskDistribution),
    "- sensitivity safe:",
    ...renderDistribution(review.productMetadataCoverage.sensitivitySafeDistribution),
    "- active axis:",
    ...renderDistribution(review.productMetadataCoverage.activeAxisDistribution),
    "- stabilizing axis:",
    ...renderDistribution(review.productMetadataCoverage.stabilizingAxisDistribution),
    "- profile evaluable:",
    ...renderDistribution(review.productMetadataCoverage.profileEvaluableDistribution),
    "- caution tags:",
    ...renderDistribution(review.productMetadataCoverage.cautionTagDistribution),
    "",
    "## Core Policy Questions",
    `- evaluator and guard duplicate blocking: ${review.aggregate.guardOverlapCount === 0 ? "No overlap in target cases; all target cases are evaluator-only blocks." : "Overlap exists and needs manual review."}`,
    "- `recent_instability_active_limited` appears to be a safety-context plus active-axis evaluator rule in this evidence, not a product-name or brand rule.",
    "- Low irritation plus sensitivity-safe products are still hard-blocked when recent instability, high sensitivity, active axis, and target ranking/safety context align.",
    `- stabilizing profile handling: ${review.functionalProfileBreakdown.stabilizing_leaning ? "stabilizing_leaning target cases exist, so the rule may need narrower boundary review." : "no stabilizing_leaning-only target cases were observed."}`,
    "- Future collapsed exposure boundary should be reviewed where product safety metadata is favorable but evaluator blocks only because of recent-instability active-axis policy.",
    "- This evidence is enough to open a targeted policy review question, not enough to change runtime behavior.",
    "",
    "## Policy Assessment",
    `- status: ${review.policyAssessment.status}`,
    `- runtime change approved: ${review.policyAssessment.runtimeChangeApproved}`,
    ...review.policyAssessment.rationale.map((item) => `- ${item}`),
    "",
    "## Explicit Non-actions",
    "- Do not change `lib/functional-ranking-contract.js` in this review.",
    "- Do not change evaluator hard filters, score, or weight.",
    "- Do not connect CandidatePolicy runtime or UI.",
    "- Do not change API response, DB, Supabase, product data, or existing recommendation output.",
    "",
    "## Limitations",
    ...renderDistribution(Object.fromEntries(review.limitations.map((item) => [item, true]))),
    "",
    "## Next Action Recommendation",
    `- ${review.nextAction}`
  ].join("\n");
}

await ensureExposureAudit();

const candidateExposureAudit = await readJsonIfPresent(EXPOSURE_AUDIT_PATH);
const review = reviewFunctionalEvaluatorHardBlocks({ candidateExposureAudit });

await mkdir(CAPTURE_DIR, { recursive: true });
await mkdir(path.dirname(REVIEW_DOC), { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(review, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(review), "utf8");
await writeFile(REVIEW_DOC, renderMarkdown(review), "utf8");

console.log("functional-evaluator-hard-block-review summary");
console.log(JSON.stringify({
  reviewedCaseCount: review.aggregate.reviewedCaseCount,
  safeLowRiskHiddenCount: review.aggregate.safeLowRiskHiddenCount,
  recentInstabilityActiveLimitedCount: review.aggregate.recentInstabilityActiveLimitedCount,
  recentInstabilityActiveLimitedRate: review.aggregate.recentInstabilityActiveLimitedRate,
  categoryDistribution: review.categoryBreakdown,
  functionalProfileDistribution: review.functionalProfileBreakdown,
  safetyContextDistribution: review.safetyContextBreakdown,
  policyAssessment: review.policyAssessment.status,
  nextAction: review.nextAction
}, null, 2));
