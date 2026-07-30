import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildCandidatePolicyGoalContext,
  resolveCandidatePolicyGoalPolicy
} from "../lib/candidate-policy-goal-context.js";
import { buildCandidatePolicyRuntimeSafetyContext } from "../lib/candidate-policy-runtime-safety.js";
import { buildCrossDomainConsistency } from "../lib/cross-domain-consistency.js";
import { buildEvaluatorBoundaryPolicyRuntime } from "../lib/evaluator-boundary-policy-runtime.js";
import { buildEvaluatorBoundaryPolicyShadow } from "../lib/evaluator-boundary-policy-shadow.js";
import { buildPremiumDecisionState, rebuildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { resolvePremiumFunctionalDisplayModel } from "../lib/premium-functional-display-model.js";
import { buildProductDataSufficiencyAudit } from "../lib/product-data-sufficiency-audit.js";
import { buildRotatedPremiumReportPayload } from "../lib/premium-report-reentry.js";
import {
  buildPremiumReportSnapshot,
  classifyPremiumSnapshotReplay
} from "../lib/premium-report-snapshot.js";
import { SHARED_SKIN_DECISION_CONTEXT_VERSION } from "../lib/shared-skin-decision-context-v4.js";
import { buildSurveyInputContract } from "../lib/survey-input-contract.js";

const REQUIRED_LOGICAL_IDS = Object.freeze([
  "S01_NO_ACTIVE_PRODUCTS",
  "S02_DUPLICATE_ACTIVE_AXIS",
  "S03_BARRIER_AGGRESSIVE_ACTIVE",
  "S04_BREAKOUT_EXFOLIATION_OVERLAP",
  "S05_SENSITIVE_HIGH_IRRITATION",
  "S06_NOT_IN_DB_ONLY",
  "S07_SELECTED_AND_NOT_IN_DB",
  "S08_NO_PHOTO",
  "S09_PHOTO_UNAVAILABLE",
  "S10_NON_PHOTO_FALLBACK",
  "S11_SURVEY_PHOTO_CONFLICT",
  "S12_INSUFFICIENT_INFORMATION",
  "S13_REPEAT_STABILITY",
  "S14_LOCALE_PARITY",
  "S15_EXISTING_SAVED_REPORT",
  "S16_NEW_SNAPSHOT",
  "S17_HISTORICAL_SNAPSHOT_IMMUTABLE",
  "S18_CROSS_DOMAIN_NEGATIVE_FIXTURES",
  "S19_SUNSCREEN_PROTECTION_COMPLETENESS",
  "S20_CURRENT_FINDINGS_POPULATED_VS_VALID_EMPTY",
  "S21_RUNTIME_SHADOW_PARITY"
]);
const FIXED_TIME = "2026-07-30T00:00:00.000Z";
let assertions = 0;
let negativeCases = 0;
const scenarioVariants = [];
const logicalIds = new Set();

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

function scenario(logicalId, variant, run) {
  check(REQUIRED_LOGICAL_IDS.includes(logicalId), `unknown logical scenario ${logicalId}`);
  const id = `${logicalId}:${variant}`;
  check(!scenarioVariants.includes(id), `duplicate scenario variant ${id}`);
  logicalIds.add(logicalId);
  scenarioVariants.push(id);
  run();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])])
  );
}

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return clone(patch);
  const result = base && typeof base === "object" && !Array.isArray(base) ? clone(base) : {};
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(result[key], value)
      : clone(value);
  }
  return result;
}

function fixtureProduct(id, category = "treatment", label = "Exfoliation", extra = {}) {
  return {
    id,
    brand: "Fixture",
    name: id,
    category,
    ...(category === "treatment" ? { product_form: "serum" } : {}),
    skin_types: ["combination"],
    concerns: ["pores"],
    texture: "light",
    finish: "natural",
    irritation_risk: "low",
    sensitivity_safe: true,
    ingredient_signals: { functional: [{ label, count: 4 }], source: "fixture" },
    review_signals: { source: "fixture" },
    market_signals: { source: "fixture" },
    image_url: "https://example.invalid/image.jpg",
    buy_link: "https://example.invalid/buy",
    price_min: 10000,
    ...extra
  };
}

const activeA = fixtureProduct("eval-active-a");
const activeB = fixtureProduct("eval-active-b");
const acneActive = fixtureProduct("eval-acne-active", "treatment", "Acne Relief", {
  concerns: ["acne"]
});
const highIrritation = fixtureProduct("eval-high-irritation", "treatment", "Exfoliation", {
  irritation_risk: "high",
  sensitivity_safe: false
});
const hydration = fixtureProduct("eval-hydration", "treatment", "Skin Hydration", {
  concerns: ["dehydration"]
});
const unknownFunctional = fixtureProduct(
  "eval-unknown-functional",
  "treatment",
  "Unregistered Magic Complex"
);
const sunscreen = fixtureProduct("eval-sunscreen", "sunscreen", "UV Protection", {
  concerns: ["uv"],
  spf_value: 50,
  uva_label: "PA++++",
  uv_filter_type: "organic",
  tone_up: false,
  white_cast: "none",
  eye_sting: "low",
  pilling_risk: "low"
});
const partialSunscreen = fixtureProduct(
  "eval-sunscreen-partial",
  "sunscreen",
  "UV Protection",
  {
    concerns: ["uv"],
    spf_value: 50,
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low"
  }
);
const candidateProducts = [activeA, activeB, hydration, sunscreen, partialSunscreen];

function selected(product) {
  return {
    status: "selected",
    category: product.category,
    productId: product.id,
    productSnapshot: clone(product)
  };
}

function scores(priority = "pores", score = 24, overrides = {}) {
  return {
    barrier: { total: priority === "barrier" ? score : 8 },
    redness: { total: priority === "redness" ? score : 6 },
    dehydration: { total: priority === "dehydration" ? score : 10 },
    oiliness: { total: priority === "oiliness" ? score : 7 },
    acne: { total: priority === "acne" ? score : 9 },
    pores: { total: priority === "pores" ? score : 11 },
    uneven_tone: { total: priority === "uneven_tone" ? score : 5 },
    uv: { total: priority === "uv" ? score : 12 },
    ...overrides
  };
}

function answers(primary = "pores", overrides = {}) {
  return {
    skinType: "combination",
    sensitivity: "low",
    mainConcerns: [primary],
    primaryConcern: primary,
    recentSkinChange: "no",
    recentlyChangedProduct: "no",
    productReaction: "no",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same",
    cleansingFrequency: "twice",
    environmentExposure: [],
    preferredTexture: "gel",
    mostDislikedFeel: "sticky",
    genderPreference: "unspecified",
    sunscreenPreferenceState: "answered",
    whiteCastHate: false,
    toneUpWanted: false,
    makeupUse: false,
    eyeSensitive: false,
    ...overrides
  };
}

function report({
  priority = "pores",
  score = 24,
  scoreOverrides = {},
  answerOverrides = {},
  selections = [],
  photoEvidenceState = { status: "not_provided" },
  photoObservations = undefined
} = {}) {
  return {
    freeResult: {
      priority: { axis: priority, score },
      scoring: { concernScores: scores(priority, score, scoreOverrides) },
      answers: answers(priority, answerOverrides)
    },
    photoEvidenceState,
    ...(photoObservations === undefined ? {} : { photoObservations }),
    currentProducts: {
      selections: clone(selections),
      summary: {
        total: selections.length,
        selectedCount: selections.filter((item) => item.status === "selected").length,
        notInDbCount: selections.filter((item) => item.status === "not_in_db").length
      }
    }
  };
}

function build(input, locale = "ko", source = "premium_integrated_evaluation_v2") {
  const before = semanticHash(input);
  const state = buildPremiumDecisionState(clone(input), { locale, source });
  equal(semanticHash(input), before, `${source}: input immutability`);
  equal(
    state.decisionBundle.context.version,
    SHARED_SKIN_DECISION_CONTEXT_VERSION,
    `${source}: authoritative context version`
  );
  equal(state.decisionBundle.version, "premium-decision-bundle-v5", `${source}: bundle version`);
  deepEqual(state.decisionBundle.rawPolicies, state.rawPolicies, `${source}: raw lineage`);
  deepEqual(state.decisionBundle.consistency, state.consistency, `${source}: consistency lineage`);
  equal(
    state.decisionBundle.effectivePolicySource,
    state.effectivePolicySource,
    `${source}: effective source lineage`
  );
  check(state.decisionBundle.effectivePolicies === undefined, `${source}: no redundant policy container`);
  equal(state.routinePolicy.invariants.sunscreenRequiredInMorning, true, `${source}: AM sunscreen`);
  equal(state.conditionPolicy.invariants.protectionMustMaintain, true, `${source}: protection invariant`);
  return state;
}

function canonical(input, state, locale = "ko") {
  return { ...clone(input), ...clone(state), locale };
}

function audit(products) {
  return buildProductDataSufficiencyAudit(clone(products), { sourceType: "fixture" });
}

function candidateBundle(input, state, products = candidateProducts) {
  const surveyContract = buildSurveyInputContract(
    state.decisionBundle.context.survey.answers,
    { source: "premium_integrated_evaluation_v2", generatedAt: FIXED_TIME }
  );
  const candidateSafetyContext = buildCandidatePolicyRuntimeSafetyContext({
    sharedContext: state.decisionBundle.context,
    functionalPolicy: state.functionalPolicy,
    effectivePolicySource: state.effectivePolicySource
  });
  const candidateGoalContext = buildCandidatePolicyGoalContext({
    surveyContract,
    sharedContext: state.decisionBundle.context,
    functionalPolicy: state.functionalPolicy,
    effectivePolicySource: state.effectivePolicySource
  });
  const resolution = resolveCandidatePolicyGoalPolicy({
    candidateGoalContext,
    candidateSafetyContext,
    legacyGoalPolicy: {}
  });
  equal(resolution.valid, true, "candidate goal context must resolve");
  const common = {
    products: clone(products),
    surveyContract,
    goalPolicy: resolution.goalPolicy,
    currentProductFindings: candidateGoalContext.currentFindingsContext,
    candidateSafetyContext,
    candidateGoalContext
  };
  return {
    surveyContract,
    candidateSafetyContext,
    candidateGoalContext,
    runtime: buildEvaluatorBoundaryPolicyRuntime(common),
    shadow: buildEvaluatorBoundaryPolicyShadow(common)
  };
}

const receiverKeys = [
  "productId", "category", "receivedHint", "receiverDecision", "futureExposureGroup",
  "visibilityPriority", "userMessageType", "safetyMetadataClass", "sensitivityUnsafe",
  "strongCautionSignal", "activeOnlyViolation", "safetyGateApplied", "safetyGateReason",
  "goalContextGateApplied", "goalContextStopReason", "reasonKeys"
];
const hintKeys = [
  "productId", "category", "sourceHardFilterReason", "boundaryDecision",
  "futureEvaluatorAction", "candidatePolicyHint", "safetyMetadataClass",
  "safetyGateApplied", "safetyGateReason", "goalContextGateApplied",
  "goalContextStopReason", "reasonKeys"
];

function rows(items, keys) {
  return (items || [])
    .map((item) => Object.fromEntries(
      keys.filter((key) => item[key] !== undefined).map((key) => [key, clone(item[key])])
    ))
    .sort((left, right) => String(left.productId || "").localeCompare(String(right.productId || "")));
}

function paritySemantic(result) {
  return {
    receivers: rows(result.receivers, receiverKeys),
    boundaryHints: rows(result.boundaryHints, hintKeys),
    violationCounts: result.violationCounts,
    safetyContextValid: result.safetyContextValid,
    safetyContextVersion: result.safetyContextVersion,
    safetyPolicyVersion: result.safetyPolicyVersion,
    goalContextValid: result.goalContextValid,
    goalContextVersion: result.goalContextVersion,
    requestedGoalPresent: result.requestedGoalPresent,
    detectedPriorityPresent: result.detectedPriorityPresent,
    goalTension: result.goalTension,
    rankingGoalSource: result.rankingGoalSource,
    legacyFallbackUsed: result.legacyFallbackUsed,
    alignmentStopReason: result.alignmentStopReason,
    currentFindingsContextVersion: result.currentFindingsContextVersion,
    currentFindingsExposureState: result.currentFindingsExposureState,
    currentFindingsCount: result.currentFindingsCount,
    currentFindingsEvaluableCount: result.currentFindingsEvaluableCount,
    currentFindingsUnknownCount: result.currentFindingsUnknownCount,
    safetyBlockReasonCounts: result.safetyBlockReasonCounts,
    safetyBlockCategoryCounts: result.safetyBlockCategoryCounts,
    safetyBlockFunctionalAxisCounts: result.safetyBlockFunctionalAxisCounts
  };
}

function assertRuntimeShadowParity(bundle, label) {
  deepEqual(paritySemantic(bundle.runtime), paritySemantic(bundle.shadow), `${label}: semantic parity`);
  const runtimeVisible = [...(bundle.runtime.visibleCandidateIds || [])].sort();
  const shadowVisible = bundle.shadow.receivers
    .filter((receiver) => receiver.futureExposureGroup === "unchanged")
    .map((receiver) => receiver.productId)
    .filter(Boolean)
    .sort();
  deepEqual(runtimeVisible, shadowVisible, `${label}: visible parity`);
}

scenario("S01_NO_ACTIVE_PRODUCTS", "default", () => {
  const state = build(report());
  equal(state.decisionBundle.context.productExposureState.activeExposurePresent, false, "no active exposure");
  equal(state.functionalRoutineAudit.status, "NO_ROUTINE_DATA", "no routine audit data");
});

scenario("S02_DUPLICATE_ACTIVE_AXIS", "default", () => {
  const input = report({ selections: [selected(activeA), selected(activeB)] });
  const state = build(input);
  check(state.decisionBundle.context.productExposureState.duplicateActiveAxes.includes("exfoliation"), "duplicate axis");
  equal(state.functionalRoutineAudit.status, "CONSOLIDATE", "duplicate audit status");
  equal(audit([activeA, activeB]).rows.length, 2, "two catalog rows audited");
});

scenario("S03_BARRIER_AGGRESSIVE_ACTIVE", "default", () => {
  const input = report({
    priority: "barrier",
    score: 26,
    scoreOverrides: { redness: { total: 22 }, dehydration: { total: 20 } },
    answerOverrides: {
      sensitivity: "high",
      recentSkinChange: "yes",
      postWashFeeling: "tight",
      afternoonSkinChange: "red_or_irritated"
    },
    selections: [selected(activeA)]
  });
  const state = build(input);
  equal(state.decisionBundle.context.safetyState.level, "stabilize_first", "barrier stabilization");
  equal(state.functionalPolicy.planMode, "HOLD", "functional hold");
  equal(state.routinePolicy.weeklySchedule.activeDaysMax, 0, "active days held");
});

scenario("S04_BREAKOUT_EXFOLIATION_OVERLAP", "overlap", () => {
  const state = build(report({
    priority: "acne",
    score: 25,
    answerOverrides: { sensitivity: "medium" },
    selections: [selected(activeA), selected(activeB)]
  }));
  check(state.decisionBundle.context.productExposureState.duplicateActiveAxes.includes("exfoliation"), "breakout overlap retained");
});

scenario("S04_BREAKOUT_EXFOLIATION_OVERLAP", "acne-control", () => {
  const state = build(report({ priority: "acne", score: 25, selections: [selected(acneActive)] }));
  equal(state.decisionBundle.context.productExposureState.rows[0].evaluable, true, "acne active evaluable");
});

scenario("S05_SENSITIVE_HIGH_IRRITATION", "default", () => {
  const state = build(report({
    priority: "barrier",
    score: 24,
    scoreOverrides: { redness: { total: 21 } },
    answerOverrides: { sensitivity: "high" },
    selections: [selected(highIrritation)]
  }));
  equal(state.decisionBundle.context.productExposureState.highCautionExposureCount, 1, "high caution counted");
  equal(state.decisionBundle.context.safetyState.level, "stabilize_first", "high irritation stabilizes");
});

scenario("S06_NOT_IN_DB_ONLY", "not-in-db", () => {
  const state = build(report({ selections: [{ status: "not_in_db", category: "serum" }] }));
  equal(state.decisionBundle.context.productExposureState.unknownProductCount, 1, "unknown product counted");
  equal(state.decisionBundle.context.productExposureState.unknownExposurePresent, true, "unknown exposure explicit");
  equal(state.functionalRoutineAudit.status, "UNKNOWN", "unknown audit status");
});

scenario("S06_NOT_IN_DB_ONLY", "selected-non-evaluable", () => {
  const state = build(report({ selections: [selected(unknownFunctional)] }));
  const dataAudit = audit([unknownFunctional]);
  equal(dataAudit.rows[0].capabilities.functionalProfileEvaluable, false, "unknown signal not evaluable");
  equal(state.decisionBundle.context.productExposureState.rows[0].evaluable, false, "context remains unknown");
  equal(state.decisionBundle.context.productExposureState.activeExposurePresent, false, "no fabricated active exposure");
});

scenario("S07_SELECTED_AND_NOT_IN_DB", "default", () => {
  const state = build(report({
    selections: [selected(activeA), { status: "not_in_db", category: "toner_pad" }]
  }));
  equal(state.decisionBundle.context.productExposureState.selectedProducts.length, 1, "selected collection");
  equal(state.decisionBundle.context.productExposureState.unknownProducts.length, 1, "unknown collection");
  equal(state.decisionBundle.context.productExposureState.completeness, "partial", "partial exposure");
});

scenario("S08_NO_PHOTO", "default", () => {
  const state = build(report({ photoEvidenceState: { status: "not_provided" } }));
  equal(state.decisionBundle.context.photo.status, "not_provided", "no photo explicit");
  equal(state.decisionBundle.context.photo.evidenceAvailable, false, "no photo evidence");
  check(state.decisionBundle.context.uncertaintyState.reasons.includes("photo_not_provided"), "no photo uncertainty");
});

scenario("S09_PHOTO_UNAVAILABLE", "default", () => {
  const state = build(report({
    photoEvidenceState: { status: "unavailable", failureReason: "analysis_unavailable", source: "vision" }
  }));
  equal(state.decisionBundle.context.photo.status, "unavailable", "unavailable photo");
  equal(state.decisionBundle.context.photo.failureReason, "analysis_unavailable", "photo failure reason");
});

scenario("S10_NON_PHOTO_FALLBACK", "default", () => {
  const state = build(report({
    photoEvidenceState: {
      status: "insufficient_evidence",
      failureReason: "non_photo_content",
      source: "vision"
    }
  }));
  equal(state.decisionBundle.context.photo.status, "insufficient_evidence", "non-photo fallback state");
  equal(state.decisionBundle.context.photo.failureReason, "non_photo_content", "non-photo reason");
  equal(state.decisionBundle.context.photo.factsMayBeInferred, false, "no photo fact inference");
});

scenario("S11_SURVEY_PHOTO_CONFLICT", "default", () => {
  const state = build(report({
    photoEvidenceState: { status: "available", source: "vision" },
    photoObservations: {
      surveyAlignment: { status: "conflict" },
      observations: [{ key: "redness", confidence: "medium" }]
    }
  }));
  equal(state.decisionBundle.context.photo.status, "available", "photo available");
  equal(state.decisionBundle.context.concernState.surveyPhotoAlignment, "conflict", "conflict explicit");
});

scenario("S12_INSUFFICIENT_INFORMATION", "default", () => {
  const input = { freeResult: {}, photoEvidenceState: { status: "unknown" }, currentProducts: null };
  const state = build(input);
  equal(state.decisionBundle.context.concernState.completeness, "minimal", "minimal concern context");
  equal(state.decisionBundle.context.uncertaintyState.level, "high", "high uncertainty");
  equal(state.decisionBundle.context.uncertaintyState.confidenceCeiling, "low", "low confidence ceiling");
});

scenario("S13_REPEAT_STABILITY", "default", () => {
  const input = report();
  const first = rebuildPremiumDecisionState(input, { locale: "ko", source: "repeat-stability" });
  const second = rebuildPremiumDecisionState(first, { locale: "ko", source: "repeat-stability" });
  const third = rebuildPremiumDecisionState(second, { locale: "ko", source: "repeat-stability" });
  equal(second.decisionBundle.contextHash, first.decisionBundle.contextHash, "repeat hash stable");
  equal(second.decisionBundle.contextRevision, first.decisionBundle.contextRevision, "repeat revision stable");
  equal(third.decisionBundle.contextHash, second.decisionBundle.contextHash, "third hash stable");
  equal(third.decisionBundle.contextRevision, second.decisionBundle.contextRevision, "third revision stable");
});

let koLocaleState;
let enLocaleState;
scenario("S14_LOCALE_PARITY", "ko", () => {
  koLocaleState = build(report(), "ko", "locale-ko");
});
scenario("S14_LOCALE_PARITY", "en", () => {
  enLocaleState = build(report(), "en", "locale-en");
});
deepEqual(koLocaleState.decisionBundle.context, enLocaleState.decisionBundle.context, "KO/EN context parity");
equal(koLocaleState.functionalPolicy.planMode, enLocaleState.functionalPolicy.planMode, "KO/EN functional parity");
deepEqual(koLocaleState.routinePolicy.weeklySchedule, enLocaleState.routinePolicy.weeklySchedule, "KO/EN routine parity");

scenario("S15_EXISTING_SAVED_REPORT", "canonical-display", () => {
  const input = report({ selections: [selected(activeA)] });
  const state = build(input);
  const saved = canonical(input, state);
  const snapshot = buildPremiumReportSnapshot(saved);
  const replay = classifyPremiumSnapshotReplay(saved, clone(saved));
  equal(replay.status, "existing", "saved report replay existing");
  equal(snapshot.contextHash, state.decisionBundle.contextHash, "saved snapshot context hash");
  const display = resolvePremiumFunctionalDisplayModel({
    report: saved,
    decisions: state.functionalDecisions,
    locale: "ko"
  });
  equal(display.source, "canonical", "canonical display source");
  check(display.functionalPlan === saved.functionalPlan, "canonical functional plan identity");
  check(display.routineAudit === saved.functionalRoutineAudit, "canonical audit identity");
  const legacy = resolvePremiumFunctionalDisplayModel({
    report: {},
    decisions: [{
      goalKey: "hydration",
      status: "now",
      title: "legacy",
      summary: "legacy",
      reasons: ["legacy"],
      nextAction: "legacy"
    }],
    locale: "ko"
  });
  equal(legacy.source, "legacy_adapter", "legacy display adapter");
});

scenario("S15_EXISTING_SAVED_REPORT", "new-report-rotation", () => {
  const input = report({ selections: [selected(activeA)] });
  const state = build(input);
  const rotated = buildRotatedPremiumReportPayload(canonical(input, state));
  equal(rotated.currentProducts, null, "rotation clears products");
  deepEqual(rotated.currentProductVerdicts, [], "rotation clears verdicts");
  equal(rotated.decisionBundle.context.productExposureState.activeExposurePresent, false, "rotation clears exposure");
  check(rotated.decisionBundle.contextHash !== state.decisionBundle.contextHash, "rotation changes context hash");
  equal(
    rotated.decisionBundle.contextRevision,
    state.decisionBundle.contextRevision + 1,
    "rotation advances revision"
  );
});

scenario("S16_NEW_SNAPSHOT", "default", () => {
  const input = report();
  const state = build(input);
  const current = canonical(input, state);
  const changed = deepMerge(current, { freeResult: { answers: { recentSkinChange: "yes" } } });
  const first = buildPremiumReportSnapshot(current);
  const next = buildPremiumReportSnapshot(changed);
  check(first.fingerprint !== next.fingerprint, "new evidence creates new fingerprint");
  equal(classifyPremiumSnapshotReplay(current, changed).status, "conflict", "changed snapshot conflicts");
});

scenario("S17_HISTORICAL_SNAPSHOT_IMMUTABLE", "default", () => {
  const input = report({ selections: [selected(activeA)] });
  const state = build(input);
  const current = canonical(input, state);
  const historical = buildPremiumReportSnapshot(current);
  const historicalHash = semanticHash(historical);
  const changed = deepMerge(current, {
    currentProducts: {
      selections: [selected(activeB)],
      summary: { total: 1, selectedCount: 1 }
    }
  });
  const next = buildPremiumReportSnapshot(changed);
  check(historical.fingerprint !== next.fingerprint, "current snapshot changes");
  equal(semanticHash(historical), historicalHash, "historical snapshot immutable");
  const transient = buildPremiumReportSnapshot({
    ...current,
    generatedAt: "2099-01-01T00:00:00.000Z",
    savedReportId: "transient",
    sessionId: "transient"
  });
  equal(transient.fingerprint, historical.fingerprint, "transient fields excluded");
});

function negativeCase(state, id, patches, expectedRule) {
  const result = buildCrossDomainConsistency({
    sharedContext: deepMerge(state.decisionBundle.context, patches.sharedContext || {}),
    functionalPolicy: deepMerge(state.rawPolicies.functional, patches.functionalPolicy || {}),
    routinePolicy: deepMerge(state.rawPolicies.routine, patches.routinePolicy || {}),
    conditionPolicy: deepMerge(state.rawPolicies.condition, patches.conditionPolicy || {})
  });
  negativeCases += 1;
  equal(result.verdict, "blocked", `${id}: blocked`);
  check(result.violations.some((item) => item.ruleId === expectedRule), `${id}: ${expectedRule}`);
}

scenario("S18_CROSS_DOMAIN_NEGATIVE_FIXTURES", "six-conflicts", () => {
  const state = build(report({ selections: [selected(activeA)] }));
  const activeRoutine = {
    weeklySchedule: { activeDaysMax: 7, sameAxisSameDayAllowed: true },
    windows: {
      evening: {
        steps: [{
          stepKey: "pm.treatment",
          requirement: "optional",
          action: "maintain",
          frequencyCap: { maximum: 7 }
        }]
      }
    }
  };
  negativeCase(state, "functional-hold-routine-active", {
    functionalPolicy: {
      functionalDirection: "exfoliation",
      status: "pause",
      planMode: "HOLD",
      allowedIntensity: "hold"
    },
    routinePolicy: activeRoutine
  }, "CONSISTENCY_FUNCTIONAL_HOLD_ROUTINE_ACTIVE");
  negativeCase(state, "protection-step-missing", {
    routinePolicy: {
      windows: { morning: { steps: [] } },
      invariants: { protectionMustMaintain: true }
    }
  }, "CONSISTENCY_PROTECTION_MISSING");
  negativeCase(state, "unknown-product-stop", {
    sharedContext: {
      productExposureState: {
        rows: [{
          sourceState: "not_in_db",
          productId: null,
          routineSlots: ["pm.treatment"]
        }],
        unknownProductCount: 1,
        duplicateActiveAxes: []
      }
    },
    routinePolicy: {
      productActions: [{ slotKey: "pm.treatment", productId: null, action: "replace" }]
    }
  }, "CONSISTENCY_UNKNOWN_PRODUCT_STOP");
  negativeCase(state, "duplicate-axis-expansion", {
    sharedContext: { productExposureState: { duplicateActiveAxes: ["exfoliation"] } },
    functionalPolicy: {
      functionalDirection: "exfoliation",
      status: "now",
      planMode: "START",
      recommendationSuppressed: false
    }
  }, "CONSISTENCY_DUPLICATE_AXIS_EXPANSION");
  negativeCase(state, "condition-stabilize-routine-active", {
    conditionPolicy: { responseMode: "stabilize" },
    routinePolicy: activeRoutine
  }, "CONSISTENCY_CONDITION_STABILIZE_ROUTINE_ACTIVE");
  negativeCase(state, "low-intensity-daily", {
    functionalPolicy: {
      functionalDirection: "exfoliation",
      allowedIntensity: "low",
      planMode: "START",
      status: "now"
    },
    routinePolicy: activeRoutine
  }, "CONSISTENCY_INTENSITY_FREQUENCY_CAP");
});

scenario("S19_SUNSCREEN_PROTECTION_COMPLETENESS", "complete", () => {
  const input = report({ priority: "uv", score: 25, selections: [selected(sunscreen)] });
  const state = build(input);
  const dataAudit = audit([sunscreen]);
  equal(dataAudit.rows[0].capabilities.sunscreenProtectionReady, true, "complete sunscreen audit");
  check(
    !state.decisionBundle.context.productExposureState.rows[0].cautionTags.includes("sunscreen_metadata_incomplete"),
    "complete sunscreen has no incomplete caution"
  );
});

scenario("S19_SUNSCREEN_PROTECTION_COMPLETENESS", "partial", () => {
  const input = report({ priority: "uv", score: 25, selections: [selected(partialSunscreen)] });
  const state = build(input);
  const dataAudit = audit([partialSunscreen]);
  equal(dataAudit.rows[0].capabilities.sunscreenProtectionReady, false, "partial sunscreen audit");
  check(dataAudit.rows[0].gaps.some((gap) => gap.code === "SUNSCREEN_METADATA_PARTIAL"), "partial sunscreen gap");
  check(
    state.decisionBundle.context.productExposureState.rows[0].cautionTags.includes("sunscreen_metadata_incomplete"),
    "partial sunscreen context fails closed"
  );
});

let emptyFindings;
let populatedFindings;
scenario("S20_CURRENT_FINDINGS_POPULATED_VS_VALID_EMPTY", "valid-empty", () => {
  const input = report();
  const state = build(input);
  emptyFindings = candidateBundle(input, state);
  equal(emptyFindings.candidateGoalContext.currentFindingsContext.exposureState, "valid_empty", "valid-empty findings");
  equal(emptyFindings.candidateGoalContext.currentFindingsContext.summary.productCount, 0, "valid-empty count");
  assertRuntimeShadowParity(emptyFindings, "valid-empty");
});

scenario("S20_CURRENT_FINDINGS_POPULATED_VS_VALID_EMPTY", "populated", () => {
  const input = report({ selections: [selected(activeA)] });
  const state = build(input);
  populatedFindings = candidateBundle(input, state);
  equal(populatedFindings.candidateGoalContext.currentFindingsContext.exposureState, "populated", "populated findings");
  equal(populatedFindings.candidateGoalContext.currentFindingsContext.summary.productCount, 1, "populated count");
  equal(populatedFindings.candidateGoalContext.currentFindingsContext.summary.evaluableSelectedCount, 1, "populated evaluable count");
  assertRuntimeShadowParity(populatedFindings, "populated");
});
check(
  emptyFindings.candidateGoalContext.currentFindingsContext.exposureState !==
    populatedFindings.candidateGoalContext.currentFindingsContext.exposureState,
  "valid-empty and populated findings remain distinct"
);

scenario("S21_RUNTIME_SHADOW_PARITY", "stable", () => {
  const input = report({ selections: [selected(activeA)] });
  const state = build(input);
  assertRuntimeShadowParity(candidateBundle(input, state), "stable runtime/shadow");
});

scenario("S21_RUNTIME_SHADOW_PARITY", "stabilizing", () => {
  const input = report({
    priority: "barrier",
    score: 26,
    scoreOverrides: { redness: { total: 22 }, dehydration: { total: 20 } },
    answerOverrides: {
      sensitivity: "high",
      recentSkinChange: "yes",
      postWashFeeling: "tight",
      afternoonSkinChange: "red_or_irritated"
    },
    selections: [selected(activeA)]
  });
  const state = build(input);
  const bundle = candidateBundle(input, state);
  assertRuntimeShadowParity(bundle, "stabilizing runtime/shadow");
  equal(
    bundle.runtime.violationCounts.stabilizationActiveExpansionFailOpen,
    0,
    "stabilization remains fail-closed"
  );
});

const goalContextSource = readFileSync(
  new URL("../lib/candidate-policy-goal-context.js", import.meta.url),
  "utf8"
);
const findingsContextSource = readFileSync(
  new URL("../lib/candidate-policy-current-findings-context.js", import.meta.url),
  "utf8"
);
check(goalContextSource.includes('from "./shared-skin-decision-context-v4.js"'), "goal context v4 import");
check(findingsContextSource.includes('from "./shared-skin-decision-context-v4.js"'), "findings context v4 import");
check(!goalContextSource.includes('from "./shared-skin-decision-context.js"'), "goal context stale v3 import removed");
check(!findingsContextSource.includes('from "./shared-skin-decision-context.js"'), "findings context stale v3 import removed");

deepEqual([...logicalIds].sort(), [...REQUIRED_LOGICAL_IDS].sort(), "exact 21 logical scenario coverage");
check(scenarioVariants.length >= 27, "expanded scenario variants");
equal(negativeCases, 6, "six cross-domain negative cases");
check(assertions >= 230, "substantial direct assertion coverage");

const semanticSummary = {
  version: "premium-integrated-evaluation-pack-v2",
  logicalScenarios: logicalIds.size,
  variants: scenarioVariants.length,
  assertions,
  negativeCases,
  contextVersion: SHARED_SKIN_DECISION_CONTEXT_VERSION
};
console.log(
  `premium integrated evaluation v2 verified: ${assertions} assertions, ` +
  `${logicalIds.size} logical scenarios, ${scenarioVariants.length} variants, ` +
  `${negativeCases} negative cases, semantic hash ${semanticHash(semanticSummary)}`
);
