import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
const EXPECTED_BASE_SHA = "f321dcd49d60acec506d414714b893059952ffab";
const EXPECTED_ROW_COUNT = 164;
const EXPECTED_RAW_EXPORT_SHA256 = "2b16bd7c66aa719367cb9a5cd422a40d57ccf2296b780e931892b4d5325aeed6";
const EXPECTED_DATASET_HASH = "f346d90ed722432dd1e1367a50939954ec5030abb9a7ea72fdef61bb1dc93e2f";
const DEFAULT_INPUT = path.join("_local_data", "products-raw-export.json");
const OUTPUT_PATH = path.join(ROOT, "tmp", "preserved-product-export-exact-gate.json");
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") {
      args.input = argv[index + 1] || "";
      index += 1;
    }
  }
  return args;
}

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true
  });
  if (!allowFailure && (result.status !== 0 || result.error)) {
    throw result.error || new Error(`git ${args.join(" ")} failed`);
  }
  return {
    status: result.status,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim()
  };
}

function verifyRepositoryBoundary() {
  const headSha = runGit(["rev-parse", "HEAD"]).stdout;
  equal(runGit(["status", "--short", "--untracked-files=no"]).stdout, "", "tracked working tree must be clean");
  const ancestor = runGit(["merge-base", "--is-ancestor", EXPECTED_BASE_SHA, "HEAD"], {
    allowFailure: true
  });
  equal(ancestor.status, 0, "PR #83 exact head must be an ancestor of the current head");

  const changedFiles = runGit(["diff", "--name-only", `${EXPECTED_BASE_SHA}..HEAD`]).stdout
    .split(/\r?\n/)
    .filter(Boolean);
  const forbidden = changedFiles.filter(
    (file) => ![
      "docs/architecture/candidate-policy-current-findings-exact-head-local-verification.md",
      "scripts/verify-preserved-product-export-exact-gate.mjs"
    ].includes(file)
  );
  deepEqual(forbidden, [], "Production code changed after PR #83 exact head");

  return { headSha, changedFiles };
}

function readProducts(inputPath) {
  check(existsSync(inputPath), `input file not found: ${path.basename(inputPath)}`);
  const bytes = readFileSync(inputPath);
  const rawExportSha256 = sha256(bytes);
  equal(rawExportSha256, EXPECTED_RAW_EXPORT_SHA256, "preserved raw export SHA-256");

  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text);
  const products = Array.isArray(parsed) ? parsed : parsed?.products;
  check(Array.isArray(products), "input must be a JSON array or an object containing products");

  const ordered = structuredClone(products).sort((left, right) =>
    productId(left).localeCompare(productId(right))
  );
  return { products: ordered, rawExportSha256 };
}

function productId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim();
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
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
    source: "candidate_policy_preserved_export_exact_gate"
  });
  const surveyContract = buildSurveyInputContract(answers, {
    source: "candidate_policy_preserved_export_exact_gate",
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
  check(found, `${label} fixture must exist in preserved export`);
  return found.product;
}

function firstTwo(rows, predicate, label) {
  const found = rows.filter(predicate).sort((left, right) => left.id.localeCompare(right.id)).slice(0, 2);
  equal(found.length, 2, `${label} requires two products in preserved export`);
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
  const shadowResult = shadow(products, bundle);
  const shadowVisible = shadowResult.receivers
    .filter((receiver) => receiver.futureExposureGroup === "unchanged")
    .map((receiver) => receiver.productId);
  deepEqual(runtimeResult.visibleCandidateIds, shadowVisible, `${label} runtime/shadow visible parity`);
  return runtimeResult;
}

function executeGate(inputPath) {
  const repository = verifyRepositoryBoundary();
  const { products, rawExportSha256 } = readProducts(inputPath);

  equal(products.length, EXPECTED_ROW_COUNT, "preserved export row count");
  equal(new Set(products.map(productId)).size, EXPECTED_ROW_COUNT, "preserved export unique product ids");

  const audit = buildProductDataSufficiencyAudit(products, { sourceType: "raw_export" });
  equal(audit.dataset.datasetHash, EXPECTED_DATASET_HASH, "preserved export dataset hash");
  equal(audit.dataset.rowCount, EXPECTED_ROW_COUNT, "audit row count");
  equal(audit.status, "audit_complete", "preserved export audit status");
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
  const duplicateGoal = ["acne", "pores", "uneven_tone"].find((goal) =>
    rows.filter((row) =>
      supportsGoal(row, goal) &&
      row.profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis.axis))
    ).length >= 2
  );
  check(duplicateGoal, "duplicate active goal must exist in preserved export");
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
  check(requestedOnlyChoice, "requested-only fixture must exist in preserved export");

  const completeSunscreen = first(
    rows,
    (row) => row.product.category === "sunscreen" && supportsGoal(row, "uv"),
    "protection-complete sunscreen"
  );
  const uvaMissingSunscreen = first(
    rows,
    (row) => row.product.category === "sunscreen" &&
      hasValue(row.product.spf_value) &&
      !hasValue(row.product.uva_label) &&
      hasValue(row.product.uv_filter_type),
    "UVA-missing sunscreen"
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
  const supportsWithoutFindings = withFindingsContext(supports, supportsEmpty.findingsContext);
  const supportsRuntime = assertRuntimeShadowParity(products, supports, "supports");
  deepEqual(
    exposureSignature(supportsRuntime),
    exposureSignature(runtime(products, supportsWithoutFindings)),
    "supports findings remain an exposure no-op"
  );
  const supportsImpact = scoreImpact(products, supports, supportsWithoutFindings);
  check(supportsImpact.scoreChangedCount > 0, "supports findings must affect ranking scores");
  check(supportsImpact.relationChangedCount > 0, "supports findings must affect ranking relation");
  equal(supportsImpact.sameProductCount, 1, "one same product relation");
  check(supportsImpact.supportsExistingCount > 0, "supporting alternatives receive supports-goal relation");

  const requestedOnly = canonical({
    requested: requestedOnlyChoice.goal,
    detected: "dehydration",
    selections: [selection(requestedOnlyChoice.row.product)]
  });
  equal(requestedOnly.candidateGoalContext.rankingGoal, "dehydration", "canonical ranking goal remains detected priority");
  equal(requestedOnly.findingsContext.findings[0].relationToPlan, "different_goal", "requested-only support does not override ranking goal");

  const different = canonical({ selections: [selection(differentHydration)] });
  equal(different.findingsContext.findings[0].relationToPlan, "different_goal", "different goal product detected");

  const duplicate = canonical({
    requested: duplicateGoal,
    detected: duplicateGoal,
    selections: duplicateProducts.map((product) => selection(product))
  });
  equal(duplicate.findingsContext.summary.duplicateAxisCount, 2, "duplicate active axis count");
  const duplicateEmpty = canonical({ requested: duplicateGoal, detected: duplicateGoal });
  const duplicateWithoutFindings = withFindingsContext(duplicate, duplicateEmpty.findingsContext);
  deepEqual(
    exposureSignature(runtime(products, duplicate)),
    exposureSignature(runtime(products, duplicateWithoutFindings)),
    "duplicate findings remain an exposure no-op"
  );
  const duplicateImpact = scoreImpact(products, duplicate, duplicateWithoutFindings);
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
  equal(sunscreenRows.length, 11, "preserved sunscreen count");
  equal(sunscreenRows.filter((row) => supportsGoal(row, "uv")).length, 10, "protection-complete sunscreen count");
  equal(sunscreenRows.filter((row) => !hasValue(row.product.pilling_risk)).length, 2, "pilling metadata missing count");
  equal(
    sunscreenRows.filter((row) => supportsGoal(row, "uv") && uvRuntime.visibleCandidateIds.includes(row.id)).length,
    sunscreenRows.filter((row) => supportsGoal(row, "uv")).length,
    "all protection-complete sunscreen rows remain visible under neutral UV context"
  );

  const pillingVisibleIds = new Set(uvRuntime.visibleCandidateIds);
  const pillingOnlyMissingSunscreen = first(
    rows,
    (row) => row.product.category === "sunscreen" &&
      supportsGoal(row, "uv") &&
      !hasValue(row.product.pilling_risk) &&
      pillingVisibleIds.has(row.id),
    "pilling-only-missing visible sunscreen"
  );

  const completeUv = canonical({
    requested: "uv",
    detected: "uv",
    selections: [selection(completeSunscreen)]
  });
  equal(completeUv.findingsContext.findings[0].relationToPlan, "supports_goal", "complete sunscreen supports UV goal");

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
  const pillingWithoutFindings = withFindingsContext(pillingMissing, uvEmpty.findingsContext);
  deepEqual(
    exposureSignature(runtime(products, pillingMissing)),
    exposureSignature(runtime(products, pillingWithoutFindings)),
    "pilling-only missing selection remains a findings exposure no-op"
  );

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
  equal(activeIds.length, 86, "preserved active-axis candidate count");
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

  const evidence = {
    datasetHash: audit.dataset.datasetHash,
    supportsImpact,
    duplicateImpact,
    scenarioEvidence
  };
  const firstSemanticHash = semanticHash(evidence);
  equal(firstSemanticHash, semanticHash(structuredClone(evidence)), "preserved export replay is deterministic");

  return {
    status: "CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP",
    source: "preserved_local_export_read_only",
    repository: {
      baseSha: EXPECTED_BASE_SHA,
      headSha: repository.headSha,
      changedFiles: repository.changedFiles
    },
    input: {
      basename: path.basename(inputPath),
      rawExportSha256,
      datasetHash: audit.dataset.datasetHash,
      rows: products.length,
      duplicateIds: 0
    },
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
      pillingSelectionFindingsExposureNoop: true
    },
    stabilization: {
      activeSourceCount: activeIds.length,
      activeVisibleCount: 0
    },
    assertions: assertionCount,
    semanticHash: firstSemanticHash
  };
}

const args = parseArgs(process.argv.slice(2));
const inputPath = path.isAbsolute(args.input || "")
  ? path.resolve(args.input)
  : path.resolve(ROOT, args.input || DEFAULT_INPUT);
mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

try {
  const result = executeGate(inputPath);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const failure = {
    status: "PRECONDITION_FAILURE",
    input: { basename: path.basename(inputPath) },
    reason: error instanceof Error ? error.message : String(error),
    assertions: assertionCount
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
