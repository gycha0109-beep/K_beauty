import { mapLegacyEvaluatorExposure } from "./candidate-exposure-policy-evaluator-adapter.js";
import { classifyCandidateExposureDivergence } from "./candidate-exposure-policy-observability.js";

const EXPOSURES = new Set([
  "primary",
  "contextual",
  "collapsed",
  "hidden",
  "insufficient_evidence"
]);

function normalizeExposure(value) {
  return EXPOSURES.has(value) ? value : "insufficient_evidence";
}

function normalizeReasons(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((reason) => String(reason || "").trim())
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "en"));
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

export function buildCandidateExposureUnexpectedDivergenceDiagnostics({
  decisions,
  legacyExecution
} = {}) {
  const legacyByRef = new Map(
    (legacyExecution?.receivers || []).map((receiver) => [
      String(receiver?.productId || ""),
      receiver
    ])
  );
  const transitionCounts = {};
  let unexpectedDivergenceCount = 0;

  for (const decision of Array.isArray(decisions) ? decisions : []) {
    const legacyExposure = normalizeExposure(
      mapLegacyEvaluatorExposure(legacyByRef.get(decision?.candidateRef))
    );
    const nextExposure = normalizeExposure(decision?.exposure);
    const category = classifyCandidateExposureDivergence(decision, legacyExposure);

    if (category !== "unexpected_divergence") continue;

    unexpectedDivergenceCount += 1;
    const reasons = normalizeReasons(decision?.reasonCodes);
    const reasonKey = reasons.length ? reasons.join("+") : "none";
    increment(transitionCounts, `${legacyExposure}>${nextExposure}|${reasonKey}`);
  }

  return Object.freeze({
    schemaVersion: "candidate-exposure-policy-divergence-diagnostics-v1",
    unexpectedDivergenceCount,
    transitionCounts: Object.fromEntries(
      Object.entries(transitionCounts)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
    )
  });
}
