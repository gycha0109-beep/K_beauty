import {
  admitRecommendationProductsWithDependencies,
  evaluateRecommendationCandidateAdmission as evaluateRecommendationCandidateAdmissionCore,
} from "@/lib/recommendation-candidate-admission-core.mjs";

export * from "@/lib/recommendation-candidate-admission-core.mjs";

async function readRecommendationAdmissionAuthorityOnDemand(productId) {
  const { readRecommendationAdmissionAuthority } = await import(
    "@/lib/recommendation-admission-authority-reader"
  );
  return readRecommendationAdmissionAuthority(productId);
}

export async function evaluateRecommendationCandidateAdmission(product, dependencies = {}) {
  return evaluateRecommendationCandidateAdmissionCore(product, {
    ...dependencies,
    reader: dependencies.reader || readRecommendationAdmissionAuthorityOnDemand,
  });
}

export async function admitRecommendationProducts(rawProducts, dependencies = {}) {
  return admitRecommendationProductsWithDependencies(rawProducts, {
    ...dependencies,
    reader: dependencies.reader || readRecommendationAdmissionAuthorityOnDemand,
  });
}
