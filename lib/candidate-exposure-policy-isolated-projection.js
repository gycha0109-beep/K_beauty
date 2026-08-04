import { createHash } from "node:crypto";
import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES,
  validateCandidateExposureDecision
} from "./candidate-exposure-policy-contract.js";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function digest(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function exactCountMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function sortedCountMap(map) {
  return Object.fromEntries(
    Object.entries(map).sort(([left], [right]) => left.localeCompare(right, "en"))
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function assertCandidateDescriptors(candidates) {
  if (!Array.isArray(candidates)) throw new Error("isolated_projection_candidates_invalid");
  const refs = new Set();
  candidates.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("isolated_projection_candidate_invalid");
    }
    if (Object.keys(candidate).some((key) => !["candidateRef", "sourceIndex"].includes(key))) {
      throw new Error("isolated_projection_candidate_field_invalid");
    }
    if (typeof candidate.candidateRef !== "string" || !candidate.candidateRef.trim()) {
      throw new Error("isolated_projection_candidate_ref_invalid");
    }
    if (refs.has(candidate.candidateRef)) {
      throw new Error("isolated_projection_duplicate_candidate_ref");
    }
    refs.add(candidate.candidateRef);
    if (!Number.isInteger(candidate.sourceIndex) || candidate.sourceIndex !== index) {
      throw new Error("isolated_projection_source_index_invalid");
    }
  });
}

export function fingerprintIsolatedCandidateProjection(projection) {
  if (!projection || typeof projection !== "object" || !projection.fingerprintInput) {
    throw new Error("isolated_projection_fingerprint_input_invalid");
  }
  return digest(projection.fingerprintInput);
}

export function buildIsolatedCandidateProjection({ candidates, decisions } = {}) {
  assertCandidateDescriptors(candidates);
  if (!Array.isArray(decisions) || decisions.length !== candidates.length) {
    throw new Error("isolated_projection_decision_count_mismatch");
  }

  const candidatesBefore = stableStringify(candidates);
  const decisionsBefore = stableStringify(decisions);
  const exposureCounts = exactCountMap(CANDIDATE_EXPOSURES);
  const laneEligibilityCounts = exactCountMap(CANDIDATE_EXPOSURE_LANES);
  const reasonCodeCounts = {};
  const orderedExposures = [];
  const orderedLaneEligibilityBits = [];
  const orderedCandidateRefs = [];

  decisions.forEach((decision, index) => {
    const validation = validateCandidateExposureDecision(decision);
    if (!validation.valid) {
      throw new Error(`isolated_projection_decision_invalid:${validation.errors.join(",")}`);
    }
    if (decision.candidateRef !== candidates[index].candidateRef) {
      throw new Error("isolated_projection_candidate_order_mismatch");
    }

    exposureCounts[decision.exposure] += 1;
    orderedExposures.push(decision.exposure);
    orderedCandidateRefs.push(decision.candidateRef);

    const laneBits = CANDIDATE_EXPOSURE_LANES.map((lane) => {
      const eligible = decision.laneEligibility[lane] === true;
      if (eligible) laneEligibilityCounts[lane] += 1;
      return eligible ? "1" : "0";
    }).join("");
    orderedLaneEligibilityBits.push(laneBits);

    for (const reason of decision.reasonCodes) {
      reasonCodeCounts[reason] = (reasonCodeCounts[reason] || 0) + 1;
    }
  });

  if (Object.values(exposureCounts).reduce((sum, count) => sum + count, 0) !== candidates.length) {
    throw new Error("isolated_projection_exposure_total_mismatch");
  }
  if (stableStringify(candidates) !== candidatesBefore) {
    throw new Error("isolated_projection_source_candidate_mutated");
  }
  if (stableStringify(decisions) !== decisionsBefore) {
    throw new Error("isolated_projection_source_decision_mutated");
  }

  const projection = {
    aggregate: {
      candidateCount: candidates.length,
      exposureCounts,
      laneEligibilityCounts,
      reasonCodeCounts: sortedCountMap(reasonCodeCounts)
    },
    fingerprintInput: {
      candidateCount: candidates.length,
      orderedExposures,
      orderedLaneEligibilityBits,
      exposureCounts,
      laneEligibilityCounts,
      reasonCodeCounts: sortedCountMap(reasonCodeCounts)
    },
    memoryOnly: {
      orderedCandidateRefs
    }
  };

  projection.fingerprint = fingerprintIsolatedCandidateProjection(projection);
  return deepFreeze(projection);
}
