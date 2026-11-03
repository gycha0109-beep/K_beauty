import { FACE_LAB_OBSERVATION_DEFINITIONS, buildFaceLabObservationAnalysis } from "../lib/face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import { buildStyleCheckGroundedExplanation } from "../lib/face-lab-v2/evaluation/style-check-grounded-explanation-sc06h.js";
import { auditStyleCheckExplanation } from "../lib/face-lab-v2/evaluation/style-check-explanation-audit-sc06j.js";
import { auditStyleCheckObservationDraft } from "./audit-face-lab-style-check-observation-draft-sc06g.mjs";

export const STYLE_CHECK_OBSERVATION_BRIDGE_SC06K_VERSION =
  "face-lab-style-check-observation-bridge-sc06k-v1";

const ATTESTATION_KEYS = ["photoPermission", "photoQuality", "independentObservation"];
const validRef = (value) => typeof value === "string" &&
  value.trim().length >= 6 && value.length <= 160;

function hold(reason, more = {}) {
  return {
    version: STYLE_CHECK_OBSERVATION_BRIDGE_SC06K_VERSION,
    status: "held",
    holdReason: reason,
    productionActive: false,
    simulationAuthorized: false,
    independentHumanValidationCompleted: false,
    providerInvoked: false,
    ...more
  };
}

function reviewGate(review, sampleRef) {
  if (!review || review.sampleRef !== sampleRef ||
      !/^[a-f0-9]{64}$/i.test(review.sourcePhotoSha256 || "")) {
    return false;
  }
  return ATTESTATION_KEYS.every((key) =>
    review[key]?.operatorAttested === true &&
    validRef(review[key]?.evidenceRef)
  );
}

function toRawObservations(record) {
  return Object.fromEntries(
    Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS).map(([group, fields]) => [
      group,
      Object.fromEntries(Object.keys(fields).map((field) => {
        const value = record.observations[group + "." + field];
        const available = value && value.held === false &&
          field !== "focalFeatures" && value.evidenceNote?.trim();
        return [field, available
          ? {
              value: value.reviewerDraftChoice,
              visibility: "partial",
              evidence: [value.evidenceNote.trim().slice(0, 240)],
              unavailableReason: null
            }
          : {
              value: null,
              visibility: "uncertain",
              evidence: [],
              unavailableReason: "evidence_missing"
            }];
      }))
    ])
  );
}

/**
 * Research-only adapter. It does not analyze image pixels, infer a user's
 * consent, authenticate reviewers, or certify aesthetic recommendation quality.
 * Operator assertions are external prerequisites, not independently verified.
 */
export function buildStyleCheckObservationResearchPreview({
  draft,
  sampleRef,
  review,
  quality,
  surveyAnswers,
  targetKey,
  routeId = null
} = {}) {
  const draftAudit = auditStyleCheckObservationDraft(draft);
  if (draftAudit.issues.length) {
    return hold("draft_audit_failed", {
      issueCodes: [...new Set(draftAudit.issues.map((issue) => issue.code))]
    });
  }

  const records = draft?.records?.filter((record) => record.sampleRef === sampleRef) || [];
  if (!/^P[0-9]{2,4}$/.test(sampleRef || "") || records.length !== 1) {
    return hold("sample_binding_unavailable");
  }
  if (!reviewGate(review, sampleRef)) {
    return hold("photo_rights_quality_independent_review_attestations_required");
  }
  if (!quality || typeof quality !== "object" ||
      !Array.isArray(quality.evidence) || quality.evidence.length === 0) {
    return hold("reviewed_photo_quality_required");
  }
  if (!surveyAnswers || typeof targetKey !== "string" ||
      !Array.isArray(surveyAnswers.targetSelections) ||
      !surveyAnswers.targetSelections.includes(targetKey)) {
    return hold("explicit_user_target_required");
  }

  const raw = {
    quality,
    observations: toRawObservations(records[0])
  };
  const analysis = buildFaceLabObservationAnalysis(raw, {
    eligibility: { faceLabEligible: true },
    provider: "manual_local_research",
    model: "operator_reviewed_draft_not_ai_photo_analysis"
  });

  if (!["partial", "available"].includes(analysis.status)) {
    return hold("canonical_observation_coverage_insufficient", {
      analysisStatus: analysis.status,
      availableObservationCount: analysis.coverage.availableFieldCount
    });
  }

  const canonical = buildFaceLabV2Canonical({
    analysis,
    surveyAnswers,
    selectedRouteId: routeId,
    locale: "ko"
  });
  const explanation = buildStyleCheckGroundedExplanation({
    canonical,
    targetKey,
    routeId
  });
  if (explanation.status !== "research_copy_ready") {
    return hold("style_explanation_unavailable", {
      canonicalStatus: canonical?.status || null
    });
  }
  const audit = auditStyleCheckExplanation({
    canonical,
    explanation,
    targetKey,
    routeId
  });
  if (audit.status !== "pass") {
    return hold("explanation_provenance_audit_failed", {
      issueCodes: audit.issues.map((issue) => issue.code)
    });
  }

  return {
    version: STYLE_CHECK_OBSERVATION_BRIDGE_SC06K_VERSION,
    status: "research_preview_only",
    sampleRef,
    targetKey,
    routeId: routeId || canonical.routes.defaultRouteId,
    analysisStatus: analysis.status,
    availableObservationCount: analysis.coverage.availableFieldCount,
    headline: explanation.headline,
    summary: explanation.summary,
    rationale: explanation.rationale,
    caveat: explanation.caveat,
    cards: explanation.cards,
    provenanceAudit: {
      status: audit.status,
      explainedActionCount: audit.explainedActionCount,
      faceLinkedCount: audit.faceLinkedCount,
      unexplainedActionCount: audit.unexplainedActionCount
    },
    operatorAttestationsPresent: true,
    operatorAttestationsIndependentlyAuthenticated: false,
    photoRightsIndependentlyVerified: false,
    recommendationAccuracyValidated: false,
    productionActive: false,
    simulationAuthorized: false,
    independentHumanValidationCompleted: false,
    providerInvoked: false,
    sourcePhotoPersisted: false
  };
}
