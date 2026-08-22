export const RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION =
  "production-recommendation-candidate-admission-v1";

export const RECOMMENDATION_CANDIDATE_ADMISSION_TYPE = Object.freeze({
  LEGACY: "LEGACY_COMPATIBILITY_ADMISSION",
  INITIAL_GRANT: "INITIAL_ADMISSION_GRANT",
  REJECTED: "REJECTED",
});

let runtimeAdmissionEvaluator = null;

export function registerRecommendationCandidateAdmissionRuntime(evaluator) {
  if (typeof evaluator !== "function") {
    throw new TypeError("Recommendation candidate admission runtime evaluator is required.");
  }
  runtimeAdmissionEvaluator = evaluator;
}

export async function admitRecommendationProducts(rawProducts) {
  if (typeof runtimeAdmissionEvaluator !== "function") {
    const error = new Error("Recommendation candidate admission runtime is unavailable.");
    error.code = "RECOMMENDATION_CANDIDATE_ADMISSION_RUNTIME_UNAVAILABLE";
    throw error;
  }
  return runtimeAdmissionEvaluator(rawProducts);
}

export function projectAdmittedRecommendationProducts(admissionResult, projector) {
  if (!admissionResult || !Array.isArray(admissionResult.decisions)) {
    const error = new Error("Recommendation candidate admission result is malformed.");
    error.code = "RECOMMENDATION_CANDIDATE_ADMISSION_RESULT_MALFORMED";
    throw error;
  }
  if (typeof projector !== "function") {
    throw new TypeError("Recommendation candidate admission projector is required.");
  }

  const projected = [];
  for (const decision of admissionResult.decisions) {
    if (decision?.admissionType === RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED) {
      continue;
    }
    if (
      decision?.admissionType !== RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.LEGACY &&
      decision?.admissionType !== RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.INITIAL_GRANT
    ) {
      const error = new Error("Recommendation candidate admission decision is unexpected.");
      error.code = "RECOMMENDATION_CANDIDATE_ADMISSION_DECISION_UNEXPECTED";
      throw error;
    }
    const product = projector(decision.product, decision);
    if (product) projected.push(product);
  }
  return projected;
}
