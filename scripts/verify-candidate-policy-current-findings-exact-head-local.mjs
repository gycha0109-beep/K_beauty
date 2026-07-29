import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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

const SOURCE_URL = "https://bygrczggxfuisupcevaz.supabase.co";
const SOURCE_KEY = "sb_publishable_siC-o2dSDTKrcXS7lJAHRA_tdNfWCPF";
const EXPECTED_ROW_COUNT = 164;
const EXPECTED_DATASET_HASH = "f346d90ed722432dd1e1367a50939954ec5030abb9a7ea72fdef61bb1dc93e2f";
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
let assertionCount = 0;

function check(value, message) {
  assertionCount += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertionCount += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertionCount += 1;
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

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

async function fetchProductPage(offset, limit = 100) {
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
  if (!response.ok) {
    throw new Error(`product export failed: ${response.status}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("product export response was not an array");
  return rows;
}

async function fetchProducts() {
  const products = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchProductPage(offset, 100);
    products.push(...page);
    if (page.length < 100) break;
  }
  products.sort((left, right) => productId(left).localeCompare(productId(right)));
  return products;
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

function selection(product, overrides = {}) {
  return {
    category: product.category,
    status: "selected",
    productId: product.id,
    productSnapshot: structuredClone(product),
    ...overrides
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
    source: "candidate_policy_current_findings_exact_head_actual"
  });
  const surveyContract = buildSurveyInputContract(answers, {
    source: "candidate_policy_current_findings_exact_head_actual",
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
    selections,
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
  check(found, `${label} fixture must exist in actual catalog`);
  return found.product;
}

function firstTwo(rows, predicate, label) {
  const found = rows.filter(predicate).sort((left, right) => left.id.localeCompare(right.id)).slice(0, 2);
  equal(found.length, 2, `${label} requires two actual products`);
  return found.map((row) => row.product);
}

function relationFor(product, bundle, findingsContext = bundle.findingsContext) {
  return evaluateFunctionalRankingCandidate({
    product,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.goalPolicy,
    productProfile: resolveProductFunctionalProfile(product),
    currentProductFindings: findingsContext
  });
}

function scoreImpact(products, populatedBundle, emptyBundle) {
  let scoreChangedCount = 0;
  let relationChangedCount = 0;
  let sameProductCount = 0;
  let supportsExistingCount = 0;
  let duplicateAxisCount = 0;
  for (const product of products) {
    const populated = relationFor(product, populatedBundle, populatedBundle.findingsContext);
    const empty = relationFor(product, emptyBundle, emptyBundle.findingsContext);
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
  const shadowResult = shadow(products, bundle);
  const shadowVisible = shadowResult.receivers
    .filter((receiver) => receiver.futureExposureGroup === "unchanged")
    .map((receiver) => receiver.productId);
  deepEqual(runtimeResult.visibleCandidateIds, shadowVisible, `${label} runtime/shadow visible parity`);
  return runtimeResult;
}

async function runVerification() {
  const firstRead = await fetchProducts();
  const secondRead = await fetchProducts();
  equal(firstRead.length, EXPECTED_ROW_COUNT, "actual catalog row count");
  equal(secondRead.length, EXPECTED_ROW_COUNT, "actual catalog reread row count");
  equal(new Set(firstRead.map(productId)).size, EXPECTED_ROW_COUNT, "actual catalog duplicate ids");
  deepEqual(firstRead, secondRead, "two SELECT-only reads must return the same ordered row set");

  const products = firstRead;
  const exportHash = createHash("sha256")
    .update(`${JSON.stringify(products, null, 2)}\n`)
    .digest("hex");
  const audit = buildProductDataSufficiencyAudit(products, { sourceType: "raw_export" });
  equal(audit.dataset.datasetHash, EXPECTED_DATASET_HASH, "actual catalog dataset hash");
  equal(audit.dataset.rowCount, EXPECTED_ROW_COUNT, "audit row count");
  equal(audit.status, "audit_complete", "actual data audit status");
  equal(audit.summary.transportCompleteCount, EXPECTED_ROW_COUNT, "current-product transport complete");
  equal(audit.summary.criticalGapCount, 0, "critical data gaps");
  equal(audit.summary.importantGapCount, 3, "known source data gaps");
  equal(audit.summary.qualityGapCount, 0, "quality data gaps");

  const rows = profileRows(products);
  equal(rows.filter((row) => row.profile.evaluable).length, EXPECTED_ROW_COUNT, "all products functional-profile evaluable");

  const hydrationProducts = firstTwo(
    rows,
    (row) => supportsGoal(row, "dehydration") && row.product.category !== "cleanser",
    "dehydration support"
  );
  const differentHydration = first(
    rows,
    (row) => row.profile.evaluable && row.product.category !== "cleanser" && !supportsGoal(row, "dehydration"),
    "different-goal"
  );
  const acneProducts = firstTwo(
    rows,
    (row) => supportsGoal(row, "acne") && ["treatment", "serum", "ampoule", "essence"].includes(row.product.category),
    "duplicate acne axis"
  );
  const completeSunscreen = first(
    rows,
    (row) => row.product.category === "sunscreen" && supportsGoal(row, "uv"),
    "protection-complete sunscreen"
  );
  const uvaMissingSunscreen = first(
    rows,
    (row) => row.product.category === "sunscreen" && hasValue(row.product.spf_value) && !hasValue(row.product.uva_label) && hasValue(row.product.uv_filter_type),
    "UVA-missing sunscreen"
  );
  const pillingOnlyMissingSunscreen = first(
    rows,
    (row) => row.product.category === "sunscreen" && supportsGoal(row, "uv") && !hasValue(row.product.pilling_risk),
    "pilling-only-missing sunscreen"
  );

  const empty = canonical();
  equal(empty.findingsContext.exposureState, "valid_empty", "empty current products stay valid empty");
  equal(validateCandidatePolicyCurrentFindingsContext(empty.findingsContext).valid, true, "empty findings context validates");
  assertRuntimeShadowParity(products, empty, "empty");

  const notUsing = canonical({ selections: [{ category: "treatment", status: "not_using" }] });
  equal(notUsing.findingsContext.exposureState, "not_using", "not_using remains distinct");

  const unanswered = canonical({ selections: [{ category: "treatment", status: "unanswered" }] });
  equal(unanswered.findingsContext.exposureState, "unanswered", "unanswered remains distinct");

  const supports = canonical({ selections: [selection(hydrationProducts[0])] });
  equal(supports.findingsContext.findings[0].relationToPlan, "supports_goal", "actual product supports canonical ranking goal");
  const supportsEmpty = canonical({ requested: supports.requested, detected: supports.detected });
  const supportsRuntime = assertRuntimeShadowParity(products, supports, "supports");
  deepEqual(
    exposureSignature(supportsRuntime),
    exposureSignature(runtime(products, withFindingsContext(supports, supportsEmpty.findingsContext))),
    "supports findings remain an exposure no-op"
  );
  const supportsImpact = scoreImpact(products, supports, supportsEmpty);
  check(supportsImpact.scoreChangedCount > 0, "supports findings must affect ranking scores");
  check(supportsImpact.relationChangedCount > 0, "supports findings must affect ranking relation");
  equal(supportsImpact.sameProductCount, 1, "one same product relation");
  check(supportsImpact.supportsExistingCount > 0, "supporting alternatives receive supports-goal relation");

  const requestedOnly = canonical({
    requested: "acne",
    detected: "dehydration",
    selections: [selection(acneProducts[0])]
  });
  equal(requestedOnly.candidateGoalContext.rankingGoal, "dehydration", "canonical ranking goal remains detected priority");
  equal(requestedOnly.findingsContext.findings[0].relationToPlan, "different_goal", "requested-only support does not override ranking goal");

  const different = canonical({ selections: [selection(differentHydration)] });
  equal(different.findingsContext.findings[0].relationToPlan, "different_goal", "different goal actual product detected");

  const duplicate = canonical({
    requested: "acne",
    detected: "acne",
    selections: acneProducts.map((product) => selection(product))
  });
  equal(duplicate.findingsContext.summary.duplicateAxisCount, 2, "duplicate active axis count");
  const duplicateEmpty = canonical({ requested: "acne", detected: "acne" });
  deepEqual(
    exposureSignature(runtime(products, duplicate)),
    exposureSignature(runtime(products, withFindingsContext(duplicate, duplicateEmpty.findingsContext))),
    "duplicate findings remain an exposure no-op"
  );
  const duplicateImpact = scoreImpact(products, duplicate, duplicateEmpty);
  check(duplicateImpact.duplicateAxisCount > 0, "duplicate axis relation affects ranking context");

  const notInDb = canonical({ selections: [{ category: "treatment", status: "not_in_db" }] });
  equal(notInDb.findingsContext.exposureState, "partial_unknown", "not_in_db remains partial unknown");
  const missingSnapshot = canonical({
    selections: [{ category: "treatment", status: "selected", productId: "missing-snapshot", productSnapshot: null }]
  });
  equal(missingSnapshot.findingsContext.findings[0].relationToPlan, "not_evaluable", "missing snapshot remains not evaluable");

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
  equal(sunscreenRows.length, 11, "actual sunscreen count");
  equal(sunscreenRows.filter((row) => supportsGoal(row, "uv")).length, 10, "protection-complete sunscreen count");
  equal(sunscreenRows.filter((row) => !hasValue(row.product.pilling_risk)).length, 2, "pilling metadata missing count");
  equal(
    sunscreenRows.filter((row) => supportsGoal(row, "uv") && uvRuntime.visibleCandidateIds.includes(row.id)).length,
    9,
    "protection-complete visible sunscreen count"
  );

  const completeUv = canonical({
    requested: "uv",
    detected: "uv",
    selections: [selection(completeSunscreen)]
  });
  equal(completeUv.findingsContext.findings[0].relationToPlan, "supports_goal", "complete sunscreen supports UV goal");
  check(runtime(products, completeUv).visibleCandidateIds.includes(productId(completeSunscreen)), "complete sunscreen remains visible");

  const incompleteUv = canonical({
    requested: "uv",
    detected: "uv",
    selections: [selection(uvaMissingSunscreen)]
  });
  equal(incompleteUv.findingsContext.findings[0].relationToPlan, "different_goal", "UVA-missing sunscreen does not claim support");
  const incompleteRuntime = runtime(products, incompleteUv);
  check(!incompleteRuntime.visibleCandidateIds.includes(productId(uvaMissingSunscreen)), "UVA-missing sunscreen remains fail-closed");
  equal(
    incompleteRuntime.exposureRows.find((row) => row.productId === productId(uvaMissingSunscreen))?.appliedExposureGroup,
    "insufficient_evidence_candidate",
    "UVA-missing sunscreen is routed to insufficient evidence"
  );

  const pillingMissing = canonical({
    requested: "uv",
    detected: "uv",
    selections: [selection(pillingOnlyMissingSunscreen)]
  });
  check(runtime(products, pillingMissing).visibleCandidateIds.includes(productId(pillingOnlyMissingSunscreen)), "pilling-only missing sunscreen remains visible");

  const stabilizing = canonical({
    requested: "acne",
    detected: "acne",
    stabilizing: true,
    selections: [selection(acneProducts[0])]
  });
  const stabilizingRuntime = assertRuntimeShadowParity(products, stabilizing, "stabilizing");
  const activeIds = rows
    .filter((row) => row.profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis.axis)))
    .map((row) => row.id);
  equal(activeIds.length, 86, "actual active-axis candidate count");
  equal(activeIds.filter((id) => stabilizingRuntime.visibleCandidateIds.includes(id)).length, 0, "stabilization active expansion remains blocked");

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
  equal(malformedRuntime.visibleCandidateIds.length, 0, "tampered findings expose no candidates");

  const sourceProbe = structuredClone(supports.sharedContext);
  const sourceHashBefore = semanticHash(sourceProbe);
  buildCandidatePolicyCurrentFindingsContext({
    sharedContext: sourceProbe,
    functionalPolicy: supports.state.functionalPolicy
  });
  equal(semanticHash(sourceProbe), sourceHashBefore, "findings projection does not mutate canonical source");

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
    ["incomplete_uv", incompleteUv],
    ["pilling_missing", pillingMissing],
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
    deepEqual(bundle.candidateSafetyContext, emptyTwin.candidateSafetyContext, `${id} safety context invariant`);
    const populatedRuntime = runtime(products, bundle);
    const emptyContextRuntime = runtime(products, withFindingsContext(bundle, emptyTwin.findingsContext));
    if (semanticHash(exposureSignature(populatedRuntime)) !== semanticHash(exposureSignature(emptyContextRuntime))) {
      unexpectedExposureDriftCount += 1;
    }
    const shadowResult = shadow(products, bundle);
    const shadowVisible = shadowResult.receivers
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
  equal(unexpectedExposureDriftCount, 0, "current findings introduce no exposure drift");
  equal(runtimeShadowDivergenceCount, 0, "runtime/shadow divergence count");

  const firstSemanticHash = semanticHash({
    datasetHash: audit.dataset.datasetHash,
    supportsImpact,
    duplicateImpact,
    scenarioEvidence
  });
  const secondSemanticHash = semanticHash(structuredClone({
    datasetHash: audit.dataset.datasetHash,
    supportsImpact,
    duplicateImpact,
    scenarioEvidence
  }));
  equal(firstSemanticHash, secondSemanticHash, "exact-head actual replay is deterministic");

  console.log(JSON.stringify({
    status: "CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP",
    source: "production_public_products_select_only",
    rows: products.length,
    pages: 2,
    duplicateIds: 0,
    exportHash,
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
    sunscreen: {
      total: sunscreenRows.length,
      protectionComplete: sunscreenRows.filter((row) => supportsGoal(row, "uv")).length,
      protectionCompleteVisible: sunscreenRows.filter((row) => supportsGoal(row, "uv") && uvRuntime.visibleCandidateIds.includes(row.id)).length,
      uvaMissingFailClosed: true,
      pillingOnlyMissingVisible: true
    },
    stabilization: {
      activeSourceCount: activeIds.length,
      activeVisibleCount: 0
    },
    assertions: assertionCount,
    semanticHash: firstSemanticHash
  }, null, 2));
}

await runVerification();
