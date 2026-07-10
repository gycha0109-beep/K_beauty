import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EVALUATOR_RECENT_INSTABILITY_BOUNDARY_POLICY_VALUES,
  resolveEvaluatorRecentInstabilityBoundaryPolicy
} from "../lib/evaluator-recent-instability-boundary-policy.js";

const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(process.cwd(), "tmp", "functional-shadow-captures");
const OUTPUT_DIR = path.join(process.cwd(), "tmp");
const EXPOSURE_AUDIT_PATH = path.join(CAPTURE_DIR, "candidate-exposure-audit.json");
const ACTUAL_COVERAGE_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-actual-coverage.json");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-target-capture-plan.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-target-capture-plan.md");

const ARTIFACT_JSON = new Set([
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

const STRONG_CAUTION_TAGS = new Set(
  EVALUATOR_RECENT_INSTABILITY_BOUNDARY_POLICY_VALUES.strongCautionTags
);

const SURVEY_FIELD_ALLOWLIST = [
  "skinType",
  "sensitivity",
  "primaryConcern",
  "mainConcerns",
  "recentSkinChange",
  "recentlyChangedProduct",
  "sunscreenPreferenceState",
  "postWashFeeling",
  "afternoonSkinChange",
  "cleansingFrequency",
  "environmentExposure",
  "preferredTexture",
  "mostDislikedFeel",
  "whiteCastHate",
  "toneUpWanted",
  "makeupUse",
  "eyeSensitive"
];

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
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }

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

function isCaptureJson(name, fixture) {
  return !ARTIFACT_JSON.has(name) && fixture?.captureVersion === "v1";
}

async function ensureExposureAudit() {
  const existing = await readJsonIfPresent(EXPOSURE_AUDIT_PATH);
  const hasRows = existing?.fixtureAudits?.some((fixture) => Array.isArray(fixture.candidateReviewRows));

  if (!hasRows) {
    execFileSync(process.execPath, ["scripts/run-functional-candidate-exposure-audit.mjs"], {
      cwd: process.cwd(),
      stdio: "ignore",
      env: process.env
    });
  }
}

async function ensureActualCoverage() {
  const existing = await readJsonIfPresent(ACTUAL_COVERAGE_PATH);
  if (existing?.runtimeMutation === false) return existing;

  execFileSync(process.execPath, ["scripts/collect-evaluator-boundary-actual-coverage.mjs"], {
    cwd: process.cwd(),
    stdio: "ignore",
    env: process.env
  });

  return readJsonIfPresent(ACTUAL_COVERAGE_PATH);
}

async function scanCaptures() {
  const summary = {
    totalJsonFilesScanned: 0,
    completeProductRowFixturesUsed: 0,
    excludedFixtureCounts: {}
  };

  let entries = [];
  try {
    entries = await readdir(CAPTURE_DIR, { withFileTypes: true });
  } catch {
    throw new Error("target capture planning requires tmp/functional-shadow-captures");
  }

  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  summary.totalJsonFilesScanned = names.length;

  for (const name of names) {
    const fixture = await readJsonIfPresent(path.join(CAPTURE_DIR, name));
    if (!isCaptureJson(name, fixture)) {
      increment(summary.excludedFixtureCounts, "analysis_or_summary_artifact");
      continue;
    }

    const source = fixture.candidateSource || {};
    if (source.completeness === "complete" && source.candidateIdentityMode === "product_row") {
      summary.completeProductRowFixturesUsed += 1;
    } else {
      increment(summary.excludedFixtureCounts, source.completeness || "unsupported_capture_source");
    }
  }

  summary.excludedFixtureCounts = sortObject(summary.excludedFixtureCounts);
  return summary;
}

function rowsFromExposureAudit(audit) {
  const rows = [];
  for (const fixture of audit?.fixtureAudits || []) {
    for (const row of fixture.candidateReviewRows || []) {
      rows.push({
        ...row,
        captureId: fixture.captureId || null,
        comparisonConfidence: fixture.comparisonConfidence || "unknown",
        sourceStage: fixture.sourceStage || null,
        sourceCompleteness: "complete",
        candidateIdentityMode: fixture.candidateIdentityMode || "product_row"
      });
    }
  }
  return rows;
}

function productKey(row) {
  return `${row.productId || "unknown"}|${row.category || "unknown"}`;
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

function hasBoundaryReason(row) {
  return Array.isArray(row.hardFilterReasons) &&
    row.hardFilterReasons.includes("recent_instability_active_limited");
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
  if (row.activeAxisPresent) axes.push({ axis: "exfoliation", source: "actual_candidate_review_row" });
  if (row.stabilizingAxisPresent) axes.push({ axis: "hydration", source: "actual_candidate_review_row" });

  return {
    evaluable: row.profileEvaluable !== false,
    categoryRole: row.category || null,
    functionalAxes: axes,
    cautionTags: Array.isArray(row.cautionTags) ? row.cautionTags : []
  };
}

function applyBoundaryPolicy(row) {
  return resolveEvaluatorRecentInstabilityBoundaryPolicy({
    candidateEvaluation: candidateEvaluationFromRow(row),
    surveySafety: surveySafetyFromRow(row),
    goalPolicy: goalPolicyFromRow(row),
    product: productFromRow(row),
    productProfile: productProfileFromRow(row)
  });
}

function createAvailabilityBucket(statusWhenEmpty) {
  return {
    availability: false,
    status: statusWhenEmpty,
    candidateRowCount: 0,
    uniqueProductCount: 0,
    boundaryApplicableRows: 0,
    safeMetadataRows: 0,
    unsafeMetadataRows: 0,
    decisionDistribution: {},
    categoryDistribution: {},
    functionalProfileDistribution: {},
    safetyMetadataProfileDistribution: {},
    suggestedScenarioIds: []
  };
}

function addToBucket(bucket, row, policy) {
  bucket.availability = true;
  bucket.status = "available_in_current_complete_candidate_rows";
  bucket.candidateRowCount += 1;
  if (hasBoundaryReason(row)) bucket.boundaryApplicableRows += 1;
  if (row.safetyMetadataProfile === "safe_low_risk" || row.safetyMetadataProfile === "safe_medium_risk") {
    bucket.safeMetadataRows += 1;
  }
  if (row.safetyMetadataProfile === "unsafe_high_risk" ||
    row.irritationRisk === "high" ||
    row.sensitivitySafe === false) {
    bucket.unsafeMetadataRows += 1;
  }
  increment(bucket.decisionDistribution, policy.boundaryDecision);
  increment(bucket.categoryDistribution, row.category);
  increment(bucket.functionalProfileDistribution, row.functionalProfile);
  increment(bucket.safetyMetadataProfileDistribution, row.safetyMetadataProfile);
}

function finalizeBucket(bucket, uniqueKeys, scenarioIds = []) {
  return {
    ...bucket,
    uniqueProductCount: uniqueKeys.size,
    suggestedScenarioIds: scenarioIds,
    decisionDistribution: sortObject(bucket.decisionDistribution),
    categoryDistribution: sortObject(bucket.categoryDistribution),
    functionalProfileDistribution: sortObject(bucket.functionalProfileDistribution),
    safetyMetadataProfileDistribution: sortObject(bucket.safetyMetadataProfileDistribution)
  };
}

function buildDistribution(rows) {
  const categoryDistribution = {};
  const functionalProfileDistribution = {};
  const safetyMetadataProfileDistribution = {};
  const uniqueProducts = new Set();

  for (const row of rows) {
    uniqueProducts.add(productKey(row));
    increment(categoryDistribution, row.category);
    increment(functionalProfileDistribution, row.functionalProfile);
    increment(safetyMetadataProfileDistribution, row.safetyMetadataProfile);
  }

  return {
    candidateRowCount: rows.length,
    uniqueProductCount: uniqueProducts.size,
    categoryDistribution: sortObject(categoryDistribution),
    functionalProfileDistribution: sortObject(functionalProfileDistribution),
    safetyMetadataProfileDistribution: sortObject(safetyMetadataProfileDistribution)
  };
}

function buildScenarios() {
  return [
    {
      scenarioId: "target_active_acne_recent_instability",
      purpose: "Increase chance of active-axis candidates under recent instability and high sensitivity.",
      form: {
        skinType: "combination",
        sensitivity: "high",
        primaryConcern: "acne",
        mainConcerns: ["acne", "redness", "pores"],
        recentSkinChange: "yes",
        recentlyChangedProduct: "yes",
        postWashFeeling: "tight",
        afternoonSkinChange: "oily",
        cleansingFrequency: "2",
        environmentExposure: ["mask", "heat"],
        preferredTexture: "lightweight",
        mostDislikedFeel: "sticky",
        sunscreenPreferenceState: "answered",
        whiteCastHate: false,
        toneUpWanted: false,
        makeupUse: false,
        eyeSensitive: false
      },
      expectedGapTargets: ["active_leaning_only", "strong_caution_metadata"],
      captureMode: "dev_only_actual_api_capture"
    },
    {
      scenarioId: "target_redness_barrier_recent_instability",
      purpose: "Recheck stabilize-first safety context while preserving redness and barrier pressure.",
      form: {
        skinType: "dry",
        sensitivity: "high",
        primaryConcern: "redness",
        mainConcerns: ["redness", "dehydration", "barrier"],
        recentSkinChange: "yes",
        recentlyChangedProduct: "yes",
        postWashFeeling: "tight",
        afternoonSkinChange: "red_or_irritated",
        cleansingFrequency: "1",
        environmentExposure: ["wind", "cold"],
        preferredTexture: "cream",
        mostDislikedFeel: "greasy",
        sunscreenPreferenceState: "answered",
        whiteCastHate: false,
        toneUpWanted: false,
        makeupUse: false,
        eyeSensitive: true
      },
      expectedGapTargets: ["metadata_incomplete", "strong_caution_metadata"],
      captureMode: "dev_only_actual_api_capture"
    },
    {
      scenarioId: "target_pores_tone_active_recent_instability",
      purpose: "Increase chance of tone or pore active-axis candidates in a recent instability context.",
      form: {
        skinType: "oily",
        sensitivity: "high",
        primaryConcern: "pores_texture",
        mainConcerns: ["pores_texture", "uneven_tone", "oiliness"],
        recentSkinChange: "yes",
        recentlyChangedProduct: "yes",
        postWashFeeling: "normal",
        afternoonSkinChange: "oily",
        cleansingFrequency: "2",
        environmentExposure: ["outdoor", "heat"],
        preferredTexture: "gel",
        mostDislikedFeel: "heavy",
        sunscreenPreferenceState: "answered",
        whiteCastHate: true,
        toneUpWanted: false,
        makeupUse: true,
        eyeSensitive: false
      },
      expectedGapTargets: ["active_leaning_only", "serum_category"],
      captureMode: "dev_only_actual_api_capture"
    },
    {
      scenarioId: "target_serum_tone_acne_recent_instability",
      purpose: "Probe whether serum-like candidate categories can enter the complete candidate source.",
      form: {
        skinType: "combination",
        sensitivity: "high",
        primaryConcern: "uneven_tone",
        mainConcerns: ["uneven_tone", "acne", "redness"],
        recentSkinChange: "yes",
        recentlyChangedProduct: "yes",
        postWashFeeling: "normal",
        afternoonSkinChange: "red_or_irritated",
        cleansingFrequency: "2",
        environmentExposure: ["outdoor", "mask"],
        preferredTexture: "watery",
        mostDislikedFeel: "sticky",
        sunscreenPreferenceState: "answered",
        whiteCastHate: true,
        toneUpWanted: true,
        makeupUse: true,
        eyeSensitive: false
      },
      expectedGapTargets: ["serum_category", "strong_caution_metadata"],
      captureMode: "dev_only_actual_api_capture"
    }
  ];
}

function validateScenarioFields(scenarios) {
  const allowed = new Set(SURVEY_FIELD_ALLOWLIST);
  for (const scenario of scenarios) {
    for (const key of Object.keys(scenario.form || {})) {
      if (!allowed.has(key)) {
        throw new Error(`Scenario ${scenario.scenarioId} uses unsupported survey field: ${key}`);
      }
    }
  }
}

function buildGapAvailability(rows, scenarios) {
  const buckets = {
    activeLeaningOnly: createAvailabilityBucket("not_available_in_current_product_distribution"),
    metadataIncomplete: createAvailabilityBucket("not_available_in_current_product_distribution"),
    serumCategory: createAvailabilityBucket("not_available_in_current_product_distribution"),
    strongCaution: createAvailabilityBucket("not_available_in_current_product_distribution")
  };
  const unique = {
    activeLeaningOnly: new Set(),
    metadataIncomplete: new Set(),
    serumCategory: new Set(),
    strongCaution: new Set()
  };

  for (const row of rows) {
    const policy = applyBoundaryPolicy(row);

    if (isActiveOnly(row)) {
      addToBucket(buckets.activeLeaningOnly, row, policy);
      unique.activeLeaningOnly.add(productKey(row));
    }
    if (isMetadataIncomplete(row)) {
      addToBucket(buckets.metadataIncomplete, row, policy);
      unique.metadataIncomplete.add(productKey(row));
    }
    if (isSerum(row)) {
      addToBucket(buckets.serumCategory, row, policy);
      unique.serumCategory.add(productKey(row));
    }
    if (hasStrongCaution(row)) {
      addToBucket(buckets.strongCaution, row, policy);
      unique.strongCaution.add(productKey(row));
    }
  }

  return {
    activeLeaningOnly: finalizeBucket(
      buckets.activeLeaningOnly,
      unique.activeLeaningOnly,
      scenarios
        .filter((scenario) => scenario.expectedGapTargets.includes("active_leaning_only"))
        .map((scenario) => scenario.scenarioId)
    ),
    metadataIncomplete: finalizeBucket(
      buckets.metadataIncomplete,
      unique.metadataIncomplete,
      scenarios
        .filter((scenario) => scenario.expectedGapTargets.includes("metadata_incomplete"))
        .map((scenario) => scenario.scenarioId)
    ),
    serumCategory: finalizeBucket(
      buckets.serumCategory,
      unique.serumCategory,
      scenarios
        .filter((scenario) => scenario.expectedGapTargets.includes("serum_category"))
        .map((scenario) => scenario.scenarioId)
    ),
    strongCaution: finalizeBucket(
      buckets.strongCaution,
      unique.strongCaution,
      scenarios
        .filter((scenario) => scenario.expectedGapTargets.includes("strong_caution_metadata"))
        .map((scenario) => scenario.scenarioId)
    )
  };
}

function buildCannotObserveReasons(gapTargetAvailability) {
  const reasons = [];
  for (const [gap, value] of Object.entries(gapTargetAvailability)) {
    if (!value.availability) {
      reasons.push(`${gap}:not_available_in_current_complete_candidate_rows`);
    } else if (value.boundaryApplicableRows === 0) {
      reasons.push(`${gap}:available_but_not_boundary_applicable_in_current_captures`);
    }
  }
  return reasons.sort();
}

function buildExpectedObservableGap(gapTargetAvailability) {
  return Object.fromEntries(
    Object.entries(gapTargetAvailability).map(([gap, value]) => [
      gap,
      value.availability
        ? "targeted_dev_capture_may_help_if_existing_engine_routes_this_category"
        : "cannot_observe_without_candidate_source_or_product_distribution_expansion"
    ])
  );
}

function makeMarkdown(plan) {
  const gapRows = Object.entries(plan.gapTargetAvailability)
    .map(([gap, value]) => `| ${gap} | ${value.status} | ${value.candidateRowCount} | ${value.boundaryApplicableRows} | ${value.uniqueProductCount} |`)
    .join("\n");
  const scenarioRows = plan.proposedScenarios
    .map((scenario) => `| ${scenario.scenarioId} | ${scenario.form.primaryConcern} | ${scenario.form.sensitivity} | ${scenario.form.recentSkinChange}/${scenario.form.recentlyChangedProduct} | ${scenario.expectedGapTargets.join(", ")} |`)
    .join("\n");

  return `# Evaluator Boundary Target Capture Plan - 2026-07-03

This document is a target capture plan and, where available, dev-only actual capture collection note. It is not runtime policy approval.

## Scope

- Complete/product_row fixtures used: ${plan.sourceSummary.completeProductRowFixturesUsed}
- Candidate review rows inspected: ${plan.productDistributionSummary.candidateRowCount}
- Unique candidate products inspected: ${plan.productDistributionSummary.uniqueProductCount}
- Runtime mutation: ${plan.runtimeMutation}

## Gap Availability

| Gap | Status | Candidate rows | Boundary applicable rows | Unique products |
| --- | --- | ---: | ---: | ---: |
${gapRows}

## Proposed Scenarios

| Scenario | Primary concern | Sensitivity | Recent signals | Expected gaps |
| --- | --- | --- | --- | --- |
${scenarioRows}

## Dev Capture Execution

- Status: ${plan.devCaptureExecution.status}
- New complete/product_row captures: ${plan.devCaptureExecution.newCompleteProductRowCaptureCount}
- Reason: ${plan.devCaptureExecution.reason}

## Limitations

${plan.cannotObserveReasons.map((reason) => `- ${reason}`).join("\n") || "- No current distribution limitation was detected by the planner."}

Synthetic fixtures were not created or counted as actual evidence. Raw request data, images, direct commercial identifiers, and review text are not stored in this artifact.
`;
}

export async function buildEvaluatorBoundaryTargetCapturePlan({ generatedAt = new Date().toISOString() } = {}) {
  await ensureExposureAudit();
  const [exposureAudit, actualCoverage, captureSummary] = await Promise.all([
    readJsonIfPresent(EXPOSURE_AUDIT_PATH),
    ensureActualCoverage(),
    scanCaptures()
  ]);

  const rows = rowsFromExposureAudit(exposureAudit);
  const scenarios = buildScenarios();
  validateScenarioFields(scenarios);

  const productDistributionSummary = buildDistribution(rows);
  const gapTargetAvailability = buildGapAvailability(rows, scenarios);
  const cannotObserveReasons = buildCannotObserveReasons(gapTargetAvailability);
  const requiresDevCaptureRun = Object.values(gapTargetAvailability).some((gap) =>
    gap.availability && gap.boundaryApplicableRows === 0
  );

  const plan = {
    planVersion: "evaluator-boundary-target-capture-plan-v1",
    generatedAt,
    sourceSummary: {
      ...captureSummary,
      actualCoverageBoundaryApplicableRows: actualCoverage?.candidateSummary?.boundaryApplicableRows || 0,
      actualCoverageReviewedRows: actualCoverage?.candidateSummary?.reviewedRows || 0,
      syntheticFixturesUsed: false
    },
    productDistributionSummary,
    gapTargetAvailability,
    proposedScenarios: scenarios,
    expectedObservableGap: buildExpectedObservableGap(gapTargetAvailability),
    cannotObserveReasons,
    requiresDevCaptureRun,
    devCaptureExecution: {
      status: "capture_run_not_executed",
      reason: "No safe no-write dev API capture run was executed by this planner; use the documented dev-only capture flag and existing /api/analyze path after confirming local execution conditions.",
      requiredConditions: [
        "NODE_ENV=development",
        "FUNCTIONAL_SHADOW_CAPTURE=1",
        "Existing /api/analyze path only",
        "No product data mutation",
        "No fixture editing",
        "Response leak check for shadow/debug fields"
      ],
      newCompleteProductRowCaptureCount: 0,
      actualCoverageDelta: {
        completeProductRowFixtures: 0,
        boundaryApplicableRows: 0
      }
    },
    runtimeMutation: false
  };

  return sortDeep(plan);
}

async function main() {
  const plan = await buildEvaluatorBoundaryTargetCapturePlan();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_OUTPUT, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(MD_OUTPUT, makeMarkdown(plan), "utf8");

  console.log("Evaluator boundary target capture plan complete");
  console.log(`complete/product_row fixtures: ${plan.sourceSummary.completeProductRowFixturesUsed}`);
  console.log(`candidate rows inspected: ${plan.productDistributionSummary.candidateRowCount}`);
  console.log(`unique products inspected: ${plan.productDistributionSummary.uniqueProductCount}`);
  console.log("gap availability:");
  for (const [gap, value] of Object.entries(plan.gapTargetAvailability)) {
    console.log(`- ${gap}: ${value.status}, rows=${value.candidateRowCount}, boundary=${value.boundaryApplicableRows}`);
  }
  console.log(`dev capture execution: ${plan.devCaptureExecution.status}`);
  console.log(`wrote ${JSON_OUTPUT}`);
  console.log(`wrote ${MD_OUTPUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
