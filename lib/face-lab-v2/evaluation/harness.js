import { createHash } from "node:crypto";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { TARGET_STYLE_REGISTRY } from "../target-style-registry.js";
import {
  FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
  FACE_LAB_V2_EXECUTION_DOMAIN_MAP,
  FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN,
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE,
  FACE_LAB_V2_LOCKED_COHORT_VERSION,
  FACE_LAB_V2_METAMORPHIC_RELATIONS
} from "./contracts.js";

export const FACE_LAB_V2_EVALUATION_HARNESS_VERSION =
  "face-lab-v2-recommendation-evaluation-harness-v1";

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

export function runFaceLabV2RecommendationEvaluation({
  seed = FACE_LAB_V2_LOCKED_COHORT_SEED,
  caseCount = FACE_LAB_V2_LOCKED_COHORT_SIZE
} = {}) {
  const cohort = buildFaceLabV2EvaluationCohort({ seed, caseCount });
  const failures = [];
  const routeStrategyCounts = {};
  const actionDomainCounts = {};
  const actionSignatureCounts = {};
  const canonicalStatusCounts = {};
  let selectedRouteCaseCount = 0;
  let noRouteCount = 0;

  for (const caseDef of cohort.cases) {
    const canonical = buildFaceLabV2Canonical({
      analysis: caseDef.analysis,
      surveyAnswers: caseDef.surveyAnswers,
      resultId: caseDef.caseId
    });

    increment(canonicalStatusCounts, canonical.status || "missing");
    evaluateContract(caseDef, canonical, failures);
    evaluateMetamorphic(caseDef, canonical, failures);

    const route = selectedRoute(canonical);
    if (route) {
      selectedRouteCaseCount += 1;
      increment(routeStrategyCounts, route.strategy || route.routeId);
      for (const action of route.actions || []) {
        increment(actionDomainCounts, action.domain);
      }
      increment(actionSignatureCounts, selectedActionSignature(canonical));
    } else {
      noRouteCount += 1;
    }
  }

  const hardFailures = failures.filter((item) => item.severity === "hard");
  const contractFailures = hardFailures.filter(
    (item) => item.evaluatorId.startsWith("E1-")
  );
  const metamorphicFailures = hardFailures.filter(
    (item) => item.evaluatorId === "E2-metamorphic"
  );

  const report = {
    reportVersion: "face-lab-v2-recommendation-evaluation-report-v1",
    harnessVersion: FACE_LAB_V2_EVALUATION_HARNESS_VERSION,
    contractVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
    relationRegistryVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
    relationIds: FACE_LAB_V2_METAMORPHIC_RELATIONS.map(
      (item) => item.relationId
    ),
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
      selectedRouteCaseCount,
      canonicalStatusCounts,
      routeStrategyCounts,
      actionDomainCounts,
      uniqueActionSignatureCount: Object.keys(actionSignatureCounts).length,
      selectedRouteConcentration: maxConcentration(
        routeStrategyCounts,
        selectedRouteCaseCount
      ),
      actionSignatureConcentration: maxConcentration(
        actionSignatureCounts,
        selectedRouteCaseCount
      )
    },
    failures
  };

  return report;
}
