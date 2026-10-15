// S1-B evaluation-only operational measurements. No Provider calls, image IO or persistence.
// Intended input: opaque trial IDs plus bounded numeric measurements collected elsewhere
// ONLY after separate Provider, photograph, privacy and shared Vision/Style approval.
export const SKIN_VISION_OPERATIONAL_METRICS_VERSION = "skin-v2-operational-metrics-v1";
const CASE_ID = /^[A-Za-z0-9_-]{1,48}$/;
const VARIANTS = new Set(["v1", "v2"]);
const RESULT = new Set(["STRUCTURALLY_VALID", "INVALID_OR_INCOMPLETE"]);
const COST_SOURCE = new Set(["unavailable", "operator_estimate"]);
const REQUIRED = ["caseId", "variant", "structuralResult", "elapsedMs", "estimatedCostMicroUsd", "costSource"];
const MAX_ELAPSED_MS = 600_000;
const MAX_ESTIMATED_COST_MICRO_USD = 1_000_000_000;
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function safeMeasurement(value, upper) {
  return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= upper);
}
function validate(row) {
  if (!isRecord(row) || Object.keys(row).length !== REQUIRED.length ||
      !REQUIRED.every(key => Object.prototype.hasOwnProperty.call(row, key))) {
    throw new Error("invalid_operational_row_shape");
  }
  if (typeof row.caseId !== "string" || !CASE_ID.test(row.caseId) ||
      !VARIANTS.has(row.variant) || !RESULT.has(row.structuralResult)) {
    throw new Error("invalid_operational_trial_identity");
  }
  if (!safeMeasurement(row.elapsedMs, MAX_ELAPSED_MS) ||
      !safeMeasurement(row.estimatedCostMicroUsd, MAX_ESTIMATED_COST_MICRO_USD) ||
      !COST_SOURCE.has(row.costSource) ||
      (row.costSource === "unavailable" ? row.estimatedCostMicroUsd !== null : row.estimatedCostMicroUsd === null)) {
    throw new Error("invalid_operational_measurement");
  }
}
function summariseNumeric(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    mean: Math.round(sum / values.length),
    median: Math.round((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2),
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1]
  };
}
/**
 * Aggregate metadata from prior inspectSkinVisionTrial() results and independently
 * operator-supplied elapsed time/cost estimates. This does NOT verify that IDs
 * represent the same image or that estimates are billed charges. Never accept
 * raw Provider envelopes, patient/user IDs, filenames, evidence strings or photos.
 */
export function summarizeSkinVisionOperationalPairs(rows, { evidenceOrigin = "synthetic" } = {}) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw new Error("invalid_operational_rows");
  if (!["synthetic", "operator_unverified"].includes(evidenceOrigin)) throw new Error("invalid_evidence_origin");
  const cases = new Map();
  for (const row of rows) {
    validate(row);
    const pair = cases.get(row.caseId) || {};
    if (pair[row.variant]) throw new Error("duplicate_variant_for_case");
    pair[row.variant] = row;
    cases.set(row.caseId, pair);
  }
  let matchedPairs = 0;
  let bothStructurallyValid = 0;
  let pairedTimings = 0;
  let pairedCosts = 0;
  let v2Slower = 0;
  let v2MoreExpensive = 0;
  const latencies = { v1: [], v2: [] };
  const costs = { v1: [], v2: [] };
  const latencyDeltas = [];
  const estimatedCostDeltas = [];
  for (const { v1, v2 } of cases.values()) {
    if (!v1 || !v2) continue;
    matchedPairs++;
    if (v1.structuralResult === "STRUCTURALLY_VALID" && v2.structuralResult === "STRUCTURALLY_VALID") bothStructurallyValid++;
    if (v1.elapsedMs !== null && v2.elapsedMs !== null) {
      pairedTimings++;
      latencies.v1.push(v1.elapsedMs);
      latencies.v2.push(v2.elapsedMs);
      const delta = v2.elapsedMs - v1.elapsedMs;
      latencyDeltas.push(delta);
      if (delta > 0) v2Slower++;
    }
    if (v1.estimatedCostMicroUsd !== null && v2.estimatedCostMicroUsd !== null) {
      pairedCosts++;
      costs.v1.push(v1.estimatedCostMicroUsd);
      costs.v2.push(v2.estimatedCostMicroUsd);
      const delta = v2.estimatedCostMicroUsd - v1.estimatedCostMicroUsd;
      estimatedCostDeltas.push(delta);
      if (delta > 0) v2MoreExpensive++;
    }
  }
  const unmatchedCases = cases.size - matchedPairs;
  const measurementCoverageComplete = unmatchedCases === 0 && matchedPairs > 0 &&
    pairedTimings === matchedPairs && pairedCosts === matchedPairs;
  return {
    version: SKIN_VISION_OPERATIONAL_METRICS_VERSION,
    evidenceOrigin,
    matchedPairs,
    unmatchedCases,
    bothStructurallyValid,
    pairedTimings,
    pairedCosts,
    v2Slower,
    v2MoreExpensive,
    latencyMs: { v1: summariseNumeric(latencies.v1), v2: summariseNumeric(latencies.v2), delta: summariseNumeric(latencyDeltas) },
    estimatedCostMicroUsd: { v1: summariseNumeric(costs.v1), v2: summariseNumeric(costs.v2), delta: summariseNumeric(estimatedCostDeltas) },
    measurementCoverageComplete,
    verdict: measurementCoverageComplete ? "MEASUREMENT_CAPTURE_COMPLETE_REVIEW_REQUIRED" : "MEASUREMENT_EVIDENCE_INCOMPLETE",
    // A complete set of user-supplied measurements is NOT an independently verified Provider result.
    providerTestingApproved: false,
    actualProviderCompatibilityVerified: false,
    humanSkinAccuracyVerified: false,
    productReady: false,
    releaseReady: false,
    liveProviderCallsByEvaluator: 0,
    personalDataPersistedByEvaluator: false
  };
}
