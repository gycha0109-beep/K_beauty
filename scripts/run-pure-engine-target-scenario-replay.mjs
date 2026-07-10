import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const PLAN_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-target-capture-plan.json");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-pure-engine-target-replay.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-pure-engine-target-replay.md");
const ALIAS_LOADER = path.join(ROOT, "scripts", "node-next-alias-loader.mjs");
const ALIAS_LOADER_ENV = "PURE_ENGINE_REPLAY_ALIAS_LOADER";
const ENV_FILES = [".env", ".env.local", ".env.development", ".env.development.local"];

const TARGET_SCENARIO_IDS = [
  "target_active_acne_recent_instability",
  "target_redness_barrier_recent_instability",
  "target_pores_tone_active_recent_instability",
  "target_serum_tone_acne_recent_instability"
];

const STRONG_CAUTION_TAGS = new Set([
  "high_irritation_caution",
  "strong_active_caution",
  "retinoid_overlap_watch",
  "multiple_active_overlap_watch",
  "peeling_risk",
  "barrier_stress_watch",
  "sensitizing_active_watch"
]);

let engineModules = null;

async function loadEngineModules() {
  if (engineModules) {
    return engineModules;
  }

  const [
    photoEvidence,
    decisionEngine,
    surveyContract,
    goalPolicy,
    exposureAudit,
    boundaryPolicy,
    productSource,
    recommendationScoring
  ] = await Promise.all([
    import("../lib/photo-evidence.js"),
    import("../lib/skin-match-decision-engine.js"),
    import("../lib/survey-input-contract.js"),
    import("../lib/functional-goal-policy.js"),
    import("../lib/functional-candidate-exposure-audit.js"),
    import("../lib/evaluator-recent-instability-boundary-policy.js"),
    import("../lib/product-source.js"),
    import("../lib/recommendation-scoring.ts")
  ]);

  engineModules = {
    buildFallbackPhotoAnalysis: photoEvidence.buildFallbackPhotoAnalysis,
    buildSkinMatchDecisionBundle: decisionEngine.buildSkinMatchDecisionBundle,
    buildSurveyInputContract: surveyContract.buildSurveyInputContract,
    resolveFunctionalGoalPolicy: goalPolicy.resolveFunctionalGoalPolicy,
    buildFunctionalCandidateExposureAudit: exposureAudit.buildFunctionalCandidateExposureAudit,
    resolveEvaluatorRecentInstabilityBoundaryPolicy:
      boundaryPolicy.resolveEvaluatorRecentInstabilityBoundaryPolicy,
    getRecommendationProducts: productSource.getRecommendationProducts,
    isProductSourceUnavailableError: productSource.isProductSourceUnavailableError,
    getProductCategorySlot: recommendationScoring.getProductCategorySlot
  };

  return engineModules;
}

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

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortDeep(item)])
    );
  }
  return value;
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function ensurePlan() {
  const existing = await readJsonIfPresent(PLAN_PATH);
  if (existing?.planVersion === "evaluator-boundary-target-capture-plan-v1") {
    return existing;
  }

  execFileSync(process.execPath, ["scripts/plan-evaluator-boundary-target-captures.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });

  return readJsonIfPresent(PLAN_PATH);
}

function scenarioFormToInput(form = {}) {
  return {
    skinType: form.skinType || "",
    sensitivity: form.sensitivity || "",
    mainConcern: Array.isArray(form.mainConcerns) && form.mainConcerns[0]
      ? form.mainConcerns[0]
      : form.primaryConcern || "",
    mainConcerns: Array.isArray(form.mainConcerns) ? form.mainConcerns : [],
    primaryConcern: form.primaryConcern || "",
    recentSkinChange: form.recentSkinChange || "",
    recentlyChangedProduct: form.recentlyChangedProduct || "",
    cleansingFrequency: form.cleansingFrequency || "",
    preferredTexture: form.preferredTexture || "",
    postWashFeeling: form.postWashFeeling || "",
    afternoonSkinChange: form.afternoonSkinChange || "",
    environmentExposure: Array.isArray(form.environmentExposure) ? form.environmentExposure : [],
    mostDislikedFeel: form.mostDislikedFeel || "",
    whiteCastHate: Boolean(form.whiteCastHate),
    toneUpWanted: Boolean(form.toneUpWanted),
    makeupUse: Boolean(form.makeupUse),
    eyeSensitive: Boolean(form.eyeSensitive),
    sunscreenPreferenceState: form.sunscreenPreferenceState || "unknown",
    outdoorExposure: Array.isArray(form.environmentExposure)
      ? form.environmentExposure.includes("outdoor")
      : false,
    verySensitivePeriod: form.sensitivity === "high"
  };
}

function candidateEvaluationFromRow(row) {
  return {
    productId: row.productId || null,
    hardFilterStatus: row.hardFilterStatus || null,
    hardFilterReasons: Array.isArray(row.hardFilterReasons) ? row.hardFilterReasons : [],
    confidence: row.confidence || "unknown"
  };
}

function surveySafetyFromRow(row) {
  return {
    sensitivityRisk: row?.safetyContext?.highSensitivity ? "high" : "medium",
    recentSkinChange: row?.safetyContext?.recentInstability ? "yes" : "no",
    recentlyChangedProduct: row?.safetyContext?.recentInstability ? "yes" : "no"
  };
}

function goalPolicyFromRow(row) {
  return {
    rankingGoal: row.rankingGoal || null,
    safetyGoal: row.safetyGoal || null,
    recommendationGuard: row.recommendationGuard || null,
    highSensitivity: row?.safetyContext?.highSensitivity === true,
    recentInstability: row?.safetyContext?.recentInstability === true
  };
}

function productFromRow(row) {
  return {
    id: row.productId || null,
    category: row.category || null,
    irritation_risk: row.irritationRisk === "unknown" ? null : row.irritationRisk,
    sensitivity_safe: typeof row.sensitivitySafe === "boolean" ? row.sensitivitySafe : null
  };
}

function productProfileFromRow(row) {
  const axes = [];
  if (row.activeAxisPresent) axes.push({ axis: "exfoliation", source: "pure_engine_replay_row" });
  if (row.stabilizingAxisPresent) axes.push({ axis: "hydration", source: "pure_engine_replay_row" });

  return {
    evaluable: row.profileEvaluable !== false,
    categoryRole: row.category || null,
    functionalAxes: axes,
    cautionTags: Array.isArray(row.cautionTags) ? row.cautionTags : []
  };
}

function applyBoundaryPolicy(row) {
  const { resolveEvaluatorRecentInstabilityBoundaryPolicy } = engineModules;

  return resolveEvaluatorRecentInstabilityBoundaryPolicy({
    candidateEvaluation: candidateEvaluationFromRow(row),
    surveySafety: surveySafetyFromRow(row),
    goalPolicy: goalPolicyFromRow(row),
    product: productFromRow(row),
    productProfile: productProfileFromRow(row)
  });
}

function hasBoundaryReason(row) {
  return Array.isArray(row.hardFilterReasons) &&
    row.hardFilterReasons.includes("recent_instability_active_limited");
}

function isActiveOnly(row) {
  return row.functionalProfile === "active_leaning" ||
    (row.activeAxisPresent === true && row.stabilizingAxisPresent !== true);
}

function isMetadataIncomplete(row) {
  return row.safetyMetadataProfile === "metadata_incomplete" ||
    row.irritationRisk === "unknown" ||
    row.sensitivitySafe == null ||
    row.profileEvaluable === false ||
    (row.activeAxisPresent !== true && row.stabilizingAxisPresent !== true);
}

function isSerum(row) {
  const category = normalizeText(row.category);
  return category === "serum" ||
    category === "serum_ampoule" ||
    category === "ampoule" ||
    category === "essence" ||
    category === "treatment";
}

function hasStrongCaution(row) {
  return Array.isArray(row.cautionTags) &&
    row.cautionTags.some((tag) => STRONG_CAUTION_TAGS.has(normalizeText(tag)));
}

function createGapBucket() {
  return {
    observed: false,
    status: "not_observed_in_pure_engine_replay",
    totalRows: 0,
    boundaryApplicableRows: 0,
    decisionDistribution: {},
    categoryDistribution: {},
    safetyMetadataProfileDistribution: {}
  };
}

function addGapRow(bucket, row, policy) {
  bucket.observed = true;
  bucket.status = "observed_in_pure_engine_replay";
  bucket.totalRows += 1;
  if (hasBoundaryReason(row)) bucket.boundaryApplicableRows += 1;
  increment(bucket.decisionDistribution, policy.boundaryDecision);
  increment(bucket.categoryDistribution, row.category);
  increment(bucket.safetyMetadataProfileDistribution, row.safetyMetadataProfile);
}

function finalizeGap(bucket) {
  return {
    ...bucket,
    decisionDistribution: sortObject(bucket.decisionDistribution),
    categoryDistribution: sortObject(bucket.categoryDistribution),
    safetyMetadataProfileDistribution: sortObject(bucket.safetyMetadataProfileDistribution)
  };
}

function summarizeRows(rows) {
  const categoryDistribution = {};
  const functionalProfileDistribution = {};
  const safetyMetadataProfileDistribution = {};
  const exposureStatusDistribution = {};

  for (const row of rows) {
    increment(categoryDistribution, row.category);
    increment(functionalProfileDistribution, row.functionalProfile);
    increment(safetyMetadataProfileDistribution, row.safetyMetadataProfile);
    increment(exposureStatusDistribution, row.exposureStatus);
  }

  return {
    rowCount: rows.length,
    categoryDistribution: sortObject(categoryDistribution),
    exposureStatusDistribution: sortObject(exposureStatusDistribution),
    functionalProfileDistribution: sortObject(functionalProfileDistribution),
    safetyMetadataProfileDistribution: sortObject(safetyMetadataProfileDistribution)
  };
}

function aggregateScenarioRows(scenarioResults) {
  const gapCoverage = {
    activeLeaningOnly: createGapBucket(),
    metadataIncomplete: createGapBucket(),
    serumCategory: createGapBucket(),
    strongCaution: createGapBucket(),
    safeLowRiskHidden: createGapBucket()
  };
  const decisionSummary = {
    preserve_hard_block: 0,
    downgrade_to_collapsed_candidate: 0,
    requires_metadata_review: 0,
    not_applicable: 0
  };
  let boundaryApplicableRows = 0;
  let highRiskCollapsedCount = 0;

  for (const scenario of scenarioResults) {
    for (const row of scenario._candidateReviewRowsForAggregation || scenario.candidateReviewRows || []) {
      const policy = applyBoundaryPolicy(row);
      increment(decisionSummary, policy.boundaryDecision);
      if (hasBoundaryReason(row)) boundaryApplicableRows += 1;

      const highRisk =
        row.safetyMetadataProfile === "unsafe_high_risk" ||
        row.irritationRisk === "high" ||
        row.sensitivitySafe === false;
      if (highRisk && policy.boundaryDecision === "downgrade_to_collapsed_candidate") {
        highRiskCollapsedCount += 1;
      }

      if (isActiveOnly(row)) addGapRow(gapCoverage.activeLeaningOnly, row, policy);
      if (isMetadataIncomplete(row)) addGapRow(gapCoverage.metadataIncomplete, row, policy);
      if (isSerum(row)) addGapRow(gapCoverage.serumCategory, row, policy);
      if (hasStrongCaution(row)) addGapRow(gapCoverage.strongCaution, row, policy);
      if (row.exposureStatus === "hidden_candidate" && row.safetyMetadataProfile === "safe_low_risk") {
        addGapRow(gapCoverage.safeLowRiskHidden, row, policy);
      }
    }
  }

  return {
    boundaryApplicableRows,
    decisionSummary: sortObject(decisionSummary),
    gapCoverage: {
      activeLeaningOnly: finalizeGap(gapCoverage.activeLeaningOnly),
      metadataIncomplete: finalizeGap(gapCoverage.metadataIncomplete),
      serumCategory: finalizeGap(gapCoverage.serumCategory),
      strongCaution: finalizeGap(gapCoverage.strongCaution),
      safeLowRiskHidden: finalizeGap(gapCoverage.safeLowRiskHidden)
    },
    highRiskCollapsedCount
  };
}

function stripRowsForOutput(rows) {
  return rows.map((row) => ({
    category: row.category,
    exposureStatus: row.exposureStatus,
    functionalProfile: row.functionalProfile,
    hardFilterReasons: row.hardFilterReasons,
    safetyMetadataProfile: row.safetyMetadataProfile
  }));
}

async function loadEnvFilesForReadOnlySource() {
  const dotenv = await import("dotenv");
  const loaded = [];

  for (const fileName of ENV_FILES) {
    const filePath = path.join(ROOT, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const result = dotenv.config({
      path: filePath,
      override: false,
      quiet: true
    });

    loaded.push({
      fileName,
      loaded: !result.error,
      keyNames: result.parsed ? Object.keys(result.parsed).sort() : [],
      valuesPrinted: false
    });
  }

  return loaded;
}

function missingScorerRequiredFields(product, getProductCategorySlot) {
  const missing = [];

  if (!String(product?.id || "").trim()) missing.push("id");
  if (!String(product?.name || "").trim()) missing.push("name");
  if (!String(product?.brand || "").trim()) missing.push("brand");
  if (!getProductCategorySlot(product)) missing.push("authorized_recommendation_category");

  return missing;
}

function summarizeProductRows(products, getProductCategorySlot) {
  const categoryDistribution = {};
  const slotDistribution = {};
  const missingRequiredFieldDistribution = {};
  let scorerCompatibleRows = 0;

  for (const product of products) {
    const slot = getProductCategorySlot(product);
    const missing = missingScorerRequiredFields(product, getProductCategorySlot);

    if (!missing.length) {
      scorerCompatibleRows += 1;
    } else {
      for (const field of missing) {
        increment(missingRequiredFieldDistribution, field);
      }
    }

    increment(categoryDistribution, product?.category);
    increment(slotDistribution, slot || "unauthorized");
  }

  return {
    productRowsLoaded: products.length,
    scorerCompatibleRows,
    scorerIncompatibleRows: products.length - scorerCompatibleRows,
    categoryDistribution: sortObject(categoryDistribution),
    slotDistribution: sortObject(slotDistribution),
    missingRequiredFieldDistribution: sortObject(missingRequiredFieldDistribution)
  };
}

async function loadReadOnlyProductRows() {
  const {
    getRecommendationProducts,
    getProductCategorySlot,
    isProductSourceUnavailableError
  } = await loadEngineModules();

  try {
    const products = await getRecommendationProducts();
    const summary = summarizeProductRows(products, getProductCategorySlot);

    return {
      status: "available",
      failureReason: null,
      products,
      summary
    };
  } catch (error) {
    return {
      status: "unavailable",
      failureReason: isProductSourceUnavailableError(error)
        ? `read_only_product_source_${error.reason || "unavailable"}`
        : "read_only_product_source_unexpected_error",
      products: [],
      summary: summarizeProductRows([], getProductCategorySlot)
    };
  }
}

function createEmptyGapCoverage() {
  return aggregateScenarioRows([]).gapCoverage;
}

function createEmptyDecisionSummary() {
  return aggregateScenarioRows([]).decisionSummary;
}

function classifyEmptyCandidateFailure({ productSourceStatus, productRowsLoaded, scorerCompatibleRows, candidateSource }) {
  if (productSourceStatus !== "available") {
    return "read_only_product_source_unavailable";
  }

  if (productRowsLoaded > 0 && scorerCompatibleRows === 0) {
    return "scorer_filter_rejected_all_products";
  }

  if (candidateSource?.completeness === "unavailable") {
    return "candidate_diagnostics_not_available";
  }

  if (productRowsLoaded > 0 && scorerCompatibleRows > 0) {
    return "product_source_loaded_but_not_consumed";
  }

  return "candidate_source_empty_after_pure_engine_replay";
}

async function runScenario(scenario, productSourceState) {
  const {
    buildFallbackPhotoAnalysis,
    buildSkinMatchDecisionBundle,
    buildSurveyInputContract,
    resolveFunctionalGoalPolicy,
    buildFunctionalCandidateExposureAudit
  } = await loadEngineModules();
  const input = scenarioFormToInput(scenario.form);
  const surveyContract = buildSurveyInputContract(input, {
    source: "pure_engine_target_replay"
  });

  if (productSourceState.status !== "available") {
    return {
      scenarioId: scenario.scenarioId,
      status: "failed",
      failureReason: productSourceState.failureReason,
      productRowsLoaded: productSourceState.summary.productRowsLoaded,
      scorerCompatibleRows: productSourceState.summary.scorerCompatibleRows,
      candidateRows: 0,
      boundaryApplicableRows: 0,
      decisionSummary: createEmptyDecisionSummary(),
      gapCoverage: createEmptyGapCoverage(),
      highRiskCollapsedCount: 0,
      limitations: ["read_only_product_source_unavailable"],
      productSourceMode: "getRecommendationProducts_read_only",
      productSourceFallbackReason: null,
      candidateSource: {
        completeness: "unavailable",
        sourceStage: "unavailable",
        sourceCount: 0,
        candidateIdentityMode: "unavailable"
      },
      rowSummary: summarizeRows([]),
      candidateReviewRows: []
    };
  }

  const decision = await buildSkinMatchDecisionBundle(input, {
    locale: "ko",
    photoAnalysis: buildFallbackPhotoAnalysis("ko"),
    currentProducts: [],
    currentProductSnapshots: [],
    products: productSourceState.products,
    includeCandidateSourceDiagnostics: true
  });
  const candidateSource = decision?.diagnostics?.candidateSource || null;
  const products = Array.isArray(candidateSource?.products) ? candidateSource.products : [];
  const goalPolicy = resolveFunctionalGoalPolicy({
    surveyContract,
    freeResultPriority: decision?.priority,
    safety: surveyContract.safety
  });
  const exposureAudit = buildFunctionalCandidateExposureAudit({
    products,
    surveyContract,
    goalPolicy,
    currentProductFindings: null,
    options: {}
  });
  const rows = exposureAudit.candidateReviewRows || [];
  const hasCandidateRows = rows.length > 0;
  const aggregate = aggregateScenarioRows([{ _candidateReviewRowsForAggregation: rows }]);
  const scenarioResult = {
    scenarioId: scenario.scenarioId,
    status: hasCandidateRows ? "succeeded" : "failed",
    failureReason: hasCandidateRows
      ? null
      : classifyEmptyCandidateFailure({
          productSourceStatus: productSourceState.status,
          productRowsLoaded: productSourceState.summary.productRowsLoaded,
          scorerCompatibleRows: productSourceState.summary.scorerCompatibleRows,
          candidateSource
        }),
    productRowsLoaded: productSourceState.summary.productRowsLoaded,
    scorerCompatibleRows: productSourceState.summary.scorerCompatibleRows,
    candidateRows: rows.length,
    boundaryApplicableRows: aggregate.boundaryApplicableRows,
    decisionSummary: aggregate.decisionSummary,
    gapCoverage: aggregate.gapCoverage,
    highRiskCollapsedCount: aggregate.highRiskCollapsedCount,
    limitations: buildLimitations({
      scenarioResults: [{ _candidateReviewRowsForAggregation: rows, status: hasCandidateRows ? "succeeded" : "failed" }],
      gapCoverage: aggregate.gapCoverage
    }),
    productSourceMode: "getRecommendationProducts_read_only",
    productSourceFallbackReason: null,
    candidateSource: {
      completeness: candidateSource?.completeness || "unavailable",
      sourceStage: candidateSource?.sourceStage || "unavailable",
      sourceCount: candidateSource?.sourceCount || products.length,
      candidateIdentityMode: candidateSource?.candidateIdentityMode || "unavailable"
    },
    rankingContext: exposureAudit.summary?.rankingContext || null,
    rowSummary: summarizeRows(rows),
    candidateReviewRows: stripRowsForOutput(rows)
  };

  Object.defineProperty(scenarioResult, "_candidateReviewRowsForAggregation", {
    value: rows,
    enumerable: false
  });

  return scenarioResult;
}

function buildLimitations({ scenarioResults, gapCoverage }) {
  const limitations = [
    "pure_engine_replay_is_not_actual_api_analyze_capture",
    "route_guard_session_premium_store_boundaries_are_not_exercised",
    "product_source_is_read_only_but_environment_dependent"
  ];

  for (const [gap, value] of Object.entries(gapCoverage)) {
    if (!value.observed) {
      limitations.push(`${gap}:not_observed_in_pure_engine_replay`);
    }
  }

  if (scenarioResults.some((scenario) => scenario.status !== "succeeded")) {
    limitations.push("one_or_more_target_scenarios_failed");
  }

  return limitations.sort();
}

function makeMarkdown(artifact) {
  const scenarioRows = artifact.scenarioResults
    .map((scenario) => `| ${scenario.scenarioId} | ${scenario.status} | ${scenario.candidateSource.sourceCount} | ${scenario.candidateSource.completeness} |`)
    .join("\n");
  const gapRows = Object.entries(artifact.gapCoverage)
    .map(([gap, value]) => `| ${gap} | ${value.status} | ${value.totalRows} | ${value.boundaryApplicableRows} | ${Object.entries(value.decisionDistribution).map(([key, count]) => `${key}:${count}`).join(", ") || "none"} |`)
    .join("\n");

  return `# Evaluator Boundary Pure Engine Target Replay - 2026-07-03

This document records pure engine replay evidence. It is not actual /api/analyze capture and is not runtime policy approval.

## Scope

- Evidence type: ${artifact.evidenceType}
- Route invoked: ${artifact.routeInvoked}
- Supabase write executed: ${artifact.supabaseWriteExecuted}
- Runtime mutation: ${artifact.runtimeMutation}

## Scenario Results

| Scenario | Status | Candidate rows | Candidate source completeness |
| --- | --- | ---: | --- |
${scenarioRows}

## Gap Coverage

| Gap | Status | Rows | Boundary-applicable rows | Decision distribution |
| --- | --- | ---: | ---: | --- |
${gapRows}

## Safety Check

- High-risk collapsed count: ${artifact.highRiskCollapsedCount}

## Limitations

${artifact.limitations.map((item) => `- ${item}`).join("\n")}
`;
}

export async function runPureEngineTargetScenarioReplay({ generatedAt = new Date().toISOString() } = {}) {
  const envFileLoads = await loadEnvFilesForReadOnlySource();
  await loadEngineModules();
  const plan = await ensurePlan();
  const productSourceState = await loadReadOnlyProductRows();
  const targetScenarios = (plan?.proposedScenarios || [])
    .filter((scenario) => TARGET_SCENARIO_IDS.includes(scenario.scenarioId))
    .sort((left, right) => TARGET_SCENARIO_IDS.indexOf(left.scenarioId) - TARGET_SCENARIO_IDS.indexOf(right.scenarioId));

  const scenarioResults = [];
  for (const scenario of targetScenarios) {
    try {
      scenarioResults.push(await runScenario(scenario, productSourceState));
    } catch (error) {
      scenarioResults.push({
        scenarioId: scenario.scenarioId,
        status: "failed",
        failureReason: error instanceof Error ? error.message : String(error),
        productRowsLoaded: productSourceState.summary.productRowsLoaded,
        scorerCompatibleRows: productSourceState.summary.scorerCompatibleRows,
        candidateRows: 0,
        boundaryApplicableRows: 0,
        decisionSummary: createEmptyDecisionSummary(),
        gapCoverage: createEmptyGapCoverage(),
        highRiskCollapsedCount: 0,
        limitations: ["scenario_execution_failed"],
        productSourceMode: "getRecommendationProducts_read_only",
        productSourceFallbackReason: null,
        candidateSource: {
          completeness: "unavailable",
          sourceStage: "unavailable",
          sourceCount: 0,
          candidateIdentityMode: "unavailable"
        },
        rowSummary: summarizeRows([]),
        candidateReviewRows: []
      });
    }
  }

  const aggregate = aggregateScenarioRows(scenarioResults);
  const candidateSourceSummary = {
    totalCandidateRows: scenarioResults.reduce((sum, scenario) => sum + (scenario.rowSummary?.rowCount || 0), 0),
    byScenario: Object.fromEntries(
      scenarioResults.map((scenario) => [
        scenario.scenarioId,
        scenario.candidateSource
      ])
    )
  };
  const productSourceSummary = {
    source: "getRecommendationProducts_read_only",
    status: productSourceState.status,
    failureReason: productSourceState.failureReason,
    productRowsLoaded: productSourceState.summary.productRowsLoaded,
    scorerCompatibleRows: productSourceState.summary.scorerCompatibleRows,
    scorerIncompatibleRows: productSourceState.summary.scorerIncompatibleRows,
    categoryDistribution: productSourceState.summary.categoryDistribution,
    slotDistribution: productSourceState.summary.slotDistribution,
    missingRequiredFieldDistribution: productSourceState.summary.missingRequiredFieldDistribution,
    replayFallbackProductCount: 0,
    productSourceModes: sortObject(
      scenarioResults.reduce((distribution, scenario) => {
        increment(distribution, scenario.productSourceMode);
        return distribution;
      }, {})
    ),
    routeInvoked: false,
    syntheticProductsUsed: false,
    envValuesPrinted: false,
    serviceRoleRequired: false
  };

  return sortDeep({
    replayVersion: "evaluator-boundary-pure-engine-target-replay-v1",
    generatedAt,
    evidenceType: "pure_engine_replay",
    routeInvoked: false,
    apiAnalyzeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    envValuesPrinted: false,
    productSource: "getRecommendationProducts_read_only",
    productRowsLoaded: productSourceSummary.productRowsLoaded,
    scorerCompatibleRows: productSourceSummary.scorerCompatibleRows,
    scenariosAttempted: scenarioResults.length,
    scenariosSucceeded: scenarioResults.filter((scenario) => scenario.status === "succeeded").length,
    scenariosFailed: scenarioResults.filter((scenario) => scenario.status !== "succeeded").length,
    scenarioResults,
    envFileLoads,
    productSourceSummary,
    candidateSourceSummary,
    boundarySummary: {
      boundaryApplicableRows: aggregate.boundaryApplicableRows
    },
    gapCoverage: aggregate.gapCoverage,
    decisionSummary: aggregate.decisionSummary,
    highRiskCollapsedCount: aggregate.highRiskCollapsedCount,
    limitations: buildLimitations({
      scenarioResults,
      gapCoverage: aggregate.gapCoverage
    })
  });
}

async function main() {
  const result = await runPureEngineTargetScenarioReplay();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(MD_OUTPUT, makeMarkdown(result), "utf8");

  console.log("pure engine target scenario replay complete");
  console.log(`scenarios attempted: ${result.scenariosAttempted}`);
  console.log(`scenarios succeeded: ${result.scenariosSucceeded}`);
  console.log(`scenarios failed: ${result.scenariosFailed}`);
  console.log(`product rows loaded: ${result.productRowsLoaded}`);
  console.log(`scorer-compatible rows: ${result.scorerCompatibleRows}`);
  console.log(`candidate rows: ${result.candidateSourceSummary.totalCandidateRows}`);
  console.log(`boundary applicable rows: ${result.boundarySummary.boundaryApplicableRows}`);
  console.log(`high-risk collapsed count: ${result.highRiskCollapsedCount}`);
  for (const [gap, value] of Object.entries(result.gapCoverage)) {
    console.log(`${gap}: ${value.status}, rows=${value.totalRows}, boundary=${value.boundaryApplicableRows}`);
  }
  console.log(`wrote ${JSON_OUTPUT}`);
  console.log(`wrote ${MD_OUTPUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.env[ALIAS_LOADER_ENV] !== "1") {
    const child = spawnSync(process.execPath, [
      "--experimental-loader",
      pathToFileURL(ALIAS_LOADER).href,
      process.argv[1],
      ...process.argv.slice(2)
    ], {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        [ALIAS_LOADER_ENV]: "1"
      }
    });

    process.exitCode = child.status || 0;
  } else {
    main().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
