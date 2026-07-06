const DEFAULT_OPTIONS = {
  includedConfidence: ["high"],
  minimumCaseCount: 5,
  minimumRepeatCount: 2
};

const POLICY_ASSESSMENTS = [
  "hard_block_behavior_appears_appropriate",
  "possible_evaluator_overblocking",
  "needs_product_metadata_coverage_review",
  "insufficient_evidence"
];

function normalizeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    includedConfidence: Array.isArray(options.includedConfidence)
      ? options.includedConfidence.map((item) => String(item || "").trim()).filter(Boolean)
      : DEFAULT_OPTIONS.includedConfidence
  };
}

function normalizeKey(value) {
  return String(value || "unknown").trim() || "unknown";
}

function increment(map, key, amount = 1) {
  const normalized = normalizeKey(key);
  map[normalized] = (map[normalized] || 0) + amount;
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function ratio(part, total) {
  return total ? round(part / total) : 0;
}

function confidenceAllowed(fixture, includedConfidence) {
  return includedConfidence.has(fixture?.comparisonConfidence || "unknown");
}

function fixtureReviewRows(fixture) {
  const rows = Array.isArray(fixture?.candidateReviewRows)
    ? fixture.candidateReviewRows
    : (Array.isArray(fixture?.candidateReviews) ? fixture.candidateReviews : []);

  return rows.map((row) => normalizeCandidateRow(row, fixture));
}

function normalizeCandidateRow(row, fixture) {
  const hardFilterStatus = row?.hardFilterStatus || row?.evaluatorHardFilterStatus || null;
  const guardDecision = row?.guardDecision || row?.recentInstabilityGuardDecision || null;
  const hardFilterReasons = Array.isArray(row?.hardFilterReasons)
    ? row.hardFilterReasons
    : (Array.isArray(row?.evaluatorHardFilterReasons) ? row.evaluatorHardFilterReasons : []);
  const guardReasons = Array.isArray(row?.guardReasons)
    ? row.guardReasons
    : (Array.isArray(row?.recentInstabilityGuardReasons) ? row.recentInstabilityGuardReasons : []);

  return {
    captureId: fixture?.captureId || null,
    comparisonConfidence: fixture?.comparisonConfidence || "unknown",
    productId: row?.productId || null,
    category: row?.category || "unknown",
    exposureStatus: row?.exposureStatus || "unknown",
    hardFilterStatus,
    hardFilterReasons,
    guardDecision,
    guardReasons,
    blockedBy: row?.blockedBy || {
      evaluator: hardFilterStatus === "blocked",
      guardHardBlock: guardDecision === "hard_block_candidate"
    },
    safetyMetadataProfile: row?.safetyMetadataProfile || "unknown",
    functionalProfile: row?.functionalProfile || "unknown",
    rankingGoal: row?.rankingGoal || fixture?.rankingContext?.rankingGoal || "unknown",
    safetyGoal: row?.safetyGoal || fixture?.rankingContext?.safetyGoal || "unknown",
    recommendationGuard: row?.recommendationGuard || fixture?.rankingContext?.recommendationGuard || "unknown",
    safetyContext: row?.safetyContext || {
      highSensitivity: false,
      recentInstability: false
    },
    irritationRisk: row?.irritationRisk || inferIrritationRisk(row?.safetyMetadataProfile),
    sensitivitySafe: typeof row?.sensitivitySafe === "boolean"
      ? row.sensitivitySafe
      : inferSensitivitySafe(row?.safetyMetadataProfile),
    activeAxisPresent: row?.activeAxisPresent === true ||
      (Array.isArray(guardReasons) && guardReasons.includes("active_functional_axis")),
    stabilizingAxisPresent: row?.stabilizingAxisPresent === true ||
      (Array.isArray(guardReasons) && guardReasons.includes("stabilizing_functional_axis")),
    profileEvaluable: row?.profileEvaluable === false ? false : true,
    cautionTags: Array.isArray(row?.cautionTags) ? row.cautionTags : []
  };
}

function inferIrritationRisk(profile) {
  if (profile === "safe_low_risk") return "low";
  if (profile === "safe_medium_risk") return "medium";
  if (profile === "unsafe_high_risk") return "high";
  return "unknown";
}

function inferSensitivitySafe(profile) {
  if (profile === "safe_low_risk" || profile === "safe_medium_risk") return true;
  if (profile === "unsafe_high_risk") return false;
  return null;
}

function isTargetCase(row) {
  return row.exposureStatus === "hidden_candidate" &&
    row.safetyMetadataProfile === "safe_low_risk" &&
    row.blockedBy?.evaluator === true &&
    row.hardFilterStatus === "blocked" &&
    row.hardFilterReasons.includes("recent_instability_active_limited");
}

function safetyContextBucket(row) {
  const highSensitivity = row?.safetyContext?.highSensitivity === true ||
    row.hardFilterReasons.includes("high_sensitivity_detected") ||
    row.guardReasons.includes("high_sensitivity_detected");
  const recentInstability = row?.safetyContext?.recentInstability === true ||
    row.hardFilterReasons.includes("recent_instability_active_limited") ||
    row.guardReasons.includes("recent_instability_detected");

  if (highSensitivity && recentInstability) return "both";
  if (highSensitivity) return "high_sensitivity_only";
  if (recentInstability) return "recent_instability_only";
  return "neither";
}

function addReasons(target, reasons = []) {
  for (const reason of Array.isArray(reasons) ? reasons : []) {
    increment(target, reason);
  }
}

function makeBreakdowns(cases) {
  const ruleReasonDistribution = {};
  const guardReasonDistribution = {};
  const blockedSourceDistribution = {};
  const categoryDistribution = {};
  const functionalProfileDistribution = {};
  const safetyContextDistribution = {};
  const rankingGoalDistribution = {};
  const safetyGoalDistribution = {};
  const recommendationGuardDistribution = {};
  const irritationRiskDistribution = {};
  const sensitivitySafeDistribution = {};
  const activeAxisDistribution = {};
  const stabilizingAxisDistribution = {};
  const profileEvaluableDistribution = {};
  const cautionTagDistribution = {};

  for (const item of cases) {
    addReasons(ruleReasonDistribution, item.hardFilterReasons);
    addReasons(guardReasonDistribution, item.guardReasons);
    increment(blockedSourceDistribution, item.blockedBy?.guardHardBlock ? "evaluator_and_guard" : "evaluator_only");
    increment(categoryDistribution, item.category);
    increment(functionalProfileDistribution, item.functionalProfile);
    increment(safetyContextDistribution, safetyContextBucket(item));
    increment(rankingGoalDistribution, item.rankingGoal);
    increment(safetyGoalDistribution, item.safetyGoal);
    increment(recommendationGuardDistribution, item.recommendationGuard);
    increment(irritationRiskDistribution, item.irritationRisk);
    increment(sensitivitySafeDistribution, String(item.sensitivitySafe));
    increment(activeAxisDistribution, item.activeAxisPresent ? "active_axis_present" : "no_active_axis");
    increment(stabilizingAxisDistribution, item.stabilizingAxisPresent ? "stabilizing_axis_present" : "no_stabilizing_axis");
    increment(profileEvaluableDistribution, item.profileEvaluable === false ? "false" : "true");

    if (item.cautionTags.length) {
      addReasons(cautionTagDistribution, item.cautionTags);
    } else {
      increment(cautionTagDistribution, "none");
    }
  }

  return {
    ruleReasonDistribution: sortObject(ruleReasonDistribution),
    guardReasonDistribution: sortObject(guardReasonDistribution),
    blockedSourceDistribution: sortObject(blockedSourceDistribution),
    categoryDistribution: sortObject(categoryDistribution),
    functionalProfileDistribution: sortObject(functionalProfileDistribution),
    safetyContextDistribution: sortObject(safetyContextDistribution),
    rankingGoalDistribution: sortObject(rankingGoalDistribution),
    safetyGoalDistribution: sortObject(safetyGoalDistribution),
    recommendationGuardDistribution: sortObject(recommendationGuardDistribution),
    productSafetyMetadata: {
      irritationRiskDistribution: sortObject(irritationRiskDistribution),
      sensitivitySafeDistribution: sortObject(sensitivitySafeDistribution),
      activeAxisDistribution: sortObject(activeAxisDistribution),
      stabilizingAxisDistribution: sortObject(stabilizingAxisDistribution),
      profileEvaluableDistribution: sortObject(profileEvaluableDistribution),
      cautionTagDistribution: sortObject(cautionTagDistribution)
    }
  };
}

function uniqueCount(cases, field) {
  return new Set(cases.map((item) => item?.[field]).filter(Boolean)).size;
}

function assessPolicy({ aggregate, breakdowns, limitations, options }) {
  if (aggregate.reviewedCaseCount < options.minimumCaseCount) {
    return "insufficient_evidence";
  }

  if (limitations.includes("candidate_review_rows_missing")) {
    return "insufficient_evidence";
  }

  if (limitations.includes("product_metadata_coverage_incomplete")) {
    return "needs_product_metadata_coverage_review";
  }

  const repeatedRecentInstability = (breakdowns.ruleReasonDistribution.recent_instability_active_limited || 0) >=
    options.minimumRepeatCount;
  const allLowRiskSafe = aggregate.lowIrritationSensitivitySafeCount === aggregate.reviewedCaseCount;
  const stabilizingBlocked = (breakdowns.functionalProfileDistribution.stabilizing_leaning || 0) > 0 ||
    (breakdowns.functionalProfileDistribution.mixed || 0) > 0;

  if (repeatedRecentInstability && allLowRiskSafe && stabilizingBlocked) {
    return "possible_evaluator_overblocking";
  }

  return "hard_block_behavior_appears_appropriate";
}

function buildLimitations({ fixtures, cases, aggregate }) {
  const limitations = [];

  if (!fixtures.length) {
    limitations.push("no_included_high_confidence_fixtures");
  }

  if (aggregate.reviewedCaseCount === 0) {
    limitations.push("no_matching_safe_low_risk_hidden_recent_instability_cases");
  }

  if (fixtures.some((fixture) => !Array.isArray(fixture.candidateReviewRows) && !Array.isArray(fixture.candidateReviews))) {
    limitations.push("candidate_review_rows_missing");
  }

  if (cases.some((item) => item.cautionTags.length === 0)) {
    limitations.push("caution_tags_absent_or_empty_in_some_cases");
  }

  if (cases.some((item) => item.profileEvaluable === false || item.irritationRisk === "unknown" || item.sensitivitySafe == null)) {
    limitations.push("product_metadata_coverage_incomplete");
  }

  if (uniqueCount(cases, "productId") < cases.length) {
    limitations.push("repeated_product_ids_reduce_independence");
  }

  return Array.from(new Set(limitations)).sort();
}

function buildCandidateSamples(cases, limit = 12) {
  return cases
    .map((item) => ({
      captureId: item.captureId,
      productId: item.productId,
      category: item.category,
      functionalProfile: item.functionalProfile,
      safetyContext: safetyContextBucket(item),
      hardFilterReasons: item.hardFilterReasons,
      guardReasons: item.guardReasons,
      irritationRisk: item.irritationRisk,
      sensitivitySafe: item.sensitivitySafe,
      activeAxisPresent: item.activeAxisPresent,
      stabilizingAxisPresent: item.stabilizingAxisPresent,
      profileEvaluable: item.profileEvaluable,
      cautionTags: item.cautionTags
    }))
    .sort((left, right) =>
      String(left.category).localeCompare(String(right.category)) ||
      String(left.captureId || "").localeCompare(String(right.captureId || "")) ||
      String(left.productId || "").localeCompare(String(right.productId || ""))
    )
    .slice(0, limit);
}

function buildNextAction(policyAssessment) {
  if (policyAssessment === "possible_evaluator_overblocking") {
    return "Open a targeted evaluator hard-block boundary policy review before changing any runtime hard filter.";
  }

  if (policyAssessment === "needs_product_metadata_coverage_review") {
    return "Review product/profile metadata coverage before drawing hard-block policy conclusions.";
  }

  if (policyAssessment === "hard_block_behavior_appears_appropriate") {
    return "Keep current evaluator hard block and continue shadow monitoring.";
  }

  return "Collect more high-confidence complete exposure audit rows before policy review.";
}

export function reviewFunctionalEvaluatorHardBlocks({
  candidateExposureAudit = {},
  options: inputOptions = {}
} = {}) {
  const options = normalizeOptions(inputOptions);
  const includedConfidence = new Set(options.includedConfidence);
  const fixtures = (Array.isArray(candidateExposureAudit?.fixtureAudits) ? candidateExposureAudit.fixtureAudits : [])
    .filter((fixture) => confidenceAllowed(fixture, includedConfidence));
  const rows = fixtures.flatMap(fixtureReviewRows);
  const cases = rows.filter(isTargetCase);
  const breakdowns = makeBreakdowns(cases);
  const aggregate = {
    reviewedCaseCount: cases.length,
    candidateRowCount: rows.length,
    safeLowRiskHiddenCount: rows.filter((row) =>
      row.exposureStatus === "hidden_candidate" && row.safetyMetadataProfile === "safe_low_risk"
    ).length,
    recentInstabilityActiveLimitedCount: cases.filter((row) =>
      row.hardFilterReasons.includes("recent_instability_active_limited")
    ).length,
    recentInstabilityActiveLimitedRate: ratio(
      cases.filter((row) => row.hardFilterReasons.includes("recent_instability_active_limited")).length,
      cases.length
    ),
    evaluatorOnlyCount: cases.filter((row) => !row.blockedBy?.guardHardBlock).length,
    guardOverlapCount: cases.filter((row) => row.blockedBy?.guardHardBlock).length,
    uniqueProductCount: uniqueCount(cases, "productId"),
    lowIrritationSensitivitySafeCount: cases.filter((row) =>
      row.irritationRisk === "low" && row.sensitivitySafe === true
    ).length
  };
  const limitations = buildLimitations({ fixtures, cases, aggregate });
  const policyAssessment = assessPolicy({ aggregate, breakdowns, limitations, options });

  return {
    reviewScope: {
      auditVersion: candidateExposureAudit?.auditVersion || null,
      includedConfidence: options.includedConfidence,
      includedFixtureCount: fixtures.length,
      minimumCaseCount: options.minimumCaseCount,
      minimumRepeatCount: options.minimumRepeatCount,
      targetCriteria: [
        "exposureStatus=hidden_candidate",
        "safetyMetadataProfile=safe_low_risk",
        "blockedBy.evaluator=true",
        "hardFilterReasons includes recent_instability_active_limited"
      ]
    },
    aggregate,
    ruleBreakdown: {
      hardFilterReasons: breakdowns.ruleReasonDistribution,
      guardReasons: breakdowns.guardReasonDistribution,
      blockedSource: breakdowns.blockedSourceDistribution
    },
    categoryBreakdown: breakdowns.categoryDistribution,
    functionalProfileBreakdown: breakdowns.functionalProfileDistribution,
    safetyContextBreakdown: breakdowns.safetyContextDistribution,
    productMetadataCoverage: breakdowns.productSafetyMetadata,
    candidateSamples: buildCandidateSamples(cases),
    policyAssessment: {
      status: policyAssessment,
      runtimeChangeApproved: false,
      validStatuses: POLICY_ASSESSMENTS,
      rationale: [
        "This review analyzes shadow candidate evidence only.",
        "It does not change evaluator hard filters or CandidatePolicy runtime behavior.",
        "Repeated safe-low-risk evaluator hard blocks are policy review signals, not automatic fixes."
      ]
    },
    limitations,
    nextAction: buildNextAction(policyAssessment)
  };
}

export const FUNCTIONAL_EVALUATOR_HARD_BLOCK_REVIEW_VALUES = {
  policyAssessments: POLICY_ASSESSMENTS,
  defaultOptions: DEFAULT_OPTIONS
};
