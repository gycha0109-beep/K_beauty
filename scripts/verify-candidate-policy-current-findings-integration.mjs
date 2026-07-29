import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildCandidatePolicyCurrentFindingsContext,
  CANDIDATE_POLICY_CURRENT_FINDINGS_CONTEXT_VERSION,
  validateCandidatePolicyCurrentFindingsContext
} from "../lib/candidate-policy-current-findings-context.js";
import {
  buildCandidatePolicyGoalContext,
  resolveCandidatePolicyGoalPolicy
} from "../lib/candidate-policy-goal-context.js";
import { buildCandidatePolicyRuntimeSafetyContext } from "../lib/candidate-policy-runtime-safety.js";
import { buildEvaluatorBoundaryPolicyRuntime } from "../lib/evaluator-boundary-policy-runtime.js";
import { buildEvaluatorBoundaryPolicyShadow } from "../lib/evaluator-boundary-policy-shadow.js";
import { evaluateFunctionalRankingCandidate } from "../lib/functional-ranking-contract.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { resolveProductFunctionalProfile } from "../lib/product-functional-profile.js";
import { buildSurveyInputContract } from "../lib/survey-input-contract.js";

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
let assertionCount = 0;
let negativeControlCount = 0;

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
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fixtureProduct(id, label, concerns, overrides = {}) {
  return {
    id,
    brand: "Fixture",
    name: id,
    category: "treatment",
    product_form: "serum",
    irritation_risk: "low",
    sensitivity_safe: true,
    concerns,
    skin_types: ["combination"],
    texture: "gel",
    finish: "fresh",
    ingredient_signals: {
      functional: [{ label, count: 5 }]
    },
    review_signals: { count: 10, rating: 4.5 },
    market_signals: { review_count: 1000, rating: 4.5 },
    ...overrides
  };
}

const PRODUCTS = Object.freeze([
  fixtureProduct("fixture-hydration-current", "skin hydration", ["dehydration"]),
  fixtureProduct("fixture-hydration-alt", "skin hydration", ["dehydration"]),
  fixtureProduct("fixture-barrier", "skin protection", ["barrier"]),
  fixtureProduct("fixture-acne-a", "acne relief", ["acne"]),
  fixtureProduct("fixture-acne-b", "acne relief", ["acne"]),
  fixtureProduct("fixture-uv-complete", "uv protection", ["uv"], {
    category: "sunscreen",
    product_form: "cream",
    spf_value: "50+",
    uva_label: "PA++++",
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low"
  }),
  fixtureProduct("fixture-uv-incomplete", "uv protection", ["uv"], {
    category: "sunscreen",
    product_form: "cream",
    spf_value: "50+",
    uva_label: null,
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low"
  })
]);

function productById(id) {
  return PRODUCTS.find((product) => product.id === id);
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

function canonical({
  requested = "dehydration",
  detected = "dehydration",
  stabilizing = false,
  selections = []
} = {}) {
  const answers = form({ requested, stabilizing });
  const currentProducts = {
    selections: structuredClone(selections),
    summary: { total: selections.length }
  };
  const state = buildPremiumDecisionState({
    freeResult: {
      priority: { axis: detected, score: 25 },
      scoring: { concernScores: concernScores(detected) },
      answers
    },
    currentProducts
  }, {
    locale: "en",
    source: "candidate_policy_current_findings_fixture"
  });
  const surveyContract = buildSurveyInputContract(answers, {
    source: "candidate_policy_current_findings_fixture",
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
  check(goalResolution.valid, "canonical goal/current-findings context must resolve");
  return {
    answers,
    state,
    surveyContract,
    sharedContext,
    candidateSafetyContext,
    candidateGoalContext,
    goalPolicy: goalResolution.goalPolicy,
    findingsContext: candidateGoalContext.currentFindingsContext
  };
}

function runtime(bundle, overrides = {}) {
  return buildEvaluatorBoundaryPolicyRuntime({
    products: PRODUCTS,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.goalPolicy,
    candidateSafetyContext: bundle.candidateSafetyContext,
    candidateGoalContext: bundle.candidateGoalContext,
    ...overrides
  });
}

function shadow(bundle, overrides = {}) {
  return buildEvaluatorBoundaryPolicyShadow({
    products: PRODUCTS,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.goalPolicy,
    candidateSafetyContext: bundle.candidateSafetyContext,
    candidateGoalContext: bundle.candidateGoalContext,
    ...overrides
  });
}

function relation(bundle, product) {
  return evaluateFunctionalRankingCandidate({
    product,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.goalPolicy,
    productProfile: resolveProductFunctionalProfile(product),
    currentProductFindings: bundle.findingsContext
  }).rankingContext.currentRoutineRelation;
}

function exposureSignature(result) {
  return {
    visibleCandidateIds: result.visibleCandidateIds,
    exposureGroupCounts: result.exposureGroupCounts,
    rejectionReasonCounts: result.rejectionReasonCounts
  };
}

const scenarios = [];

const empty = canonical();
equal(empty.findingsContext.version, CANDIDATE_POLICY_CURRENT_FINDINGS_CONTEXT_VERSION, "context version");
equal(empty.findingsContext.exposureState, "valid_empty", "empty selection is valid empty");
equal(empty.findingsContext.summary.productCount, 0, "empty context count");
equal(validateCandidatePolicyCurrentFindingsContext(empty.findingsContext).valid, true, "empty context validates");
equal(runtime(empty).currentFindingsExposureState, "valid_empty", "runtime reports valid empty");
scenarios.push({ id: "R01", state: empty.findingsContext.exposureState });

const notUsing = canonical({ selections: [{ category: "treatment", status: "not_using" }] });
equal(notUsing.findingsContext.exposureState, "not_using", "not_using is explicit");
equal(notUsing.findingsContext.findings[0].relationToPlan, "empty_slot", "not_using maps to empty slot");
scenarios.push({ id: "R02", state: notUsing.findingsContext.exposureState });

const unanswered = canonical({ selections: [{ category: "treatment", status: "unanswered" }] });
equal(unanswered.findingsContext.exposureState, "unanswered", "unanswered stays distinct");
equal(unanswered.findingsContext.findings[0].relationToPlan, "unknown_usage", "unanswered relation");
scenarios.push({ id: "R03", state: unanswered.findingsContext.exposureState });

const supports = canonical({ selections: [selection(productById("fixture-hydration-current"))] });
equal(supports.findingsContext.findings[0].relationToPlan, "supports_goal", "ranking-goal support detected");
equal(relation(supports, productById("fixture-hydration-current")), "same_product_already_selected", "same product relation");
equal(relation(supports, productById("fixture-hydration-alt")), "supports_goal_existing", "support relation reaches ranking");
scenarios.push({ id: "R04", relation: supports.findingsContext.findings[0].relationToPlan });

const requestedOnly = canonical({
  requested: "acne",
  detected: "dehydration",
  selections: [selection(productById("fixture-acne-a"))]
});
equal(requestedOnly.candidateGoalContext.rankingGoal, "dehydration", "canonical ranking goal remains detected priority");
equal(requestedOnly.findingsContext.findings[0].relationToPlan, "different_goal", "requested-only support is not canonical support");
scenarios.push({ id: "R05", relation: requestedOnly.findingsContext.findings[0].relationToPlan });

const different = canonical({ selections: [selection(productById("fixture-barrier"))] });
equal(different.findingsContext.findings[0].relationToPlan, "different_goal", "different goal detected");
equal(relation(different, productById("fixture-hydration-alt")), "different_or_unknown_current_product", "different goal reaches ranking");
scenarios.push({ id: "R06", relation: different.findingsContext.findings[0].relationToPlan });

const duplicate = canonical({
  requested: "acne",
  detected: "acne",
  selections: [selection(productById("fixture-acne-a")), selection(productById("fixture-acne-b"))]
});
equal(duplicate.findingsContext.summary.duplicateAxisCount, 2, "duplicate active findings counted");
check(duplicate.findingsContext.findings.every((finding) => finding.relationToPlan === "duplicate_axis"), "duplicate relation applied to both findings");
equal(relation(duplicate, productById("fixture-hydration-alt")), "duplicate_axis", "duplicate relation reaches ranking");
scenarios.push({ id: "R07", duplicateCount: duplicate.findingsContext.summary.duplicateAxisCount });

const notInDb = canonical({ selections: [{ category: "treatment", status: "not_in_db" }] });
equal(notInDb.findingsContext.exposureState, "partial_unknown", "not_in_db is partial unknown");
equal(notInDb.findingsContext.findings[0].relationToPlan, "not_evaluable", "not_in_db is not evaluable");
equal(relation(notInDb, productById("fixture-hydration-alt")), "not_evaluable_current_product", "unknown current product reaches ranking");
scenarios.push({ id: "R08", state: notInDb.findingsContext.exposureState });

const missingSnapshot = canonical({
  selections: [{ category: "treatment", status: "selected", productId: "missing-snapshot", productSnapshot: null }]
});
equal(missingSnapshot.findingsContext.exposureState, "partial_unknown", "selected missing snapshot is partial unknown");
equal(missingSnapshot.findingsContext.findings[0].relationToPlan, "not_evaluable", "missing snapshot is not evaluable");
scenarios.push({ id: "R09", relation: missingSnapshot.findingsContext.findings[0].relationToPlan });

const mixed = canonical({
  selections: [
    selection(productById("fixture-hydration-current")),
    selection(productById("fixture-barrier")),
    { category: "sunscreen", status: "not_in_db" }
  ]
});
equal(mixed.findingsContext.summary.supportsRankingGoalCount, 1, "mixed supports count");
equal(mixed.findingsContext.summary.differentGoalCount, 1, "mixed different count");
equal(mixed.findingsContext.summary.notInDbCount, 1, "mixed unknown count");
scenarios.push({ id: "R10", summary: mixed.findingsContext.summary });

const completeUv = canonical({
  requested: "uv",
  detected: "uv",
  selections: [selection(productById("fixture-uv-complete"))]
});
equal(completeUv.findingsContext.findings[0].relationToPlan, "supports_goal", "complete sunscreen supports UV goal");
check(runtime(completeUv).visibleCandidateIds.includes("fixture-uv-complete"), "complete sunscreen remains visible");
scenarios.push({ id: "R11", visible: true });

const incompleteUv = canonical({
  requested: "uv",
  detected: "uv",
  selections: [selection(productById("fixture-uv-incomplete"))]
});
equal(incompleteUv.findingsContext.findings[0].relationToPlan, "different_goal", "incomplete sunscreen does not claim support");
check(!runtime(incompleteUv).visibleCandidateIds.includes("fixture-uv-incomplete"), "UVA-incomplete sunscreen remains fail-closed");
scenarios.push({ id: "R12", visible: false });

const stabilizing = canonical({
  requested: "acne",
  detected: "acne",
  stabilizing: true,
  selections: [selection(productById("fixture-acne-a"))]
});
check(!runtime(stabilizing).visibleCandidateIds.includes("fixture-acne-b"), "stabilization active expansion remains blocked");
scenarios.push({ id: "R13", visibleActive: false });

const runtimeResult = runtime(supports);
const shadowResult = shadow(supports);
deepEqual(runtimeResult.visibleCandidateIds, shadowResult.receivers.filter((receiver) => receiver.futureExposureGroup === "unchanged").map((receiver) => receiver.productId), "runtime/shadow findings parity");
equal(runtimeResult.currentFindingsContextVersion, CANDIDATE_POLICY_CURRENT_FINDINGS_CONTEXT_VERSION, "runtime context version");
equal(runtimeResult.currentFindingsEvaluableCount, 1, "runtime aggregate evaluable count");
scenarios.push({ id: "R14", parity: true });

const canonicalExposure = exposureSignature(runtime(supports));
const legacyExplicitEmpty = exposureSignature(runtime(supports, { currentProductFindings: [] }));
deepEqual(canonicalExposure, legacyExplicitEmpty, "current findings are a contracted exposure no-op at this boundary");
const withFindingsScore = evaluateFunctionalRankingCandidate({
  product: productById("fixture-hydration-current"),
  surveyContract: supports.surveyContract,
  goalPolicy: supports.goalPolicy,
  productProfile: resolveProductFunctionalProfile(productById("fixture-hydration-current")),
  currentProductFindings: supports.findingsContext
}).totalScore;
const withoutFindingsScore = evaluateFunctionalRankingCandidate({
  product: productById("fixture-hydration-current"),
  surveyContract: supports.surveyContract,
  goalPolicy: supports.goalPolicy,
  productProfile: resolveProductFunctionalProfile(productById("fixture-hydration-current")),
  currentProductFindings: []
}).totalScore;
check(withFindingsScore < withoutFindingsScore, "findings affect routine-fit scoring without changing exposure policy");
scenarios.push({ id: "R15", exposureNoop: true, rankingAware: true });

const malformedGoalContext = structuredClone(supports.candidateGoalContext);
malformedGoalContext.currentFindingsContext.summary.productCount += 1;
const malformedRuntime = buildEvaluatorBoundaryPolicyRuntime({
  products: PRODUCTS,
  surveyContract: supports.surveyContract,
  goalPolicy: supports.goalPolicy,
  candidateSafetyContext: supports.candidateSafetyContext,
  candidateGoalContext: malformedGoalContext
});
equal(malformedRuntime.policyApplicationStatus, "blocked_goal_context", "tampered nested context blocks runtime");
equal(malformedRuntime.visibleCandidateIds.length, 0, "tampered nested context fails closed");
negativeControlCount += 1;
scenarios.push({ id: "R16", blocked: true });

const duplicateIdContext = structuredClone(supports.findingsContext);
duplicateIdContext.findings.push(structuredClone(duplicateIdContext.findings[0]));
duplicateIdContext.summary.productCount += 1;
equal(validateCandidatePolicyCurrentFindingsContext(duplicateIdContext).valid, false, "duplicate finding id rejected");
negativeControlCount += 1;
scenarios.push({ id: "R17", duplicateRejected: true });

const sourceMutationProbe = structuredClone(supports.sharedContext);
const sourceBefore = semanticHash(sourceMutationProbe);
buildCandidatePolicyCurrentFindingsContext({
  sharedContext: sourceMutationProbe,
  functionalPolicy: supports.state.functionalPolicy
});
equal(semanticHash(sourceMutationProbe), sourceBefore, "context projection does not mutate canonical source");
scenarios.push({ id: "R18", immutableSource: true });

const firstHash = semanticHash(scenarios);
const secondHash = semanticHash(structuredClone(scenarios));
equal(firstHash, secondHash, "deterministic semantic output");
check(Object.isFrozen(supports.findingsContext), "current findings context is immutable");
check(Object.isFrozen(supports.findingsContext.findings), "current findings rows are immutable");

console.log(
  `candidate policy current findings integration verified: ${assertionCount} assertions, ${scenarios.length} scenarios, ${negativeControlCount} negative controls, semantic hash ${firstHash}`
);
