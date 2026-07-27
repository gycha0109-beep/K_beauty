const CALIBRATED_AXES = Object.freeze([
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone"
]);

const LEVELS = Object.freeze(["none", "mild", "moderate", "high"]);

export const SKIN_QUANTIZATION_POLICIES = Object.freeze({
  conservative_0123_v1: Object.freeze({
    id: "conservative_0123_v1",
    version: 1,
    mapping: Object.freeze({ none: 0, mild: 1, moderate: 2, high: 3 })
  }),
  linear_0135_v1: Object.freeze({
    id: "linear_0135_v1",
    version: 1,
    mapping: Object.freeze({ none: 0, mild: 1, moderate: 3, high: 5 })
  }),
  capped_0124_v1: Object.freeze({
    id: "capped_0124_v1",
    version: 1,
    mapping: Object.freeze({ none: 0, mild: 1, moderate: 2, high: 4 })
  })
});

export const SKIN_QUANTIZATION_APPROVAL_GATE = Object.freeze({
  minimumPositivePairs: 30,
  minimumPairsPerAxis: 3,
  requiredAxes: CALIBRATED_AXES,
  allowedReferenceTypes: Object.freeze([
    "consented_real_label",
    "declared_synthetic_ground_truth"
  ]),
  requireDownstreamEngineReplay: true,
  requireProductRegression: true,
  requireRoutineRegression: true,
  maximumPriorityFlipRate: 0,
  maximumMeanAbsoluteError: 1
});

function clampSignal(value) {
  return Math.max(0, Math.min(5, Number(value) || 0));
}

function scoreMultiplier(axis) {
  return axis === "uv" ? 3 : 4;
}

function resolvePolicy(policyId) {
  const policy = SKIN_QUANTIZATION_POLICIES[policyId];
  if (!policy) throw new Error(`unknown_skin_quantization_policy:${policyId}`);
  return policy;
}

export function quantizeVisibleLevel(policyId, level) {
  const policy = resolvePolicy(policyId);
  if (!LEVELS.includes(level)) throw new Error(`invalid_visible_level:${level}`);
  return policy.mapping[level];
}

function sortConcernScores(scoreMap = {}, tieBreaker = []) {
  return Object.entries(scoreMap)
    .map(([axis, score]) => ({ axis, score: Number(score) || 0 }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return tieBreaker.indexOf(left.axis) - tieBreaker.indexOf(right.axis);
    });
}

function buildConcernScores(fixture, signals) {
  const baseline = fixture.baselineConcernScores || {};
  const axes = new Set([
    ...Object.keys(baseline),
    ...Object.keys(signals || {})
  ]);
  return Object.fromEntries([...axes].map((axis) => [
    axis,
    (Number(baseline[axis]) || 0) + clampSignal(signals?.[axis]) * scoreMultiplier(axis)
  ]));
}

function buildCandidateSignals(fixture, policyId) {
  const observations = fixture.observations || {};
  return Object.fromEntries(Object.entries(observations).map(([axis, observation]) => {
    if (observation?.status !== "available") return [axis, 0];
    return [axis, quantizeVisibleLevel(policyId, observation.level)];
  }));
}

function collectPositivePairs(fixtures, policyId) {
  const pairs = [];
  for (const fixture of fixtures) {
    for (const [axis, observation] of Object.entries(fixture.observations || {})) {
      if (!CALIBRATED_AXES.includes(axis)) continue;
      if (observation?.status !== "available") continue;
      if (!LEVELS.includes(observation.level) || observation.level === "none") continue;
      const reference = fixture.referenceSignals?.[axis];
      if (!Number.isFinite(Number(reference))) continue;
      pairs.push({
        fixtureId: fixture.id,
        axis,
        level: observation.level,
        candidate: quantizeVisibleLevel(policyId, observation.level),
        reference: clampSignal(reference),
        referenceType: fixture.referenceType || "unknown"
      });
    }
  }
  return pairs;
}

function evaluatePolicy(fixtures, policyId, gate = SKIN_QUANTIZATION_APPROVAL_GATE) {
  const pairs = collectPositivePairs(fixtures, policyId);
  const absoluteErrors = pairs.map((pair) => Math.abs(pair.candidate - pair.reference));
  const axisCounts = Object.fromEntries(CALIBRATED_AXES.map((axis) => [
    axis,
    pairs.filter((pair) => pair.axis === axis).length
  ]));
  const referenceTypes = [...new Set(pairs.map((pair) => pair.referenceType))];
  const provenanceEligible = pairs.length > 0 && pairs.every((pair) =>
    gate.allowedReferenceTypes.includes(pair.referenceType)
  );

  let priorityComparableCount = 0;
  let priorityFlipCount = 0;
  for (const fixture of fixtures) {
    if (!fixture.referenceSignals || !fixture.baselineConcernScores) continue;
    const tieBreaker = fixture.priorityTieBreaker || [];
    const referenceScores = buildConcernScores(fixture, fixture.referenceSignals);
    const candidateScores = buildConcernScores(fixture, buildCandidateSignals(fixture, policyId));
    const referencePriority = sortConcernScores(referenceScores, tieBreaker)[0]?.axis || null;
    const candidatePriority = sortConcernScores(candidateScores, tieBreaker)[0]?.axis || null;
    if (!referencePriority || !candidatePriority) continue;
    priorityComparableCount += 1;
    if (referencePriority !== candidatePriority) priorityFlipCount += 1;
  }

  const downstreamReplayComplete = fixtures.length > 0 && fixtures.every((fixture) =>
    fixture.downstreamReplay?.engine === true &&
    fixture.downstreamReplay?.product === true &&
    fixture.downstreamReplay?.routine === true
  );
  const meanAbsoluteError = absoluteErrors.length
    ? absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length
    : null;
  const exactMatchRate = pairs.length
    ? pairs.filter((pair) => pair.candidate === pair.reference).length / pairs.length
    : null;
  const priorityFlipRate = priorityComparableCount
    ? priorityFlipCount / priorityComparableCount
    : null;

  const gateResults = {
    minimumPositivePairs: pairs.length >= gate.minimumPositivePairs,
    minimumPairsPerAxis: gate.requiredAxes.every((axis) => axisCounts[axis] >= gate.minimumPairsPerAxis),
    provenanceEligible,
    downstreamEngineReplay: !gate.requireDownstreamEngineReplay || downstreamReplayComplete,
    productRegression: !gate.requireProductRegression || fixtures.every((fixture) => fixture.downstreamReplay?.product === true),
    routineRegression: !gate.requireRoutineRegression || fixtures.every((fixture) => fixture.downstreamReplay?.routine === true),
    priorityFlipRate: priorityFlipRate !== null && priorityFlipRate <= gate.maximumPriorityFlipRate,
    meanAbsoluteError: meanAbsoluteError !== null && meanAbsoluteError <= gate.maximumMeanAbsoluteError
  };

  return {
    policyId,
    mapping: { ...resolvePolicy(policyId).mapping },
    positivePairCount: pairs.length,
    pairs,
    axisCounts,
    referenceTypes,
    meanAbsoluteError,
    maximumAbsoluteError: absoluteErrors.length ? Math.max(...absoluteErrors) : null,
    exactMatchRate,
    priorityComparableCount,
    priorityFlipCount,
    priorityFlipRate,
    downstreamReplayComplete,
    gateResults,
    approved: Object.values(gateResults).every(Boolean)
  };
}

export function evaluateSkinQuantizationCalibration(fixtures, options = {}) {
  if (!Array.isArray(fixtures)) throw new Error("skin_quantization_fixtures_must_be_array");
  const gate = options.gate || SKIN_QUANTIZATION_APPROVAL_GATE;
  const policyResults = Object.keys(SKIN_QUANTIZATION_POLICIES)
    .map((policyId) => evaluatePolicy(fixtures, policyId, gate))
    .sort((left, right) => {
      const leftMae = left.meanAbsoluteError ?? Number.POSITIVE_INFINITY;
      const rightMae = right.meanAbsoluteError ?? Number.POSITIVE_INFINITY;
      if (leftMae !== rightMae) return leftMae - rightMae;
      return left.policyId.localeCompare(right.policyId);
    });
  const approvedPolicies = policyResults.filter((result) => result.approved);

  return {
    schemaVersion: "skin-quantization-calibration-v1",
    mode: "offline_shadow_governance",
    productionAuthoritative: false,
    fixtureCount: fixtures.length,
    policyResults,
    diagnosticBestPolicy: policyResults[0]?.policyId || null,
    approvedPolicy: approvedPolicies.length === 1 ? approvedPolicies[0].policyId : null,
    outcome: approvedPolicies.length === 1 ? "approved_for_separate_activation_review" : "no_policy_approved",
    activationAllowed: false
  };
}
