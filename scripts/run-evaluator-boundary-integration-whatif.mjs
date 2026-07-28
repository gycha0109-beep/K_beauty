import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveEvaluatorBoundaryCollapsedHint } from "../lib/evaluator-boundary-collapsed-hint-contract.js";
import { resolveEvaluatorRecentInstabilityBoundaryPolicy } from "../lib/evaluator-recent-instability-boundary-policy.js";
import {
  resolveCliDirectory,
  resolveGeneratedAt
} from "./lib/verifier-cli-options.mjs";

const ROOT = process.cwd();
const OUTPUT_DIR = resolveCliDirectory("--output-dir", path.join(ROOT, "tmp"));
const CAPTURE_DIR = resolveCliDirectory(
  "--capture-dir",
  path.join(ROOT, "tmp", "functional-shadow-captures")
);
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-integration-whatif.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-integration-whatif.md");
const ACTUAL_AUDIT_PATH = path.join(CAPTURE_DIR, "candidate-exposure-audit.json");
const ACTUAL_COVERAGE_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-actual-coverage.json");
const PURE_REPLAY_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-pure-engine-target-replay.json");
const READINESS_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-readiness-review.json");

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

function isRecentInstabilityBoundaryRow(row = {}) {
  return Array.isArray(row.hardFilterReasons) &&
    row.hardFilterReasons.includes("recent_instability_active_limited") &&
    (row.hardFilterStatus === "blocked" || row.exposureStatus === "hidden_candidate");
}

function isSafeLowRiskHidden(row = {}) {
  return row.exposureStatus === "hidden_candidate" &&
    row.safetyMetadataProfile === "safe_low_risk" &&
    isRecentInstabilityBoundaryRow(row);
}

function isSerumFamily(row = {}) {
  const category = normalizeText(row.category);
  return ["serum", "serum_ampoule", "ampoule", "essence", "treatment"].includes(category);
}

function isHighRisk(row = {}) {
  return row.safetyMetadataProfile === "unsafe_high_risk" ||
    row.irritationRisk === "high" ||
    row.sensitivitySafe === false;
}

function axesFromRow(row = {}) {
  const axes = [];
  if (row.activeAxisPresent || row.functionalProfile === "mixed" || row.functionalProfile === "active_leaning") {
    axes.push({ axis: "exfoliation", source: "whatif_candidate_review_row" });
  }
  if (row.stabilizingAxisPresent || row.functionalProfile === "mixed" || row.functionalProfile === "stabilizing_leaning") {
    axes.push({ axis: "hydration", source: "whatif_candidate_review_row" });
  }
  return axes;
}

function inferSafetyFromProfile(row = {}) {
  if (row.safetyMetadataProfile === "safe_low_risk") {
    return { irritation_risk: "low", sensitivity_safe: true };
  }

  if (row.safetyMetadataProfile === "safe_medium_risk") {
    return { irritation_risk: "medium", sensitivity_safe: true };
  }

  if (row.safetyMetadataProfile === "unsafe_high_risk") {
    return { irritation_risk: "high", sensitivity_safe: false };
  }

  if (row.safetyMetadataProfile === "metadata_incomplete") {
    return { irritation_risk: null, sensitivity_safe: null };
  }

  if (row.irritationRisk || typeof row.sensitivitySafe === "boolean") {
    return {
      irritation_risk: row.irritationRisk || null,
      sensitivity_safe: typeof row.sensitivitySafe === "boolean" ? row.sensitivitySafe : null
    };
  }

  return { irritation_risk: "medium", sensitivity_safe: false };
}

function surveySafetyFromRow(row = {}) {
  return {
    sensitivityRisk: row?.safetyContext?.highSensitivity === false ? "medium" : "high",
    recentSkinChange: row?.safetyContext?.recentInstability === false ? "no" : "yes",
    recentlyChangedProduct: row?.safetyContext?.recentInstability === false ? "no" : "yes"
  };
}

function goalPolicyFromRow(row = {}, container = {}) {
  return {
    rankingGoal: row.rankingGoal || container?.rankingContext?.rankingGoal || null,
    safetyGoal: row.safetyGoal || container?.rankingContext?.safetyGoal || null,
    recommendationGuard: row.recommendationGuard || container?.rankingContext?.recommendationGuard || null,
    highSensitivity: row?.safetyContext?.highSensitivity !== false,
    recentInstability: row?.safetyContext?.recentInstability !== false
  };
}

function candidateEvaluationFromRow(row = {}) {
  return {
    hardFilterStatus: row.hardFilterStatus || (isRecentInstabilityBoundaryRow(row) ? "blocked" : null),
    hardFilterReasons: Array.isArray(row.hardFilterReasons) ? row.hardFilterReasons : [],
    confidence: row.confidence || "high"
  };
}

function productFromRow(row = {}) {
  const inferred = inferSafetyFromProfile(row);
  return {
    category: row.category || null,
    irritation_risk: inferred.irritation_risk,
    sensitivity_safe: inferred.sensitivity_safe
  };
}

function productProfileFromRow(row = {}) {
  return {
    evaluable: row.profileEvaluable === false ? false : row.safetyMetadataProfile !== "metadata_incomplete",
    categoryRole: row.category || null,
    functionalAxes: axesFromRow(row),
    cautionTags: Array.isArray(row.cautionTags) ? row.cautionTags : []
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function flattenActualRows(actualAudit) {
  const rows = [];

  for (const fixture of Array.isArray(actualAudit.fixtureAudits) ? actualAudit.fixtureAudits : []) {
    if (fixture.comparisonConfidence !== "high") continue;
    for (const row of Array.isArray(fixture.candidateReviewRows) ? fixture.candidateReviewRows : []) {
      rows.push({ row, container: fixture });
    }
  }

  return rows;
}

function flattenPureReplayRows(pureReplay) {
  const rows = [];

  for (const scenario of Array.isArray(pureReplay.scenarioResults) ? pureReplay.scenarioResults : []) {
    for (const row of Array.isArray(scenario.candidateReviewRows) ? scenario.candidateReviewRows : []) {
      rows.push({ row, container: scenario });
    }
  }

  return rows;
}

function baselineCountsFromRows(rows) {
  const distribution = {};
  for (const { row } of rows) {
    increment(distribution, row.exposureStatus || "unknown");
  }
  return {
    totalRows: rows.length,
    hiddenCount: distribution.hidden_candidate || 0,
    collapsedCount: distribution.collapsed_candidate || 0,
    exposureStatusDistribution: sortObject(distribution)
  };
}

function applyWhatIf(rows, evidenceLabel) {
  const baseline = baselineCountsFromRows(rows);
  const hintDistribution = {};
  const futureEvaluatorActionDistribution = {};
  const boundaryDecisionDistribution = {};
  const serumFamily = {
    observedRows: 0,
    boundaryApplicableRows: 0,
    collapsedHintCount: 0,
    preserveHardBlockHintCount: 0,
    metadataReviewHintCount: 0
  };
  const safeLowRiskHidden = {
    observedRows: 0,
    collapsedHintCount: 0,
    hiddenHintCount: 0,
    metadataReviewHintCount: 0
  };
  let boundaryApplicableRows = 0;
  let collapsedHintCount = 0;
  let hiddenHintCount = 0;
  let metadataReviewHintCount = 0;
  let highRiskCollapsedHintCount = 0;
  let metadataIncompleteCollapsedHintCount = 0;

  for (const { row, container } of rows) {
    const candidateEvaluation = candidateEvaluationFromRow(row);
    const boundaryPolicyResult = resolveEvaluatorRecentInstabilityBoundaryPolicy({
      candidateEvaluation,
      surveySafety: surveySafetyFromRow(row),
      goalPolicy: goalPolicyFromRow(row, container),
      product: productFromRow(row),
      productProfile: productProfileFromRow(row)
    });
    const hint = resolveEvaluatorBoundaryCollapsedHint({
      candidateEvaluation,
      boundaryPolicyResult,
      exposureContext: {
        currentExposureStatus: row.exposureStatus || null,
        safetyMetadataProfile: row.safetyMetadataProfile || null,
        functionalProfile: row.functionalProfile || null,
        category: row.category || null
      }
    });

    increment(boundaryDecisionDistribution, boundaryPolicyResult.boundaryDecision);
    increment(hintDistribution, hint.candidatePolicyHint);
    increment(futureEvaluatorActionDistribution, hint.futureEvaluatorAction);

    if (isRecentInstabilityBoundaryRow(row)) {
      boundaryApplicableRows += 1;
    }

    if (hint.candidatePolicyHint === "collapsed_candidate_hint") {
      collapsedHintCount += 1;
      if (isHighRisk(row)) highRiskCollapsedHintCount += 1;
      if (row.safetyMetadataProfile === "metadata_incomplete") metadataIncompleteCollapsedHintCount += 1;
    }

    if (hint.candidatePolicyHint === "hidden_candidate_hint") {
      hiddenHintCount += 1;
    }

    if (hint.candidatePolicyHint === "insufficient_evidence_hint") {
      metadataReviewHintCount += 1;
    }

    if (isSafeLowRiskHidden(row)) {
      safeLowRiskHidden.observedRows += 1;
      if (hint.candidatePolicyHint === "collapsed_candidate_hint") safeLowRiskHidden.collapsedHintCount += 1;
      if (hint.candidatePolicyHint === "hidden_candidate_hint") safeLowRiskHidden.hiddenHintCount += 1;
      if (hint.candidatePolicyHint === "insufficient_evidence_hint") safeLowRiskHidden.metadataReviewHintCount += 1;
    }

    if (isSerumFamily(row)) {
      serumFamily.observedRows += 1;
      if (isRecentInstabilityBoundaryRow(row)) serumFamily.boundaryApplicableRows += 1;
      if (hint.candidatePolicyHint === "collapsed_candidate_hint") serumFamily.collapsedHintCount += 1;
      if (hint.candidatePolicyHint === "hidden_candidate_hint") serumFamily.preserveHardBlockHintCount += 1;
      if (hint.candidatePolicyHint === "insufficient_evidence_hint") serumFamily.metadataReviewHintCount += 1;
    }
  }

  return {
    evidenceLabel,
    baseline,
    boundaryApplicableRows,
    candidatePolicyHintDistribution: sortObject(hintDistribution),
    futureEvaluatorActionDistribution: sortObject(futureEvaluatorActionDistribution),
    boundaryDecisionDistribution: sortObject(boundaryDecisionDistribution),
    collapsedHintCount,
    hiddenHintCount,
    metadataReviewHintCount,
    baselineVsWhatIf: {
      hiddenCountBefore: baseline.hiddenCount,
      hiddenCountAfter: baseline.hiddenCount - collapsedHintCount,
      hiddenCountDelta: -collapsedHintCount,
      collapsedCountBefore: baseline.collapsedCount,
      collapsedCountAfter: baseline.collapsedCount + collapsedHintCount,
      collapsedCountDelta: collapsedHintCount
    },
    safeLowRiskHidden,
    serumFamily,
    highRiskCollapsedHintCount,
    metadataIncompleteCollapsedHintCount
  };
}

function integrationOptions() {
  return [
    {
      id: "option_a_evaluator_hard_filter_relaxation",
      summary: "Relax evaluator hard filter directly at the source.",
      benefits: [
        "single decision point",
        "simple downstream exposure model"
      ],
      risks: [
        "highest runtime behavior blast radius",
        "harder to preserve hidden safety semantics",
        "could change existing recommendation payloads immediately"
      ],
      requiredGuardrails: [
        "separate runtime approval",
        "high-risk preservation invariant",
        "API response regression checks"
      ],
      recommended: false
    },
    {
      id: "option_b_evaluator_pass_with_collapsed_hint",
      summary: "Allow only the narrow boundary to pass with a collapsed CandidatePolicy hint.",
      benefits: [
        "keeps evaluator and exposure responsibilities explicit",
        "preserves high-risk hard-block behavior",
        "supports shadow what-if validation before runtime wiring"
      ],
      risks: [
        "requires a well-defined hint contract",
        "requires CandidatePolicy integration approval later"
      ],
      requiredGuardrails: [
        "collapsed hint only for boundary downgrade decisions",
        "metadata-incomplete routes to review",
        "unsafe or strong-caution context remains hidden"
      ],
      recommended: true
    },
    {
      id: "option_c_exposure_layer_post_process",
      summary: "Keep evaluator blocked and post-process blocked candidates in exposure layer.",
      benefits: [
        "does not alter evaluator output",
        "can be implemented as an exposure-only shadow layer"
      ],
      risks: [
        "blurs responsibility between hard filter and exposure layers",
        "can make blocked candidate semantics harder to audit",
        "may duplicate evaluator boundary logic"
      ],
      requiredGuardrails: [
        "strict evidence separation",
        "blocked reason provenance retained",
        "no public exposure without runtime approval"
      ],
      recommended: false
    }
  ];
}

function buildGapStatus(readiness = {}) {
  return readiness.gapStatus || {
    activeLeaningOnly: { actualStatus: "unknown", pureReplayStatus: "unknown" },
    metadataIncomplete: { actualStatus: "unknown", pureReplayStatus: "unknown" },
    serumCategory: { actualStatus: "unknown", pureReplayStatus: "unknown" },
    strongCaution: { actualStatus: "unknown", pureReplayStatus: "unknown" }
  };
}

function renderMarkdown(output) {
  return [
    "# Evaluator Boundary Integration What-if",
    "",
    "This is integration what-if shadow evidence. It does not connect runtime evaluator behavior, CandidatePolicy, UI, API, DB, Supabase, or product data.",
    "",
    "## Recommendation",
    `- recommended option: ${output.recommendedIntegrationOption}`,
    "",
    "## Actual Evidence What-if",
    `- baseline hidden: ${output.actualWhatIfSummary.baselineVsWhatIf.hiddenCountBefore}`,
    `- what-if hidden: ${output.actualWhatIfSummary.baselineVsWhatIf.hiddenCountAfter}`,
    `- baseline collapsed: ${output.actualWhatIfSummary.baselineVsWhatIf.collapsedCountBefore}`,
    `- what-if collapsed: ${output.actualWhatIfSummary.baselineVsWhatIf.collapsedCountAfter}`,
    `- safe_low_risk hidden collapsed hints: ${output.actualWhatIfSummary.safeLowRiskHidden.collapsedHintCount}/${output.actualWhatIfSummary.safeLowRiskHidden.observedRows}`,
    `- high-risk collapsed hints: ${output.actualWhatIfSummary.highRiskCollapsedHintCount}`,
    "",
    "## Pure Replay What-if",
    `- baseline hidden: ${output.pureReplayWhatIfSummary.baselineVsWhatIf.hiddenCountBefore}`,
    `- what-if hidden: ${output.pureReplayWhatIfSummary.baselineVsWhatIf.hiddenCountAfter}`,
    `- baseline collapsed: ${output.pureReplayWhatIfSummary.baselineVsWhatIf.collapsedCountBefore}`,
    `- what-if collapsed: ${output.pureReplayWhatIfSummary.baselineVsWhatIf.collapsedCountAfter}`,
    `- safe_low_risk hidden collapsed hints: ${output.pureReplayWhatIfSummary.safeLowRiskHidden.collapsedHintCount}/${output.pureReplayWhatIfSummary.safeLowRiskHidden.observedRows}`,
    `- serum-family collapsed hints: ${output.pureReplayWhatIfSummary.serumFamily.collapsedHintCount}/${output.pureReplayWhatIfSummary.serumFamily.observedRows}`,
    `- high-risk collapsed hints: ${output.pureReplayWhatIfSummary.highRiskCollapsedHintCount}`,
    "",
    "## Safety",
    `- high-risk collapsed hint count actual: ${output.safetyRegressionCheck.highRiskCollapsedHintCountActual}`,
    `- high-risk collapsed hint count pure replay: ${output.safetyRegressionCheck.highRiskCollapsedHintCountPureReplay}`,
    `- passed: ${output.safetyRegressionCheck.passed}`,
    "",
    "## Allowed Next Step",
    ...output.allowedNextStep.map((item) => `- ${item}`),
    "",
    "## Prohibited Next Step",
    ...output.prohibitedNextStep.map((item) => `- ${item}`),
    "",
    "## Limitations",
    ...output.limitations.map((item) => `- ${item}`),
    "",
    "## Runtime Flags",
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`
  ].join("\n");
}

const actualAudit = await readJson(ACTUAL_AUDIT_PATH);
const actualCoverage = await readJson(ACTUAL_COVERAGE_PATH);
const pureReplay = await readJson(PURE_REPLAY_PATH);
const readiness = await readJson(READINESS_PATH);
const actualWhatIfSummary = applyWhatIf(
  flattenActualRows(actualAudit),
  actualAudit.evidenceType || "actual_capture_coverage_unavailable"
);
const pureReplayWhatIfSummary = applyWhatIf(flattenPureReplayRows(pureReplay), "pure_engine_replay");
const options = integrationOptions();

const output = {
  generatedAt: resolveGeneratedAt(),
  evidenceType: "integration_whatif_shadow",
  contractVersion: "evaluator-boundary-collapsed-hint-contract-v1",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: {
    actual: "tmp/functional-shadow-captures/candidate-exposure-audit.json",
    actualCoverage: "tmp/evaluator-boundary-actual-coverage.json",
    pureReplay: "tmp/evaluator-boundary-pure-engine-target-replay.json",
    readiness: "tmp/evaluator-boundary-readiness-review.json"
  },
  integrationOptions: options,
  recommendedIntegrationOption: "option_b_evaluator_pass_with_collapsed_hint",
  actualWhatIfSummary,
  pureReplayWhatIfSummary,
  safetyRegressionCheck: {
    highRiskCollapsedHintCountActual: actualWhatIfSummary.highRiskCollapsedHintCount,
    highRiskCollapsedHintCountPureReplay: pureReplayWhatIfSummary.highRiskCollapsedHintCount,
    passed: actualWhatIfSummary.highRiskCollapsedHintCount === 0 &&
      pureReplayWhatIfSummary.highRiskCollapsedHintCount === 0
  },
  lowRiskCollapsedHintConsistency: {
    actualSafeLowRiskHiddenRows: actualCoverage.gapCoverage?.safeLowRiskHidden?.totalRows || 0,
    actualSafeLowRiskHiddenCollapsedHints: actualWhatIfSummary.safeLowRiskHidden.collapsedHintCount,
    pureReplaySafeLowRiskHiddenRows: pureReplay.gapCoverage?.safeLowRiskHidden?.totalRows || 0,
    pureReplaySafeLowRiskHiddenCollapsedHints: pureReplayWhatIfSummary.safeLowRiskHidden.collapsedHintCount,
    passed: actualWhatIfSummary.safeLowRiskHidden.collapsedHintCount ===
        (actualCoverage.gapCoverage?.safeLowRiskHidden?.totalRows || 0) &&
      pureReplayWhatIfSummary.safeLowRiskHidden.collapsedHintCount ===
        (pureReplay.gapCoverage?.safeLowRiskHidden?.totalRows || 0)
  },
  gapStatus: buildGapStatus(readiness),
  allowedNextStep: [
    "write_runtime_integration_plan",
    "add_shadow_only_hint_contract_tests",
    "design_candidate_policy_hint_receiver",
    "extend_whatif_shadow_coverage"
  ],
  prohibitedNextStep: [
    "connect_evaluator_runtime",
    "connect_candidate_policy_runtime",
    "change_api_analyze_response",
    "change_ui_exposure",
    "change_db_or_supabase_schema",
    "replace_recommendation_results"
  ],
  limitations: [
    "whatif_shadow_is_not_runtime_approval",
    "actual_capture_and_pure_replay_evidence_remain_separate",
    "synthetic_coverage_is_not_recorded_as_actual_evidence",
    "active_leaning_only_not_observed_in_actual_or_pure_replay",
    "metadata_incomplete_not_observed_in_actual_or_pure_replay",
    "strong_caution_not_observed_in_actual_or_pure_replay",
    "pure_replay_does_not_exercise_route_mutation_boundaries"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(output), "utf8");

console.log("evaluator-boundary-integration-whatif summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  recommendedIntegrationOption: output.recommendedIntegrationOption,
  actual: {
    hiddenDelta: output.actualWhatIfSummary.baselineVsWhatIf.hiddenCountDelta,
    collapsedDelta: output.actualWhatIfSummary.baselineVsWhatIf.collapsedCountDelta,
    safeLowRiskHiddenCollapsedHints: output.actualWhatIfSummary.safeLowRiskHidden.collapsedHintCount,
    highRiskCollapsedHintCount: output.actualWhatIfSummary.highRiskCollapsedHintCount
  },
  pureReplay: {
    hiddenDelta: output.pureReplayWhatIfSummary.baselineVsWhatIf.hiddenCountDelta,
    collapsedDelta: output.pureReplayWhatIfSummary.baselineVsWhatIf.collapsedCountDelta,
    safeLowRiskHiddenCollapsedHints: output.pureReplayWhatIfSummary.safeLowRiskHidden.collapsedHintCount,
    serumFamilyCollapsedHints: output.pureReplayWhatIfSummary.serumFamily.collapsedHintCount,
    highRiskCollapsedHintCount: output.pureReplayWhatIfSummary.highRiskCollapsedHintCount
  },
  safetyRegressionCheck: output.safetyRegressionCheck,
  lowRiskCollapsedHintConsistency: output.lowRiskCollapsedHintConsistency,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
