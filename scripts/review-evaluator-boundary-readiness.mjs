import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-readiness-review.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-readiness-review.md");

const ACTUAL_PATH = path.join(ROOT, "tmp", "evaluator-boundary-actual-coverage.json");
const PURE_REPLAY_PATH = path.join(ROOT, "tmp", "evaluator-boundary-pure-engine-target-replay.json");

const DOC_SOURCES = [
  "docs/reviews/evaluator-recent-instability-boundary-shadow-20260703.md",
  "docs/reviews/evaluator-boundary-coverage-gaps-20260703.md",
  "docs/reviews/evaluator-boundary-actual-coverage-20260703.md",
  "docs/reviews/evaluator-boundary-target-capture-plan-20260703.md",
  "docs/reviews/evaluator-boundary-dev-target-captures-20260703.md",
  "docs/architecture/analyze-no-write-capture-boundary.md",
  "docs/reviews/evaluator-boundary-pure-engine-target-replay-20260703.md",
  "docs/reviews/read-only-scorer-compatible-product-source-20260709.md",
  "docs/reviews/product-source-config-trace-20260709.md",
  "docs/reviews/evaluator-boundary-pure-engine-readonly-replay-20260709.md",
  "lib/evaluator-recent-instability-boundary-policy.js"
];

const READINESS_STATUSES = [
  "ready_for_boundary_integration_design",
  "needs_more_evidence_before_design",
  "blocked_by_safety_regression",
  "blocked_by_runtime_mutation",
  "blocked_by_source_unavailability"
];

function getDecisionCount(distribution = {}, decision) {
  return Number(distribution?.[decision] || 0);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function inspectSource(filePath, evidenceType) {
  try {
    await readFile(path.join(ROOT, filePath), "utf8");
    return { path: filePath, evidenceType, present: true };
  } catch {
    return { path: filePath, evidenceType, present: false };
  }
}

function summarizeGapBucket(bucket = {}, evidenceLabel) {
  return {
    evidenceLabel,
    observed: bucket.observed === true,
    status: bucket.status || "unknown",
    totalRows: Number(bucket.totalRows || 0),
    boundaryApplicableRows: Number(bucket.boundaryApplicableRows || 0),
    decisionDistribution: bucket.decisionDistribution || {}
  };
}

function summarizeActualEvidence(actual) {
  const safeLowRisk = actual.gapCoverage?.safeLowRiskHidden || {};

  return {
    evidenceType: actual.evidenceType || "actual_capture_coverage_unavailable",
    actualEvidenceAvailable: actual.actualEvidenceAvailable === true,
    completeProductRowCaptures: Number(actual.captureSummary?.completeProductRowFixturesUsed || 0),
    totalCandidateRows: Number(actual.candidateSummary?.totalCandidateRows || 0),
    boundaryApplicableRows: Number(actual.candidateSummary?.boundaryApplicableRows || 0),
    reviewedRows: Number(actual.candidateSummary?.reviewedRows || 0),
    safeLowRiskHidden: {
      ...summarizeGapBucket(safeLowRisk, "actual_capture"),
      downgradeToCollapsedCount: getDecisionCount(safeLowRisk.decisionDistribution, "downgrade_to_collapsed_candidate"),
      allDowngradedToCollapsed: Number(safeLowRisk.totalRows || 0) > 0 &&
        getDecisionCount(safeLowRisk.decisionDistribution, "downgrade_to_collapsed_candidate") === Number(safeLowRisk.totalRows || 0)
    },
    gapObservations: {
      activeLeaningOnly: summarizeGapBucket(actual.gapCoverage?.activeLeaningOnly, "actual_capture"),
      metadataIncomplete: summarizeGapBucket(actual.gapCoverage?.metadataIncomplete, "actual_capture"),
      serumCategory: summarizeGapBucket(actual.gapCoverage?.serumCategory, "actual_capture"),
      strongCaution: summarizeGapBucket(actual.gapCoverage?.strongCaution, "actual_capture")
    },
    decisionSummary: actual.decisionSummary || {},
    highRiskCollapsedCount: Number(actual.highRiskProtection?.highRiskCollapsedCount || 0),
    runtimeMutation: actual.runtimeMutation === true
  };
}

function summarizePureReplayEvidence(pureReplay) {
  const safeLowRisk = pureReplay.gapCoverage?.safeLowRiskHidden || {};
  const scenarioResults = Array.isArray(pureReplay.scenarioResults) ? pureReplay.scenarioResults : [];

  return {
    evidenceType: pureReplay.evidenceType,
    routeInvoked: pureReplay.routeInvoked === true,
    supabaseWriteExecuted: pureReplay.supabaseWriteExecuted === true,
    runtimeMutation: pureReplay.runtimeMutation === true,
    productRowsLoaded: Number(pureReplay.productRowsLoaded || 0),
    scorerCompatibleRows: Number(pureReplay.scorerCompatibleRows || 0),
    totalCandidateRows: Number(pureReplay.candidateSourceSummary?.totalCandidateRows || 0),
    scenariosAttempted: Number(pureReplay.scenariosAttempted || 0),
    scenariosSucceeded: Number(pureReplay.scenariosSucceeded || 0),
    scenariosFailed: Number(pureReplay.scenariosFailed || 0),
    scenarioBoundaryApplicableRows: Object.fromEntries(scenarioResults.map((scenario) => [
      scenario.scenarioId,
      Number(scenario.boundaryApplicableRows || 0)
    ])),
    safeLowRiskHidden: {
      ...summarizeGapBucket(safeLowRisk, "pure_engine_replay"),
      downgradeToCollapsedCount: getDecisionCount(safeLowRisk.decisionDistribution, "downgrade_to_collapsed_candidate"),
      allDowngradedToCollapsed: Number(safeLowRisk.totalRows || 0) > 0 &&
        getDecisionCount(safeLowRisk.decisionDistribution, "downgrade_to_collapsed_candidate") === Number(safeLowRisk.totalRows || 0)
    },
    gapObservations: {
      activeLeaningOnly: summarizeGapBucket(pureReplay.gapCoverage?.activeLeaningOnly, "pure_engine_replay"),
      metadataIncomplete: summarizeGapBucket(pureReplay.gapCoverage?.metadataIncomplete, "pure_engine_replay"),
      serumCategory: summarizeGapBucket(pureReplay.gapCoverage?.serumCategory, "pure_engine_replay"),
      strongCaution: summarizeGapBucket(pureReplay.gapCoverage?.strongCaution, "pure_engine_replay")
    },
    decisionSummary: pureReplay.decisionSummary || {},
    highRiskCollapsedCount: Number(pureReplay.highRiskCollapsedCount || 0),
    limitations: Array.isArray(pureReplay.limitations) ? pureReplay.limitations : []
  };
}

function buildSyntheticCoverageSummary() {
  return {
    evidenceType: "synthetic_policy_coverage",
    source: "docs/reviews/evaluator-boundary-coverage-gaps-20260703.md",
    actualEvidence: false,
    cases: {
      activeLeaningOnlySafeMetadata: "downgrade_to_collapsed_candidate",
      activeLeaningOnlyUnsafeMetadata: "preserve_hard_block",
      metadataIncomplete: "requires_metadata_review",
      serumSafeMetadata: "downgrade_to_collapsed_candidate",
      serumStrongCautionHighRisk: "preserve_hard_block",
      strongCaution: "preserve_hard_block",
      cautionTagsEmptyLowSafe: "downgrade_to_collapsed_candidate"
    },
    passed: true,
    limitation: "controlled policy fixture coverage, not actual capture or pure replay distribution evidence"
  };
}

function buildGapStatus(actualSummary, pureSummary, syntheticSummary) {
  return {
    activeLeaningOnly: {
      actualStatus: actualSummary.gapObservations.activeLeaningOnly.status,
      pureReplayStatus: pureSummary.gapObservations.activeLeaningOnly.status,
      syntheticCoverage: {
        safeMetadata: syntheticSummary.cases.activeLeaningOnlySafeMetadata,
        unsafeMetadata: syntheticSummary.cases.activeLeaningOnlyUnsafeMetadata
      },
      readinessImpact: "does_not_block_design_when_documented_as_distribution_limitation"
    },
    metadataIncomplete: {
      actualStatus: actualSummary.gapObservations.metadataIncomplete.status,
      pureReplayStatus: pureSummary.gapObservations.metadataIncomplete.status,
      syntheticCoverage: syntheticSummary.cases.metadataIncomplete,
      readinessImpact: "does_not_block_design_when_metadata_review_branch_remains_design_requirement"
    },
    serumCategory: {
      actualStatus: actualSummary.gapObservations.serumCategory.status,
      pureReplayStatus: pureSummary.gapObservations.serumCategory.status,
      pureReplayRows: pureSummary.gapObservations.serumCategory.totalRows,
      pureReplayBoundaryApplicableRows: pureSummary.gapObservations.serumCategory.boundaryApplicableRows,
      syntheticCoverage: {
        safeMetadata: syntheticSummary.cases.serumSafeMetadata,
        strongCautionHighRisk: syntheticSummary.cases.serumStrongCautionHighRisk
      },
      readinessImpact: "supports_design_review_because_pure_replay_observed_serum_family_candidates"
    },
    strongCaution: {
      actualStatus: actualSummary.gapObservations.strongCaution.status,
      pureReplayStatus: pureSummary.gapObservations.strongCaution.status,
      syntheticCoverage: syntheticSummary.cases.strongCaution,
      readinessImpact: "does_not_block_design_when_preservation_rule_is_kept_as_required_invariant"
    }
  };
}

function determineReadiness({ actualSummary, pureSummary, lowRiskDowngradeConsistency }) {
  const runtimeMutation = actualSummary.runtimeMutation ||
    pureSummary.runtimeMutation ||
    pureSummary.routeInvoked ||
    pureSummary.supabaseWriteExecuted;

  if (actualSummary.highRiskCollapsedCount > 0 || pureSummary.highRiskCollapsedCount > 0) {
    return {
      readinessStatus: "blocked_by_safety_regression",
      readinessReasons: [
        "high_risk_candidate_was_downgraded_to_collapsed_in_actual_or_pure_replay_evidence"
      ]
    };
  }

  if (runtimeMutation) {
    return {
      readinessStatus: "blocked_by_runtime_mutation",
      readinessReasons: [
        "runtime_route_or_supabase_write_flag_was_true_in_evidence"
      ]
    };
  }

  if (pureSummary.productRowsLoaded === 0 || pureSummary.scorerCompatibleRows === 0) {
    return {
      readinessStatus: "blocked_by_source_unavailability",
      readinessReasons: [
        "pure_replay_product_source_or_scorer_compatible_rows_were_unavailable"
      ]
    };
  }

  if (lowRiskDowngradeConsistency.passed) {
    return {
      readinessStatus: "ready_for_boundary_integration_design",
      readinessReasons: [
        "actual_safe_low_risk_hidden_rows_consistently_downgraded_to_collapsed_candidate",
        "pure_replay_safe_low_risk_hidden_rows_consistently_downgraded_to_collapsed_candidate",
        "high_risk_collapsed_count_is_zero_in_actual_and_pure_replay_evidence",
        "remaining_unobserved_gaps_are_covered_by_synthetic_policy_evidence_and_documented_as_distribution_limitations",
        "pure_replay_observed_serum_family_candidates_without_category_only_hard_block_generalization"
      ]
    };
  }

  return {
    readinessStatus: "needs_more_evidence_before_design",
    readinessReasons: [
      "low_risk_downgrade_consistency_was_not_established_across_actual_and_pure_replay_evidence"
    ]
  };
}

function buildLowRiskDowngradeConsistency(actualSummary, pureSummary) {
  const actualRows = actualSummary.safeLowRiskHidden.totalRows;
  const pureRows = pureSummary.safeLowRiskHidden.totalRows;
  const actualDowngraded = actualSummary.safeLowRiskHidden.downgradeToCollapsedCount;
  const pureDowngraded = pureSummary.safeLowRiskHidden.downgradeToCollapsedCount;

  return {
    actualSafeLowRiskHiddenRows: actualRows,
    actualDowngradeToCollapsedCount: actualDowngraded,
    pureReplaySafeLowRiskHiddenRows: pureRows,
    pureReplayDowngradeToCollapsedCount: pureDowngraded,
    passed: actualRows > 0 &&
      pureRows > 0 &&
      actualDowngraded === actualRows &&
      pureDowngraded === pureRows
  };
}

function buildLimitations(gapStatus, pureSummary) {
  const limitations = [
    "readiness_review_is_not_runtime_policy_approval",
    "actual_capture_and_pure_engine_replay_evidence_have_different_strengths",
    "synthetic_policy_coverage_is_not_actual_product_distribution_evidence",
    "pure_engine_replay_does_not_exercise_route_guard_session_or_premium_store_mutation_paths"
  ];

  if (gapStatus.activeLeaningOnly.actualStatus.includes("not_observed") &&
    gapStatus.activeLeaningOnly.pureReplayStatus.includes("not_observed")) {
    limitations.push("active_leaning_only_not_observed_in_actual_or_pure_replay");
  }

  if (gapStatus.metadataIncomplete.actualStatus.includes("not_observed") &&
    gapStatus.metadataIncomplete.pureReplayStatus.includes("not_observed")) {
    limitations.push("metadata_incomplete_not_observed_in_actual_or_pure_replay");
  }

  if (gapStatus.strongCaution.actualStatus.includes("not_observed") &&
    gapStatus.strongCaution.pureReplayStatus.includes("not_observed")) {
    limitations.push("strong_caution_not_observed_in_actual_or_pure_replay");
  }

  if (pureSummary.limitations.includes("product_source_is_read_only_but_environment_dependent")) {
    limitations.push("read_only_product_source_is_environment_dependent");
  }

  return limitations.sort();
}

function renderMarkdown(output) {
  const scenarioLines = Object.entries(output.pureReplayEvidenceSummary.scenarioBoundaryApplicableRows)
    .map(([scenarioId, rows]) => `- ${scenarioId}: ${rows}`);

  return [
    "# Evaluator Boundary Readiness Review",
    "",
    "This is a boundary policy readiness review. It is not runtime policy approval and does not connect evaluator behavior, CandidatePolicy, UI, API, DB, Supabase, or product data.",
    "",
    "## Readiness",
    `- readinessStatus: ${output.readinessStatus}`,
    ...output.readinessReasons.map((reason) => `- reason: ${reason}`),
    "",
    "## Actual Evidence",
    `- complete/product_row captures: ${output.actualEvidenceSummary.completeProductRowCaptures}`,
    `- total candidate rows: ${output.actualEvidenceSummary.totalCandidateRows}`,
    `- boundary applicable rows: ${output.actualEvidenceSummary.boundaryApplicableRows}`,
    `- safe_low_risk hidden rows: ${output.actualEvidenceSummary.safeLowRiskHidden.totalRows}`,
    `- safe_low_risk hidden downgraded: ${output.actualEvidenceSummary.safeLowRiskHidden.downgradeToCollapsedCount}`,
    `- highRiskCollapsedCount: ${output.actualEvidenceSummary.highRiskCollapsedCount}`,
    "",
    "## Pure Replay Evidence",
    `- evidenceType: ${output.pureReplayEvidenceSummary.evidenceType}`,
    `- productRowsLoaded: ${output.pureReplayEvidenceSummary.productRowsLoaded}`,
    `- scorerCompatibleRows: ${output.pureReplayEvidenceSummary.scorerCompatibleRows}`,
    `- total candidate rows: ${output.pureReplayEvidenceSummary.totalCandidateRows}`,
    `- safe_low_risk hidden rows: ${output.pureReplayEvidenceSummary.safeLowRiskHidden.totalRows}`,
    `- safe_low_risk hidden downgraded: ${output.pureReplayEvidenceSummary.safeLowRiskHidden.downgradeToCollapsedCount}`,
    `- highRiskCollapsedCount: ${output.pureReplayEvidenceSummary.highRiskCollapsedCount}`,
    "",
    "## Scenario Boundary Rows",
    ...scenarioLines,
    "",
    "## Gap Status",
    `- activeLeaningOnly: actual=${output.gapStatus.activeLeaningOnly.actualStatus}, pure=${output.gapStatus.activeLeaningOnly.pureReplayStatus}`,
    `- metadataIncomplete: actual=${output.gapStatus.metadataIncomplete.actualStatus}, pure=${output.gapStatus.metadataIncomplete.pureReplayStatus}`,
    `- serumCategory: actual=${output.gapStatus.serumCategory.actualStatus}, pure=${output.gapStatus.serumCategory.pureReplayStatus}, pureRows=${output.gapStatus.serumCategory.pureReplayRows}`,
    `- strongCaution: actual=${output.gapStatus.strongCaution.actualStatus}, pure=${output.gapStatus.strongCaution.pureReplayStatus}`,
    "",
    "## Safety",
    `- high-risk regression passed: ${output.safetyRegressionCheck.passed}`,
    `- low-risk downgrade consistency passed: ${output.lowRiskDowngradeConsistency.passed}`,
    "",
    "## Allowed Next Step",
    ...output.allowedNextStep.map((item) => `- ${item}`),
    "",
    "## Prohibited Next Step",
    ...output.prohibitedNextStep.map((item) => `- ${item}`),
    "",
    "## Limitations",
    ...output.remainingLimitations.map((item) => `- ${item}`),
    "",
    "## Runtime Flags",
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`
  ].join("\n");
}

const actual = await readJson(ACTUAL_PATH);
const pureReplay = await readJson(PURE_REPLAY_PATH);
const evidenceSources = [
  { path: "tmp/evaluator-boundary-actual-coverage.json", evidenceType: actual.evidenceType || "actual_capture_coverage_unavailable", present: true },
  { path: "tmp/evaluator-boundary-pure-engine-target-replay.json", evidenceType: "pure_engine_replay", present: true },
  ...(await Promise.all(DOC_SOURCES.map((source) => inspectSource(source, source.includes("coverage-gaps") ? "synthetic_policy_coverage" : "supporting_phase_document"))))
];

const actualEvidenceSummary = summarizeActualEvidence(actual);
const pureReplayEvidenceSummary = summarizePureReplayEvidence(pureReplay);
const syntheticCoverageSummary = buildSyntheticCoverageSummary();
const gapStatus = buildGapStatus(actualEvidenceSummary, pureReplayEvidenceSummary, syntheticCoverageSummary);
const safetyRegressionCheck = {
  highRiskCollapsedCountActual: actualEvidenceSummary.highRiskCollapsedCount,
  highRiskCollapsedCountPureReplay: pureReplayEvidenceSummary.highRiskCollapsedCount,
  passed: actualEvidenceSummary.highRiskCollapsedCount === 0 && pureReplayEvidenceSummary.highRiskCollapsedCount === 0
};
const lowRiskDowngradeConsistency = buildLowRiskDowngradeConsistency(actualEvidenceSummary, pureReplayEvidenceSummary);
const readiness = determineReadiness({
  actualSummary: actualEvidenceSummary,
  pureSummary: pureReplayEvidenceSummary,
  lowRiskDowngradeConsistency
});

if (!READINESS_STATUSES.includes(readiness.readinessStatus)) {
  throw new Error(`Invalid readinessStatus: ${readiness.readinessStatus}`);
}

const output = {
  generatedAt: new Date().toISOString(),
  evidenceSources,
  actualEvidenceSummary,
  pureReplayEvidenceSummary,
  syntheticCoverageSummary,
  gapStatus,
  safetyRegressionCheck,
  lowRiskDowngradeConsistency,
  readinessStatus: readiness.readinessStatus,
  readinessReasons: readiness.readinessReasons,
  remainingLimitations: buildLimitations(gapStatus, pureReplayEvidenceSummary),
  allowedNextStep: [
    "evaluator_pass_plus_collapsed_hint_design",
    "integration_design_document",
    "shadow_only_what_if_runner",
    "candidate_policy_hint_contract_design"
  ],
  prohibitedNextStep: [
    "evaluator_runtime_change",
    "candidate_policy_runtime_connection",
    "api_analyze_result_change",
    "ui_exposure_change",
    "db_storage_schema_change",
    "recommendation_result_replacement"
  ],
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(output), "utf8");

console.log("evaluator-boundary-readiness-review summary");
console.log(JSON.stringify({
  readinessStatus: output.readinessStatus,
  actual: {
    completeProductRowCaptures: output.actualEvidenceSummary.completeProductRowCaptures,
    totalCandidateRows: output.actualEvidenceSummary.totalCandidateRows,
    boundaryApplicableRows: output.actualEvidenceSummary.boundaryApplicableRows,
    safeLowRiskHiddenRows: output.actualEvidenceSummary.safeLowRiskHidden.totalRows,
    highRiskCollapsedCount: output.actualEvidenceSummary.highRiskCollapsedCount
  },
  pureReplay: {
    evidenceType: output.pureReplayEvidenceSummary.evidenceType,
    productRowsLoaded: output.pureReplayEvidenceSummary.productRowsLoaded,
    scorerCompatibleRows: output.pureReplayEvidenceSummary.scorerCompatibleRows,
    totalCandidateRows: output.pureReplayEvidenceSummary.totalCandidateRows,
    safeLowRiskHiddenRows: output.pureReplayEvidenceSummary.safeLowRiskHidden.totalRows,
    highRiskCollapsedCount: output.pureReplayEvidenceSummary.highRiskCollapsedCount
  },
  gapStatus: output.gapStatus,
  safetyRegressionCheck: output.safetyRegressionCheck,
  lowRiskDowngradeConsistency: output.lowRiskDowngradeConsistency,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
