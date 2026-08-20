import { scheduleV21_9LOrganicEvidencePersistence } from "./exfoliation-normative-policy-organic-evidence-store.js";

export const EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES = Object.freeze({
  ORGANIC_PRODUCTION: "ORGANIC_PRODUCTION",
  CONTROLLED_PRODUCTION_PROBE: "CONTROLLED_PRODUCTION_PROBE",
  UNKNOWN_PRODUCTION_SOURCE: "UNKNOWN_PRODUCTION_SOURCE"
});

const PROVENANCE_CAPABILITY = Symbol("exfoliation-normative-policy-production-provenance");
const VALID_SOURCES = new Set(Object.values(EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES));

export function normalizeExfoliationNormativePolicyProductionSource(value) {
  return VALID_SOURCES.has(value)
    ? value
    : EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE;
}

export function assignExfoliationNormativePolicyProductionProvenance(
  input,
  source,
  { captureObservation = null } = {}
) {
  if (!input || typeof input !== "object") {
    return EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE;
  }

  const existing = input[PROVENANCE_CAPABILITY];
  if (existing) {
    return normalizeExfoliationNormativePolicyProductionSource(existing.source);
  }

  const normalizedSource = normalizeExfoliationNormativePolicyProductionSource(source);
  const capability = Object.freeze({
    source: normalizedSource,
    captureObservation: typeof captureObservation === "function" ? captureObservation : null
  });

  Object.defineProperty(input, PROVENANCE_CAPABILITY, {
    value: capability,
    enumerable: false,
    configurable: false,
    writable: false
  });

  return normalizedSource;
}

export function resolveExfoliationNormativePolicyProductionSource(input) {
  if (!input || typeof input !== "object") {
    return EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE;
  }

  return normalizeExfoliationNormativePolicyProductionSource(
    input[PROVENANCE_CAPABILITY]?.source
  );
}

export function captureExfoliationNormativePolicyProductionObservation(input, observation) {
  if (!input || typeof input !== "object") {
    return false;
  }

  try {
    scheduleV21_9LOrganicEvidencePersistence({ input, observation });
  } catch {
    // Evidence persistence is observability-only and must not affect Recommendation.
  }

  const captureObservation = input[PROVENANCE_CAPABILITY]?.captureObservation;
  if (typeof captureObservation !== "function") {
    return false;
  }

  try {
    captureObservation(observation);
    return true;
  } catch {
    return false;
  }
}
