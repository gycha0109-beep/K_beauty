const DEFAULT_OPTIONS = {
  includedConfidence: ["high"],
  minimumCaptureCount: 5,
  minimumGroupCount: 10,
  minimumReasonRepeatCount: 2
};

const READINESS = [
  "ready_for_shadow_candidate_policy_integration",
  "needs_hidden_reason_policy_review",
  "needs_metadata_or_coverage_expansion",
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

function mergeDistribution(target, source = {}) {
  for (const [key, value] of Object.entries(source || {})) {
    increment(target, key, Number(value) || 0);
  }
}

function mergeNestedDistribution(target, source = {}) {
  for (const [key, value] of Object.entries(source || {})) {
    if (!target[key]) target[key] = {};
    mergeDistribution(target[key], value);
  }
}

function sortNested(input = {}) {
  return Object.fromEntries(
    Object.entries(input)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, sortObject(value)])
  );
}

function captureConfidenceLookup(replaySummary = {}) {
  const lookup = new Map();

  for (const result of Array.isArray(replaySummary.results) ? replaySummary.results : []) {
    if (result?.captureId) {
      lookup.set(result.captureId, result?.comparison?.comparisonSummary?.comparisonConfidence || "unknown");
    }
  }

  return lookup;
}

function includedFixtureAudits(exposureAudit = {}, replaySummary = {}, options) {
  const confidenceByCaptureId = captureConfidenceLookup(replaySummary);
  const includedConfidence = new Set(options.includedConfidence);

  return (Array.isArray(exposureAudit.fixtureAudits) ? exposureAudit.fixtureAudits : [])
    .map((fixture) => ({
      ...fixture,
      comparisonConfidence: confidenceByCaptureId.get(fixture.captureId) || fixture.comparisonConfidence || "unknown"
    }))
    .filter((fixture) => includedConfidence.has(fixture.comparisonConfidence));
}

function collectCandidateReviews(fixtures) {
  return fixtures.flatMap((fixture) =>
    (Array.isArray(fixture.candidateReviews) ? fixture.candidateReviews : []).map((item) => ({
      ...item,
      captureId: fixture.captureId || null
    }))
  );
}

function safetyContextBucket(item) {
  const highSensitivity = item?.safetyContext?.highSensitivity === true;
  const recentInstability = item?.safetyContext?.recentInstability === true;

  if (highSensitivity && recentInstability) return "both";
  if (highSensitivity) return "high_sensitivity";
  if (recentInstability) return "recent_instability";
  return "neither";
}

function blockedSource(item) {
  const evaluatorBlocked = item?.blockedBy?.evaluator === true;
  const guardHardBlock = item?.blockedBy?.guardHardBlock === true;

  if (evaluatorBlocked && guardHardBlock) return "both";
  if (evaluatorBlocked) return "evaluator_blocked";
  if (guardHardBlock) return "guard_hard_block_candidate";
  return "neither";
}

function addReasons(target, reasons = []) {
  for (const reason of Array.isArray(reasons) ? reasons : []) {
    increment(target, reason);
  }
}

function buildHiddenReasonReview(candidates) {
  const hidden = candidates.filter((item) => item.exposureStatus === "hidden_candidate");
  const safeLowRiskHidden = hidden.filter((item) => item.safetyMetadataProfile === "safe_low_risk");
  const evaluatorHardFilterReasonDistribution = {};
  const recentInstabilityGuardReasonDistribution = {};
  const safeLowRiskHiddenReasonDistribution = {};
  const safeLowRiskHiddenByCategory = {};
  const safeLowRiskHiddenByFunctionalProfile = {};
  const safeLowRiskHiddenBySafetyContext = {};
  const hiddenBlockedSourceDistribution = {};

  for (const item of hidden) {
    addReasons(evaluatorHardFilterReasonDistribution, item.evaluatorHardFilterReasons);
    addReasons(recentInstabilityGuardReasonDistribution, item.recentInstabilityGuardReasons);
    increment(hiddenBlockedSourceDistribution, blockedSource(item));
  }

  for (const item of safeLowRiskHidden) {
    const reasons = [
      ...(Array.isArray(item.evaluatorHardFilterReasons) ? item.evaluatorHardFilterReasons : []),
      ...(Array.isArray(item.recentInstabilityGuardReasons) ? item.recentInstabilityGuardReasons : []),
      ...(Array.isArray(item.exposurePolicyReasons) ? item.exposurePolicyReasons : [])
    ];

    addReasons(safeLowRiskHiddenReasonDistribution, reasons);
    increment(safeLowRiskHiddenByCategory, item.category);
    increment(safeLowRiskHiddenByFunctionalProfile, item.functionalProfile);
    increment(safeLowRiskHiddenBySafetyContext, safetyContextBucket(item));
  }

  return {
    hiddenCount: hidden.length,
    evaluatorHardFilterReasonDistribution: sortObject(evaluatorHardFilterReasonDistribution),
    recentInstabilityGuardReasonDistribution: sortObject(recentInstabilityGuardReasonDistribution),
    safeLowRiskHiddenCount: safeLowRiskHidden.length,
    safeLowRiskHiddenReasonDistribution: sortObject(safeLowRiskHiddenReasonDistribution),
    safeLowRiskHiddenByCategory: sortObject(safeLowRiskHiddenByCategory),
    safeLowRiskHiddenByFunctionalProfile: sortObject(safeLowRiskHiddenByFunctionalProfile),
    safeLowRiskHiddenBySafetyContext: sortObject(safeLowRiskHiddenBySafetyContext),
    hiddenBlockedSourceDistribution: sortObject(hiddenBlockedSourceDistribution),
    interpretationNotes: [
      "safe_low_risk hidden is not automatically a bug.",
      "Hidden can still be explained by evaluator hard block, current safety context, category role, or recent-instability rules.",
      "Evaluator blocked and guard hard-block candidate are reviewed separately."
    ]
  };
}

function buildCollapsedReview(fixtures, candidates) {
  const collapsed = candidates.filter((item) => item.exposureStatus === "collapsed_candidate");
  const hidden = candidates.filter((item) => item.exposureStatus === "hidden_candidate");
  const safetyMetadataProfileDistribution = {};
  const categoryDistribution = {};
  const functionalProfileDistribution = {};
  const collapsedByCapture = {};
  const hiddenByProductKey = new Set(hidden.map((item) => `${item.captureId || "unknown"}:${item.productId || "unknown"}`));
  let duplicateOrSupportsGoalFlippedToHiddenCount = 0;

  for (const item of collapsed) {
    increment(safetyMetadataProfileDistribution, item.safetyMetadataProfile);
    increment(categoryDistribution, item.category);
    increment(functionalProfileDistribution, item.functionalProfile);
    increment(collapsedByCapture, item.captureId);
  }

  for (const item of hidden) {
    if (
      ["duplicate_axis", "supports_goal"].includes(item.currentProductRelation) ||
      (Array.isArray(item.exposurePolicyReasons) &&
        item.exposurePolicyReasons.some((reason) =>
          ["current_duplicate_axis_context", "current_supports_goal_context"].includes(reason)
        ))
    ) {
      duplicateOrSupportsGoalFlippedToHiddenCount += 1;
    }
  }

  const collapsedRatesByCapture = {};
  for (const fixture of fixtures) {
    const counts = fixture.counts || {};
    const total =
      (counts.primary || 0) +
      (counts.contextual || 0) +
      (counts.collapsed || 0) +
      (counts.hidden || 0) +
      (counts.insufficientEvidence || 0);
    collapsedRatesByCapture[fixture.captureId || "unknown"] = {
      collapsed: counts.collapsed || 0,
      total,
      rate: ratio(counts.collapsed || 0, total)
    };
  }

  const total = candidates.length;

  return {
    collapsedCount: collapsed.length,
    collapsedSafetyMetadataProfileDistribution: sortObject(safetyMetadataProfileDistribution),
    collapsedSafetyMetadataProfileRatio: Object.fromEntries(
      Object.entries(sortObject(safetyMetadataProfileDistribution)).map(([key, value]) => [key, ratio(value, collapsed.length)])
    ),
    collapsedCategoryDistribution: sortObject(categoryDistribution),
    collapsedCategoryRatio: Object.fromEntries(
      Object.entries(sortObject(categoryDistribution)).map(([key, value]) => [key, ratio(value, collapsed.length)])
    ),
    collapsedFunctionalProfileDistribution: sortObject(functionalProfileDistribution),
    collapsedFunctionalProfileRatio: Object.fromEntries(
      Object.entries(sortObject(functionalProfileDistribution)).map(([key, value]) => [key, ratio(value, collapsed.length)])
    ),
    collapsedTotalRatio: ratio(collapsed.length, total),
    collapsedRatesByCapture: Object.fromEntries(
      Object.entries(collapsedRatesByCapture).sort(([left], [right]) => left.localeCompare(right))
    ),
    duplicateOrSupportsGoalFlippedToHiddenCount,
    collapsedHiddenOverlapCount: collapsed.filter((item) =>
      hiddenByProductKey.has(`${item.captureId || "unknown"}:${item.productId || "unknown"}`)
    ).length,
    interpretation:
      collapsed.length > 0
        ? "Collapsed is interpretable as normal-recommendation exclusion plus stabilization-first consideration."
        : "Collapsed evidence is absent in the included scope."
  };
}

function buildCategoryReview(candidates) {
  const byCategory = {};
  const byFunctionalProfile = {};
  const metadataCoverage = {};

  for (const item of candidates) {
    const status = item.exposureStatus || "unknown";
    const category = item.category || "unknown";
    const functionalProfile = item.functionalProfile || "unknown";

    if (!byCategory[category]) byCategory[category] = {};
    if (!byFunctionalProfile[functionalProfile]) byFunctionalProfile[functionalProfile] = {};
    increment(byCategory[category], status);
    increment(byFunctionalProfile[functionalProfile], status);
    increment(metadataCoverage, item.safetyMetadataProfile);
  }

  return {
    byCategory: sortNested(byCategory),
    byFunctionalProfile: sortNested(byFunctionalProfile),
    safetyMetadataCoverage: sortObject(metadataCoverage)
  };
}

function buildAggregate(fixtures, candidates) {
  const exposureStatusDistribution = {};
  const categoryDistribution = {};
  const functionalProfileDistribution = {};
  const safetyMetadataProfileDistribution = {};

  for (const item of candidates) {
    increment(exposureStatusDistribution, item.exposureStatus);
    increment(categoryDistribution, item.category);
    increment(functionalProfileDistribution, item.functionalProfile);
    increment(safetyMetadataProfileDistribution, item.safetyMetadataProfile);
  }

  return {
    includedCaptureCount: fixtures.length,
    reviewedCandidateCount: candidates.length,
    exposureStatusDistribution: sortObject(exposureStatusDistribution),
    categoryDistribution: sortObject(categoryDistribution),
    functionalProfileDistribution: sortObject(functionalProfileDistribution),
    safetyMetadataProfileDistribution: sortObject(safetyMetadataProfileDistribution)
  };
}

function coverageLimitations({ aggregate, categoryReview, replaySummary, fixtures, options }) {
  const limitations = [];

  if (fixtures.length < options.minimumCaptureCount) {
    limitations.push("included_high_confidence_capture_count_below_minimum");
  }

  if ((aggregate.reviewedCandidateCount || 0) === 0) {
    limitations.push("candidate_review_rows_missing_run_exposure_audit_with_candidate_reviews");
  }

  if (!categoryReview.byFunctionalProfile.active_leaning) {
    limitations.push("active_leaning_only_profile_not_observed");
  }

  if (!categoryReview.byCategory.serum) {
    limitations.push("serum_category_not_independently_observed");
  }

  if (!categoryReview.safetyMetadataCoverage.metadata_incomplete) {
    limitations.push("metadata_incomplete_cases_not_observed");
  }

  if ((replaySummary?.comparisonConfidenceDistribution?.low || 0) > 0) {
    limitations.push("low_confidence_captures_exist_outside_included_scope");
  }

  return Array.from(new Set(limitations)).sort();
}

function hasRepeatedBroadSafeLowRiskHidden(hiddenReasonReview, options) {
  return Object.entries(hiddenReasonReview.safeLowRiskHiddenReasonDistribution)
    .some(([reason, count]) => {
      const broad =
        reason === "recent_instability_active_limited" ||
        reason === "active_functional_axis" ||
        reason === "candidate_evaluator_blocked" ||
        reason.includes("recent_instability") ||
        reason.includes("stabilize_first");

      return broad && count >= options.minimumReasonRepeatCount;
    });
}

function determineReadiness({ aggregate, hiddenReasonReview, collapsedReview, limitations, options }) {
  if (
    aggregate.includedCaptureCount < options.minimumCaptureCount ||
    aggregate.reviewedCandidateCount === 0
  ) {
    return "insufficient_evidence";
  }

  if (hasRepeatedBroadSafeLowRiskHidden(hiddenReasonReview, options)) {
    return "needs_hidden_reason_policy_review";
  }

  if (limitations.some((item) =>
    [
      "active_leaning_only_profile_not_observed",
      "serum_category_not_independently_observed",
      "metadata_incomplete_cases_not_observed"
    ].includes(item)
  )) {
    return "needs_metadata_or_coverage_expansion";
  }

  if (
    collapsedReview.collapsedCount >= options.minimumGroupCount &&
    collapsedReview.collapsedHiddenOverlapCount === 0
  ) {
    return "ready_for_shadow_candidate_policy_integration";
  }

  return "needs_metadata_or_coverage_expansion";
}

function buildPolicyQuestions() {
  return [
    "Which hard block rules are creating safe_low_risk hidden candidates?",
    "Are recent instability guard and evaluator hard block duplicating exclusion for the same candidates?",
    "Can treatment/toner_pad and moisturizer/sunscreen share the same exposure rule?",
    "Does collapsed_candidate naturally map to CandidatePolicy stabilize_first intent?",
    "Does insufficient evidence count 0 mean coverage is sufficient, or does it reflect complete-source fixture bias?",
    "Which category and functional profile samples should be collected before runtime integration confidence increases?"
  ];
}

function buildNextAction(readiness) {
  if (readiness === "ready_for_shadow_candidate_policy_integration") {
    return "Run shadow CandidatePolicy integration only; do not wire runtime exposure yet.";
  }

  if (readiness === "needs_hidden_reason_policy_review") {
    return "Open a targeted hidden-reason policy review before any CandidatePolicy shadow integration.";
  }

  if (readiness === "needs_metadata_or_coverage_expansion") {
    return "Collect additional high-confidence complete captures for active-leaning, serum, and metadata-incomplete cases.";
  }

  return "Generate enough high-confidence complete shadow captures before drawing integration conclusions.";
}

export function reviewFunctionalExposureReadiness({
  exposureAudit = {},
  replaySummary = {},
  options: inputOptions = {}
} = {}) {
  const options = normalizeOptions(inputOptions);
  const fixtures = includedFixtureAudits(exposureAudit, replaySummary, options);
  const candidates = collectCandidateReviews(fixtures);
  const aggregate = buildAggregate(fixtures, candidates);
  const hiddenReasonReview = buildHiddenReasonReview(candidates);
  const collapsedReview = buildCollapsedReview(fixtures, candidates);
  const categoryReview = buildCategoryReview(candidates);
  const limitations = coverageLimitations({ aggregate, categoryReview, replaySummary, fixtures, options });
  const readinessStatus = determineReadiness({
    aggregate,
    hiddenReasonReview,
    collapsedReview,
    limitations,
    options
  });

  return {
    reviewScope: {
      includedConfidence: options.includedConfidence,
      minimumCaptureCount: options.minimumCaptureCount,
      minimumGroupCount: options.minimumGroupCount,
      minimumReasonRepeatCount: options.minimumReasonRepeatCount,
      sourceAuditVersion: exposureAudit?.auditVersion || null,
      replaySummaryAvailable: Boolean(replaySummary && typeof replaySummary === "object")
    },
    aggregate,
    hiddenReasonReview,
    collapsedReview,
    categoryReview,
    integrationReadiness: {
      status: readinessStatus,
      runtimeApproval: false,
      allowedNextStep:
        readinessStatus === "ready_for_shadow_candidate_policy_integration"
          ? "shadow_candidate_policy_integration"
          : "evidence_or_policy_review_before_integration",
      validStatuses: READINESS
    },
    policyQuestions: buildPolicyQuestions(),
    limitations,
    nextAction: buildNextAction(readinessStatus)
  };
}

export const FUNCTIONAL_EXPOSURE_READINESS_REVIEW_VALUES = {
  readiness: READINESS,
  defaultOptions: DEFAULT_OPTIONS
};
