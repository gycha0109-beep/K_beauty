import "server-only";
import { readRecommendationAdmissionAuthority } from "@/lib/recommendation-admission-authority-reader";
import {
  admitRecommendationProductsWithDependencies,
  evaluateRecommendationCandidateAdmission as evaluateRecommendationCandidateAdmissionCore,
} from "@/lib/recommendation-candidate-admission-core.mjs";

export * from "@/lib/recommendation-candidate-admission-core.mjs";

export async function evaluateRecommendationCandidateAdmission(product, dependencies = {}) {
  return evaluateRecommendationCandidateAdmissionCore(product, {
    ...dependencies,
    reader: dependencies.reader || readRecommendationAdmissionAuthority,
  });
}

export async function admitRecommendationProducts(rawProducts, dependencies = {}) {
  return admitRecommendationProductsWithDependencies(rawProducts, {
    ...dependencies,
    reader: dependencies.reader || readRecommendationAdmissionAuthority,
  });
}
