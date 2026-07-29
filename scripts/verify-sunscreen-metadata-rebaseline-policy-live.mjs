import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCandidatePolicyCurrentFindingsContext,
  validateCandidatePolicyCurrentFindingsContext
} from "../lib/candidate-policy-current-findings-context.js";
import {
  buildCandidatePolicyGoalContext,
  resolveCandidatePolicyGoalPolicy
} from "../lib/candidate-policy-goal-context.js";
import { buildCandidatePolicyRuntimeSafetyContext } from "../lib/candidate-policy-runtime-safety.js";
import { buildEvaluatorBoundaryPolicyRuntime } from "../lib/evaluator-boundary-policy-runtime.js";
import { buildEvaluatorBoundaryPolicyShadow } from "../lib/evaluator-boundary-policy-shadow.js";
import {
  evaluateFunctionalRankingCandidate,
  FUNCTIONAL_RANKING_GOAL_AXES
} from "../lib/functional-ranking-contract.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { buildProductDataSufficiencyAudit } from "../lib/product-data-sufficiency-audit.js";
import { resolveProductFunctionalProfile } from "../lib/product-functional-profile.js";
import { buildSurveyInputContract } from "../lib/survey-input-contract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "tmp", "sunscreen-metadata-rebaseline");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "sunscreen-metadata-rebaseline-policy-evidence.json");
const SOURCE_URL = "https://bygrczggxfuisupcevaz.supabase.co";
const SOURCE_KEY = "sb_publishable_siC-o2dSDTKrcXS7lJAHRA_tdNfWCPF";
const EXPECTED_ROWS = 164;
const EXPECTED_DATASET_HASH = "6c74785e7b7163a70fa2d47526ba4845a062bbd70486b01485da7cd4b5a1e978";
const FIXED_TIME = "2026-07-29T00:00:00.000Z";
const CONCERNS = [
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
];
const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const RANK = Object.freeze({ none: 0, low: 1, medium: 2, high: 3 });
let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => [key, stable(value[key])])
  );
}

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function productId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim();
}

async function fetchPage(offset, limit = 100) {
  const endpoint = new URL("/rest/v1/products", SOURCE_URL);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("order", "id.asc");
  endpoint.searchParams.set("offset", String(offset));
  endpoint.searchParams.set("limit", String(limit));
  const response = await fetch(endpoint, {
    headers: {
      apikey: SOURCE_KEY,
      Authorization: `Bearer ${SOURCE_KEY}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`catalog read failed: ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("catalog response was not an array");
  return rows;
}

async function fetchProducts() {
  const products = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchPage(offset, 100);
    products.push(...page);
    if (page.length < 100) break;
  }
  return products.sort((left, right) => productId(left).localeCompare(productId(right)));
}

function form({ requested = "dehydration", stabilizing = false } = {}) {
  return {
    skinType: "combination",
    sensitivity: stabilizing ? "high" : "low",
    mainConcerns: [requested],
    primaryConcern: requested,
    postWashFeeling: stabilizing ? "tight" : "comfortable",
    afternoonSkinChange: stabilizing ? "red_or_irritated" : "mostly_same",
    cleansingFrequency: "twice",
    environmentExposure: [],
    preferredTexture: "gel",
    mostDislikedFeel: "sticky",
    genderPreference: "unspecified",
    recentSkinChange: stabilizing ? "yes" : "no",
    recentlyChangedProduct: stabilizing ? "yes" : "no",
    sunscreenPreferenceState: "answered",
    whiteCastHate: false,
    toneUpWanted: false,
    makeupUse: false,
    eyeSensitive: false
  };
}

function concernScores(detected) {
  return Object.fromEntries(
    CONCERNS.map((axis) => [axis, { total: axis === detected ? 25 : 5 }])
  );
}

function selection(product) {
  return {
    category: product.category,
    status: "selected",
    productId: product.id,
    productSnapshot: structuredClone(product)
  };
}

function canonical({
  requested = "dehydration",
  detected = "dehydration",
  stabilizing = false,
  selections = []
} = {}) {
  const answers = form({ requested, stabilizing });
  const state = buildPremiumDecisionState({
    freeResult: {
      priority: { axis: detected, score: 25 },
      scoring: { concernScores: concernScores(detected) },
      answers
    },
    currentProducts: {
      selections: structuredClone(selections),
      summary: { total: selections.length }
    }
  }, {
    locale: "en",
    source: "sunscreen_metadata_rebaseline_policy_live"
  });
  const surveyContract = buildSurveyInputContract(answers, {
    source: "sunscreen_metadata_rebaseline_policy_live",
    generatedAt: FIXED_TIME
  });
  const sharedContext = state.decisionBundle.context;
  const candidateSafetyContext = buildCandidatePolicyRuntimeSafetyContext({
    sharedContext,
    functionalPolicy: state.rawPolicies.functional,
    effectivePolicySource: "raw"
  });
  const candidateGoalContext = buildCandidatePolicyGoalContext({
    surveyContract,
    sharedContext,
    functionalPolicy: state.functionalPolicy,
    effectivePolicySource: state.effectivePolicySource
  });
  const goalResolution = resolveCandidatePolicyGoalPolicy({
    candidateGoalContext,
    candidateSafetyContext,
    legacyGoalPolicy: {}
  });
  check(goalResolution.valid, "canonical goal context must resolve");
  return {
    requested,
    detected,
    stabilizing,
    state,
    surveyContract,
    sharedContext,
    candidateSafetyContext,
    candidateGoalContext,
    goalPolicy: goalResolution.goalPolicy,
    findingsContext: candidateGoalContext.currentFindingsContext
  };
}

function withFindingsContext(bundle, findingsContext) {
  const candidateGoalContext = structuredClone(bundle.candidateGoalContext);
  candidateGoalContext.currentFindingsContext = structuredClone(findingsContext);
  const goalResolution = resolveCandidatePolicyGoalPolicy({
    candidateGoalContext,
    candidateSafetyContext: bundle.candidateSafetyContext,
    legacyGoalPolicy: {}
  });
  check(goalResolution.valid, "replacement current findings context must resolve");
  return {
    ...bundle,
    candidateGoalContext,
    goalPolicy: goalResolution.goalPolicy,
    findingsContext
  };
}

function runtime(products, bundle) {
  return buildEvaluatorBoundaryPolicyRuntime({
    products,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.goalPolicy,
    candidateSafetyContext: bundle.candidateSafetyContext,
    candidateGoalContext: bundle.candidateGoalContext
  });
}

function shadow(products, bundle) {
  return buildEvaluatorBoundaryPolicyShadow({
    products,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.goalPolicy,
    candidateSafetyContext: bundle.candidateSafetyContext,
    candidateGoalContext: bundle.candidateGoalContext
  });
}

function exposureSignature(result) {
  return {
    policyApplicationStatus: result.policyApplicationStatus,
    visibleCandidateIds: result.visibleCandidateIds,
    exposureGroupCounts: result.exposureGroupCounts,
    rejectionReasonCounts: result.rejectionReasonCounts,
    safetyBlockReasonCounts: result.safetyBlockReasonCounts
  };
}

function profileRows(products) {
  return products.map((product) => ({
    product,
    id: productId(product),
    profile: resolveProductFunctionalProfile(product)
  }));
}

function supportsGoal(row, goal) {
  const goalAxes = FUNCTIONAL_RANKING_GOAL_AXES[goal] || [];
  return row.profile.evaluable === true &&
    !row.profile.cautionTags.includes("rinse_off_limit") &&
    row.profile.functionalAxes.some((axis) =>
      goalAxes.includes(axis.axis) &&
      (RANK[axis.strength] || 0) >= RANK.low &&
      (RANK[axis.confidence] || 0) >= RANK.medium &&
      !(
        axis.axis === "sunscreen_protection" &&
        (row.profile.categoryRole !== "protection" ||
          row.profile.cautionTags.includes("sunscreen_metadata_incomplete"))
      )
    );
}

function first(rows, predicate, label) {
  const found = rows.filter(predicate).sort((left, right) => left.id.localeCompare(right.id))[0];
  check(found, `${label} fixture must exist`);
  return found.product;
}

function firstTwo(rows, predicate, label) {
  const found = rows.filter(predicate).sort((left, right) => left.id.localeCompare(right.id)).slice(0, 2);
  equal(found.length, 2, `${label} requires two products`);
  return found.map((row) => row.product);
}

function relationFor(product, bundle) {
  return evaluateFunctionalRankingCandidate({
    product,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.goalPolicy,
    productProfile: resolveProductFunctionalProfile(product),
    currentProductFindings: bundle.findingsContext
  });
}

function scoreImpact(products, populatedBundle, emptyFindingsBundle) {
  let scoreChangedCount = 0;
  let relationChangedCount = 0;
  let sameProductCount = 0;
  let supportsExistingCount = 0;
  let duplicateAxisCount = 0;
  for (const product of products) {
    const populated = relationFor(product, populatedBundle);
    const empty = relationFor(product, emptyFindingsBundle);
    if (populated.totalScore !== empty.totalScore) scoreChangedCount += 1;
    if (populated.rankingContext.currentRoutineRelation !== empty.rankingContext.currentRoutineRelation) {
      relationChangedCount += 1;
    }
    if (populated.rankingContext.currentRoutineRelation === "same_product_already_selected") sameProductCount += 1;
    if (populated.rankingContext.currentRoutineRelation === "supports_goal_existing") supportsExistingCount += 1;
    if (populated.rankingContext.currentRoutineRelation === "duplicate_axis") duplicateAxisCount += 1;
  }
  return {
    scoreChangedCount,
    relationChangedCount,
    sameProductCount,
    supportsExistingCount,
    duplicateAxisCount
  };
}

function assertRuntimeShadowParity(products, bundle, label) {
  const runtimeResult = runtime(products, bundle);
  const shadowVisible = shadow(products, bundle).receivers
    .filter((receiver) => receiver.futureExposureGroup === "unchanged")
    .map((receiver) => receiver.productId);
  deepEqual(runtimeResult.visibleCandidateIds, shadowVisible, `${label} runtime/shadow parity`);
  return runtimeResult;
}

async function run() {
  const firstRead = await fetchProducts();
  const secondRead = await fetchProducts();
  equal(firstRead.length, EXPECTED_ROWS, "catalog rows");
  equal(secondRead.length, EXPECTED_ROWS, "catalog reread rows");
  equal(new Set(firstRead.map(productId)).size, EXPECTED_ROWS, "unique IDs");
  deepEqual(firstRead, secondRead, "ordered reads are identical");

  const products = firstRead;
  const audit = buildProductDataSufficiencyAudit(products, { sourceType: "raw_export" });
  equal(audit.dataset.datasetHash, EXPECTED_DATASET_HASH, "post-remediation dataset hash");
  equal(audit.status, "audit_complete", "audit complete");
  equal(audit.summary.transportCompleteCount, EXPECTED_ROWS, "transport complete");
  equal(audit.summary.criticalGapCount, 0, "critical gaps");
  equal(audit.summary.importantGapCount, 0, "important gaps");
  equal(audit.summary.qualityGapCount, 0, "quality gaps");

  const rows = profileRows(products);
  equal(rows.filter((row) => row.profile.evaluable).length, EXPECTED_ROWS, "all products evaluable");

  const hydrationProducts = firstTwo(
    rows,
    (row) => supportsGoal(row, "dehydration") && row.product.category !== "cleanser",
    "hydration support"
  );
  const differentHydration = first(
    rows,
    (row) => row.profile.evaluable && row.product.category !== "cleanser" && !supportsGoal(row, "dehydration"),
    "different goal"
  );
  const duplicateGoal = ["acne", "pores", "uneven_tone"].find((goal) =>
    rows.filter((row) => supportsGoal(row, goal) &&
      row.profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis.axis))).length >= 2
  );
  check(duplicateGoal, "duplicate active goal exists");
  const duplicateProducts = firstTwo(
    rows,
    (row) => supportsGoal(row, duplicateGoal) &&
      row.profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis.axis)),
    "duplicate active axis"
  );
  const requestedOnlyChoice = ["acne", "pores", "uneven_tone", "barrier", "redness", "oiliness", "uv"]
    .flatMap((goal) => rows
      .filter((row) => supportsGoal(row, goal) && !supportsGoal(row, "dehydration"))
      .map((row) => ({ goal, row })))
    .sort((left, right) => left.goal.localeCompare(right.goal) || left.row.id.localeCompare(right.row.id))[0];
  check(requestedOnlyChoice, "requested-only fixture exists");

  const empty = canonical();
  equal(empty.findingsContext.exposureState, "valid_empty", "empty findings state");
  equal(validateCandidatePolicyCurrentFindingsContext(empty.findingsContext).valid, true, "empty findings validates");
  assertRuntimeShadowParity(products, empty, "empty");

  const notUsing = canonical({ selections: [{ category: "treatment", status: "not_using" }] });
  equal(notUsing.findingsContext.exposureState, "not_using", "not_using state");
  const unanswered = canonical({ selections: [{ category: "treatment", status: "unanswered" }] });
  equal(unanswered.findingsContext.exposureState, "unanswered", "unanswered state");

  const supports = canonical({ selections: [selection(hydrationProducts[0])] });
  equal(supports.findingsContext.findings[0].relationToPlan, "supports_goal", "supports relation");
  const supportsEmpty = canonical({ requested: supports.requested, detected: supports.detected });
  const supportsWithoutFindings = withFindingsContext(supports, supportsEmpty.findingsContext);
  deepEqual(
    exposureSignature(assertRuntimeShadowParity(products, supports, "supports")),
    exposureSignature(runtime(products, supportsWithoutFindings)),
    "supports findings exposure no-op"
  );
  const supportsImpact = scoreImpact(products, supports, supportsWithoutFindings);
  check(supportsImpact.scoreChangedCount > 0, "supports changes ranking score");
  check(supportsImpact.relationChangedCount > 0, "supports changes ranking relation");
  equal(supportsImpact.sameProductCount, 1, "one same-product relation");
  check(supportsImpact.supportsExistingCount > 0, "supporting alternatives detected");

  const requestedOnly = canonical({
    requested: requestedOnlyChoice.goal,
    detected: "dehydration",
    selections: [selection(requestedOnlyChoice.row.product)]
  });
  equal(requestedOnly.candidateGoalContext.rankingGoal, "dehydration", "detected priority remains ranking goal");
  equal(requestedOnly.findingsContext.findings[0].relationToPlan, "different_goal", "requested-only remains different goal");

  const different = canonical({ selections: [selection(differentHydration)] });
  equal(different.findingsContext.findings[0].relationToPlan, "different_goal", "different goal relation");

  const duplicate = canonical({
    requested: duplicateGoal,
    detected: duplicateGoal,
    selections: duplicateProducts.map(selection)
  });
  equal(duplicate.findingsContext.summary.duplicateAxisCount, 2, "duplicate axis count");
  const duplicateEmpty = canonical({ requested: duplicateGoal, detected: duplicateGoal });
  const duplicateWithoutFindings = withFindingsContext(duplicate, duplicateEmpty.findingsContext);
  deepEqual(
    exposureSignature(runtime(products, duplicate)),
    exposureSignature(runtime(products, duplicateWithoutFindings)),
    "duplicate findings exposure no-op"
  );
  const duplicateImpact = scoreImpact(products, duplicate, duplicateWithoutFindings);
  check(duplicateImpact.duplicateAxisCount > 0, "duplicate axis affects ranking context");

  const notInDb = canonical({ selections: [{ category: "treatment", status: "not_in_db" }] });
  equal(notInDb.findingsContext.exposureState, "partial_unknown", "not_in_db state");
  const missingSnapshot = canonical({
    selections: [{ category: "treatment", status: "selected", productId: "missing-snapshot", productSnapshot: null }]
  });
  equal(missingSnapshot.findingsContext.findings[0].relationToPlan, "not_evaluable", "missing snapshot relation");

  const mixed = canonical({
    selections: [
      selection(hydrationProducts[0]),
      selection(differentHydration),
      { category: "sunscreen", status: "not_in_db" }
    ]
  });
  equal(mixed.findingsContext.summary.supportsRankingGoalCount, 1, "mixed supports count");
  equal(mixed.findingsContext.summary.differentGoalCount, 1, "mixed different count");
  equal(mixed.findingsContext.summary.notInDbCount, 1, "mixed unknown count");

  const uvEmpty = canonical({ requested: "uv", detected: "uv" });
  const uvRuntime = assertRuntimeShadowParity(products, uvEmpty, "uv-empty");
  const sunscreenRows = rows.filter((row) => row.product.category === "sunscreen");
  equal(sunscreenRows.length, 11, "sunscreen rows");
  equal(sunscreenRows.filter((row) => supportsGoal(row, "uv")).length, 11, "all sunscreen protection complete");
  equal(
    sunscreenRows.filter((row) => uvRuntime.visibleCandidateIds.includes(row.id)).length,
    11,
    "all sunscreen visible in neutral UV context"
  );
  const completeUv = canonical({
    requested: "uv",
    detected: "uv",
    selections: [selection(sunscreenRows[0].product)]
  });
  equal(completeUv.findingsContext.findings[0].relationToPlan, "supports_goal", "selected sunscreen supports UV");

  const stabilizing = canonical({
    requested: duplicateGoal,
    detected: duplicateGoal,
    stabilizing: true,
    selections: [selection(duplicateProducts[0])]
  });
  const stabilizingRuntime = assertRuntimeShadowParity(products, stabilizing, "stabilizing");
  const activeIds = rows
    .filter((row) => row.profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis.axis)))
    .map((row) => row.id);
  check(activeIds.length > 0, "active-axis candidates exist");
  equal(activeIds.filter((id) => stabilizingRuntime.visibleCandidateIds.includes(id)).length, 0, "stabilization blocks active exposure");

  const malformedGoalContext = structuredClone(supports.candidateGoalContext);
  malformedGoalContext.currentFindingsContext.summary.productCount += 1;
  const malformedRuntime = buildEvaluatorBoundaryPolicyRuntime({
    products,
    surveyContract: supports.surveyContract,
    goalPolicy: supports.goalPolicy,
    candidateSafetyContext: supports.candidateSafetyContext,
    candidateGoalContext: malformedGoalContext
  });
  equal(malformedRuntime.policyApplicationStatus, "blocked_goal_context", "tampered findings fail closed");
  equal(malformedRuntime.visibleCandidateIds.length, 0, "tampered findings expose none");

  const sourceProbe = structuredClone(supports.sharedContext);
  const sourceHashBefore = semanticHash(sourceProbe);
  buildCandidatePolicyCurrentFindingsContext({
    sharedContext: sourceProbe,
    functionalPolicy: supports.state.functionalPolicy
  });
  equal(semanticHash(sourceProbe), sourceHashBefore, "findings projection is immutable");

  const scenarioBundles = [
    ["not_using", notUsing],
    ["unanswered", unanswered],
    ["supports", supports],
    ["requested_only", requestedOnly],
    ["different", different],
    ["duplicate", duplicate],
    ["not_in_db", notInDb],
    ["missing_snapshot", missingSnapshot],
    ["mixed", mixed],
    ["complete_uv", completeUv],
    ["stabilizing", stabilizing]
  ];
  let unexpectedExposureDriftCount = 0;
  let runtimeShadowDivergenceCount = 0;
  const scenarioEvidence = [];
  for (const [id, bundle] of scenarioBundles) {
    const emptyTwin = canonical({
      requested: bundle.requested,
      detected: bundle.detected,
      stabilizing: bundle.stabilizing
    });
    equal(bundle.candidateGoalContext.rankingGoal, emptyTwin.candidateGoalContext.rankingGoal, `${id} ranking goal invariant`);
    const populatedRuntime = runtime(products, bundle);
    const emptyContextRuntime = runtime(products, withFindingsContext(bundle, emptyTwin.findingsContext));
    if (semanticHash(exposureSignature(populatedRuntime)) !== semanticHash(exposureSignature(emptyContextRuntime))) {
      unexpectedExposureDriftCount += 1;
    }
    const shadowVisible = shadow(products, bundle).receivers
      .filter((receiver) => receiver.futureExposureGroup === "unchanged")
      .map((receiver) => receiver.productId);
    if (semanticHash(populatedRuntime.visibleCandidateIds) !== semanticHash(shadowVisible)) {
      runtimeShadowDivergenceCount += 1;
    }
    scenarioEvidence.push({
      id,
      exposureState: bundle.findingsContext.exposureState,
      relationCounts: bundle.findingsContext.summary,
      visibleCount: populatedRuntime.visibleCandidateIds.length,
      removedCount: populatedRuntime.candidateCounts.removed,
      exposureHash: semanticHash(exposureSignature(populatedRuntime))
    });
  }
  equal(unexpectedExposureDriftCount, 0, "no Current Findings exposure drift");
  equal(runtimeShadowDivergenceCount, 0, "runtime/shadow divergence count");

  const evidenceCore = {
    datasetHash: audit.dataset.datasetHash,
    supportsImpact,
    duplicateImpact,
    scenarioEvidence,
    sunscreen: {
      total: sunscreenRows.length,
      protectionComplete: sunscreenRows.filter((row) => supportsGoal(row, "uv")).length,
      neutralVisible: sunscreenRows.filter((row) => uvRuntime.visibleCandidateIds.includes(row.id)).length
    },
    stabilization: {
      activeSourceCount: activeIds.length,
      activeVisibleCount: 0
    }
  };
  const firstSemanticHash = semanticHash(evidenceCore);
  equal(firstSemanticHash, semanticHash(structuredClone(evidenceCore)), "policy replay deterministic");

  const result = {
    status: "SUNSCREEN_METADATA_REMEDIATION_REBASELINED_NO_REGRESSION",
    source: "production_public_products_select_only",
    rows: products.length,
    datasetHash: audit.dataset.datasetHash,
    auditStatus: audit.status,
    transportComplete: audit.summary.transportCompleteCount,
    gaps: {
      critical: audit.summary.criticalGapCount,
      important: audit.summary.importantGapCount,
      quality: audit.summary.qualityGapCount
    },
    supportsImpact,
    duplicateImpact,
    scenarioCount: scenarioBundles.length,
    unexpectedExposureDriftCount,
    runtimeShadowDivergenceCount,
    sunscreen: evidenceCore.sunscreen,
    stabilization: evidenceCore.stabilization,
    assertions,
    semanticHash: firstSemanticHash
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
}

await run();
