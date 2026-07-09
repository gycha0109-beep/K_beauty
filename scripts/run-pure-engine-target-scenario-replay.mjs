import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const PLAN_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-target-capture-plan.json");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-pure-engine-target-replay.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-pure-engine-target-replay.md");
const ALIAS_LOADER = path.join(ROOT, "scripts", "node-next-alias-loader.mjs");
const ALIAS_LOADER_ENV = "PURE_ENGINE_REPLAY_ALIAS_LOADER";
const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(ROOT, "tmp", "functional-shadow-captures");

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

const CAPTURE_ARTIFACT_JSON = new Set([
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
    boundaryPolicy
  ] = await Promise.all([
    import("../lib/photo-evidence.js"),
    import("../lib/skin-match-decision-engine.js"),
    import("../lib/survey-input-contract.js"),
    import("../lib/functional-goal-policy.js"),
    import("../lib/functional-candidate-exposure-audit.js"),
    import("../lib/evaluator-recent-instability-boundary-policy.js")
  ]);

  engineModules = {
    buildFallbackPhotoAnalysis: photoEvidence.buildFallbackPhotoAnalysis,
    buildSkinMatchDecisionBundle: decisionEngine.buildSkinMatchDecisionBundle,
    buildSurveyInputContract: surveyContract.buildSurveyInputContract,
    resolveFunctionalGoalPolicy: goalPolicy.resolveFunctionalGoalPolicy,
    buildFunctionalCandidateExposureAudit: exposureAudit.buildFunctionalCandidateExposureAudit,
    resolveEvaluatorRecentInstabilityBoundaryPolicy:
      boundaryPolicy.resolveEvaluatorRecentInstabilityBoundaryPolicy
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

function getProductId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || null;
}

async function readReplayFallbackProducts() {
  const unique = new Map();
  let entries = [];

  try {
    entries = await readdir(CAPTURE_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  for (const name of names) {
    if (CAPTURE_ARTIFACT_JSON.has(name)) continue;
    const fixture = await readJsonIfPresent(path.join(CAPTURE_DIR, name));
    const source = fixture?.candidateSource || {};

    if (fixture?.captureVersion !== "v1" ||
      source.completeness !== "complete" ||
      source.candidateIdentityMode !== "product_row") {
      continue;
    }

    for (const product of source.products || []) {
      const id = getProductId(product);
      if (id && !unique.has(id)) {
        unique.set(id, product);
      }
    }
  }

  return Array.from(unique.values());
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
  return category === "serum" || category === "serum_ampoule" || category === "ampoule";
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
    for (const row of scenario.candidateReviewRows || []) {
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

async function runScenario(scenario, replayFallbackProducts) {
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
  let decision = null;
  let productSourceMode = "live_read_only_product_source";
  let productSourceFallbackReason = null;

  try {
    decision = await buildSkinMatchDecisionBundle(input, {
      locale: "ko",
      photoAnalysis: buildFallbackPhotoAnalysis("ko"),
      currentProducts: [],
      currentProductSnapshots: [],
      includeCandidateSourceDiagnostics: true
    });
  } catch (error) {
    if (!replayFallbackProducts.length) {
      throw error;
    }

    productSourceMode = "existing_complete_capture_product_rows_replay_fallback";
    productSourceFallbackReason = error instanceof Error ? error.message : String(error);
    decision = await buildSkinMatchDecisionBundle(input, {
      locale: "ko",
      photoAnalysis: buildFallbackPhotoAnalysis("ko"),
      currentProducts: [],
      currentProductSnapshots: [],
      products: replayFallbackProducts,
      includeCandidateSourceDiagnostics: true
    });
  }
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

  return {
    scenarioId: scenario.scenarioId,
    status: hasCandidateRows ? "succeeded" : "failed",
    failureReason: hasCandidateRows ? null : "candidate_source_empty_after_pure_engine_replay",
    productSourceMode,
    productSourceFallbackReason,
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
  await loadEngineModules();
  const plan = await ensurePlan();
  const replayFallbackProducts = await readReplayFallbackProducts();
  const targetScenarios = (plan?.proposedScenarios || [])
    .filter((scenario) => TARGET_SCENARIO_IDS.includes(scenario.scenarioId))
    .sort((left, right) => TARGET_SCENARIO_IDS.indexOf(left.scenarioId) - TARGET_SCENARIO_IDS.indexOf(right.scenarioId));

  const scenarioResults = [];
  for (const scenario of targetScenarios) {
    try {
      scenarioResults.push(await runScenario(scenario, replayFallbackProducts));
    } catch (error) {
      scenarioResults.push({
        scenarioId: scenario.scenarioId,
        status: "failed",
        failureReason: error instanceof Error ? error.message : String(error),
        productSourceMode: replayFallbackProducts.length
          ? "existing_complete_capture_product_rows_replay_fallback_unavailable_for_scenario"
          : "product_source_unavailable",
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
    source: "buildSkinMatchDecisionBundle_read_only_product_source",
    replayFallbackProductCount: replayFallbackProducts.length,
    productSourceModes: sortObject(
      scenarioResults.reduce((distribution, scenario) => {
        increment(distribution, scenario.productSourceMode);
        return distribution;
      }, {})
    ),
    routeInvoked: false,
    syntheticProductsUsed: false
  };

  return sortDeep({
    replayVersion: "evaluator-boundary-pure-engine-target-replay-v1",
    generatedAt,
    evidenceType: "pure_engine_replay",
    routeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    scenariosAttempted: scenarioResults.length,
    scenariosSucceeded: scenarioResults.filter((scenario) => scenario.status === "succeeded").length,
    scenariosFailed: scenarioResults.filter((scenario) => scenario.status !== "succeeded").length,
    scenarioResults,
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
