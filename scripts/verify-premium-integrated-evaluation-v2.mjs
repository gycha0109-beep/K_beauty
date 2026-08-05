import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateCandidateExposurePolicy } from "../lib/candidate-exposure-policy.js";
import {
  resolveCandidateExposurePolicyShadowControl,
  runCandidateExposurePolicyShadow
} from "../lib/candidate-exposure-policy-shadow.js";
import { buildCrossDomainConsistency } from "../lib/cross-domain-consistency.js";
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
  photoObservations = undefined,
  imageEligibility = undefined
} = {}) {
  return {
    freeResult: {
      priority: { axis: priority, score },
      scoring: { concernScores: scores(priority, score, scoreOverrides) },
      answers: answers(priority, answerOverrides)
    },
    photoEvidenceState,
    ...(photoObservations === undefined ? {} : { photoObservations }),
    ...(imageEligibility === undefined ? {} : { imageEligibility }),
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
  const canonicalState = canonical(input, state);
  const candidates = clone(products);
  const runtime = evaluateCandidateExposurePolicy({ canonicalState, candidates });
  const responseValue = {
    summary: "unchanged",
    candidateOrder: candidates.map((product) => product.id)
  };
  const snapshotValue = clone(canonicalState);
  const control = resolveCandidateExposurePolicyShadowControl({
    DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1",
    VERCEL_ENV: "preview",
    NODE_ENV: "production"
  });
  equal(control.enabled, true, "candidate shadow preview control");
  equal(control.productionHardDisabled, false, "candidate shadow preview is not Production");
  const shadow = runCandidateExposurePolicyShadow({
    control,
    canonicalState,
    candidates,
    legacyExecution: null,
    responseValue,
    snapshotValue,
    telemetrySink: () => {}
  });
  return { canonicalState, runtime, shadow, responseValue, snapshotValue };
}

function assertRuntimeShadowParity(bundle, label) {
  equal(bundle.shadow.executed, true, `${label}: shadow executed`);
  equal(bundle.shadow.status, "executed", `${label}: shadow status`);
  deepEqual(bundle.shadow.policyResult, bundle.runtime, `${label}: current policy parity`);
  deepEqual(
    bundle.shadow.fingerprints,
    { responseMatch: true, snapshotMatch: true, candidateOrderMatch: true },
    `${label}: shadow invariance`
  );
  deepEqual(bundle.responseValue, {
    summary: "unchanged",
    candidateOrder: candidateProducts.map((product) => product.id)
  }, `${label}: response object unchanged`);
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
  equal(state.functionalPolicy.planMode, "START", "support policy starts");
  equal(state.functionalPolicy.allowedIntensity, "support_only", "support intensity only");
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

scenario("S09_PHOTO_UNAVAILABLE", "provider-failure", () => {
  const state = build(report({
    photoEvidenceState: {
      status: "unavailable",
      failureReason: "vision_request_failed",
      failureClass: "provider_failure",
      source: "vision"
    }
  }));
  equal(state.decisionBundle.context.photo.status, "unavailable", "provider failure is unavailable");
  equal(state.decisionBundle.context.photo.failureClass, "provider_failure", "provider failure class");
  check(state.decisionBundle.context.uncertaintyState.reasons.includes("photo_provider_unavailable"), "provider failure uncertainty");
});

scenario("S09_PHOTO_UNAVAILABLE", "provider-unavailable", () => {
  const state = build(report({
    photoEvidenceState: {
      status: "unavailable",
      failureReason: "api_key_missing",
      failureClass: "provider_unavailable",
      source: "vision"
    }
  }));
  equal(state.decisionBundle.context.photo.status, "unavailable", "provider unavailable is not a skin result");
  equal(state.decisionBundle.context.photo.failureClass, "provider_unavailable", "provider unavailable class");
});

scenario("S09_PHOTO_UNAVAILABLE", "technical-failure", () => {
  const state = build(report({
    photoEvidenceState: {
      status: "unavailable",
      failureReason: "response_body_unavailable",
      failureClass: "technical_failure",
      source: "vision"
    }
  }));
  equal(state.decisionBundle.context.photo.failureClass, "technical_failure", "technical failure remains distinct");
  check(state.decisionBundle.context.uncertaintyState.reasons.includes("photo_technical_failure"), "technical failure uncertainty");
});

scenario("S10_NON_PHOTO_FALLBACK", "input-ineligible", () => {
  const state = build(report({
    photoEvidenceState: {
      status: "ineligible",
      failureReason: "face_not_detected",
      failureClass: "input_ineligible",
      source: "vision"
    },
    imageEligibility: {
      status: "ineligible",
      source: "vision",
      imageType: "product",
      humanFaceCount: 0,
      faceLabEligible: false,
      skinAnalysisEligible: false,
      faceLabFailureReason: "face_not_detected",
      skinFailureReason: "face_not_detected",
      confidence: 0.99,
      evidence: ["The uploaded image contains a product and no human face."]
    }
  }));
  equal(state.decisionBundle.context.photo.status, "ineligible", "non-photo input remains ineligible");
  equal(state.decisionBundle.context.photo.failureClass, "input_ineligible", "input ineligible class");
  equal(state.decisionBundle.context.photo.factsMayBeInferred, false, "no photo fact inference");
});

scenario("S10_NON_PHOTO_FALLBACK", "input-insufficient", () => {
  const state = build(report({
    photoEvidenceState: {
      status: "insufficient_evidence",
      failureReason: "heavy_filter_or_editing",
      failureClass: "input_insufficient",
      source: "vision"
    },
    imageEligibility: {
      status: "insufficient_evidence",
      source: "vision",
      imageType: "photorealistic_human",
      humanFaceCount: 1,
      faceLabEligible: false,
      skinAnalysisEligible: false,
      faceLabFailureReason: "image_quality_insufficient",
      skinFailureReason: "heavy_filter_or_editing",
      confidence: 0.72,
      evidence: ["One face is visible but the skin surface is heavily filtered."]
    }
  }));
  equal(state.decisionBundle.context.photo.status, "insufficient_evidence", "insufficient input remains distinct");
  equal(state.decisionBundle.context.photo.failureClass, "input_insufficient", "input insufficient class");
  check(state.decisionBundle.context.uncertaintyState.reasons.includes("photo_evidence_insufficient"), "insufficient evidence uncertainty");
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
  koLocaleState = build(report(), "ko", "locale-parity");
});
scenario("S14_LOCALE_PARITY", "en", () => {
  enLocaleState = build(report(), "en", "locale-parity");
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
    !state.decisionBundle.context.productExposureState.rows[0].cautionTags.includes("sunscreen_metadata_incomplete"),
    "sunscreen completeness remains audit-only until its separate Admin contract and activation"
  );
  equal(state.decisionBundle.context.productExposureState.rows[0].evaluable, true, "closeout does not activate a sunscreen gate");
});

let emptyFindings;
let populatedFindings;
scenario("S20_CURRENT_FINDINGS_POPULATED_VS_VALID_EMPTY", "valid-empty", () => {
  const input = report();
  const state = build(input);
  emptyFindings = candidateBundle(input, state);
  equal(emptyFindings.canonicalState.currentProductFindings.findings.length, 0, "valid-empty findings");
  equal(emptyFindings.canonicalState.currentProductFindings.summary.evaluableSelectedCount, 0, "valid-empty count");
  equal(emptyFindings.runtime.status, "evaluated", "valid-empty current policy evaluates");
  assertRuntimeShadowParity(emptyFindings, "valid-empty");
});

scenario("S20_CURRENT_FINDINGS_POPULATED_VS_VALID_EMPTY", "populated", () => {
  const input = report({ selections: [selected(activeA)] });
  const state = build(input);
  populatedFindings = candidateBundle(input, state);
  equal(populatedFindings.canonicalState.currentProductFindings.findings.length, 1, "populated findings");
  equal(populatedFindings.canonicalState.currentProductFindings.summary.evaluableSelectedCount, 1, "populated evaluable count");
  equal(populatedFindings.runtime.status, "evaluated", "populated current policy evaluates");
  assertRuntimeShadowParity(populatedFindings, "populated");
});
check(
  emptyFindings.canonicalState.currentProductFindings.findings.length !==
    populatedFindings.canonicalState.currentProductFindings.findings.length,
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
  check(
    bundle.runtime.decisions.some((decision) =>
      decision.exposure === "hidden" && decision.reasonCodes.includes("expansion_prohibited")
    ),
    "stabilization remains fail-closed"
  );
});

const candidatePolicySource = readFileSync(
  new URL("../lib/candidate-exposure-policy.js", import.meta.url),
  "utf8"
);
const candidateShadowSource = readFileSync(
  new URL("../lib/candidate-exposure-policy-shadow.js", import.meta.url),
  "utf8"
);
const premiumStateSource = readFileSync(
  new URL("../lib/premium-decision-state.js", import.meta.url),
  "utf8"
);
check(premiumStateSource.includes('from "./shared-skin-decision-context-v4.js"'), "Premium state v4 import");
check(candidatePolicySource.includes("currentProductFindings"), "current CandidateExposurePolicy findings contract");
check(candidatePolicySource.includes("invalid_canonical_input"), "current CandidateExposurePolicy fail-closed contract");
check(candidateShadowSource.includes("productionHardDisabled"), "CandidateExposurePolicy Production hard-disable");
check(candidateShadowSource.includes("responseMatch"), "CandidateExposurePolicy response invariance");
check(!candidateShadowSource.includes("ENABLE_CANDIDATE_EXPOSURE_POLICY_RUNTIME"), "no CandidateExposurePolicy activation flag");

deepEqual([...logicalIds].sort(), [...REQUIRED_LOGICAL_IDS].sort(), "exact 21 logical scenario coverage");
check(scenarioVariants.length >= 27, "expanded scenario variants");
equal(negativeCases, 6, "six cross-domain negative cases");
check(assertions >= 190, "substantial direct assertion coverage");

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
