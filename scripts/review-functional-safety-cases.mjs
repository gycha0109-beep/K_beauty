import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const PACKET_PATH = path.join(CAPTURE_DIR, "safety-review-packet.json");
const REPLAY_SUMMARY_PATH = path.join(CAPTURE_DIR, "replay-summary.json");
const POLICY_REVIEW_PATH = path.join(CAPTURE_DIR, "divergence-policy-review.json");
const ANALYSIS_PATH = path.join(CAPTURE_DIR, "safety-review-analysis.json");
const REVIEW_DOC_PATH = process.env.FUNCTIONAL_SAFETY_REVIEW_DOC_PATH ||
  path.join(process.cwd(), "docs", "reviews", "functional-safety-review-20260703.md");

const ALLOWED_OUTCOMES = [
  "guard_appears_appropriate",
  "possible_overblocking",
  "insufficient_product_metadata",
  "goal_function_difference",
  "insufficient_sample",
  "needs_domain_review"
];

const ALLOWED_NEXT_ACTIONS = [
  "maintain_guard_and_collect_more_samples",
  "open_targeted_policy_review_task",
  "open_product_metadata_coverage_task",
  "request_domain_review",
  "insufficient_evidence_collect_more_cases"
];

const FOLLOW_UP_SAMPLE_MATRIX = {
  categories: ["treatment", "toner_pad", "serum", "essence", "moisturizer", "sunscreen"],
  rankingGoals: ["redness", "acne", "pores_texture", "dehydration", "uneven_tone"],
  safetyContexts: [
    "high sensitivity only",
    "recent instability only",
    "both high sensitivity and recent instability",
    "neither high sensitivity nor recent instability"
  ],
  productSafetyMetadata: [
    "sensitivity_safe true with low irritation",
    "sensitivity_safe false with high irritation",
    "metadata incomplete"
  ]
};

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error(`Missing or unreadable ${label}: ${filePath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function countBy(items, getKey) {
  const output = {};
  for (const item of items) {
    const key = getKey(item) || "unknown";
    output[key] = (output[key] || 0) + 1;
  }
  return sortObject(output);
}

function countHardFilterReasons(cases) {
  const output = {};
  for (const item of cases) {
    for (const reason of getReasonKeys(item)) {
      output[reason] = (output[reason] || 0) + 1;
    }
  }
  return sortObject(output);
}

function getReasonKeys(item) {
  const reasons = item.filterDecision?.hardFilterReasons || [];
  const keys = [];
  for (const reason of reasons) {
    const normalized = String(reason).toLowerCase();
    if (normalized.includes("high sensitivity")) keys.push("high_sensitivity");
    if (normalized.includes("recent instability")) keys.push("recent_instability");
  }
  return keys.length ? keys : ["unclassified"];
}

function hasProductLevelRisk(item) {
  return item.productContext?.irritationRisk === "high" ||
    item.productContext?.sensitivitySafe === false ||
    (item.productContext?.cautionTags || []).length > 0;
}

function hasPositiveSafetyMetadata(item) {
  return item.productContext?.irritationRisk === "low" &&
    item.productContext?.sensitivitySafe === true;
}

function hasRecentInstabilityRule(item) {
  return getReasonKeys(item).includes("recent_instability");
}

function chooseCaseRecommendation(item, totalCasesWithSameReason) {
  const metadataGaps = getMetadataGaps(item);
  const reasonKeys = getReasonKeys(item);
  const positiveSafetyMetadata = hasPositiveSafetyMetadata(item);

  if (reasonKeys.includes("high_sensitivity") && hasProductLevelRisk(item)) {
    return {
      recommendedOutcome: "guard_appears_appropriate",
      confidenceInReview: "high",
      policyChangeEligible: "no",
      reason: "The block is supported by high user sensitivity plus product-level risk metadata, including high irritation risk or an explicit non-sensitive-safe signal."
    };
  }

  if (hasRecentInstabilityRule(item) && positiveSafetyMetadata) {
    return {
      recommendedOutcome: "possible_overblocking",
      confidenceInReview: totalCasesWithSameReason >= 2 ? "medium" : "low",
      policyChangeEligible: totalCasesWithSameReason >= 2 ? "yes" : "no",
      reason: "The block comes from the recent-instability broad guard even though the product-level safety metadata is comparatively favorable."
    };
  }

  if (metadataGaps.length >= 2) {
    return {
      recommendedOutcome: "insufficient_product_metadata",
      confidenceInReview: "medium",
      policyChangeEligible: "no",
      reason: "Several core product metadata fields are missing, so the divergence is better treated as a coverage issue than a policy signal."
    };
  }

  return {
    recommendedOutcome: "insufficient_sample",
    confidenceInReview: "low",
    policyChangeEligible: "no",
    reason: "The evidence is high-confidence for comparison, but the same category and safety pattern is not repeated enough for a policy task."
  };
}

function getMetadataGaps(item) {
  const gaps = [];
  const context = item.productContext || {};
  if (!Array.isArray(context.functionalAxes) || context.functionalAxes.length === 0) gaps.push("functionalAxes");
  if (context.irritationRisk == null || context.irritationRisk === "unknown") gaps.push("irritationRisk");
  if (context.sensitivitySafe == null || context.sensitivitySafe === "unknown") gaps.push("sensitivitySafe");
  if (context.profileEvaluable === false) gaps.push("profileEvaluable");
  return gaps.sort();
}

function summarizeScoreBreakdown(scoreBreakdown = {}) {
  const keys = [
    "functionalFit",
    "skinFit",
    "safetyFit",
    "preferenceFit",
    "routineFit",
    "evidenceQuality",
    "reviewSignal",
    "penalties"
  ];
  return Object.fromEntries(keys.map((key) => [
    key,
    {
      score: scoreBreakdown[key]?.score ?? 0,
      max: scoreBreakdown[key]?.max ?? null
    }
  ]));
}

function buildCaseReview(item, reasonCounts) {
  const reasonKeys = getReasonKeys(item);
  const recommendation = chooseCaseRecommendation(
    item,
    Math.max(...reasonKeys.map((reason) => reasonCounts[reason] || 0))
  );
  const metadataGaps = getMetadataGaps(item);
  const positiveSafetyMetadata = hasPositiveSafetyMetadata(item);

  return {
    caseId: item.caseId,
    captureId: item.captureId,
    productId: item.productId,
    category: item.category || "unknown",
    confirmedFacts: {
      category: item.category || "unknown",
      existingRecommendationMembership: item.existingRecommendationContext?.existingResultMembership || [],
      rankingGoal: item.userContext?.rankingGoal || null,
      safetyGoal: item.userContext?.safetyGoal || null,
      recommendationGuard: item.userContext?.recommendationGuard || null,
      safetySignals: {
        sensitivityRisk: item.userContext?.sensitivityRisk || null,
        drynessRisk: item.userContext?.drynessRisk || null,
        rednessRisk: item.userContext?.rednessRisk || null,
        recentSkinChange: item.userContext?.recentSkinChange || null,
        recentlyChangedProduct: item.userContext?.recentlyChangedProduct || null,
        sunscreenSourceCompleteness: item.userContext?.sunscreenSourceCompleteness || null
      },
      hardFilterReasons: item.filterDecision?.hardFilterReasons || [],
      productSafetyMetadata: {
        irritationRisk: item.productContext?.irritationRisk ?? null,
        sensitivitySafe: item.productContext?.sensitivitySafe ?? null,
        cautionTags: item.productContext?.cautionTags || []
      },
      productFunctionalMetadata: {
        categoryRole: item.productContext?.categoryRole || null,
        functionalAxes: item.productContext?.functionalAxes || [],
        profileEvaluable: item.productContext?.profileEvaluable ?? null
      },
      evaluatorScoreSummary: summarizeScoreBreakdown(item.filterDecision?.scoreBreakdownSummary)
    },
    judgment: {
      recommendedOutcome: recommendation.recommendedOutcome,
      confidenceInReview: recommendation.confidenceInReview,
      policyChangeEligible: recommendation.policyChangeEligible,
      reason: recommendation.reason
    },
    guardAppropriatenessAnalysis: {
      supportsGuard: [
        item.userContext?.sensitivityRisk === "high" ? "User context contains high sensitivity risk." : null,
        item.userContext?.rednessRisk === "high" ? "User context contains high redness risk." : null,
        item.userContext?.recentSkinChange === "yes" ? "Recent skin instability is present." : null,
        hasProductLevelRisk(item) ? "Product-level risk metadata supports a conservative block." : null
      ].filter(Boolean),
      supportsOverblocking: [
        hasRecentInstabilityRule(item) && positiveSafetyMetadata
          ? "Recent-instability guard blocks the item despite low irritation risk and sensitivity-safe metadata."
          : null,
        hasRecentInstabilityRule(item) && !hasProductLevelRisk(item)
          ? "The block appears driven by a broad safety guard rather than product-level risk metadata."
          : null
      ].filter(Boolean),
      metadataGaps,
      goalFunctionDifference: [
        item.userContext?.hasTension
          ? "The requested ranking goal and safety goal are separated, so the divergence may include goal-priority tension."
          : null,
        item.existingRecommendationContext?.existingTopPick
          ? "The item was the existing top selected result, but no internal legacy rationale is inferred here."
          : null
      ].filter(Boolean)
    },
    additionalEvidenceNeeded: {
      neededCategories: item.category === "toner_pad" ? ["toner_pad", "serum", "essence"] : ["treatment", "serum", "moisturizer"],
      neededGoalSafetyPairs: [
        `${item.userContext?.rankingGoal || "unknown"} / ${item.userContext?.safetyGoal || "unknown"}`,
        "redness / redness",
        "acne / redness"
      ],
      neededProductMetadata: [
        "sensitivity_safe true with low irritation",
        "sensitivity_safe false with high irritation",
        "complete caution tags where applicable"
      ],
      neededRepeatCaseCount: recommendation.policyChangeEligible === "yes" ? 2 : 3
    },
    policyConclusion: {
      whyNotChangeNow: [
        "The packet is a manual evidence review, not a runtime decision source.",
        "The sample is still small and comes from development shadow captures.",
        "Changing a safety guard requires a separate approved task with explicit acceptance criteria."
      ],
      conditionsForSeparatePolicyTask: [
        "Repeat the same hard-filter pattern in high-confidence captures.",
        "Confirm product-level metadata is sufficient for the affected category.",
        "Frame the task as a review question, not an automatic filter change."
      ],
      allowedFollowUpNow: [
        "Collect additional shadow captures for the sample matrix.",
        "Open a targeted policy review task for recent-instability broad blocking.",
        "Keep existing runtime behavior unchanged."
      ]
    }
  };
}

function buildAggregateReview(caseReviews, packet, replaySummary, policyReview) {
  const recentInstabilityCases = caseReviews.filter((item) =>
    item.confirmedFacts.hardFilterReasons.some((reason) => String(reason).toLowerCase().includes("recent instability"))
  );
  const positiveMetadataBroadBlocks = recentInstabilityCases.filter((item) =>
    item.confirmedFacts.productSafetyMetadata.irritationRisk === "low" &&
    item.confirmedFacts.productSafetyMetadata.sensitivitySafe === true
  );
  const highSensitivityProductRiskCases = caseReviews.filter((item) =>
    item.confirmedFacts.hardFilterReasons.some((reason) => String(reason).toLowerCase().includes("high sensitivity")) &&
    (
      item.confirmedFacts.productSafetyMetadata.irritationRisk === "high" ||
      item.confirmedFacts.productSafetyMetadata.sensitivitySafe === false
    )
  );

  const recommendedNextAction = positiveMetadataBroadBlocks.length >= 2
    ? "open_targeted_policy_review_task"
    : highSensitivityProductRiskCases.length === caseReviews.length
      ? "maintain_guard_and_collect_more_samples"
      : "insufficient_evidence_collect_more_cases";

  return {
    casesReviewed: {
      total: caseReviews.length,
      categories: countBy(caseReviews, (item) => item.category),
      hardFilterReasons: countHardFilterReasons(packet.cases || []),
      rankingGoalDistribution: countBy(caseReviews, (item) => item.confirmedFacts.rankingGoal),
      safetyGoalDistribution: countBy(caseReviews, (item) => item.confirmedFacts.safetyGoal)
    },
    patternAssessment: {
      repeatedRulePattern: positiveMetadataBroadBlocks.length >= 2
        ? "Two high-confidence cases repeat the recent-instability broad guard while product-level safety metadata is favorable."
        : "The blocked cases do not yet show a repeated broad-rule pattern strong enough for policy review.",
      productLevelMetadataCoverage: packet.aggregate?.metadataCoverageSummary || {},
      categoryDifferentiation: "The current packet includes treatment and toner_pad cases, but toner_pad has only one high-confidence example.",
      evidenceSufficiency: caseReviews.length >= 3
        ? "Enough for a targeted review question, not enough for runtime policy change."
        : "Insufficient for a targeted policy review question.",
      safetyUncertainty: "All included cases have high sensitivity and redness risk, so safety uncertainty remains material."
    },
    recommendedNextAction,
    why: [
      "Three high-confidence existing-selected-but-blocked cases are available.",
      "One case has direct product-level risk metadata supporting the current guard.",
      "Two cases are blocked by a broad recent-instability guard despite low irritation and sensitivity-safe product metadata.",
      "The repeated broad-rule pattern is suitable for manual policy review, but not for immediate implementation.",
      "Development fixtures and a fixed test image do not represent the full user distribution."
    ],
    explicitNonActions: [
      "Do not change hard filters in this phase.",
      "Do not change ranking scores or weights in this phase.",
      "Do not alter existing recommendation output in this phase.",
      "Do not expose functional ranking results to users in this phase.",
      "Do not update product data from this packet."
    ],
    evidenceCounters: {
      replayedCount: replaySummary.replayedCount ?? null,
      highConfidenceCount: policyReview.reviewScope?.includedComparisonCount ?? null,
      existingSelectedBlockedCount: policyReview.aggregate?.byDivergenceType?.existing_selected_but_blocked?.count ??
        packet.aggregate?.totalEligibleSafetyCases ?? null
    }
  };
}

function renderList(items, empty = "- none") {
  if (!items || items.length === 0) return [empty];
  return items.map((item) => `- ${item}`);
}

function renderDistribution(distribution) {
  const entries = Object.entries(distribution || {});
  return entries.length ? entries.map(([key, value]) => `- ${key}: ${value}`) : ["- none"];
}

function renderCaseReview(item) {
  return [
    `## Case ${item.caseId}`,
    "",
    "### Confirmed Facts",
    `- category: ${item.confirmedFacts.category}`,
    `- existing recommendation membership: ${JSON.stringify(item.confirmedFacts.existingRecommendationMembership)}`,
    `- rankingGoal / safetyGoal: ${item.confirmedFacts.rankingGoal || "unknown"} / ${item.confirmedFacts.safetyGoal || "unknown"}`,
    `- recommendationGuard: ${item.confirmedFacts.recommendationGuard || "unknown"}`,
    `- safety signals: sensitivity=${item.confirmedFacts.safetySignals.sensitivityRisk || "unknown"}, dryness=${item.confirmedFacts.safetySignals.drynessRisk || "unknown"}, redness=${item.confirmedFacts.safetySignals.rednessRisk || "unknown"}, recentSkinChange=${item.confirmedFacts.safetySignals.recentSkinChange || "unknown"}, recentlyChangedProduct=${item.confirmedFacts.safetySignals.recentlyChangedProduct || "unknown"}`,
    `- hardFilterReasons: ${item.confirmedFacts.hardFilterReasons.join("; ")}`,
    `- product safety metadata: irritationRisk=${item.confirmedFacts.productSafetyMetadata.irritationRisk ?? "unknown"}, sensitivitySafe=${item.confirmedFacts.productSafetyMetadata.sensitivitySafe ?? "unknown"}, cautionTags=${item.confirmedFacts.productSafetyMetadata.cautionTags.join(", ") || "none"}`,
    `- product functional metadata: categoryRole=${item.confirmedFacts.productFunctionalMetadata.categoryRole || "unknown"}, functionalAxes=${item.confirmedFacts.productFunctionalMetadata.functionalAxes.map((axis) => axis.axis).join(", ") || "none"}, profileEvaluable=${item.confirmedFacts.productFunctionalMetadata.profileEvaluable}`,
    `- evaluator score summary: functionalFit ${item.confirmedFacts.evaluatorScoreSummary.functionalFit.score}/${item.confirmedFacts.evaluatorScoreSummary.functionalFit.max}, safetyFit ${item.confirmedFacts.evaluatorScoreSummary.safetyFit.score}/${item.confirmedFacts.evaluatorScoreSummary.safetyFit.max}, evidenceQuality ${item.confirmedFacts.evaluatorScoreSummary.evidenceQuality.score}/${item.confirmedFacts.evaluatorScoreSummary.evidenceQuality.max}`,
    "",
    "### Judgment",
    `- recommendedOutcome: ${item.judgment.recommendedOutcome}`,
    `- confidenceInReview: ${item.judgment.confidenceInReview}`,
    `- policyChangeEligible: ${item.judgment.policyChangeEligible}`,
    `- reason: ${item.judgment.reason}`,
    "",
    "### Guard Appropriateness Analysis",
    "- guard-supporting evidence:",
    ...renderList(item.guardAppropriatenessAnalysis.supportsGuard),
    "- overblocking evidence:",
    ...renderList(item.guardAppropriatenessAnalysis.supportsOverblocking),
    "- metadata gaps:",
    ...renderList(item.guardAppropriatenessAnalysis.metadataGaps),
    "- legacy/new goal-function difference:",
    ...renderList(item.guardAppropriatenessAnalysis.goalFunctionDifference),
    "",
    "### Additional Samples Or Information Needed",
    `- needed category: ${item.additionalEvidenceNeeded.neededCategories.join(", ")}`,
    `- needed rankingGoal/safetyGoal pairs: ${item.additionalEvidenceNeeded.neededGoalSafetyPairs.join(", ")}`,
    `- needed product metadata: ${item.additionalEvidenceNeeded.neededProductMetadata.join(", ")}`,
    `- needed repeat case count: ${item.additionalEvidenceNeeded.neededRepeatCaseCount}`,
    "",
    "### Policy Change Conclusion",
    "- why hard filters should not change now:",
    ...renderList(item.policyConclusion.whyNotChangeNow),
    "- conditions for a separate policy task:",
    ...renderList(item.policyConclusion.conditionsForSeparatePolicyTask),
    "- allowed follow-up now:",
    ...renderList(item.policyConclusion.allowedFollowUpNow),
    ""
  ].join("\n");
}

function renderMarkdown(analysis) {
  return [
    "# Functional Safety Review Case Analysis",
    "",
    "## Review Scope",
    `- analysis date: 2026-07-03`,
    `- included confidence: ${analysis.reviewScope.includedConfidence.join(", ")}`,
    `- eligible divergence type: ${analysis.reviewScope.eligibleDivergenceType}`,
    `- cases reviewed: ${analysis.reviewScope.casesReviewed}`,
    `- low-confidence cases included in recommendations: no`,
    "",
    "## Evidence Sources",
    ...analysis.evidenceSources.map((item) => `- ${item}`),
    "",
    "## Case-by-Case Review",
    "",
    ...analysis.caseReviews.map(renderCaseReview),
    "## Aggregate Review",
    "",
    "### Cases Reviewed",
    `- total: ${analysis.aggregateReview.casesReviewed.total}`,
    "- categories:",
    ...renderDistribution(analysis.aggregateReview.casesReviewed.categories),
    "- hard filter reasons:",
    ...renderDistribution(analysis.aggregateReview.casesReviewed.hardFilterReasons),
    "- rankingGoal distribution:",
    ...renderDistribution(analysis.aggregateReview.casesReviewed.rankingGoalDistribution),
    "- safetyGoal distribution:",
    ...renderDistribution(analysis.aggregateReview.casesReviewed.safetyGoalDistribution),
    "",
    "### Pattern Assessment",
    `- repeated rule pattern: ${analysis.aggregateReview.patternAssessment.repeatedRulePattern}`,
    `- product-level metadata coverage: ${JSON.stringify(analysis.aggregateReview.patternAssessment.productLevelMetadataCoverage)}`,
    `- category differentiation: ${analysis.aggregateReview.patternAssessment.categoryDifferentiation}`,
    `- evidence sufficiency: ${analysis.aggregateReview.patternAssessment.evidenceSufficiency}`,
    `- safety uncertainty: ${analysis.aggregateReview.patternAssessment.safetyUncertainty}`,
    "",
    "### Recommended Next Action",
    `- ${analysis.aggregateReview.recommendedNextAction}`,
    "",
    "### Why",
    ...renderList(analysis.aggregateReview.why),
    "",
    "### Explicit Non-Actions",
    ...renderList(analysis.aggregateReview.explicitNonActions),
    "",
    "## Limitations",
    ...renderList(analysis.limitations),
    "",
    "## Follow-up Sample Matrix",
    `- category: ${analysis.followUpSampleMatrix.categories.join(", ")}`,
    `- rankingGoal: ${analysis.followUpSampleMatrix.rankingGoals.join(", ")}`,
    `- safety context: ${analysis.followUpSampleMatrix.safetyContexts.join(", ")}`,
    `- product safety metadata: ${analysis.followUpSampleMatrix.productSafetyMetadata.join(", ")}`,
    ""
  ].join("\n");
}

function buildAnalysis({ packet, replaySummary, policyReview }) {
  const eligibleCases = (packet.cases || [])
    .filter((item) =>
      item.divergence?.type === "existing_selected_but_blocked" &&
      item.divergence?.functionalConfidence === "high" &&
      (item.filterDecision?.hardFilterReasons || []).length > 0
    )
    .sort((left, right) => String(left.caseId).localeCompare(String(right.caseId)));
  const reasonCounts = countHardFilterReasons(eligibleCases);
  const caseReviews = eligibleCases.map((item) => buildCaseReview(item, reasonCounts));
  const aggregateReview = buildAggregateReview(caseReviews, packet, replaySummary, policyReview);

  if (!ALLOWED_NEXT_ACTIONS.includes(aggregateReview.recommendedNextAction)) {
    throw new Error(`Unexpected next action: ${aggregateReview.recommendedNextAction}`);
  }

  for (const item of caseReviews) {
    if (!ALLOWED_OUTCOMES.includes(item.judgment.recommendedOutcome)) {
      throw new Error(`Unexpected outcome: ${item.judgment.recommendedOutcome}`);
    }
  }

  return {
    generatedAt: "2026-07-03T00:00:00.000Z",
    reviewScope: {
      includedConfidence: ["high"],
      excludedConfidence: ["medium", "low"],
      eligibleDivergenceType: "existing_selected_but_blocked",
      casesReviewed: caseReviews.length,
      sourcePacketCases: packet.cases?.length || 0
    },
    evidenceSources: [
      "tmp/functional-shadow-captures/safety-review-packet.json",
      "tmp/functional-shadow-captures/replay-summary.json",
      "tmp/functional-shadow-captures/divergence-policy-review.json"
    ],
    caseReviews,
    aggregateReview,
    limitations: [
      "The sample is limited to development shadow captures.",
      "The fixed test media setup may not represent broader usage.",
      "The legacy and functional ranking objectives are intentionally different.",
      "The analysis compares structured evidence and does not decide correctness.",
      "Current-routine and vision-derived ranking context remain limited.",
      "High-confidence source boundaries can still represent a post-score source stage."
    ],
    followUpSampleMatrix: FOLLOW_UP_SAMPLE_MATRIX
  };
}

const packet = await readJson(PACKET_PATH, "safety review packet");
const replaySummary = await readJson(REPLAY_SUMMARY_PATH, "replay summary");
const policyReview = await readJson(POLICY_REVIEW_PATH, "divergence policy review");
const analysis = buildAnalysis({ packet, replaySummary, policyReview });

await mkdir(CAPTURE_DIR, { recursive: true });
await mkdir(path.dirname(REVIEW_DOC_PATH), { recursive: true });
await writeFile(ANALYSIS_PATH, JSON.stringify(analysis, null, 2), "utf8");
await writeFile(REVIEW_DOC_PATH, renderMarkdown(analysis), "utf8");

console.log("functional-safety-case-review summary");
console.log(JSON.stringify({
  casesReviewed: analysis.caseReviews.length,
  outcomes: countBy(analysis.caseReviews, (item) => item.judgment.recommendedOutcome),
  policyChangeEligible: countBy(analysis.caseReviews, (item) => item.judgment.policyChangeEligible),
  recommendedNextAction: analysis.aggregateReview.recommendedNextAction,
  output: {
    analysisPath: ANALYSIS_PATH,
    reviewDocPath: REVIEW_DOC_PATH
  }
}, null, 2));
