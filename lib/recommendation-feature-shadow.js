import { evaluateFaceLabArchetypeShadow } from "./face-lab-archetype-decision.js";
import {
  buildFaceArchetypeCompatibilityAnalysis,
  buildSkinLegacyShadowAdapter
} from "./recommendation-feature-adapters.js";
import { validateRecommendationFeatureBundle } from "./recommendation-feature-contract.js";
import { buildDerivedRecommendationFeatures } from "./recommendation-feature-derived.js";
import { normalizeRecommendationFeatureBundle } from "./recommendation-feature-normalizer.js";

function safeFaceDecisionSummary(result) {
  return {
    schemaVersion: result?.schemaVersion || null,
    mode: result?.mode || null,
    productionEligible: result?.productionEligible === true,
    status: result?.status || null,
    decision: result?.decision || null,
    registryVersion: result?.registryVersion || null,
    topCandidate: result?.topCandidate
      ? {
          key: result.topCandidate.key,
          rawScore: result.topCandidate.rawScore,
          evidenceCoverage: result.topCandidate.evidenceCoverage,
          topMargin: result.topCandidate.topMargin
        }
      : null,
    holdReasons: Array.isArray(result?.holdReasons) ? [...result.holdReasons] : []
  };
}

export function buildRecommendationFeatureShadow(visionBundle) {
  const canonical = normalizeRecommendationFeatureBundle(visionBundle);
  const validation = validateRecommendationFeatureBundle(canonical);
  const derived = buildDerivedRecommendationFeatures(canonical);
  const faceCompatibilityAnalysis = buildFaceArchetypeCompatibilityAnalysis(canonical, derived);
  const skinLegacyShadow = buildSkinLegacyShadowAdapter(canonical, derived);

  const originalFaceAnalysis = visionBundle?.face?.analysis || null;
  const originalFaceDecision = evaluateFaceLabArchetypeShadow(originalFaceAnalysis);
  const adaptedFaceDecision = evaluateFaceLabArchetypeShadow(faceCompatibilityAnalysis);
  const originalSummary = safeFaceDecisionSummary(originalFaceDecision);
  const adaptedSummary = safeFaceDecisionSummary(adaptedFaceDecision);

  return {
    schemaVersion: canonical.schemaVersion,
    shadowVersion: canonical.shadowVersion,
    mode: "shadow",
    productionAuthoritative: false,
    valid: validation.ok,
    validationErrors: validation.errors,
    canonical,
    derived,
    adapters: {
      face: {
        analysis: faceCompatibilityAnalysis,
        decision: adaptedSummary,
        comparison: {
          originalDecision: originalSummary,
          adaptedDecision: adaptedSummary,
          productionEligibleUnchanged:
            originalSummary.productionEligible === false && adaptedSummary.productionEligible === false,
          heldUnchanged: originalSummary.status === "held" && adaptedSummary.status === "held",
          decisionRemainsNull: originalSummary.decision === null && adaptedSummary.decision === null,
          topCandidateKeyEqual:
            originalSummary.topCandidate?.key === adaptedSummary.topCandidate?.key
        }
      },
      skin: skinLegacyShadow
    },
    privacy: {
      sourceImagePersisted: false,
      faceCropPersisted: false,
      rawProviderResponsePersisted: false,
      imagePayloadIncluded: false,
      evidenceTextCopiedIntoArchetypeLedger: false
    }
  };
}
