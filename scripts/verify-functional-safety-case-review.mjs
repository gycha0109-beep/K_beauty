import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const CAPTURE_DIR = path.join(ROOT, "tmp", "functional-shadow-captures");
const ANALYSIS_PATH = path.join(CAPTURE_DIR, "safety-review-analysis.json");
const PACKET_PATH = path.join(CAPTURE_DIR, "safety-review-packet.json");
const ALLOWED_OUTCOMES = new Set([
  "guard_appears_appropriate",
  "possible_overblocking",
  "insufficient_product_metadata",
  "goal_function_difference",
  "insufficient_sample",
  "needs_domain_review"
]);
const ALLOWED_NEXT_ACTIONS = new Set([
  "maintain_guard_and_collect_more_samples",
  "open_targeted_policy_review_task",
  "open_product_metadata_coverage_task",
  "request_domain_review",
  "insufficient_evidence_collect_more_cases"
]);

function runScript(env = {}) {
  return execFileSync("node", ["scripts/review-functional-safety-cases.mjs"], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function blockedCase({ caseId, captureId, productId, confidence = "high", reason = "High sensitivity and high product irritation risk should not be treated as a normal candidate.", category = "treatment" }) {
  return {
    caseId,
    captureId,
    productId,
    category,
    divergence: {
      type: "existing_selected_but_blocked",
      existingSource: "supporting",
      existingRank: null,
      functionalStatus: "blocked",
      functionalRank: null,
      functionalScore: null,
      functionalConfidence: confidence
    },
    userContext: {
      rankingGoal: "acne",
      safetyGoal: "redness",
      recommendationGuard: "stabilize_first",
      hasTension: true,
      sensitivityRisk: "high",
      drynessRisk: "low",
      rednessRisk: "high",
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes",
      sunscreenSourceCompleteness: "answered"
    },
    productContext: {
      categoryRole: "functional_leave_on",
      functionalAxes: [{ axis: "hydration", strength: "medium", confidence: "high" }],
      cautionTags: [],
      irritationRisk: reason.includes("Recent instability") ? "low" : "high",
      sensitivitySafe: reason.includes("Recent instability") ? true : false,
      texture: "gel",
      finish: "natural",
      evidenceQuality: { score: 0, max: 5 },
      profileEvaluable: true
    },
    filterDecision: {
      hardFilterReasons: [reason],
      evaluatorReasons: [],
      evaluatorPenalties: [],
      scoreBreakdownSummary: {
        functionalFit: { score: 0, max: 30 },
        skinFit: { score: 0, max: 20 },
        safetyFit: { score: 0, max: 20 },
        preferenceFit: { score: 0, max: 10 },
        routineFit: { score: 0, max: 10 },
        evidenceQuality: { score: 0, max: 5 },
        reviewSignal: { score: 0, max: 5 },
        penalties: { score: 0 }
      }
    },
    existingRecommendationContext: {
      source: "supporting",
      existingResultMembership: [{ source: "supporting", rank: 1, category }],
      existingTopPick: false,
      existingSupporting: true,
      existingBudgetAlternative: false
    },
    allowedReviewOutcomes: Array.from(ALLOWED_OUTCOMES),
    outcome: null
  };
}

function assertNoLeakage(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  [
    "raw form",
    "base64",
    "filepath",
    "email",
    "session",
    "cookie",
    "user-agent",
    "product name",
    "brand",
    "purchase url",
    "review text"
  ].forEach((token) => assert.equal(serialized.includes(token), false, token));
}

async function main() {
  const beforePacket = await readJson(PACKET_PATH);
  runScript();
  const analysis = await readJson(ANALYSIS_PATH);
  const afterPacket = await readJson(PACKET_PATH);

  assert.equal(analysis.caseReviews.length, 3);
  assert.ok(analysis.caseReviews.every((item) => item.judgment.recommendedOutcome));
  assert.ok(analysis.caseReviews.every((item) => ALLOWED_OUTCOMES.has(item.judgment.recommendedOutcome)));
  assert.ok(analysis.caseReviews.every((item) => ["yes", "no"].includes(item.judgment.policyChangeEligible)));
  assert.ok(analysis.caseReviews.some((item) => item.judgment.policyChangeEligible === "no"));
  assert.deepEqual(afterPacket.cases.map((item) => item.outcome), beforePacket.cases.map((item) => item.outcome));
  assert.ok(afterPacket.cases.every((item) => item.outcome === null));
  assertNoLeakage(analysis);
  assert.ok(ALLOWED_NEXT_ACTIONS.has(analysis.aggregateReview.recommendedNextAction));
  assert.ok(analysis.followUpSampleMatrix);
  assert.ok(analysis.followUpSampleMatrix.categories.includes("treatment"));
  assert.ok(analysis.followUpSampleMatrix.rankingGoals.includes("redness"));

  const firstStable = JSON.stringify({
    caseReviews: analysis.caseReviews.map((item) => ({
      caseId: item.caseId,
      recommendedOutcome: item.judgment.recommendedOutcome,
      policyChangeEligible: item.judgment.policyChangeEligible
    })),
    nextAction: analysis.aggregateReview.recommendedNextAction
  });
  runScript();
  const second = await readJson(ANALYSIS_PATH);
  const secondStable = JSON.stringify({
    caseReviews: second.caseReviews.map((item) => ({
      caseId: item.caseId,
      recommendedOutcome: item.judgment.recommendedOutcome,
      policyChangeEligible: item.judgment.policyChangeEligible
    })),
    nextAction: second.aggregateReview.recommendedNextAction
  });
  assert.equal(firstStable, secondStable);

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "safety-case-review-"));
  try {
    await mkdir(tmpDir, { recursive: true });
    const packet = {
      cases: [
        blockedCase({ caseId: "a", captureId: "a", productId: "a", confidence: "high" }),
        blockedCase({
          caseId: "b",
          captureId: "b",
          productId: "b",
          confidence: "low",
          reason: "Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking.",
          category: "toner_pad"
        })
      ],
      aggregate: { metadataCoverageSummary: {} }
    };
    await writeFile(path.join(tmpDir, "safety-review-packet.json"), JSON.stringify(packet), "utf8");
    await writeFile(path.join(tmpDir, "replay-summary.json"), JSON.stringify({ replayedCount: 2 }), "utf8");
    await writeFile(path.join(tmpDir, "divergence-policy-review.json"), JSON.stringify({ reviewScope: { includedComparisonCount: 1 }, aggregate: {} }), "utf8");
    runScript({
      FUNCTIONAL_SHADOW_CAPTURE_DIR: tmpDir,
      FUNCTIONAL_SAFETY_REVIEW_DOC_PATH: path.join(tmpDir, "review.md")
    });
    const tmpAnalysis = await readJson(path.join(tmpDir, "safety-review-analysis.json"));
    assert.equal(tmpAnalysis.caseReviews.length, 1);
    assert.equal(tmpAnalysis.caseReviews[0].caseId, "a");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  let missingFailed = false;
  try {
    execFileSync("node", ["scripts/review-functional-safety-cases.mjs"], {
      cwd: ROOT,
      env: { ...process.env, FUNCTIONAL_SHADOW_CAPTURE_DIR: path.join(ROOT, "tmp", "missing-safety-case-review") },
      encoding: "utf8",
      stdio: "pipe"
    });
  } catch (error) {
    missingFailed = String(error.stderr || error.stdout || error.message).includes("Missing or unreadable");
  }
  assert.equal(missingFailed, true);

  const runtimeDiff = execFileSync("git", [
    "diff",
    "--",
    "app/api/analyze/route.js",
    "lib/functional-ranking-contract.js",
    "lib/recommendation-scoring.ts"
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(runtimeDiff.trim(), "");

  console.log("ok - high-confidence blocked case analysis verified");
  console.log("ok - low-confidence blocked cases excluded from recommendations");
  console.log("ok - packet outcomes left unchanged");
  console.log("ok - deterministic output and missing-source handling verified");
}

await main();
