import { createHash } from "node:crypto";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { TARGET_STYLE_REGISTRY } from "../target-style-registry.js";
import {
  FACE_LAB_V2_ADVERSARIAL_COHORT_SEED,
  FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE,
  FACE_LAB_V2_ADVERSARIAL_COHORT_VERSION,
  FACE_LAB_V2_COVERAGE_COHORT_SEED,
  FACE_LAB_V2_COVERAGE_COHORT_SIZE,
  FACE_LAB_V2_COVERAGE_COHORT_VERSION,
  FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
  FACE_LAB_V2_EXECUTION_DOMAIN_MAP,
  FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN,
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE,
  FACE_LAB_V2_LOCKED_COHORT_VERSION,
  FACE_LAB_V2_METAMORPHIC_RELATIONS
} from "./contracts.js";
import {
  runFaceLabV2AxisConsumptionEvaluation
} from "./axis-consumption.js";
import {
  runFaceLabV2TargetResponsivenessEvaluation
} from "./target-responsiveness.js";

export const FACE_LAB_V2_EVALUATION_HARNESS_VERSION =
  "face-lab-v2-recommendation-evaluation-harness-v4";

const TARGET_KEYS = Object.freeze(Object.keys(TARGET_STYLE_REGISTRY));
const PRESENTATION_VALUES = Object.freeze([
  "neutral_examples",
  "masculine_examples",
  "feminine_examples"
]);
const CHANGE_TOLERANCES = Object.freeze(["minimal", "light", "moderate", "high"]);
const MAKEUP_INTENSITIES = Object.freeze(["light", "medium", "expressive"]);
const DAILY_MINUTES = Object.freeze([5, 15, 30]);
const BUDGET_BANDS = Object.freeze(["low", "standard"]);
const MAINTENANCE_VALUES = Object.freeze(["low", "medium"]);
const STYLING_DOMAINS = Object.freeze([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

const COVERAGE_SCOPE_PROFILES = Object.freeze([
  Object.freeze({
    id: "hair_only",
    stylingScope: ["hair"],
    hardExclusions: []
  }),
  Object.freeze({
    id: "makeup_only",
    stylingScope: ["makeup"],
    hardExclusions: []
  }),
  Object.freeze({
    id: "grooming_pair",
    stylingScope: ["brow_grooming", "facial_hair"],
    hardExclusions: []
  }),
  Object.freeze({
    id: "adjacent_accessory_set",
    stylingScope: ["color", "eyewear", "accessories"],
    hardExclusions: []
  }),
  Object.freeze({
    id: "hair_makeup_no_dye",
    stylingScope: ["hair", "makeup"],
    hardExclusions: ["hair_dye"]
  }),
  Object.freeze({
    id: "hair_brow_eyewear_brow_disabled",
    stylingScope: ["hair", "brow_grooming", "eyewear"],
    hardExclusions: ["brow_grooming_disabled"]
  }),
  Object.freeze({
    id: "makeup_color_accessories_makeup_disabled",
    stylingScope: ["makeup", "color", "accessories"],
    hardExclusions: ["makeup_disabled"]
  }),
  Object.freeze({
    id: "all_domains_facial_hair_disabled",
    stylingScope: [...STYLING_DOMAINS],
    hardExclusions: ["facial_hair_disabled"]
  })
]);

const ADVERSARIAL_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "all_excludable_domains_disabled",
    stylingScope: [
      "hair",
      "brow_grooming",
      "makeup",
      "eyewear",
      "accessories",
      "facial_hair"
    ],
    hardExclusions: [
      "hair_disabled",
      "brow_grooming_disabled",
      "makeup_disabled",
      "eyewear_disabled",
      "accessories_disabled",
      "facial_hair_disabled"
    ],
    changeTolerance: "minimal",
    makeupIntensity: "light",
    dailyMinutes: 5,
    budgetBand: "low",
    maintenanceTolerance: "low"
  }),
  Object.freeze({
    id: "makeup_only_but_disabled",
    stylingScope: ["makeup"],
    hardExclusions: ["makeup_disabled"],
    changeTolerance: "moderate",
    makeupIntensity: "expressive",
    dailyMinutes: 30,
    budgetBand: "standard",
    maintenanceTolerance: "medium"
  }),
  Object.freeze({
    id: "grooming_pair_brow_disabled",
    stylingScope: ["brow_grooming", "facial_hair"],
    hardExclusions: ["brow_grooming_disabled"],
    changeTolerance: "light",
    makeupIntensity: "light",
    dailyMinutes: 15,
    budgetBand: "low",
    maintenanceTolerance: "low"
  }),
  Object.freeze({
    id: "grooming_pair_facial_hair_disabled",
    stylingScope: ["brow_grooming", "facial_hair"],
    hardExclusions: ["facial_hair_disabled"],
    changeTolerance: "light",
    makeupIntensity: "light",
    dailyMinutes: 15,
    budgetBand: "low",
    maintenanceTolerance: "low"
  }),
  Object.freeze({
    id: "hair_only_but_disabled",
    stylingScope: ["hair"],
    hardExclusions: ["hair_disabled"],
    changeTolerance: "high",
    makeupIntensity: "light",
    dailyMinutes: 30,
    budgetBand: "standard",
    maintenanceTolerance: "medium"
  }),
  Object.freeze({
    id: "extreme_low_effort",
    stylingScope: [...STYLING_DOMAINS],
    hardExclusions: [],
    changeTolerance: "minimal",
    makeupIntensity: "light",
    dailyMinutes: 5,
    budgetBand: "low",
    maintenanceTolerance: "low"
  }),
  Object.freeze({
    id: "high_change_expressive",
    stylingScope: ["makeup", "color", "accessories"],
    hardExclusions: [],
    changeTolerance: "high",
    makeupIntensity: "expressive",
    dailyMinutes: 30,
    budgetBand: "standard",
    maintenanceTolerance: "medium"
  }),
  Object.freeze({
    id: "hair_makeup_both_disabled",
    stylingScope: ["hair", "makeup"],
    hardExclusions: ["hair_disabled", "makeup_disabled"],
    changeTolerance: "moderate",
    makeupIntensity: "medium",
    dailyMinutes: 15,
    budgetBand: "standard",
    maintenanceTolerance: "medium"
  })
]);

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}

function pickUnique(values, count, random) {
  const pool = [...values];
  const result = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function buildRawObservation(caseId, random) {
  const observations = {};

  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [key, values] of Object.entries(fields)) {
      const arrayField = group === "featureLayout" && key === "focalFeatures";
      const count = arrayField && random() > 0.6 ? 2 : 1;
      observations[group][key] = {
        value: arrayField
          ? pickUnique(values, count, random)
          : pick(values, random),
        visibility: "clear",
        evidence: [`eval:${caseId}:${group}.${key}`],
        unavailableReason: null
      };
    }
  }

  return {
    quality: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: {
        yaw: "frontal",
        pitch: "level",
        roll: "level"
      },
      occlusion: {
        forehead: "none",
        brows: "none",
        eyes: "none",
        cheeks: "none",
        jawline: "none"
      },
      sharpness: "clear",
      exposure: "balanced",
      lightingUniformity: "even",
      whiteBalance: "stable",
      filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable",
      colorSuitability: "suitable",
      evidence: [`eval:${caseId}:quality`]
    },
    observations
  };
}

function buildSurvey(caseId, random) {
  const targetSelections = pickUnique(
    TARGET_KEYS,
    random() > 0.55 ? 2 : 1,
    random
  );
  const stylingScope = pickUnique(
    STYLING_DOMAINS,
    2 + Math.floor(random() * 4),
    random
  );
  const hardExclusions = [];

  if (random() > 0.72) {
    const excludable = stylingScope.filter(
      (domain) => FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN[domain]
    );
    if (excludable.length) {
      hardExclusions.push(
        FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN[pick(excludable, random)]
      );
    }
  }

  if (stylingScope.includes("hair") && random() > 0.82) {
    hardExclusions.push("hair_dye");
  }

  return {
    schemaVersion: "face-lab-target-style-survey-v1",
    entryMode: "known",
    targetSelections,
    clarifiers: {
      softSharp: null,
      naturalPolished: null
    },
    presentationPreference: pick(PRESENTATION_VALUES, random),
    stylingScope,
    changeTolerance: pick(CHANGE_TOLERANCES, random),
    contexts: ["daily"],
    constraints: {
      hair: {
        lengthChange: random() > 0.72 ? "large" : "small",
        dye: random() > 0.78 ? "yes" : "no"
      },
      makeup: {
        intensity: pick(MAKEUP_INTENSITIES, random)
      },
      lifestyle: {
        dailyMinutes: pick(DAILY_MINUTES, random),
        budgetBand: pick(BUDGET_BANDS, random),
        maintenanceTolerance: pick(MAINTENANCE_VALUES, random)
      },
      hardExclusions: [...new Set(hardExclusions)]
    },
    approvedAt: "2026-09-28T00:00:00.000Z",
    evaluationCaseId: caseId
  };
}

export function buildFaceLabV2EvaluationCohort({
  seed = FACE_LAB_V2_LOCKED_COHORT_SEED,
  caseCount = FACE_LAB_V2_LOCKED_COHORT_SIZE
} = {}) {
  const random = mulberry32(fnv1a32(seed));
  const cases = [];

  for (let index = 0; index < caseCount; index += 1) {
    const caseId = `FL-EVAL-${String(index + 1).padStart(4, "0")}`;
    const rawObservation = buildRawObservation(caseId, random);
    const analysis = buildFaceLabObservationAnalysis(rawObservation, {
      eligibility: { faceLabEligible: true },
      provider: "evaluation_fixture",
      model: "face-lab-v2-core-eval-v1"
    });
    const surveyAnswers = buildSurvey(caseId, random);

    cases.push({
      caseId,
      cohort: "LOCKED_REGRESSION",
      analysis,
      surveyAnswers,
      provenance: {
        source: "synthetic_structured_observation",
        generationIntentIsGroundTruth: false,
        seed,
        cohortVersion: FACE_LAB_V2_LOCKED_COHORT_VERSION
      }
    });
  }

  const cohortPayload = cases.map((item) => ({
    caseId: item.caseId,
    analysis: item.analysis,
    surveyAnswers: item.surveyAnswers
  }));

  return {
    cohortVersion: FACE_LAB_V2_LOCKED_COHORT_VERSION,
    seed,
    caseCount: cases.length,
    cohortHash: sha256(stableStringify(cohortPayload)),
    cases
  };
}

function buildCohortResult({ cases, cohortVersion, seed }) {
  const cohortPayload = cases.map((item) => ({
    caseId: item.caseId,
    analysis: item.analysis,
    surveyAnswers: item.surveyAnswers
  }));

  return {
    cohortVersion,
    seed,
    caseCount: cases.length,
    cohortHash: sha256(stableStringify(cohortPayload)),
    cases
  };
}

export function buildFaceLabV2CoverageCohort({
  seed = FACE_LAB_V2_COVERAGE_COHORT_SEED,
  caseCount = FACE_LAB_V2_COVERAGE_COHORT_SIZE
} = {}) {
  const random = mulberry32(fnv1a32(seed));
  const cases = [];
  const boundedCount = Math.max(
    1,
    Math.min(caseCount, TARGET_KEYS.length * COVERAGE_SCOPE_PROFILES.length)
  );

  let sequence = 0;
  for (let targetIndex = 0; targetIndex < TARGET_KEYS.length; targetIndex += 1) {
    for (
      let profileIndex = 0;
      profileIndex < COVERAGE_SCOPE_PROFILES.length;
      profileIndex += 1
    ) {
      if (cases.length >= boundedCount) break;

      sequence += 1;
      const caseId = `FL-COV-${String(sequence).padStart(4, "0")}`;
      const profile = COVERAGE_SCOPE_PROFILES[profileIndex];
      const rawObservation = buildRawObservation(caseId, random);
      const analysis = buildFaceLabObservationAnalysis(rawObservation, {
        eligibility: { faceLabEligible: true },
        provider: "evaluation_fixture",
        model: "face-lab-v2-coverage-eval-v1"
      });

      const surveyAnswers = {
        schemaVersion: "face-lab-target-style-survey-v1",
        entryMode: "known",
        targetSelections: [TARGET_KEYS[targetIndex]],
        clarifiers: {
          softSharp: null,
          naturalPolished: null
        },
        presentationPreference:
          PRESENTATION_VALUES[(targetIndex + profileIndex) % PRESENTATION_VALUES.length],
        stylingScope: [...profile.stylingScope],
        changeTolerance:
          CHANGE_TOLERANCES[(targetIndex + profileIndex) % CHANGE_TOLERANCES.length],
        contexts: ["daily"],
        constraints: {
          hair: {
            lengthChange: profileIndex % 2 === 0 ? "small" : "large",
            dye: profile.stylingScope.includes("hair") && profileIndex % 3 === 1
              ? "yes"
              : "no"
          },
          makeup: {
            intensity:
              MAKEUP_INTENSITIES[(targetIndex + profileIndex) % MAKEUP_INTENSITIES.length]
          },
          lifestyle: {
            dailyMinutes:
              DAILY_MINUTES[(targetIndex + profileIndex) % DAILY_MINUTES.length],
            budgetBand:
              BUDGET_BANDS[(targetIndex + profileIndex) % BUDGET_BANDS.length],
            maintenanceTolerance:
              MAINTENANCE_VALUES[
                (targetIndex + profileIndex) % MAINTENANCE_VALUES.length
              ]
          },
          hardExclusions: [...profile.hardExclusions]
        },
        approvedAt: "2026-09-28T00:00:00.000Z",
        evaluationCaseId: caseId
      };

      cases.push({
        caseId,
        cohort: "COVERAGE",
        analysis,
        surveyAnswers,
        tags: [
          `target:${TARGET_KEYS[targetIndex]}`,
          `scope_profile:${profile.id}`
        ],
        provenance: {
          source: "synthetic_structured_observation",
          generationIntentIsGroundTruth: false,
          samplingSemantics: "designed_coverage_not_population_prevalence",
          seed,
          cohortVersion: FACE_LAB_V2_COVERAGE_COHORT_VERSION
        }
      });
    }
    if (cases.length >= boundedCount) break;
  }

  return buildCohortResult({
    cases,
    cohortVersion: FACE_LAB_V2_COVERAGE_COHORT_VERSION,
    seed
  });
}

export function buildFaceLabV2AdversarialCohort({
  seed = FACE_LAB_V2_ADVERSARIAL_COHORT_SEED,
  caseCount = FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE
} = {}) {
  const random = mulberry32(fnv1a32(seed));
  const cases = [];
  const maxCases = ADVERSARIAL_SCENARIOS.length * 4;
  const boundedCount = Math.max(1, Math.min(caseCount, maxCases));
  let sequence = 0;

  for (let round = 0; round < 4; round += 1) {
    for (
      let scenarioIndex = 0;
      scenarioIndex < ADVERSARIAL_SCENARIOS.length;
      scenarioIndex += 1
    ) {
      if (cases.length >= boundedCount) break;

      sequence += 1;
      const caseId = `FL-ADV-${String(sequence).padStart(4, "0")}`;
      const scenario = ADVERSARIAL_SCENARIOS[scenarioIndex];
      const targetIndex =
        (round * ADVERSARIAL_SCENARIOS.length + scenarioIndex) %
        TARGET_KEYS.length;
      const targetSelections = [TARGET_KEYS[targetIndex]];

      if (round % 2 === 1) {
        const pairedTarget = TARGET_KEYS[(targetIndex + 5) % TARGET_KEYS.length];
        if (!targetSelections.includes(pairedTarget)) {
          targetSelections.push(pairedTarget);
        }
      }

      const rawObservation = buildRawObservation(caseId, random);
      const analysis = buildFaceLabObservationAnalysis(rawObservation, {
        eligibility: { faceLabEligible: true },
        provider: "evaluation_fixture",
        model: "face-lab-v2-adversarial-eval-v1"
      });

      const surveyAnswers = {
        schemaVersion: "face-lab-target-style-survey-v1",
        entryMode: "known",
        targetSelections,
        clarifiers: {
          softSharp: null,
          naturalPolished: null
        },
        presentationPreference:
          PRESENTATION_VALUES[(round + scenarioIndex) % PRESENTATION_VALUES.length],
        stylingScope: [...scenario.stylingScope],
        changeTolerance: scenario.changeTolerance,
        contexts: ["daily"],
        constraints: {
          hair: {
            lengthChange: round % 2 === 0 ? "small" : "large",
            dye: scenario.stylingScope.includes("hair") && round % 2 === 1
              ? "yes"
              : "no"
          },
          makeup: {
            intensity: scenario.makeupIntensity
          },
          lifestyle: {
            dailyMinutes: scenario.dailyMinutes,
            budgetBand: scenario.budgetBand,
            maintenanceTolerance: scenario.maintenanceTolerance
          },
          hardExclusions: [...scenario.hardExclusions]
        },
        approvedAt: "2026-09-28T00:00:00.000Z",
        evaluationCaseId: caseId
      };

      cases.push({
        caseId,
        cohort: "ADVERSARIAL",
        analysis,
        surveyAnswers,
        tags: [
          `scenario:${scenario.id}`,
          ...targetSelections.map((target) => `target:${target}`)
        ],
        provenance: {
          source: "synthetic_structured_observation",
          generationIntentIsGroundTruth: false,
          samplingSemantics: "adversarial_stress_not_failure_prevalence",
          seed,
          cohortVersion: FACE_LAB_V2_ADVERSARIAL_COHORT_VERSION
        }
      });
    }
    if (cases.length >= boundedCount) break;
  }

  return buildCohortResult({
    cases,
    cohortVersion: FACE_LAB_V2_ADVERSARIAL_COHORT_VERSION,
    seed
  });
}

function requestedDomain(surveyAnswers, domain) {
  return surveyAnswers.stylingScope.includes(domain);
}

function exclusionSet(surveyAnswers) {
  return new Set(surveyAnswers.constraints?.hardExclusions || []);
}

function domainDisabled(surveyAnswers, domain) {
  const key = FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN[domain];
  return Boolean(key && exclusionSet(surveyAnswers).has(key));
}

function routeActions(canonical) {
  return (canonical.routes?.routes || []).flatMap((route) => route.actions || []);
}

function selectedRoute(canonical) {
  return (canonical.routes?.routes || []).find(
    (route) => route.routeId === canonical.routes?.selectedRouteId
  ) || null;
}

function executionRequested(surveyAnswers, executionDomain) {
  if (executionDomain === "grooming") {
    const brow = requestedDomain(surveyAnswers, "brow_grooming") &&
      !domainDisabled(surveyAnswers, "brow_grooming");
    const facial = requestedDomain(surveyAnswers, "facial_hair") &&
      !domainDisabled(surveyAnswers, "facial_hair");
    return brow || facial;
  }

  return requestedDomain(surveyAnswers, executionDomain) &&
    !domainDisabled(surveyAnswers, executionDomain);
}

function semanticProjection(canonical) {
  return {
    currentFaceProfile: canonical.currentFaceProfile,
    styleDelta: canonical.styleDelta,
    routes: canonical.routes,
    hair: canonical.hair,
    grooming: canonical.grooming,
    makeup: canonical.makeup,
    color: canonical.color,
    eyewear: canonical.eyewear,
    accessories: canonical.accessories,
    looks: canonical.looks,
    productHandoff: canonical.productHandoff
  };
}

function addFailure(failures, {
  caseId,
  evaluatorId,
  relationId = null,
  severity = "hard",
  expected,
  observed,
  likelyLayer = "recommendation_core"
}) {
  const fingerprint = sha256(stableStringify({
    evaluatorId,
    relationId,
    expected,
    observed
  })).slice(0, 16);

  failures.push({
    caseId,
    evaluatorId,
    relationId,
    severity,
    expected,
    observed,
    likelyLayer,
    fingerprint
  });
}

function evaluateContract(caseDef, canonical, failures) {
  const { caseId, surveyAnswers } = caseDef;
  const exclusions = exclusionSet(surveyAnswers);

  if (canonical.targetStyle?.status !== "available") {
    addFailure(failures, {
      caseId,
      evaluatorId: "E1-target-authority",
      expected: "available",
      observed: canonical.targetStyle?.status || null
    });
  }

  for (const action of routeActions(canonical)) {
    if (!surveyAnswers.stylingScope.includes(action.domain)) {
      addFailure(failures, {
        caseId,
        evaluatorId: "E1-scope-leakage",
        expected: "route action domain must be requested",
        observed: action.domain
      });
    }

    const exclusion = FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN[action.domain];
    if (exclusion && exclusions.has(exclusion)) {
      addFailure(failures, {
        caseId,
        evaluatorId: "E1-hard-exclusion-leakage",
        expected: `${action.domain} excluded`,
        observed: `${action.domain} route action survived`
      });
    }
  }

  for (const executionDomain of Object.keys(FACE_LAB_V2_EXECUTION_DOMAIN_MAP)) {
    const requested = executionRequested(surveyAnswers, executionDomain);
    if (!requested && canonical[executionDomain]?.status !== "not_requested") {
      addFailure(failures, {
        caseId,
        evaluatorId: "E1-execution-request-state",
        expected: `${executionDomain}:not_requested`,
        observed: `${executionDomain}:${canonical[executionDomain]?.status || "missing"}`
      });
    }
  }

  const groomingRequested = executionRequested(surveyAnswers, "grooming");
  if (!groomingRequested && canonical.grooming?.status !== "not_requested") {
    addFailure(failures, {
      caseId,
      evaluatorId: "E1-grooming-request-state",
      expected: "grooming:not_requested",
      observed: `grooming:${canonical.grooming?.status || "missing"}`
    });
  }

  if (!executionRequested(surveyAnswers, "makeup") &&
      canonical.productHandoff?.status !== "not_requested") {
    addFailure(failures, {
      caseId,
      evaluatorId: "E1-product-handoff-makeup-boundary",
      expected: "productHandoff:not_requested",
      observed: `productHandoff:${canonical.productHandoff?.status || "missing"}`
    });
  }

  const expectedLookDomains = [
    "hair",
    "grooming",
    "makeup",
    "color",
    "eyewear",
    "accessories"
  ].filter((domain) => canonical[domain]?.status === "available");

  const actualLookDomains = canonical.looks?.looks?.[0]?.pieces?.map(
    (piece) => piece.domain
  ) || [];

  if (stableStringify(expectedLookDomains) !== stableStringify(actualLookDomains)) {
    addFailure(failures, {
      caseId,
      evaluatorId: "E1-look-execution-boundary",
      expected: expectedLookDomains,
      observed: actualLookDomains
    });
  }

  const selected = selectedRoute(canonical);
  if (canonical.routes?.selectedRouteId && !selected) {
    addFailure(failures, {
      caseId,
      evaluatorId: "E1-selected-route-authority",
      expected: "selectedRouteId references an emitted route",
      observed: canonical.routes.selectedRouteId
    });
  }

  return failures;
}

function rotatePresentation(value) {
  const index = PRESENTATION_VALUES.indexOf(value);
  return PRESENTATION_VALUES[(index + 1) % PRESENTATION_VALUES.length];
}

function alternateTargetSelections(targetSelections) {
  const blocked = new Set(targetSelections || []);
  const replacement = TARGET_KEYS.find((key) => !blocked.has(key));
  return replacement ? [replacement] : [TARGET_KEYS[0]];
}

function relationFailure(failures, caseId, relationId, expected, observed) {
  addFailure(failures, {
    caseId,
    evaluatorId: "E2-metamorphic",
    relationId,
    expected,
    observed
  });
}

function evaluatePresentationInvariant(caseDef, canonical, failures) {
  const nextSurvey = clone(caseDef.surveyAnswers);
  nextSurvey.presentationPreference = rotatePresentation(
    nextSurvey.presentationPreference
  );

  const mutated = buildFaceLabV2Canonical({
    analysis: caseDef.analysis,
    surveyAnswers: nextSurvey,
    resultId: `${caseDef.caseId}-mr001`
  });

  if (
    stableStringify(semanticProjection(canonical)) !==
    stableStringify(semanticProjection(mutated))
  ) {
    relationFailure(
      failures,
      caseDef.caseId,
      "FL-MR-001",
      "canonical recommendation semantics unchanged",
      "semantic projection changed"
    );
  }
}

function evaluateTargetEditInvariant(caseDef, canonical, failures) {
  const nextSurvey = clone(caseDef.surveyAnswers);
  nextSurvey.targetSelections = alternateTargetSelections(
    nextSurvey.targetSelections
  );

  const mutated = buildFaceLabV2Canonical({
    analysis: caseDef.analysis,
    surveyAnswers: nextSurvey,
    resultId: `${caseDef.caseId}-mr002`
  });

  if (
    stableStringify(canonical.currentFaceProfile) !==
    stableStringify(mutated.currentFaceProfile)
  ) {
    relationFailure(
      failures,
      caseDef.caseId,
      "FL-MR-002",
      "currentFaceProfile invariant under target edit",
      "currentFaceProfile changed"
    );
  }

  if (
    stableStringify(canonical.targetStyle?.targetLabels) ===
    stableStringify(mutated.targetStyle?.targetLabels)
  ) {
    relationFailure(
      failures,
      caseDef.caseId,
      "FL-MR-002",
      "target authority changes after target edit",
      "target labels did not change"
    );
  }
}

function evaluateHardExclusionRelation(caseDef, failures) {
  const domain = caseDef.surveyAnswers.stylingScope.find(
    (item) => FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN[item]
  );
  if (!domain) return;

  const nextSurvey = clone(caseDef.surveyAnswers);
  const exclusion = FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN[domain];
  nextSurvey.constraints.hardExclusions = [
    ...new Set([...(nextSurvey.constraints.hardExclusions || []), exclusion])
  ];

  const mutated = buildFaceLabV2Canonical({
    analysis: caseDef.analysis,
    surveyAnswers: nextSurvey,
    resultId: `${caseDef.caseId}-mr003`
  });

  const leaked = routeActions(mutated).filter(
    (action) => action.domain === domain
  );
  if (leaked.length) {
    relationFailure(
      failures,
      caseDef.caseId,
      "FL-MR-003",
      `${domain} route actions removed`,
      leaked.map((item) => `${item.domain}:${item.parameter}`)
    );
  }

  const directExecution = FACE_LAB_V2_EXECUTION_DOMAIN_MAP[domain];
  if (directExecution && mutated[directExecution]?.status !== "not_requested") {
    relationFailure(
      failures,
      caseDef.caseId,
      "FL-MR-003",
      `${directExecution}:not_requested`,
      `${directExecution}:${mutated[directExecution]?.status || "missing"}`
    );
  }

  if (domain === "brow_grooming" || domain === "facial_hair") {
    const other = domain === "brow_grooming" ? "facial_hair" : "brow_grooming";
    const otherStillRequested =
      nextSurvey.stylingScope.includes(other) &&
      !domainDisabled(nextSurvey, other);

    if (!otherStillRequested && mutated.grooming?.status !== "not_requested") {
      relationFailure(
        failures,
        caseDef.caseId,
        "FL-MR-003",
        "grooming:not_requested when both grooming subdomains are inactive",
        `grooming:${mutated.grooming?.status || "missing"}`
      );
    }
  }
}

function evaluateMinimalToleranceRelation(caseDef, failures) {
  const nextSurvey = clone(caseDef.surveyAnswers);
  nextSurvey.changeTolerance = "minimal";

  const mutated = buildFaceLabV2Canonical({
    analysis: caseDef.analysis,
    surveyAnswers: nextSurvey,
    resultId: `${caseDef.caseId}-mr004`
  });

  for (const route of mutated.routes?.routes || []) {
    if (route.changeMagnitude !== "low") {
      relationFailure(
        failures,
        caseDef.caseId,
        "FL-MR-004",
        "route.changeMagnitude=low",
        `${route.routeId}:${route.changeMagnitude}`
      );
    }

    for (const action of route.actions || []) {
      if (action.strength !== "light") {
        relationFailure(
          failures,
          caseDef.caseId,
          "FL-MR-004",
          "all minimal-tolerance route actions use light strength",
          `${route.routeId}:${action.domain}:${action.parameter}:${action.strength}`
        );
      }
    }
  }
}

function evaluateMetamorphic(caseDef, canonical, failures) {
  evaluatePresentationInvariant(caseDef, canonical, failures);
  evaluateTargetEditInvariant(caseDef, canonical, failures);
  evaluateHardExclusionRelation(caseDef, failures);
  evaluateMinimalToleranceRelation(caseDef, failures);
}

function increment(counter, key) {
  if (!key) return;
  counter[key] = (counter[key] || 0) + 1;
}

function selectedActionSignature(canonical) {
  const route = selectedRoute(canonical);
  if (!route) return null;

  return (route.actions || [])
    .map((item) => `${item.domain}:${item.parameter}:${item.direction}:${item.strength}`)
    .sort()
    .join("|");
}

function maxConcentration(counter, denominator) {
  if (!denominator) return 0;
  const max = Math.max(0, ...Object.values(counter));
  return Number((max / denominator).toFixed(4));
}

export function classifyFaceLabV2NoRoute(canonical) {
  if ((canonical?.routes?.routes || []).length > 0) return null;

  const priorities = Array.isArray(canonical?.styleDelta?.priorities)
    ? canonical.styleDelta.priorities
    : [];
  const active = priorities.filter((item) => item?.constraintState !== "blocked");
  const blocked = priorities.filter((item) => item?.constraintState === "blocked");

  if (!active.length && blocked.length) {
    return {
      classification: "EXPECTED_CONSTRAINT_BOUNDED_NO_ROUTE",
      activePriorityCount: 0,
      blockedPriorityCount: blocked.length,
      blockedBy: [...new Set(blocked.map((item) => item.blockedBy).filter(Boolean))]
    };
  }

  if (!active.length) {
    return {
      classification: "EXPECTED_NO_ACTIONABLE_STYLE_DELTA",
      activePriorityCount: 0,
      blockedPriorityCount: blocked.length,
      blockedBy: []
    };
  }

  return {
    classification: "UNEXPECTED_ROUTE_GENERATION_GAP",
    activePriorityCount: active.length,
    blockedPriorityCount: blocked.length,
    blockedBy: [...new Set(blocked.map((item) => item.blockedBy).filter(Boolean))]
  };
}

export function evaluateFaceLabV2RecommendationCase(caseDef) {
  const failures = [];
  const canonical = buildFaceLabV2Canonical({
    analysis: caseDef.analysis,
    surveyAnswers: caseDef.surveyAnswers,
    resultId: caseDef.caseId
  });

  evaluateContract(caseDef, canonical, failures);
  evaluateMetamorphic(caseDef, canonical, failures);

  const route = selectedRoute(canonical);
  let noRouteDiagnostic = null;

  if (!route) {
    noRouteDiagnostic = classifyFaceLabV2NoRoute(canonical);
    const classification =
      noRouteDiagnostic?.classification || "UNEXPECTED_ROUTE_GENERATION_GAP";

    if (classification === "UNEXPECTED_ROUTE_GENERATION_GAP") {
      addFailure(failures, {
        caseId: caseDef.caseId,
        evaluatorId: "E1-unexpected-route-generation-gap",
        expected: "at least one route when actionable priorities exist",
        observed: noRouteDiagnostic,
        likelyLayer: "route_generator"
      });
    }
  }

  return {
    caseId: caseDef.caseId,
    canonical,
    route,
    noRouteDiagnostic,
    failures
  };
}

function evaluateCohort(cohort) {
  const failures = [];
  const routeStrategyCounts = {};
  const actionDomainCounts = {};
  const actionSignatureCounts = {};
  const canonicalStatusCounts = {};
  const noRouteClassificationCounts = {};
  const noRouteCases = [];
  let selectedRouteCaseCount = 0;
  let noRouteCount = 0;

  for (const caseDef of cohort.cases) {
    const evaluated = evaluateFaceLabV2RecommendationCase(caseDef);
    const { canonical, route, noRouteDiagnostic } = evaluated;
    failures.push(...evaluated.failures);

    increment(canonicalStatusCounts, canonical.status || "missing");

    if (route) {
      selectedRouteCaseCount += 1;
      increment(routeStrategyCounts, route.strategy || route.routeId);
      for (const action of route.actions || []) {
        increment(actionDomainCounts, action.domain);
      }
      increment(actionSignatureCounts, selectedActionSignature(canonical));
      continue;
    }

    noRouteCount += 1;
    const classification =
      noRouteDiagnostic?.classification || "UNEXPECTED_ROUTE_GENERATION_GAP";
    increment(noRouteClassificationCounts, classification);

    noRouteCases.push({
      caseId: caseDef.caseId,
      classification,
      targetSelections: [...(caseDef.surveyAnswers.targetSelections || [])],
      stylingScope: [...(caseDef.surveyAnswers.stylingScope || [])],
      hardExclusions: [...(caseDef.surveyAnswers.constraints?.hardExclusions || [])],
      activePriorityCount: noRouteDiagnostic?.activePriorityCount ?? null,
      blockedPriorityCount: noRouteDiagnostic?.blockedPriorityCount ?? null,
      blockedBy: noRouteDiagnostic?.blockedBy || [],
      tags: [...(caseDef.tags || [])]
    });
  }

  const hardFailures = failures.filter((item) => item.severity === "hard");
  const contractFailures = hardFailures.filter((item) => item.evaluatorId.startsWith("E1-"));
  const metamorphicFailures = hardFailures.filter((item) => item.evaluatorId === "E2-metamorphic");

  return {
    reportVersion: "face-lab-v2-recommendation-evaluation-report-v2",
    harnessVersion: FACE_LAB_V2_EVALUATION_HARNESS_VERSION,
    contractVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
    relationRegistryVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
    relationIds: FACE_LAB_V2_METAMORPHIC_RELATIONS.map((item) => item.relationId),
    cohort: {
      version: cohort.cohortVersion,
      seed: cohort.seed,
      caseCount: cohort.caseCount,
      hash: cohort.cohortHash
    },
    summary: {
      hardFailureCount: hardFailures.length,
      contractFailureCount: contractFailures.length,
      metamorphicFailureCount: metamorphicFailures.length,
      noRouteCount,
      unexpectedNoRouteCount:
        noRouteClassificationCounts.UNEXPECTED_ROUTE_GENERATION_GAP || 0,
      selectedRouteCaseCount,
      canonicalStatusCounts,
      noRouteClassificationCounts,
      routeStrategyCounts,
      actionDomainCounts,
      uniqueActionSignatureCount: Object.keys(actionSignatureCounts).length,
      selectedRouteConcentration: maxConcentration(routeStrategyCounts, selectedRouteCaseCount),
      actionSignatureConcentration: maxConcentration(actionSignatureCounts, selectedRouteCaseCount)
    },
    noRouteCases,
    failures
  };
}

export function runFaceLabV2RecommendationEvaluation({
  seed = FACE_LAB_V2_LOCKED_COHORT_SEED,
  caseCount = FACE_LAB_V2_LOCKED_COHORT_SIZE
} = {}) {
  return evaluateCohort(buildFaceLabV2EvaluationCohort({ seed, caseCount }));
}

export function runFaceLabV2CoverageEvaluation({
  seed = FACE_LAB_V2_COVERAGE_COHORT_SEED,
  caseCount = FACE_LAB_V2_COVERAGE_COHORT_SIZE
} = {}) {
  return evaluateCohort(buildFaceLabV2CoverageCohort({ seed, caseCount }));
}

export function runFaceLabV2AdversarialEvaluation({
  seed = FACE_LAB_V2_ADVERSARIAL_COHORT_SEED,
  caseCount = FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE
} = {}) {
  return evaluateCohort(buildFaceLabV2AdversarialCohort({ seed, caseCount }));
}

export function runFaceLabV2EvaluationSuite() {
  const locked = runFaceLabV2RecommendationEvaluation();
  const coverage = runFaceLabV2CoverageEvaluation();
  const adversarial = runFaceLabV2AdversarialEvaluation();
  const targetResponsiveness = runFaceLabV2TargetResponsivenessEvaluation();
  const axisConsumption = runFaceLabV2AxisConsumptionEvaluation();

  return {
    suiteVersion: "face-lab-v2-recommendation-evaluation-suite-v3",
    harnessVersion: FACE_LAB_V2_EVALUATION_HARNESS_VERSION,
    contractVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
    reports: {
      locked,
      coverage,
      adversarial,
      targetResponsiveness,
      axisConsumption
    },
    summary: {
      caseCount:
        locked.cohort.caseCount +
        coverage.cohort.caseCount +
        adversarial.cohort.caseCount +
        targetResponsiveness.cohort.caseCount,
      hardFailureCount:
        locked.summary.hardFailureCount +
        coverage.summary.hardFailureCount +
        adversarial.summary.hardFailureCount +
        targetResponsiveness.summary.hardFailureCount +
        axisConsumption.summary.hardFailureCount,
      unexpectedNoRouteCount:
        locked.summary.unexpectedNoRouteCount +
        coverage.summary.unexpectedNoRouteCount +
        adversarial.summary.unexpectedNoRouteCount,
      targetCollapsedFaceCount:
        targetResponsiveness.summary.collapsedFaceCount,
      targetContrastPairCollisionCount:
        targetResponsiveness.summary.contrastPairCollisionCount,
      fullyConsumedAxisCount:
        axisConsumption.summary.fullyConsumedAxisCount,
      styleAxisCount:
        axisConsumption.summary.axisCount
    }
  };
}
