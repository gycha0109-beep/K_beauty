import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const PLAN_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-target-capture-plan.json");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "read-only-scorer-compatible-product-source.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "read-only-scorer-compatible-product-source.md");
const ALIAS_LOADER = path.join(ROOT, "scripts", "node-next-alias-loader.mjs");
const ALIAS_LOADER_ENV = "READ_ONLY_SCORER_SOURCE_ALIAS_LOADER";

const TARGET_SCENARIO_IDS = [
  "target_active_acne_recent_instability",
  "target_redness_barrier_recent_instability",
  "target_pores_tone_active_recent_instability",
  "target_serum_tone_acne_recent_instability"
];

let modules = null;

async function loadModules() {
  if (modules) {
    return modules;
  }

  const [
    productSource,
    recommendationScoring,
    photoEvidence,
    decisionEngine,
    surveyContract,
    goalPolicy,
    exposureAudit
  ] = await Promise.all([
    import("../lib/product-source.js"),
    import("../lib/recommendation-scoring.ts"),
    import("../lib/photo-evidence.js"),
    import("../lib/skin-match-decision-engine.js"),
    import("../lib/survey-input-contract.js"),
    import("../lib/functional-goal-policy.js"),
    import("../lib/functional-candidate-exposure-audit.js")
  ]);

  modules = {
    getRecommendationProducts: productSource.getRecommendationProducts,
    isProductSourceUnavailableError: productSource.isProductSourceUnavailableError,
    getProductCategorySlot: recommendationScoring.getProductCategorySlot,
    buildFallbackPhotoAnalysis: photoEvidence.buildFallbackPhotoAnalysis,
    buildSkinMatchDecisionBundle: decisionEngine.buildSkinMatchDecisionBundle,
    buildSurveyInputContract: surveyContract.buildSurveyInputContract,
    resolveFunctionalGoalPolicy: goalPolicy.resolveFunctionalGoalPolicy,
    buildFunctionalCandidateExposureAudit: exposureAudit.buildFunctionalCandidateExposureAudit
  };

  return modules;
}

function normalizeText(value) {
  return String(value ?? "").trim();
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

function missingScorerRequiredFields(product, getProductCategorySlot) {
  const missing = [];

  if (!normalizeText(product?.id)) missing.push("id");
  if (!normalizeText(product?.name)) missing.push("name");
  if (!normalizeText(product?.brand)) missing.push("brand");
  if (!getProductCategorySlot(product)) missing.push("authorized_recommendation_category");

  return missing;
}

function summarizeScorerCompatibility(products, getProductCategorySlot) {
  const missingRequiredFieldDistribution = {};
  const categoryDistribution = {};
  const categorySlotDistribution = {};
  const signalAvailability = {
    ingredient_signals: 0,
    market_signals: 0,
    review_signals: 0
  };
  const sunscreenMetadataAvailability = {
    uv_filter_type: 0,
    tone_up: 0,
    white_cast: 0,
    eye_sting: 0,
    pilling_risk: 0
  };
  let scorerCompatibleCount = 0;
  let lowIrritationCount = 0;
  let sensitivitySafeCount = 0;

  for (const product of products) {
    const slot = getProductCategorySlot(product);
    const missing = missingScorerRequiredFields(product, getProductCategorySlot);

    if (!missing.length) {
      scorerCompatibleCount += 1;
    } else {
      for (const field of missing) {
        increment(missingRequiredFieldDistribution, field);
      }
    }

    increment(categoryDistribution, product?.category);
    increment(categorySlotDistribution, slot || "unauthorized");

    for (const key of Object.keys(signalAvailability)) {
      if (product?.[key] && typeof product[key] === "object") {
        signalAvailability[key] += 1;
      }
    }

    for (const key of Object.keys(sunscreenMetadataAvailability)) {
      if (product?.[key] != null) {
        sunscreenMetadataAvailability[key] += 1;
      }
    }

    if (product?.irritation_risk === "low") lowIrritationCount += 1;
    if (product?.sensitivity_safe === true) sensitivitySafeCount += 1;
  }

  return {
    totalRows: products.length,
    scorerCompatibleCount,
    scorerIncompatibleCount: products.length - scorerCompatibleCount,
    missingRequiredFieldDistribution: sortObject(missingRequiredFieldDistribution),
    categoryDistribution: sortObject(categoryDistribution),
    categorySlotDistribution: sortObject(categorySlotDistribution),
    lowIrritationCount,
    sensitivitySafeCount,
    signalAvailability,
    sunscreenMetadataAvailability
  };
}

async function loadReadOnlyProducts() {
  const { getRecommendationProducts, isProductSourceUnavailableError } = await loadModules();

  try {
    const products = await getRecommendationProducts();
    return {
      status: "available",
      unavailableReason: null,
      products
    };
  } catch (error) {
    return {
      status: "unavailable",
      unavailableReason: isProductSourceUnavailableError(error)
        ? error.reason || error.message
        : error instanceof Error
          ? error.message
          : String(error),
      products: []
    };
  }
}

async function runScenario(scenario, products) {
  const {
    buildFallbackPhotoAnalysis,
    buildSkinMatchDecisionBundle,
    buildSurveyInputContract,
    resolveFunctionalGoalPolicy,
    buildFunctionalCandidateExposureAudit
  } = await loadModules();
  const input = scenarioFormToInput(scenario.form);
  const surveyContract = buildSurveyInputContract(input, {
    source: "read_only_scorer_compatible_product_source"
  });
  const decision = await buildSkinMatchDecisionBundle(input, {
    locale: "ko",
    photoAnalysis: buildFallbackPhotoAnalysis("ko"),
    currentProducts: [],
    currentProductSnapshots: [],
    products,
    includeCandidateSourceDiagnostics: true
  });
  const candidateSource = decision?.diagnostics?.candidateSource || null;
  const candidateProducts = Array.isArray(candidateSource?.products) ? candidateSource.products : [];
  const goalPolicy = resolveFunctionalGoalPolicy({
    surveyContract,
    freeResultPriority: decision?.priority,
    safety: surveyContract.safety
  });
  const audit = buildFunctionalCandidateExposureAudit({
    products: candidateProducts,
    surveyContract,
    goalPolicy,
    currentProductFindings: null,
    options: {}
  });

  return {
    scenarioId: scenario.scenarioId,
    status: candidateProducts.length ? "succeeded" : "failed",
    failureReason: candidateProducts.length ? null : "candidate_source_empty_after_read_only_extraction",
    candidateSource: {
      completeness: candidateSource?.completeness || "unavailable",
      sourceStage: candidateSource?.sourceStage || "unavailable",
      sourceCount: candidateSource?.sourceCount || candidateProducts.length,
      candidateIdentityMode: candidateSource?.candidateIdentityMode || "unavailable"
    },
    auditRowCount: Array.isArray(audit?.candidateReviewRows) ? audit.candidateReviewRows.length : 0,
    rankingContext: audit?.summary?.rankingContext || null
  };
}

async function runTargetScenarios(products) {
  if (!products.length) {
    return [];
  }

  const plan = await ensurePlan();
  const targetScenarios = (plan?.proposedScenarios || [])
    .filter((scenario) => TARGET_SCENARIO_IDS.includes(scenario.scenarioId))
    .sort((left, right) => TARGET_SCENARIO_IDS.indexOf(left.scenarioId) - TARGET_SCENARIO_IDS.indexOf(right.scenarioId));
  const results = [];

  for (const scenario of targetScenarios) {
    try {
      results.push(await runScenario(scenario, products));
    } catch (error) {
      results.push({
        scenarioId: scenario.scenarioId,
        status: "failed",
        failureReason: error instanceof Error ? error.message : String(error),
        candidateSource: {
          completeness: "unavailable",
          sourceStage: "unavailable",
          sourceCount: 0,
          candidateIdentityMode: "unavailable"
        },
        auditRowCount: 0,
        rankingContext: null
      });
    }
  }

  return results;
}

function summarizeScenarios(scenarios) {
  const sourceCountDistribution = {};
  const completenessDistribution = {};
  const identityModeDistribution = {};
  let totalCandidateRows = 0;
  let totalAuditRows = 0;

  for (const scenario of scenarios) {
    totalCandidateRows += Number(scenario?.candidateSource?.sourceCount || 0);
    totalAuditRows += Number(scenario?.auditRowCount || 0);
    increment(sourceCountDistribution, String(scenario?.candidateSource?.sourceCount || 0));
    increment(completenessDistribution, scenario?.candidateSource?.completeness);
    increment(identityModeDistribution, scenario?.candidateSource?.candidateIdentityMode);
  }

  return {
    scenariosAttempted: scenarios.length,
    scenariosSucceeded: scenarios.filter((scenario) => scenario.status === "succeeded").length,
    scenariosFailed: scenarios.filter((scenario) => scenario.status !== "succeeded").length,
    totalCandidateRows,
    totalAuditRows,
    sourceCountDistribution: sortObject(sourceCountDistribution),
    completenessDistribution: sortObject(completenessDistribution),
    identityModeDistribution: sortObject(identityModeDistribution)
  };
}

function buildLimitations(sourceStatus, scenarioSummary) {
  const limitations = [
    "read_only_source_extraction_is_not_actual_api_analyze_capture",
    "route_guard_session_premium_store_boundaries_are_not_exercised",
    "no_runtime_evaluator_or_candidate_policy_integration"
  ];

  if (sourceStatus.status !== "available") {
    limitations.push(`product_source_unavailable:${sourceStatus.unavailableReason || "unknown"}`);
  }

  if (scenarioSummary.scenariosFailed > 0) {
    limitations.push("one_or_more_target_scenarios_failed");
  }

  return limitations.sort();
}

function makeMarkdown(artifact) {
  const contractRows = artifact.scorerProductContract.requiredForScorerCompatibility
    .map((item) => `- ${item}`)
    .join("\n");
  const scenarioRows = artifact.scenarioResults.length
    ? artifact.scenarioResults
        .map((scenario) => `| ${scenario.scenarioId} | ${scenario.status} | ${scenario.candidateSource.sourceCount} | ${scenario.candidateSource.completeness} | ${scenario.auditRowCount} |`)
        .join("\n")
    : "| none | skipped | 0 | unavailable | 0 |";

  return `# Read-only Scorer-compatible Product Source Extraction - 2026-07-09

This is Phase 23 diagnostic evidence. It does not invoke /api/analyze and does not change runtime recommendation behavior.

## Scope

- Evidence type: ${artifact.evidenceType}
- Route invoked: ${artifact.routeInvoked}
- Supabase write executed: ${artifact.supabaseWriteExecuted}
- Runtime mutation: ${artifact.runtimeMutation}
- Product source status: ${artifact.productSourceSummary.status}
- Product source unavailable reason: ${artifact.productSourceSummary.unavailableReason || "none"}

## Scorer Product Contract

Required for scorer compatibility:

${contractRows}

Optional fields are used as score modifiers, explanation evidence, or sunscreen-specific fit metadata. Missing optional fields should reduce evidence quality or bonuses, not block the row.

## Product Source Summary

- Total rows: ${artifact.productSourceSummary.totalRows}
- Scorer-compatible rows: ${artifact.productSourceSummary.scorerCompatibleCount}
- Scorer-incompatible rows: ${artifact.productSourceSummary.scorerIncompatibleCount}

## Target Scenario Replay With Extracted Source

| Scenario | Status | Candidate rows | Completeness | Audit rows |
| --- | --- | ---: | --- | ---: |
${scenarioRows}

## Limitations

${artifact.limitations.map((item) => `- ${item}`).join("\n")}
`;
}

export async function inspectReadOnlyScorerCompatibleProductSource({ generatedAt = new Date().toISOString() } = {}) {
  const { getProductCategorySlot } = await loadModules();
  const sourceStatus = await loadReadOnlyProducts();
  const compatibility = summarizeScorerCompatibility(sourceStatus.products, getProductCategorySlot);
  const scenarioResults = await runTargetScenarios(sourceStatus.products);
  const scenarioSummary = summarizeScenarios(scenarioResults);

  return sortDeep({
    extractionVersion: "read-only-scorer-compatible-product-source-v1",
    generatedAt,
    evidenceType: "read_only_scorer_compatible_product_source",
    routeInvoked: false,
    apiAnalyzeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    syntheticProductsUsed: false,
    scorerProductContract: {
      source: "current_code_static_and_runtime_boundary_inspection",
      requiredForScorerCompatibility: [
        "id: required by buildSkinMatchDecisionBundle scoredProducts filter",
        "name: required by buildSkinMatchDecisionBundle scoredProducts filter",
        "brand: required by buildSkinMatchDecisionBundle scoredProducts filter",
        "authorized recommendation category: required by getProductCategorySlot before scoring",
        "product_form: used with category to authorize serum/moisturizer subcategory semantics when present"
      ],
      normalizedByProductSource: [
        "skin_types",
        "concerns",
        "texture",
        "finish",
        "irritation_risk",
        "sensitivity_safe",
        "price_min",
        "price_max",
        "review_signals",
        "market_signals",
        "ingredient_signals",
        "sunscreen metadata"
      ],
      optionalScoreModifiers: [
        "recommendation_tier",
        "is_mens",
        "uv_filter_type",
        "tone_up",
        "white_cast",
        "eye_sting",
        "pilling_risk",
        "review_signals",
        "market_signals",
        "ingredient_signals"
      ]
    },
    productSourceSummary: {
      status: sourceStatus.status,
      sourceMode: "getRecommendationProducts_read_only",
      unavailableReason: sourceStatus.unavailableReason,
      totalRows: compatibility.totalRows,
      scorerCompatibleCount: compatibility.scorerCompatibleCount,
      scorerIncompatibleCount: compatibility.scorerIncompatibleCount,
      missingRequiredFieldDistribution: compatibility.missingRequiredFieldDistribution,
      categoryDistribution: compatibility.categoryDistribution,
      categorySlotDistribution: compatibility.categorySlotDistribution,
      lowIrritationCount: compatibility.lowIrritationCount,
      sensitivitySafeCount: compatibility.sensitivitySafeCount,
      signalAvailability: compatibility.signalAvailability,
      sunscreenMetadataAvailability: compatibility.sunscreenMetadataAvailability
    },
    scenarioSummary,
    scenarioResults,
    limitations: buildLimitations(sourceStatus, scenarioSummary)
  });
}

async function main() {
  const result = await inspectReadOnlyScorerCompatibleProductSource();

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(MD_OUTPUT, makeMarkdown(result), "utf8");

  console.log("read-only scorer-compatible product source inspection complete");
  console.log(`source status: ${result.productSourceSummary.status}`);
  console.log(`total rows: ${result.productSourceSummary.totalRows}`);
  console.log(`scorer-compatible rows: ${result.productSourceSummary.scorerCompatibleCount}`);
  console.log(`target scenarios attempted: ${result.scenarioSummary.scenariosAttempted}`);
  console.log(`total candidate rows: ${result.scenarioSummary.totalCandidateRows}`);
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
