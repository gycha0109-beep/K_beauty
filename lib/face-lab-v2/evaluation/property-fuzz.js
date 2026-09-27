import { createHash } from "node:crypto";
import {
  buildFaceLabV2EvaluationCohort,
  evaluateFaceLabV2RecommendationCase
} from "./harness.js";

export const FACE_LAB_V2_PROPERTY_FUZZ_VERSION =
  "face-lab-v2-property-fuzz-evaluator-v1";

export const FACE_LAB_V2_PROPERTY_FUZZ_SEEDS = Object.freeze([
  "face-lab-v2-fuzz-a",
  "face-lab-v2-fuzz-b",
  "face-lab-v2-fuzz-c",
  "face-lab-v2-fuzz-d"
]);

export const FACE_LAB_V2_PROPERTY_FUZZ_CASES_PER_SEED = 128;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
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

function hash(value) {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function failureIdentity(failure) {
  return [
    failure?.evaluatorId || "unknown",
    failure?.relationId || ""
  ].join("|");
}

function sameFailure(evaluated, identity) {
  return (evaluated?.failures || []).some(
    (item) => failureIdentity(item) === identity
  );
}

function withSurvey(caseDef, surveyAnswers, suffix) {
  return {
    ...caseDef,
    caseId: `${caseDef.caseId}-shrink-${suffix}`,
    surveyAnswers
  };
}

function addCandidate(candidates, caseDef, surveyAnswers, label) {
  if (
    stableStringify(surveyAnswers) ===
    stableStringify(caseDef.surveyAnswers)
  ) {
    return;
  }

  candidates.push({
    label,
    caseDef: withSurvey(caseDef, surveyAnswers, label)
  });
}

function scopeSubsets(scope) {
  const unique = [...new Set(Array.isArray(scope) ? scope : [])];
  const subsets = unique.map((domain) => [domain]);

  if (unique.length > 2) {
    for (let left = 0; left < unique.length; left += 1) {
      for (let right = left + 1; right < unique.length; right += 1) {
        subsets.push([unique[left], unique[right]]);
      }
    }
  }

  return subsets;
}

function reductionCandidates(caseDef) {
  const candidates = [];
  const survey = caseDef.surveyAnswers || {};

  if ((survey.targetSelections || []).length > 1) {
    const next = clone(survey);
    next.targetSelections = [next.targetSelections[0]];
    addCandidate(candidates, caseDef, next, "target-one");
  }

  if (survey.presentationPreference !== "neutral_examples") {
    const next = clone(survey);
    next.presentationPreference = "neutral_examples";
    addCandidate(candidates, caseDef, next, "presentation-neutral");
  }

  for (const [index, scope] of scopeSubsets(survey.stylingScope).entries()) {
    const next = clone(survey);
    next.stylingScope = scope;
    addCandidate(candidates, caseDef, next, `scope-${index + 1}`);
  }

  const exclusions = survey.constraints?.hardExclusions || [];
  if (exclusions.length) {
    const none = clone(survey);
    none.constraints.hardExclusions = [];
    addCandidate(candidates, caseDef, none, "exclusion-none");

    exclusions.forEach((value, index) => {
      const next = clone(survey);
      next.constraints.hardExclusions = [value];
      addCandidate(candidates, caseDef, next, `exclusion-${index + 1}`);
    });
  }

  const scalarReductions = [
    {
      label: "change-light",
      apply(next) {
        next.changeTolerance = "light";
      }
    },
    {
      label: "makeup-medium",
      apply(next) {
        next.constraints.makeup.intensity = "medium";
      }
    },
    {
      label: "daily-15",
      apply(next) {
        next.constraints.lifestyle.dailyMinutes = 15;
      }
    },
    {
      label: "budget-standard",
      apply(next) {
        next.constraints.lifestyle.budgetBand = "standard";
      }
    },
    {
      label: "maintenance-medium",
      apply(next) {
        next.constraints.lifestyle.maintenanceTolerance = "medium";
      }
    },
    {
      label: "hair-small",
      apply(next) {
        next.constraints.hair.lengthChange = "small";
      }
    },
    {
      label: "hair-no-dye",
      apply(next) {
        next.constraints.hair.dye = "no";
      }
    }
  ];

  for (const reduction of scalarReductions) {
    const next = clone(survey);
    reduction.apply(next);
    addCandidate(candidates, caseDef, next, reduction.label);
  }

  return candidates;
}

export function minimizeFaceLabV2FuzzFailure(caseDef, failure, {
  maxPasses = 16
} = {}) {
  const identity = failureIdentity(failure);
  let current = clone(caseDef);
  const steps = [];

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let reduced = false;

    for (const candidate of reductionCandidates(current)) {
      const evaluated = evaluateFaceLabV2RecommendationCase(
        candidate.caseDef
      );

      if (!sameFailure(evaluated, identity)) continue;

      current = {
        ...candidate.caseDef,
        caseId: caseDef.caseId
      };
      steps.push(candidate.label);
      reduced = true;
      break;
    }

    if (!reduced) break;
  }

  const replay = evaluateFaceLabV2RecommendationCase(current);
  const minimizedFailure = replay.failures.find(
    (item) => failureIdentity(item) === identity
  ) || failure;

  return {
    failureIdentity: identity,
    steps,
    minimizedSurveyAnswers: current.surveyAnswers,
    minimizedFailure
  };
}

export function runFaceLabV2PropertyFuzzEvaluation({
  seeds = FACE_LAB_V2_PROPERTY_FUZZ_SEEDS,
  casesPerSeed = FACE_LAB_V2_PROPERTY_FUZZ_CASES_PER_SEED,
  shrinkLimit = 12
} = {}) {
  const failures = [];
  const counterexamples = [];
  const seedReports = [];
  let totalCaseCount = 0;
  let actionableCaseCount = 0;
  let noRouteCaseCount = 0;

  for (const seed of seeds) {
    const cohort = buildFaceLabV2EvaluationCohort({
      seed,
      caseCount: casesPerSeed
    });
    const seedFailures = [];

    cohort.cases.forEach((caseDef, caseIndex) => {
      totalCaseCount += 1;
      const evaluated = evaluateFaceLabV2RecommendationCase(caseDef);

      if (evaluated.route) {
        actionableCaseCount += 1;
      } else {
        noRouteCaseCount += 1;
      }

      for (const failure of evaluated.failures) {
        const record = {
          seed,
          caseIndex,
          caseId: caseDef.caseId,
          evaluatorId: failure.evaluatorId,
          relationId: failure.relationId || null,
          fingerprint: failure.fingerprint,
          failure
        };

        failures.push(record);
        seedFailures.push(record);

        if (counterexamples.length < shrinkLimit) {
          const minimized = minimizeFaceLabV2FuzzFailure(
            caseDef,
            failure
          );

          counterexamples.push({
            seed,
            caseIndex,
            caseId: caseDef.caseId,
            reproduction: {
              seed,
              caseIndex,
              casesPerSeed,
              evaluatorId: failure.evaluatorId,
              relationId: failure.relationId || null
            },
            originalSurveyHash: hash(caseDef.surveyAnswers),
            minimizedSurveyHash: hash(
              minimized.minimizedSurveyAnswers
            ),
            shrinkSteps: minimized.steps,
            minimizedSurveyAnswers:
              minimized.minimizedSurveyAnswers,
            minimizedFailure: minimized.minimizedFailure
          });
        }
      }
    });

    seedReports.push({
      seed,
      caseCount: cohort.caseCount,
      cohortHash: cohort.cohortHash,
      hardFailureCount: seedFailures.length,
      failureFingerprints: [
        ...new Set(seedFailures.map((item) => item.fingerprint))
      ]
    });
  }

  return {
    reportVersion: "face-lab-v2-property-fuzz-report-v1",
    evaluatorVersion: FACE_LAB_V2_PROPERTY_FUZZ_VERSION,
    configuration: {
      seeds: [...seeds],
      casesPerSeed,
      shrinkLimit
    },
    summary: {
      seedCount: seeds.length,
      totalCaseCount,
      actionableCaseCount,
      noRouteCaseCount,
      hardFailureCount: failures.length,
      uniqueFailureFingerprintCount: new Set(
        failures.map((item) => item.fingerprint)
      ).size,
      minimizedCounterexampleCount: counterexamples.length
    },
    seedReports,
    counterexamples,
    failures
  };
}
