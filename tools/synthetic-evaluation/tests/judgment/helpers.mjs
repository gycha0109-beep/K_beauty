import {
  BLIND_JUDGMENT_SUBMISSION_SCHEMA_VERSION,
  FACE_FEATURE_CUE_PROFILE_VERSION,
  FACE_FEATURE_INTENT_SCHEMA_VERSION,
  JUDGMENT_AXIS_KEYS,
  JUDGMENT_AXIS_REGISTRY
} from "@bejewely/face-contracts";
import { buildCandidateIdentity, buildCandidateManifest } from "../../src/import/build-candidate.js";
import { compileGenerationPrompt } from "../../src/generation/compile-prompt.js";
import { SKIN_CONTROL_FIXTURES } from "../../src/generation/fixtures/skin-control-fixtures.js";
import { createBlindJudgmentAssignment } from "../../src/judgment/assignment.js";

export const TEST_CANONICAL_SHA = "d".repeat(64);

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDraftSpec({ fixture = "A", purpose = null } = {}) {
  const spec = clone(SKIN_CONTROL_FIXTURES[fixture].spec);
  if (purpose === "face_feature_control") {
    spec.purpose = purpose;
    spec.featureIntent = {
      schemaVersion: FACE_FEATURE_INTENT_SCHEMA_VERSION,
      cueProfileVersion: FACE_FEATURE_CUE_PROFILE_VERSION,
      cues: {
        eyeDirection: { value: "level", strength: "subtle" },
        jawlineAngularity: { value: "moderate", strength: "moderate" }
      }
    };
    spec.skinIntent = clone(SKIN_CONTROL_FIXTURES.A.spec.skinIntent);
  } else if (purpose === "mixed_control_pilot") {
    spec.purpose = purpose;
    spec.featureIntent = {
      schemaVersion: FACE_FEATURE_INTENT_SCHEMA_VERSION,
      cueProfileVersion: FACE_FEATURE_CUE_PROFILE_VERSION,
      cues: {
        eyeDirection: { value: "level", strength: "subtle" }
      }
    };
  }
  return spec;
}

export function createCandidateArtifacts({ fixture = "A", purpose = null, markStatus = "absent" } = {}) {
  const draftSpec = createDraftSpec({ fixture, purpose });
  const compiled = compileGenerationPrompt({ draftSpec, providerProfileId: "gemini-image-manual-v1" });
  if (!compiled.ok) throw new Error(`fixture_compile_failed:${compiled.errors?.[0]?.code}`);
  const finalizedSpec = compiled.canonicalSpec.finalizedSpec;
  const compiledPrompt = compiled.compiledPrompt;
  const request = {
    generationArtifact: {
      expectedSpecDigest: finalizedSpec.specDigest,
      expectedPromptDigest: compiledPrompt.promptDigest
    },
    providerRun: {
      providerProfileId: compiledPrompt.providerProfile.id,
      providerProfileVersion: compiledPrompt.providerProfile.version,
      executionMode: compiledPrompt.providerProfile.executionMode,
      providerModelLabel: null,
      providerModelVersion: null,
      providerGenerationId: null,
      generatedAt: null,
      downloadedAt: "2026-08-02T00:00:00.000Z",
      exactReproductionAvailable: false
    },
    grouping: {
      campaignId: finalizedSpec.provenance.campaignId,
      campaignSeriesId: null,
      conditionId: fixture,
      lineage: { kind: "independent", parentCandidateId: null }
    },
    operatorAttestation: {
      syntheticOnly: true,
      realPersonReferenceUsed: false,
      termsAndRightsReviewed: true,
      downloadedBy: "human_operator"
    },
    operatorHints: {
      visibleExternalMark: {
        status: markStatus,
        location: markStatus === "present" ? "bottom_right" : null,
        provenanceStatus: "unverified"
      },
      notes: null
    }
  };
  const inspection = { assetId: "asset_fixture_01", rawSha256: "e".repeat(64) };
  const canonical = { canonicalSha256: TEST_CANONICAL_SHA, transformPolicyVersion: "canonical-image-v1" };
  const fingerprint = { value: "0".repeat(16) };
  const identity = buildCandidateIdentity({ request, inspection, compiledPrompt });
  const candidateManifest = buildCandidateManifest({
    candidateIdentity: identity,
    request,
    inspection,
    canonical,
    fingerprint,
    paths: {
      raw: `objects/raw/sha256/ee/${"e".repeat(64)}.png`,
      canonical: `objects/canonical/sha256/dd/${TEST_CANONICAL_SHA}.png`,
      spec: `objects/generation/spec/by-digest/${finalizedSpec.specDigest.slice(0, 2)}/${finalizedSpec.specDigest}.json`,
      prompt: `objects/generation/prompt/by-digest/${compiledPrompt.promptDigest.slice(0, 2)}/${compiledPrompt.promptDigest}.json`
    },
    duplicates: { exactCanonicalDuplicateOf: [], nearestPerceptualCandidates: [] },
    registeredAt: "2026-08-02T00:30:00.000Z"
  });
  return { finalizedSpec, compiledPrompt, candidateManifest };
}

export function createBlindInput(candidateManifest) {
  return {
    schemaVersion: "blind-judgment-input-v1",
    candidateId: candidateManifest.candidateId,
    observationRunId: `obs_${"c".repeat(24)}`,
    observationDigest: "a".repeat(64),
    canonicalAsset: {
      sha256: candidateManifest.asset.canonicalSha256,
      objectRelativePath: candidateManifest.asset.canonicalObjectRelativePath
    },
    observation: {
      status: "available",
      privacy: { sourceImagePersisted: false, rawProviderResponsePersisted: false }
    }
  };
}

export function createAssignment(candidateManifest) {
  const result = createBlindJudgmentAssignment(createBlindInput(candidateManifest), { issuedAt: "2026-08-02T01:00:00.000Z" });
  if (!result.ok) throw new Error("assignment_fixture_failed");
  return result.assignment;
}

export function createAxes(spec, overrides = {}) {
  const values = Object.fromEntries(JUDGMENT_AXIS_KEYS.map((axis) => [axis, {
    status: "observed",
    value: axis.startsWith("capture.") || axis.startsWith("appearance.") ? "confirmed" :
      axis === "skin.redness.presence" ? spec.skinIntent.redness.severity :
      axis === "skin.redness.regions" ? clone(spec.skinIntent.redness.regions) :
      axis === "skin.blemishes.presence" ? spec.skinIntent.blemishes.severity :
      axis === "skin.blemishes.countBand" ? spec.skinIntent.blemishes.countBand :
      axis === "skin.blemishes.regions" ? clone(spec.skinIntent.blemishes.regions) :
      axis === "face.eyeDirection" ? "level" :
      axis === "face.eyeOpenness" ? "medium" :
      axis === "face.faceLengthBalance" ? "balanced" :
      axis === "face.jawlineAngularity" ? "moderate" :
      axis === "face.straightCurveBalance" ? "balanced" : "medium",
    reasons: [],
    observationPaths: []
  }]));
  for (const [axis, patch] of Object.entries(overrides)) values[axis] = { ...values[axis], ...clone(patch) };
  return values;
}

export function createSubmissionDraft({ assignment, spec, judgeId, judgeType = "human_reviewer", overrides = {}, reviewable = true }) {
  return {
    schemaVersion: BLIND_JUDGMENT_SUBMISSION_SCHEMA_VERSION,
    assignment: {
      assignmentId: assignment.assignmentId,
      assignmentDigest: assignment.assignmentDigest,
      candidateId: assignment.candidateId,
      observationRunId: assignment.observationRunId,
      observationDigest: assignment.observationDigest
    },
    judge: { judgeId, judgeType },
    registry: { id: JUDGMENT_AXIS_REGISTRY.registryId, version: JUDGMENT_AXIS_REGISTRY.registryVersion },
    reviewability: {
      status: reviewable ? "reviewable" : "unreviewable",
      reasons: reviewable ? [] : ["image_not_reviewable"]
    },
    axes: createAxes(spec, overrides),
    observationReview: {
      agreement: reviewable ? "agree" : "unreviewable",
      disputedObservationPaths: [],
      reasons: []
    },
    completedAt: "2026-08-02T01:30:00.000Z"
  };
}
