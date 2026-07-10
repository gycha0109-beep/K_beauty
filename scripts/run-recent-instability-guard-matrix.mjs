import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveProductFunctionalProfile } from "../lib/product-functional-profile.js";
import { resolveRecentInstabilityGuardPolicy } from "../lib/recent-instability-guard-policy.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const JSON_OUTPUT_PATH = path.join(CAPTURE_DIR, "recent-instability-guard-matrix.json");
const MD_OUTPUT_PATH = path.join(CAPTURE_DIR, "recent-instability-guard-matrix.md");
const REVIEW_DOC_PATH = path.join(process.cwd(), "docs", "reviews", "recent-instability-guard-matrix-20260703.md");

const DECISIONS = [
  "no_guard",
  "allow_with_context",
  "soft_penalty_candidate",
  "collapsed_exposure_candidate",
  "hard_block_candidate",
  "insufficient_data"
];
const GUARD_LEVELS = ["none", "low", "medium", "high"];
const IMPLEMENTATION_HINTS = [
  "keep_hard_block",
  "future_soft_penalty",
  "future_collapsed_exposure",
  "collect_more_evidence",
  "needs_metadata_review"
];
const SAFETY_METADATA_PROFILES = [
  "safe_low_risk",
  "safe_medium_risk",
  "unsafe_high_risk",
  "mixed_or_uncertain",
  "metadata_incomplete"
];
const FUNCTIONAL_PROFILES = ["active_leaning", "stabilizing_leaning", "mixed", "unknown"];
const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const STABILIZING_AXES = new Set(["hydration", "moisture_lock", "barrier_support", "soothing"]);
const NON_CAPTURE_JSON = new Set([
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

export function buildRecentInstabilityGuardMatrixContexts() {
  const safetyContexts = [
    {
      safetyContextId: "recent_instability_only",
      surveySafety: {
        recentSkinChange: "yes",
        recentlyChangedProduct: "yes",
        sensitivityRisk: "medium",
        drynessRisk: "low",
        rednessRisk: "high"
      },
      recommendationGuard: "stabilize_first"
    },
    {
      safetyContextId: "high_sensitivity_only",
      surveySafety: {
        recentSkinChange: "no",
        recentlyChangedProduct: "no",
        sensitivityRisk: "high",
        drynessRisk: "low",
        rednessRisk: "high"
      },
      recommendationGuard: "normal"
    },
    {
      safetyContextId: "both_high_sensitivity_and_recent_instability",
      surveySafety: {
        recentSkinChange: "yes",
        recentlyChangedProduct: "yes",
        sensitivityRisk: "high",
        drynessRisk: "low",
        rednessRisk: "high"
      },
      recommendationGuard: "stabilize_first"
    },
    {
      safetyContextId: "baseline_no_instability",
      surveySafety: {
        recentSkinChange: "no",
        recentlyChangedProduct: "no",
        sensitivityRisk: "low",
        drynessRisk: "low",
        rednessRisk: "low"
      },
      recommendationGuard: "normal"
    }
  ];
  const goalPairs = [
    { rankingGoal: "redness", safetyGoal: "redness" },
    { rankingGoal: "acne", safetyGoal: "redness" },
    { rankingGoal: "dehydration", safetyGoal: "redness" }
  ];

  return safetyContexts.flatMap((safetyContext) =>
    goalPairs.map((goalPair) => ({
      contextId: `${safetyContext.safetyContextId}__${goalPair.rankingGoal}_${goalPair.safetyGoal}`,
      safetyContextId: safetyContext.safetyContextId,
      safetyContext: safetyContext.surveySafety,
      goalPolicyContext: {
        ...goalPair,
        recommendationGuard: safetyContext.recommendationGuard,
        hasTension: goalPair.rankingGoal !== goalPair.safetyGoal
      }
    }))
  );
}

function emptyDistribution(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function increment(map, key, amount = 1) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + amount;
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function productId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim();
}

function normalizeCategory(category) {
  const value = String(category || "").trim();

  if (!value) return "unknown";
  if (value === "serum" || value === "ampoule") return "serum";
  if (value === "essence" || value === "toner_essence") return "essence";
  if (value === "moisturizer" || value.startsWith("moisturizer_")) return "moisturizer";
  if (["treatment", "toner_pad", "sunscreen", "cleanser"].includes(value)) return value;
  return "other";
}

function safetyMetadataProfile(product, productProfile) {
  const irritationRisk = String(product?.irritation_risk || "").trim();
  const sensitivitySafe = typeof product?.sensitivity_safe === "boolean" ? product.sensitivity_safe : null;
  const profileComplete = productProfile?.evaluable !== false &&
    Array.isArray(productProfile?.functionalAxes) &&
    productProfile.functionalAxes.length > 0 &&
    Array.isArray(productProfile?.cautionTags);

  if (!irritationRisk || sensitivitySafe == null || !profileComplete) {
    return "metadata_incomplete";
  }

  if (sensitivitySafe === true && irritationRisk === "low") return "safe_low_risk";
  if (sensitivitySafe === true && irritationRisk === "medium") return "safe_medium_risk";
  if (sensitivitySafe === false && irritationRisk === "high") return "unsafe_high_risk";
  return "mixed_or_uncertain";
}

function functionalProfile(productProfile) {
  const axes = Array.isArray(productProfile?.functionalAxes) ? productProfile.functionalAxes : [];
  const hasActive = axes.some((axis) => ACTIVE_AXES.has(axis?.axis));
  const hasStabilizing = axes.some((axis) => STABILIZING_AXES.has(axis?.axis));

  if (hasActive && hasStabilizing) return "mixed";
  if (hasActive) return "active_leaning";
  if (hasStabilizing) return "stabilizing_leaning";
  return "unknown";
}

function makeContextSummary(context) {
  return {
    contextId: context.contextId,
    safetyContext: context.safetyContext,
    goalPolicyContext: context.goalPolicyContext,
    totalProducts: 0,
    evaluatedProducts: 0,
    skippedProducts: 0,
    decisions: emptyDistribution(DECISIONS),
    guardLevels: emptyDistribution(GUARD_LEVELS),
    implementationHints: emptyDistribution(IMPLEMENTATION_HINTS),
    bySafetyMetadataProfile: Object.fromEntries(
      SAFETY_METADATA_PROFILES.map((profile) => [profile, emptyDistribution(DECISIONS)])
    ),
    byCategory: {},
    byFunctionalProfile: Object.fromEntries(
      FUNCTIONAL_PROFILES.map((profile) => [profile, emptyDistribution(DECISIONS)])
    ),
    notes: []
  };
}

function addToNestedDecision(map, bucket, decision) {
  if (!map[bucket]) {
    map[bucket] = emptyDistribution(DECISIONS);
  }

  increment(map[bucket], decision);
}

function addEvaluation(summary, evaluation) {
  const { decision, guardLevel, implementationHint, safetyProfile, category, functionalBucket } = evaluation;
  summary.totalProducts += 1;
  summary.evaluatedProducts += 1;
  increment(summary.decisions, decision);
  increment(summary.guardLevels, guardLevel);
  increment(summary.implementationHints, implementationHint);
  addToNestedDecision(summary.bySafetyMetadataProfile, safetyProfile, decision);
  addToNestedDecision(summary.byCategory, category, decision);
  addToNestedDecision(summary.byFunctionalProfile, functionalBucket, decision);
}

function mergeDecisionDistribution(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    increment(target, key, value);
  }
}

function mergeNestedDecisionDistribution(target, source) {
  for (const [bucket, distribution] of Object.entries(source || {})) {
    if (!target[bucket]) {
      target[bucket] = emptyDistribution(DECISIONS);
    }
    mergeDecisionDistribution(target[bucket], distribution);
  }
}

function countFromDecisionDistribution(distribution = {}) {
  return Object.values(distribution).reduce((total, value) => total + value, 0);
}

function decisionRate(distribution, decision) {
  const total = countFromDecisionDistribution(distribution);
  return total ? round((distribution?.[decision] || 0) / total) : 0;
}

function readCandidateProducts(captures) {
  return captures.flatMap((capture) =>
    Array.isArray(capture?.candidateSource?.products) ? capture.candidateSource.products : []
  );
}

function summarizeCaptures(captures) {
  return captures
    .map((capture) => ({
      captureId: capture.captureId || null,
      sourceCount: capture.candidateSource?.sourceCount || capture.candidateSource?.products?.length || 0,
      sourceStage: capture.candidateSource?.sourceStage || "unknown",
      rankingGoal: capture.goalPolicy?.rankingGoal || null,
      safetyGoal: capture.goalPolicy?.safetyGoal || null,
      recommendationGuard: capture.goalPolicy?.recommendationGuard || null
    }))
    .sort((left, right) => String(left.captureId || "").localeCompare(String(right.captureId || "")));
}

function buildProductProfileSummary(products) {
  const unique = new Map();

  for (const product of products) {
    const id = productId(product);
    if (id && !unique.has(id)) {
      const profile = resolveProductFunctionalProfile(product);
      unique.set(id, {
        safetyProfile: safetyMetadataProfile(product, profile),
        category: normalizeCategory(product.category),
        functionalBucket: functionalProfile(profile)
      });
    }
  }

  const safetyProfiles = {};
  const categories = {};
  const functionalProfiles = {};

  for (const item of unique.values()) {
    increment(safetyProfiles, item.safetyProfile);
    increment(categories, item.category);
    increment(functionalProfiles, item.functionalBucket);
  }

  return {
    uniqueProductCount: unique.size,
    safetyMetadataProfileDistribution: sortObject(safetyProfiles),
    categoryDistribution: sortObject(categories),
    functionalProfileDistribution: sortObject(functionalProfiles)
  };
}

function derivePolicyValidation({ aggregate, byContext }) {
  const recentContexts = byContext.filter((item) => item.contextId.startsWith("recent_instability_only"));
  const bothContexts = byContext.filter((item) => item.contextId.startsWith("both_high_sensitivity_and_recent_instability"));
  const highOnlyContexts = byContext.filter((item) => item.contextId.startsWith("high_sensitivity_only"));
  const baselineContexts = byContext.filter((item) => item.contextId.startsWith("baseline_no_instability"));
  const relevantRecentContexts = [...recentContexts, ...bothContexts];

  const safeLowRecent = emptyDistribution(DECISIONS);
  const safeMediumRecent = emptyDistribution(DECISIONS);
  const unsafeHighRisk = emptyDistribution(DECISIONS);
  const metadataIncomplete = emptyDistribution(DECISIONS);
  const baseline = emptyDistribution(DECISIONS);
  const highOnlySafeLow = emptyDistribution(DECISIONS);

  for (const context of relevantRecentContexts) {
    mergeDecisionDistribution(safeLowRecent, context.bySafetyMetadataProfile.safe_low_risk);
    mergeDecisionDistribution(safeMediumRecent, context.bySafetyMetadataProfile.safe_medium_risk);
    mergeDecisionDistribution(unsafeHighRisk, context.bySafetyMetadataProfile.unsafe_high_risk);
    mergeDecisionDistribution(metadataIncomplete, context.bySafetyMetadataProfile.metadata_incomplete);
  }

  for (const context of baselineContexts) {
    mergeDecisionDistribution(baseline, context.decisions);
  }

  for (const context of highOnlyContexts) {
    mergeDecisionDistribution(highOnlySafeLow, context.bySafetyMetadataProfile.safe_low_risk);
  }

  const safeLowHardBlockRate = decisionRate(safeLowRecent, "hard_block_candidate");
  const safeLowCollapsedRate = decisionRate(safeLowRecent, "collapsed_exposure_candidate");
  const safeMediumCollapsedRate = decisionRate(safeMediumRecent, "collapsed_exposure_candidate");
  const unsafeHardBlockRate = decisionRate(unsafeHighRisk, "hard_block_candidate");
  const metadataIncompleteRate = decisionRate(metadataIncomplete, "insufficient_data");
  const baselineNoGuardRate = decisionRate(baseline, "no_guard");
  const highOnlySafeLowHardBlockRate = decisionRate(highOnlySafeLow, "hard_block_candidate");

  const hasMinimumCoverage =
    countFromDecisionDistribution(safeLowRecent) > 0 &&
    countFromDecisionDistribution(unsafeHighRisk) > 0 &&
    baseline.evaluatedProducts !== 0;
  const potentialOverblocking =
    safeLowHardBlockRate > 0 ||
    highOnlySafeLowHardBlockRate > 0;
  const metadataLimit =
    countFromDecisionDistribution(metadataIncomplete) > 0 &&
    metadataIncompleteRate < 0.8;

  let status = "policy_behavior_consistent";
  if (!hasMinimumCoverage) {
    status = "insufficient_matrix_coverage";
  } else if (metadataLimit) {
    status = "metadata_coverage_limit";
  } else if (potentialOverblocking) {
    status = "potential_overblocking_remaining";
  }

  return {
    status,
    metrics: {
      unsafeHighRiskHardBlockRate: unsafeHardBlockRate,
      safeLowRiskCollapsedExposureRate: safeLowCollapsedRate,
      safeLowRiskHardBlockRate: safeLowHardBlockRate,
      safeMediumRiskCollapsedExposureRate: safeMediumCollapsedRate,
      metadataIncompleteInsufficientDataRate: metadataIncompleteRate,
      baselineNoGuardRate,
      highSensitivityOnlySafeLowHardBlockRate: highOnlySafeLowHardBlockRate
    },
    notes: [
      "This validates policy-helper branching only; it does not approve runtime application.",
      "Actual capture observations and synthetic matrix results are intentionally separated.",
      status === "policy_behavior_consistent"
        ? "Unsafe high-risk and safe low-risk branches separate as expected in the matrix."
        : "Review status requires follow-up before any runtime design task."
    ]
  };
}

export function evaluateRecentInstabilityGuardMatrix({
  captures = [],
  contexts = buildRecentInstabilityGuardMatrixContexts(),
  generatedAt = new Date().toISOString(),
  excludedFixtures = []
} = {}) {
  const includedCaptures = captures
    .filter((capture) =>
      capture?.candidateSource?.completeness === "complete" &&
      capture?.candidateSource?.candidateIdentityMode === "product_row" &&
      Array.isArray(capture?.candidateSource?.products) &&
      capture.candidateSource.products.length > 0
    )
    .sort((left, right) => String(left.captureId || "").localeCompare(String(right.captureId || "")));

  if (!includedCaptures.length) {
    throw new Error("No complete product-row shadow captures are available for matrix validation.");
  }

  const byContext = contexts
    .map(makeContextSummary)
    .sort((left, right) => left.contextId.localeCompare(right.contextId));
  const byContextLookup = Object.fromEntries(byContext.map((context) => [context.contextId, context]));
  const aggregate = {
    totalProducts: 0,
    evaluatedProducts: 0,
    skippedProducts: 0,
    decisions: emptyDistribution(DECISIONS),
    guardLevels: emptyDistribution(GUARD_LEVELS),
    implementationHints: emptyDistribution(IMPLEMENTATION_HINTS),
    bySafetyMetadataProfile: Object.fromEntries(
      SAFETY_METADATA_PROFILES.map((profile) => [profile, emptyDistribution(DECISIONS)])
    ),
    byCategory: {},
    byFunctionalProfile: Object.fromEntries(
      FUNCTIONAL_PROFILES.map((profile) => [profile, emptyDistribution(DECISIONS)])
    )
  };

  for (const capture of includedCaptures) {
    const products = [...capture.candidateSource.products].sort((left, right) =>
      productId(left).localeCompare(productId(right))
    );

    for (const product of products) {
      const id = productId(product);
      if (!id) {
        aggregate.skippedProducts += contexts.length;
        for (const context of byContext) {
          context.totalProducts += 1;
          context.skippedProducts += 1;
        }
        continue;
      }

      const productProfile = resolveProductFunctionalProfile(product);
      const safetyProfile = safetyMetadataProfile(product, productProfile);
      const category = normalizeCategory(product.category);
      const functionalBucket = functionalProfile(productProfile);

      for (const context of contexts) {
        const output = resolveRecentInstabilityGuardPolicy({
          surveySafety: context.safetyContext,
          goalPolicy: context.goalPolicyContext,
          product,
          productProfile
        });
        const evaluation = {
          decision: output.decision,
          guardLevel: output.guardLevel,
          implementationHint: output.implementationHint,
          safetyProfile,
          category,
          functionalBucket
        };

        addEvaluation(byContextLookup[context.contextId], evaluation);
        addEvaluation(aggregate, evaluation);
      }
    }
  }

  aggregate.byCategory = Object.fromEntries(
    Object.entries(aggregate.byCategory).sort(([left], [right]) => left.localeCompare(right))
  );

  for (const context of byContext) {
    context.byCategory = Object.fromEntries(
      Object.entries(context.byCategory).sort(([left], [right]) => left.localeCompare(right))
    );
    if (context.skippedProducts > 0) {
      context.notes.push("Some products were skipped because they lacked a stable product id.");
    }
  }

  const products = readCandidateProducts(includedCaptures);
  const productSummary = buildProductProfileSummary(products);
  const policyValidation = derivePolicyValidation({ aggregate, byContext });

  return {
    matrixVersion: "recent-instability-guard-matrix-v1",
    generatedAt,
    sourceScope: {
      totalInputCaptureCount: captures.length + excludedFixtures.length,
      includedCompleteCaptureCount: includedCaptures.length,
      excludedFixtureCount: excludedFixtures.length,
      excludedFixturesByReason: sortObject(
        excludedFixtures.reduce((acc, item) => {
          increment(acc, item.reason);
          return acc;
        }, {})
      ),
      captureSummaries: summarizeCaptures(includedCaptures),
      sourceStageDistribution: sortObject(
        includedCaptures.reduce((acc, capture) => {
          increment(acc, capture.candidateSource?.sourceStage || "unknown");
          return acc;
        }, {})
      )
    },
    contexts: contexts.map((context) => ({
      contextId: context.contextId,
      safetyContextId: context.safetyContextId,
      safetyContext: context.safetyContext,
      goalPolicyContext: context.goalPolicyContext
    })).sort((left, right) => left.contextId.localeCompare(right.contextId)),
    productScope: {
      uniqueCandidateProductCount: productSummary.uniqueProductCount,
      totalCaptureProductRows: products.length,
      totalMatrixEvaluations: aggregate.evaluatedProducts,
      safetyMetadataProfileDistribution: productSummary.safetyMetadataProfileDistribution,
      categoryDistribution: productSummary.categoryDistribution,
      functionalProfileDistribution: productSummary.functionalProfileDistribution
    },
    aggregate,
    byContext,
    bySafetyMetadataProfile: aggregate.bySafetyMetadataProfile,
    byCategory: aggregate.byCategory,
    byFunctionalProfile: aggregate.byFunctionalProfile,
    policyValidation,
    actualCaptureObservation: {
      source: "Phase 8 safety review analysis",
      highConfidenceSafetyCases: 3,
      finding: "One high-sensitivity product-risk case supported keeping hard-block candidacy; two recent-instability cases with favorable product safety metadata suggested possible overblocking."
    },
    limitations: [
      "Synthetic safety contexts are policy validation inputs, not observed user outcomes.",
      "Actual high-confidence capture observations and synthetic matrix results must not be merged as equivalent evidence.",
      "Complete candidate sources can repeat the same product rows across captures.",
      "The fixture pool comes from development captures and may not represent production distribution.",
      "A policy-consistent matrix does not approve runtime application."
    ]
  };
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

async function readCapturesFromDisk() {
  const files = await listCaptureFiles();
  const captures = [];
  const excludedFixtures = [];

  for (const filePath of files) {
    let fixture;
    try {
      fixture = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      excludedFixtures.push({ reason: "malformed_fixture" });
      continue;
    }

    if (!fixture || fixture.captureVersion !== "v1") {
      excludedFixtures.push({ reason: "unsupported_fixture" });
      continue;
    }

    const candidateSource = fixture.candidateSource || {};
    const products = Array.isArray(candidateSource.products) ? candidateSource.products : [];
    if (
      candidateSource.completeness !== "complete" ||
      candidateSource.candidateIdentityMode !== "product_row" ||
      products.length === 0
    ) {
      excludedFixtures.push({ reason: candidateSource.completeness || "candidate_source_unavailable" });
      continue;
    }

    captures.push(fixture);
  }

  return { captures, excludedFixtures };
}

function renderDistribution(title, distribution) {
  return [
    `### ${title}`,
    ...Object.entries(distribution || {}).map(([key, value]) => `- ${key}: ${value}`)
  ];
}

function renderDecisionTable(byContext) {
  return byContext.flatMap((context) => [
    `### ${context.contextId}`,
    `- total evaluations: ${context.evaluatedProducts}`,
    `- hard_block_candidate: ${context.decisions.hard_block_candidate}`,
    `- collapsed_exposure_candidate: ${context.decisions.collapsed_exposure_candidate}`,
    `- insufficient_data: ${context.decisions.insufficient_data}`,
    `- no_guard: ${context.decisions.no_guard}`,
    ""
  ]);
}

function renderMarkdown(matrix) {
  return [
    "# Recent Instability Guard Matrix Review",
    "",
    "## Purpose",
    "Validate the pure `resolveRecentInstabilityGuardPolicy()` helper against complete shadow candidate sources and synthetic safety contexts. This does not change runtime ranking behavior.",
    "",
    "## Actual High-Confidence Capture Observation",
    `- source: ${matrix.actualCaptureObservation.source}`,
    `- high-confidence safety cases: ${matrix.actualCaptureObservation.highConfidenceSafetyCases}`,
    `- finding: ${matrix.actualCaptureObservation.finding}`,
    "",
    "## Synthetic Matrix Validation Method",
    "- Reused complete product-row shadow capture candidate sources.",
    "- Replayed 12 synthetic policy contexts across each candidate row.",
    "- Called product functional profile resolution and recent-instability policy helper only.",
    "",
    "## Source Scope",
    `- included complete captures: ${matrix.sourceScope.includedCompleteCaptureCount}`,
    `- excluded fixtures: ${matrix.sourceScope.excludedFixtureCount}`,
    `- unique candidate products: ${matrix.productScope.uniqueCandidateProductCount}`,
    `- total capture product rows: ${matrix.productScope.totalCaptureProductRows}`,
    `- total matrix evaluations: ${matrix.productScope.totalMatrixEvaluations}`,
    "",
    ...renderDistribution("Safety Metadata Profile Coverage", matrix.productScope.safetyMetadataProfileDistribution),
    "",
    ...renderDistribution("Category Coverage", matrix.productScope.categoryDistribution),
    "",
    ...renderDistribution("Functional Profile Coverage", matrix.productScope.functionalProfileDistribution),
    "",
    "## Context Decision Results",
    ...renderDecisionTable(matrix.byContext),
    "## Policy Behavior Judgment",
    `- status: ${matrix.policyValidation.status}`,
    ...Object.entries(matrix.policyValidation.metrics).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Potential Overblocking Observation",
    `- safe_low_risk hard block rate in recent contexts: ${matrix.policyValidation.metrics.safeLowRiskHardBlockRate}`,
    `- high-sensitivity-only safe_low_risk hard block rate: ${matrix.policyValidation.metrics.highSensitivityOnlySafeLowHardBlockRate}`,
    "",
    "## Metadata Coverage Limitation",
    `- metadata incomplete products: ${matrix.productScope.safetyMetadataProfileDistribution.metadata_incomplete || 0}`,
    `- metadata incomplete insufficient-data rate: ${matrix.policyValidation.metrics.metadataIncompleteInsufficientDataRate}`,
    "",
    "## Insufficient Matrix Coverage",
    ...matrix.limitations.map((item) => `- ${item}`),
    "",
    "## Runtime Non-Application Principle",
    "- This matrix validates policy-helper branching only.",
    "- It does not change hard filters, evaluator score, existing recommendations, API responses, or UI.",
    "- CandidatePolicy or evaluator connection requires a separate approved task.",
    "",
    "## Conditions Before CandidatePolicy/Evaluator Wiring",
    "- Additional high-confidence captures should cover missing category and metadata cells.",
    "- The team must choose soft penalty or collapsed exposure explicitly.",
    "- Runtime response/storage boundary checks must be specified before implementation.",
    "",
    "## Next Step",
    "- Use this matrix as evidence for a separate collapsed-exposure design task only; do not apply runtime changes from this phase."
  ].join("\n");
}

async function run() {
  const { captures, excludedFixtures } = await readCapturesFromDisk();
  const matrix = evaluateRecentInstabilityGuardMatrix({ captures, excludedFixtures });

  await mkdir(CAPTURE_DIR, { recursive: true });
  await mkdir(path.dirname(REVIEW_DOC_PATH), { recursive: true });
  await writeFile(JSON_OUTPUT_PATH, JSON.stringify(matrix, null, 2), "utf8");
  const markdown = renderMarkdown(matrix);
  await writeFile(MD_OUTPUT_PATH, markdown, "utf8");
  await writeFile(REVIEW_DOC_PATH, markdown, "utf8");

  console.log("recent-instability-guard-matrix summary");
  console.log(JSON.stringify({
    completeCaptureCount: matrix.sourceScope.includedCompleteCaptureCount,
    excludedFixtureCount: matrix.sourceScope.excludedFixtureCount,
    uniqueCandidateProductCount: matrix.productScope.uniqueCandidateProductCount,
    totalMatrixEvaluations: matrix.productScope.totalMatrixEvaluations,
    safetyMetadataProfileDistribution: matrix.productScope.safetyMetadataProfileDistribution,
    unsafeHighRiskHardBlockRate: matrix.policyValidation.metrics.unsafeHighRiskHardBlockRate,
    safeLowRiskCollapsedExposureRate: matrix.policyValidation.metrics.safeLowRiskCollapsedExposureRate,
    safeLowRiskHardBlockRate: matrix.policyValidation.metrics.safeLowRiskHardBlockRate,
    metadataIncompleteInsufficientDataRate: matrix.policyValidation.metrics.metadataIncompleteInsufficientDataRate,
    policyValidationStatus: matrix.policyValidation.status,
    outputs: {
      json: JSON_OUTPUT_PATH,
      markdown: MD_OUTPUT_PATH,
      review: REVIEW_DOC_PATH
    }
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
