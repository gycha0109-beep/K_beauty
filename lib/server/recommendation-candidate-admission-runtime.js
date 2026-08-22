import "server-only";

import { registerRecommendationCandidateAdmissionRuntime } from "@/lib/recommendation-candidate-admission";
import { admitRecommendationProductsWithDependencies } from "@/lib/recommendation-candidate-admission-core.mjs";
import { readRecommendationAdmissionAuthority } from "@/lib/recommendation-admission-authority-reader";

registerRecommendationCandidateAdmissionRuntime((rawProducts) =>
  admitRecommendationProductsWithDependencies(rawProducts, {
    reader: readRecommendationAdmissionAuthority,
  }),
);

export const RECOMMENDATION_CANDIDATE_ADMISSION_RUNTIME_REGISTERED = true;
