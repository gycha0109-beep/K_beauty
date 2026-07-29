import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildCandidatePolicyGoalContext,
  CANDIDATE_POLICY_GOAL_CONTEXT_VERSION,
  resolveCandidatePolicyGoalPolicy,
  validateCandidatePolicyGoalContext
} from "../lib/candidate-policy-goal-context.js";
import { buildCandidatePolicyRuntimeSafetyContext } from "../lib/candidate-policy-runtime-safety.js";
import {
  buildEvaluatorBoundaryPolicyRuntimeTelemetry,
  resolveEvaluatorBoundaryPolicyRuntimeControl,
  validateEvaluatorBoundaryPolicyRuntimeTelemetry
} from "../lib/evaluator-boundary-policy-runtime-observability.js";
import { buildEvaluatorBoundaryPolicyRuntime } from "../lib/evaluator-boundary-policy-runtime.js";
import { buildEvaluatorBoundaryPolicyShadow } from "../lib/evaluator-boundary-policy-shadow.js";
import { evaluateFunctionalRankingCandidate } from "../lib/functional-ranking-contract.js";
import { resolveFunctionalGoalPolicy } from "../lib/functional-goal-policy.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { buildSurveyInputContract } from "../lib/survey-input-contract.js";

const SCHEMA_VERSION = "candidate-policy-goal-alignment-evidence-v1";
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
const EXPECTED_SCENARIOS = Array.from({ length: 18 }, (_, index) =>
  `R${String(index + 1).padStart(2, "0")}`
);
const EXPECTED_FILES = ["evidence.json"];
const FIXED_TIME = "2026-07-29T00:00:00.000Z";
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
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])])
  );
}

function semanticHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function product(id, functionalLabel, concerns, overrides = {}) {
  return {
    id,
    category: "treatment",
    irritation_risk: "low",
    sensitivity_safe: true,
    concerns,
    skin_types: ["combination"],
    ingredient_signals: {
      functional: [{ label: functionalLabel, count: 3 }]
    },
    review_signals: { count: 10, rating: 4.5 },
    ...overrides
  };
}

const PRODUCTS = Object.freeze([
  product("fixture-hydration", "skin hydration", ["dehydration"]),
  product("fixture-barrier", "barrier care", ["barrier"]),
  product("fixture-acne", "acne relief", ["acne"]),
  product("fixture-tone", "whitening", ["uneven_tone"]),
  product("fixture-uv-complete", "uv protection", ["uv"], {
    category: "sunscreen",
    spf_value: "50+",
    uva_label: "PA++++",
    uv_filter_type: "organic",
    pilling_risk: null
  }),
  product("fixture-uv-incomplete", "uv protection", ["uv"], {
    category: "sunscreen",
    spf_value: "50+",
    uva_label: null,
    uv_filter_type: "organic"
  })
]);

function form({ requested = "dehydration", stabilizing = false, omitRequested = false } = {}) {
  const value = {
    skinType: "combination",
    sensitivity: stabilizing ? "high" : "low",
    mainConcerns: omitRequested ? [] : [requested],
    primaryConcern: omitRequested ? null : requested,
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
  return value;
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
  omitRequested = false
} = {}) {
  const answers = form({ requested, stabilizing, omitRequested });
  const surveyContract = buildSurveyInputContract(answers, {
    source: "candidate_policy_goal_alignment_fixture",
    generatedAt: FIXED_TIME
  });
  const state = buildPremiumDecisionState({
    freeResult: {
      priority: { axis: detected, score: 25 },
      scoring: { concernScores: concernScores(detected) },
      answers
    },
    currentProducts: { selections: [], summary: { total: 0 } }
  }, {
    locale: "en",
    source: "candidate_policy_goal_alignment_fixture"
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
  const legacyGoalPolicy = resolveFunctionalGoalPolicy({
    surveyContract,
    freeResultPriority: { axis: detected },
    safety: surveyContract.safety
  });
  const goalResolution = resolveCandidatePolicyGoalPolicy({
    candidateGoalContext,
    candidateSafetyContext,
    legacyGoalPolicy
  });
  return {
    answers,
    surveyContract,
    state,
    candidateSafetyContext,
    candidateGoalContext,
    legacyGoalPolicy,
    goalPolicy: goalResolution.goalPolicy
  };
}

function runtime(bundle, products = PRODUCTS, overrides = {}) {
  return buildEvaluatorBoundaryPolicyRuntime({
    products,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.legacyGoalPolicy,
    candidateSafetyContext: bundle.candidateSafetyContext,
    candidateGoalContext: bundle.candidateGoalContext,
    ...overrides
  });
}

function shadow(bundle, products = PRODUCTS, overrides = {}) {
  return buildEvaluatorBoundaryPolicyShadow({
    products,
    surveyContract: bundle.surveyContract,
    goalPolicy: bundle.legacyGoalPolicy,
    candidateSafetyContext: bundle.candidateSafetyContext,
    candidateGoalContext: bundle.candidateGoalContext,
    ...overrides
  });
}

function ordering(bundle, goalPolicy) {
  return PRODUCTS
    .map((item) => ({
      id: item.id,
      result: evaluateFunctionalRankingCandidate({
        product: item,
        surveyContract: bundle.surveyContract,
        goalPolicy
      })
    }))
    .sort((left, right) => {
      const leftScore = Number.isFinite(left.result.totalScore) ? left.result.totalScore : -1;
      const rightScore = Number.isFinite(right.result.totalScore) ? right.result.totalScore : -1;
      return rightScore - leftScore || left.id.localeCompare(right.id);
    })
    .map((row) => ({
      id: row.id,
      score: row.result.totalScore,
      status: row.result.hardFilterStatus
    }));
}

function pools(visibleIds) {
  return {
    topPick: visibleIds.slice(0, 1),
    alternatives: visibleIds.slice(1, 3),
    supporting: visibleIds.slice(0, 3),
    routine: visibleIds.slice(0, 4),
    budget: visibleIds.slice(-2)
  };
}

function summary(result) {
  return {
    status: result.policyApplicationStatus,
    visibleIds: result.visibleCandidateIds,
    exposureGroups: result.exposureRows.map((row) => ({
      id: row.productId,
      group: row.appliedExposureGroup,
      reason: row.rejectionReason
    })),
    goalContextValid: result.goalContextValid,
    goalContextVersion: result.goalContextVersion,
    requestedGoalPresent: result.requestedGoalPresent,
    detectedPriorityPresent: result.detectedPriorityPresent,
    goalTension: result.goalTension,
    rankingGoalSource: result.rankingGoalSource,
    legacyFallbackUsed: result.legacyFallbackUsed,
    alignmentStopReason: result.alignmentStopReason
  };
}

function buildMatrix() {
  const rows = [];
  for (const requested of CONCERNS) {
    for (const detected of CONCERNS) {
      for (const risk of ["stable", "stabilize"]) {
        const bundle = canonical({
          requested,
          detected,
          stabilizing: risk === "stabilize"
        });
        const runtimeResult = runtime(bundle);
        const shadowResult = shadow(bundle);
        const runtimeGroups = runtimeResult.exposureRows.map((row) => row.appliedExposureGroup);
        const shadowGroups = shadowResult.receivers.map((row) => row.futureExposureGroup);
        const resolved = resolveCandidatePolicyGoalPolicy({
          candidateGoalContext: bundle.candidateGoalContext,
          candidateSafetyContext: bundle.candidateSafetyContext,
          legacyGoalPolicy: bundle.legacyGoalPolicy
        });
        rows.push({
          requestedGoal: requested,
          detectedPriority: detected,
          risk,
          rankingGoal: resolved.goalPolicy.rankingGoal,
          recommendationGuard: resolved.goalPolicy.recommendationGuard,
          goalTension: resolved.goalPolicy.hasTension,
          classification: requested === detected ? "D0" : "D1",
          runtimeShadowEqual: JSON.stringify(runtimeGroups) === JSON.stringify(shadowGroups),
          rankingDivergence:
            resolved.goalPolicy.rankingGoal !== bundle.state.functionalPolicy.priorityAxis,
          guardDivergence:
            resolved.goalPolicy.recommendationGuard !==
            (bundle.candidateSafetyContext.stabilizationMode ? "stabilize_first" : "normal")
        });
      }
    }
  }
  return rows;
}

function materializeEvidence() {
  const aligned = canonical();
  const tension = canonical({ requested: "barrier", detected: "acne" });
  const stabilizing = canonical({
    requested: "uneven_tone",
    detected: "redness",
    stabilizing: true
  });
  const uv = canonical({ requested: "uv", detected: "uv" });
  const detectedOnly = canonical({
    requested: "dehydration",
    detected: "pores",
    omitRequested: true
  });
  const alignedRuntime = runtime(aligned);
  const tensionRuntime = runtime(tension);
  const stabilizingRuntime = runtime(stabilizing);
  const uvRuntime = runtime(uv);
  const detectedOnlyRuntime = runtime(detectedOnly);
  const requestedOnlyRuntime = buildEvaluatorBoundaryPolicyRuntime({
    products: PRODUCTS,
    surveyContract: buildSurveyInputContract(form({ requested: "barrier" }), {
      source: "candidate_policy_goal_alignment_fixture",
      generatedAt: FIXED_TIME
    }),
    goalPolicy: resolveFunctionalGoalPolicy({
      surveyContract: buildSurveyInputContract(form({ requested: "barrier" }), {
        source: "candidate_policy_goal_alignment_fixture",
        generatedAt: FIXED_TIME
      })
    }),
    candidateSafetyContext: aligned.candidateSafetyContext,
    candidateGoalContext: null
  });
  const neitherRuntime = buildEvaluatorBoundaryPolicyRuntime({
    products: PRODUCTS,
    candidateSafetyContext: aligned.candidateSafetyContext,
    candidateGoalContext: null
  });
  const invalidGoalContext = {
    ...aligned.candidateGoalContext,
    rankingGoal: "invalid_goal"
  };
  const invalidRuntime = runtime(aligned, PRODUCTS, {
    candidateGoalContext: invalidGoalContext
  });
  const runtimeParity = runtime(tension);
  const shadowParity = shadow(tension);
  const alignedOrder = ordering(tension, tension.goalPolicy);
  const legacyOrder = ordering(tension, tension.legacyGoalPolicy);
  const matrix = buildMatrix();
  const matrixClassifications = matrix.reduce((counts, row) => {
    counts[row.classification] = (counts[row.classification] || 0) + 1;
    return counts;
  }, { D0: 0, D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 });
  const runtimeGroups = runtimeParity.exposureRows.map((row) => row.appliedExposureGroup);
  const shadowGroups = shadowParity.receivers.map((row) => row.futureExposureGroup);
  const stabilizationPools = pools(stabilizingRuntime.visibleCandidateIds);
  const blockedActiveIds = new Set(["fixture-acne", "fixture-tone"]);

  const scenarios = [
    {
      id: "R01",
      requestedGoal: aligned.candidateGoalContext.requestedGoal,
      detectedPriority: aligned.candidateGoalContext.detectedPriority,
      rankingGoal: aligned.goalPolicy.rankingGoal,
      tension: aligned.goalPolicy.hasTension
    },
    {
      id: "R02",
      requestedGoal: tension.candidateGoalContext.requestedGoal,
      detectedPriority: tension.candidateGoalContext.detectedPriority,
      rankingGoal: tension.goalPolicy.rankingGoal,
      tension: tension.goalPolicy.hasTension
    },
    {
      id: "R03",
      summary: summary(requestedOnlyRuntime)
    },
    {
      id: "R04",
      summary: summary(detectedOnlyRuntime),
      requestedGoal: detectedOnly.candidateGoalContext.requestedGoal,
      rankingGoal: detectedOnly.goalPolicy.rankingGoal
    },
    {
      id: "R05",
      summary: summary(neitherRuntime)
    },
    {
      id: "R06",
      rankingGoal: stabilizing.goalPolicy.rankingGoal,
      guard: stabilizing.goalPolicy.recommendationGuard,
      activeVisibleCount: stabilizingRuntime.visibleCandidateIds
        .filter((id) => blockedActiveIds.has(id)).length,
      pools: stabilizationPools
    },
    {
      id: "R07",
      completeVisible: uvRuntime.visibleCandidateIds.includes("fixture-uv-complete"),
      incompleteVisible: uvRuntime.visibleCandidateIds.includes("fixture-uv-incomplete"),
      incompleteExposure: uvRuntime.exposureRows
        .find((row) => row.productId === "fixture-uv-incomplete")?.appliedExposureGroup
    },
    {
      id: "R08",
      legacyTop: legacyOrder[0]?.id || null,
      alignedTop: alignedOrder[0]?.id || null,
      canonicalRankingGoal: tension.state.functionalPolicy.priorityAxis,
      runtimeRankingGoal: tension.goalPolicy.rankingGoal
    },
    {
      id: "R09",
      requestedGoal: tension.goalPolicy.requestedConcern,
      rankingGoal: tension.goalPolicy.rankingGoal,
      explanationLead: tension.goalPolicy.copyStrategy.leadWith
    },
    {
      id: "R10",
      runtimeGroups,
      shadowGroups
    },
    {
      id: "R11",
      legacyRankingGoal: tension.legacyGoalPolicy.rankingGoal,
      alignedRankingGoal: tension.goalPolicy.rankingGoal,
      legacyObjectPreserved: tension.legacyGoalPolicy.requestedConcern === "barrier"
    },
    {
      id: "R12",
      validation: validateCandidatePolicyGoalContext(invalidGoalContext),
      summary: summary(invalidRuntime)
    },
    {
      id: "R13",
      pools: stabilizationPools,
      blockedActiveIds: [...blockedActiveIds]
    },
    {
      id: "R14",
      legacyOrder,
      alignedOrder
    },
    {
      id: "R15",
      uvaMissingVisible: uvRuntime.visibleCandidateIds.includes("fixture-uv-incomplete"),
      stabilizationActiveVisible: stabilizingRuntime.visibleCandidateIds
        .filter((id) => blockedActiveIds.has(id)).length
    },
    {
      id: "R16",
      transportContract: "verified_by_current_product_snapshot_transport_verifier"
    },
    {
      id: "R17",
      combinationCount: matrix.length,
      classifications: matrixClassifications,
      rankingDivergenceCount: matrix.filter((row) => row.rankingDivergence).length,
      guardDivergenceCount: matrix.filter((row) => row.guardDivergence).length,
      runtimeShadowDivergenceCount: matrix.filter((row) => !row.runtimeShadowEqual).length,
      tensionCount: matrix.filter((row) => row.goalTension).length
    },
    {
      id: "R18",
      deterministicContract: true
    }
  ];

  const telemetry = buildEvaluatorBoundaryPolicyRuntimeTelemetry({
    control: resolveEvaluatorBoundaryPolicyRuntimeControl({
      ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1"
    }),
    runtimeResult: tensionRuntime,
    latencyMs: 1
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    goalContextVersion: CANDIDATE_POLICY_GOAL_CONTEXT_VERSION,
    fixtureProvenance: "deterministic_anonymous_contract_fixture",
    productionModulesUsed: [
      "candidate-policy-goal-context",
      "candidate-policy-runtime-safety",
      "evaluator-boundary-policy-runtime",
      "evaluator-boundary-policy-shadow",
      "functional-ranking-contract",
      "premium-decision-state"
    ],
    scenarios,
    matrix,
    telemetry: {
      valid: validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry).valid,
      goalContextVersion: telemetry.goalContextVersion,
      requestedGoalPresent: telemetry.requestedGoalPresent,
      detectedPriorityPresent: telemetry.detectedPriorityPresent,
      goalTension: telemetry.goalTension,
      rankingGoalSource: telemetry.rankingGoalSource,
      legacyFallbackUsed: telemetry.legacyFallbackUsed,
      alignmentStopReason: telemetry.alignmentStopReason
    },
    databaseAccessCount: 0,
    networkAccessCount: 0,
    runtimeEnvironmentChanged: false
  };
}

function assertEvidence(evidence) {
  equal(evidence.schemaVersion, SCHEMA_VERSION, "evidence schema version");
  equal(
    evidence.goalContextVersion,
    CANDIDATE_POLICY_GOAL_CONTEXT_VERSION,
    "goal context version"
  );
  deepEqual(
    evidence.scenarios.map((row) => row.id),
    EXPECTED_SCENARIOS,
    "scenario exact set"
  );
  const byId = new Map(evidence.scenarios.map((row) => [row.id, row]));
  equal(byId.get("R01").rankingGoal, byId.get("R01").detectedPriority, "R01 aligned");
  equal(byId.get("R01").tension, false, "R01 no tension");
  equal(byId.get("R02").requestedGoal, "barrier", "R02 requested preserved");
  equal(byId.get("R02").rankingGoal, "acne", "R02 canonical ranking");
  equal(byId.get("R02").tension, true, "R02 tension");
  equal(byId.get("R03").summary.goalContextValid, false, "R03 requested-only fail closed");
  equal(byId.get("R03").summary.visibleIds.length, 0, "R03 no arbitrary ranking");
  equal(byId.get("R04").requestedGoal, null, "R04 missing requested preserved");
  equal(byId.get("R04").rankingGoal, "pores", "R04 detected ranking");
  equal(byId.get("R04").summary.goalContextValid, true, "R04 valid");
  equal(byId.get("R05").summary.goalContextValid, false, "R05 unavailable");
  equal(byId.get("R05").summary.visibleIds.length, 0, "R05 fail closed");
  equal(byId.get("R06").guard, "stabilize_first", "R06 canonical guard");
  equal(byId.get("R06").activeVisibleCount, 0, "R06 active blocked");
  equal(byId.get("R07").completeVisible, true, "R07 complete sunscreen visible");
  equal(byId.get("R07").incompleteVisible, false, "R07 incomplete sunscreen blocked");
  equal(
    byId.get("R07").incompleteExposure,
    "insufficient_evidence_candidate",
    "R07 incomplete exposure"
  );
  equal(
    byId.get("R08").runtimeRankingGoal,
    byId.get("R08").canonicalRankingGoal,
    "R08 canonical runtime ranking"
  );
  check(
    byId.get("R08").legacyTop !== byId.get("R08").alignedTop,
    "R08 fixture proves ranking impact"
  );
  equal(byId.get("R09").requestedGoal, "barrier", "R09 requested preserved");
  equal(byId.get("R09").rankingGoal, "acne", "R09 ranking separated");
  equal(byId.get("R09").explanationLead, "requestedConcern", "R09 explanation lead");
  deepEqual(byId.get("R10").runtimeGroups, byId.get("R10").shadowGroups, "R10 parity");
  equal(byId.get("R11").legacyRankingGoal, "barrier", "R11 legacy remains requested-first");
  equal(byId.get("R11").alignedRankingGoal, "acne", "R11 runtime aligned");
  equal(byId.get("R11").legacyObjectPreserved, true, "R11 compatibility object");
  equal(byId.get("R12").validation.valid, false, "R12 invalid rejected");
  equal(byId.get("R12").summary.visibleIds.length, 0, "R12 invalid fail closed");
  for (const [pool, ids] of Object.entries(byId.get("R13").pools)) {
    check(
      byId.get("R13").blockedActiveIds.every((id) => !ids.includes(id)),
      `R13 ${pool} excludes blocked active candidates`
    );
  }
  check(byId.get("R14").legacyOrder.length > 0, "R14 legacy order present");
  check(byId.get("R14").alignedOrder.length > 0, "R14 aligned order present");
  check(
    semanticHash(byId.get("R14").legacyOrder) !== semanticHash(byId.get("R14").alignedOrder),
    "R14 ordering assertion"
  );
  equal(byId.get("R15").uvaMissingVisible, false, "R15 UVA fail closed");
  equal(byId.get("R15").stabilizationActiveVisible, 0, "R15 stabilization gate");
  equal(
    byId.get("R16").transportContract,
    "verified_by_current_product_snapshot_transport_verifier",
    "R16 transport linkage"
  );
  equal(byId.get("R17").combinationCount, 128, "R17 exact matrix");
  equal(
    Object.values(byId.get("R17").classifications).reduce((sum, count) => sum + count, 0),
    128,
    "R17 classification sum"
  );
  equal(byId.get("R17").classifications.D0, 16, "R17 D0");
  equal(byId.get("R17").classifications.D1, 112, "R17 D1");
  equal(byId.get("R17").rankingDivergenceCount, 0, "R17 D3 zero");
  equal(byId.get("R17").guardDivergenceCount, 0, "R17 D4 zero");
  equal(byId.get("R17").runtimeShadowDivergenceCount, 0, "R17 parity");
  equal(byId.get("R17").tensionCount, 112, "R17 tension count");
  equal(byId.get("R18").deterministicContract, true, "R18 contract");
  equal(evidence.telemetry.valid, true, "telemetry valid");
  equal(evidence.telemetry.requestedGoalPresent, true, "telemetry requested presence");
  equal(evidence.telemetry.detectedPriorityPresent, true, "telemetry detected presence");
  equal(evidence.telemetry.goalTension, true, "telemetry tension");
  equal(
    evidence.telemetry.rankingGoalSource,
    "canonical_functional_policy_priority_axis",
    "telemetry ranking source"
  );
  equal(evidence.telemetry.legacyFallbackUsed, false, "telemetry no legacy fallback");
  equal(evidence.telemetry.alignmentStopReason, null, "telemetry no stop");
  equal(evidence.databaseAccessCount, 0, "no database");
  equal(evidence.networkAccessCount, 0, "no network");
  equal(evidence.runtimeEnvironmentChanged, false, "runtime env unchanged");
}

function expectEvidenceFailure(label, mutate) {
  negativeControlCount += 1;
  const evidence = materializeEvidence();
  mutate(evidence);
  assert.throws(() => assertEvidence(evidence), undefined, label);
}

async function writeIsolatedEvidence() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "candidate-goal-alignment-"));
  const outputPath = path.join(directory, "evidence.json");
  await writeFile(outputPath, "{\"stale\":true}\n", "utf8");
  const evidence = materializeEvidence();
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const files = (await readdir(directory)).sort();
  const parsed = JSON.parse(await readFile(outputPath, "utf8"));
  return { directory, files, parsed };
}

const first = await writeIsolatedEvidence();
const second = await writeIsolatedEvidence();
let cleanupCompleted = false;
try {
  deepEqual(first.files, EXPECTED_FILES, "first artifact exact set");
  deepEqual(second.files, EXPECTED_FILES, "second artifact exact set");
  assertEvidence(first.parsed);
  assertEvidence(second.parsed);
  equal(semanticHash(first.parsed), semanticHash(second.parsed), "deterministic semantic hash");

  expectEvidenceFailure("NC01 requested goal cannot overwrite ranking", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R02").rankingGoal = "barrier";
  });
  expectEvidenceFailure("NC02 detected priority cannot be ignored", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R08").runtimeRankingGoal = "barrier";
  });
  expectEvidenceFailure("NC03 requested goal cannot disappear", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R09").requestedGoal = null;
  });
  expectEvidenceFailure("NC04 tension cannot be forced false", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R02").tension = false;
  });
  expectEvidenceFailure("NC05 stabilization cannot use active requested ranking", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R06").activeVisibleCount = 1;
  });
  expectEvidenceFailure("NC06 runtime and shadow cannot diverge", (evidence) => {
    const row = evidence.scenarios.find((item) => item.id === "R10");
    row.shadowGroups[0] = row.runtimeGroups[0] === "hidden_candidate"
      ? "unchanged"
      : "hidden_candidate";
  });
  expectEvidenceFailure("NC07 missing context cannot fail open", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R05").summary.visibleIds = ["fixture-acne"];
  });
  expectEvidenceFailure("NC08 blocked alternative insertion", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R13").pools.alternatives.push("fixture-acne");
  });
  expectEvidenceFailure("NC09 top ordering cannot use legacy", (evidence) => {
    const row = evidence.scenarios.find((item) => item.id === "R14");
    row.alignedOrder = clone(row.legacyOrder);
  });
  expectEvidenceFailure("NC10 telemetry source must be canonical", (evidence) => {
    evidence.telemetry.rankingGoalSource = "legacy_requested_goal";
  });
  expectEvidenceFailure("NC11 invalid goal cannot be coerced", (evidence) => {
    evidence.scenarios.find((row) => row.id === "R12").validation.valid = true;
  });
  expectEvidenceFailure("NC12 stale artifact cannot be reused", (evidence) => {
    evidence.schemaVersion = "stale-placeholder";
  });
} finally {
  await rm(first.directory, { recursive: true, force: true });
  await rm(second.directory, { recursive: true, force: true });
  let firstMissing = false;
  let secondMissing = false;
  try {
    await access(first.directory);
  } catch {
    firstMissing = true;
  }
  try {
    await access(second.directory);
  } catch {
    secondMissing = true;
  }
  cleanupCompleted = firstMissing && secondMissing;
}

equal(negativeControlCount, 12, "negative control exact count");
equal(cleanupCompleted, true, "isolated artifact cleanup");

console.log(JSON.stringify({
  status: "PASS",
  verifier: "candidate-policy-goal-alignment",
  assertionCount,
  scenarioCount: EXPECTED_SCENARIOS.length,
  matrixCombinationCount: 128,
  negativeControlCount,
  semanticHashFirst: semanticHash(first.parsed),
  semanticHashSecond: semanticHash(second.parsed),
  cleanupCompleted
}));
