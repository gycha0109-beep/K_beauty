import { PILOT_TERMINAL_OUTCOMES } from "@bejewely/face-contracts";
import { verifyBlindJudgmentAssignmentIntegrity } from "../judgment/assignment.js";
import { sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { appendPilotCampaignEvent } from "./events.js";
import { derivePilotCampaignProjection } from "./projection.js";
import {
  verifyAlignmentStageArtifact,
  verifyCandidateStageArtifacts,
  verifyConsensusStageArtifact,
  verifyObservationStageArtifacts,
  verifyPromotionStageArtifacts
} from "./stage-adapters.js";
import {
  readCampaignBundle,
  saveCampaignEvent,
  saveProjection,
  withCampaignWriterClaim
} from "./storage.js";

const HEX64 = /^[a-f0-9]{64}$/;
const SAFE_ENV_NAME = /^[A-Z][A-Z0-9_]{2,127}$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function sourceRefKey(ref) {
  return `${ref.track}:${ref.artifactType}:${ref.artifactDigest}`;
}

function semanticEventKey(input) {
  return stableStringify({
    campaignRunId: input.campaignRunId,
    slotId: input.slotId,
    eventType: input.eventType,
    sourceRefs: [...input.sourceRefs].sort((a,b) => sourceRefKey(a).localeCompare(sourceRefKey(b))),
    reasonCodes: [...new Set(input.reasonCodes)].sort()
  });
}

function projectionOf(bundle, events = bundle.events) {
  return derivePilotCampaignProjection({ plan: bundle.plan, run: bundle.run, slots: bundle.slots, events });
}

async function appendBoundEvent(dataRoot, bundle, input) {
  const existing = bundle.events.find((event) => semanticEventKey(event) === semanticEventKey(input));
  if (existing) {
    const projected = projectionOf(bundle);
    return projected.ok ? Object.freeze({ ok: true, state: "existing", event: existing, projection: projected.projection }) : projected;
  }
  const appended = appendPilotCampaignEvent(bundle.events, input, {
    campaignRunId: bundle.run.campaignRunId,
    slotIds: bundle.slots.map((slot) => slot.slotId)
  });
  if (!appended.ok) return appended;
  const projected = projectionOf(bundle, appended.events);
  if (!projected.ok) return projected;
  await saveCampaignEvent(dataRoot, appended.event);
  await saveProjection(dataRoot, projected.projection);
  return Object.freeze({ ok: true, state: "appended", event: appended.event, projection: projected.projection });
}

function currentSlotProjection(bundle, slotId) {
  const projected = projectionOf(bundle);
  if (!projected.ok) return projected;
  const slot = projected.projection.slotProjections.find((item) => item.slotId === slotId);
  return slot ? Object.freeze({ ok: true, slot, projection: projected.projection }) : failure("campaign_slot_invalid", "slotId", null);
}

function requireCurrentCandidate(slot, candidateManifest) {
  return slot.refs.candidateId &&
    slot.refs.candidateDigest &&
    candidateManifest?.candidateId === slot.refs.candidateId &&
    candidateManifest?.candidateDigest === slot.refs.candidateDigest &&
    candidateManifest?.asset?.canonicalSha256 === slot.refs.canonicalSha256;
}

function prepareStage({ stage, artifacts, slot, plan }) {
  if (stage === "candidate") {
    const verified = verifyCandidateStageArtifacts(artifacts);
    if (!verified.ok) return verified;
    if (slot.refs.candidateId && (slot.refs.candidateId !== verified.candidateId || slot.refs.canonicalSha256 !== verified.canonicalSha256)) return failure("registered_candidate_replacement_attempted", "candidate", null);
    return Object.freeze({ ok: true, eventType: "candidate_registered", sourceRefs: verified.sourceRefs, reasonCodes: ["candidate_registered_to_slot"] });
  }

  if (stage === "observation_authorization") {
    if (!HEX64.test(artifacts?.authorizationDigest || "") || artifacts?.explicitProviderAuthorization !== true || !SAFE_ENV_NAME.test(artifacts?.apiKeyEnvName || "")) return failure("observation_authorization_required", "artifacts", null);
    if (slot.refs.observationObjectDigest) return failure("observation_recovery_not_allowed", "artifacts", "authoritative_observation_exists");
    const recovery = artifacts.recovery === true;
    if (recovery) {
      if (slot.observationRuns < 1 || slot.observationRecoveryRuns >= plan.budgets.maxObservationRecoveryRuns || slot.observationRuns >= plan.budgets.maxObservationRunsTotal) return failure("observation_recovery_not_allowed", "artifacts.recovery", null);
    } else if (slot.observationRuns > 0) return failure("observation_recovery_not_allowed", "artifacts.recovery", "recovery_flag_required");
    return Object.freeze({
      ok: true,
      eventType: "observation_authorization_recorded",
      sourceRefs: [{ track: "T7", artifactType: "observation-authorization", artifactDigest: artifacts.authorizationDigest }],
      reasonCodes: recovery ? ["observation_recovery_reserved"] : []
    });
  }

  if (stage === "observation") {
    if (!requireCurrentCandidate(slot, artifacts?.candidateManifest)) return failure("source_artifact_integrity_invalid", "candidateManifest", "slot_binding_mismatch");
    const verified = verifyObservationStageArtifacts(artifacts);
    if (!verified.ok) return verified;
    return Object.freeze({
      ok: true,
      eventType: "observation_registered",
      sourceRefs: verified.sourceRefs,
      reasonCodes: [verified.technicalFailureReason || (verified.validIneligible ? "observation_valid_ineligible" : "observation_registered")]
    });
  }

  if (stage === "judgment_assignment") {
    const assignment = artifacts?.assignment;
    if (!verifyBlindJudgmentAssignmentIntegrity(assignment) || assignment.candidateId !== slot.refs.candidateId || assignment.observationRunId !== slot.refs.observationRunId || assignment.observationDigest !== slot.refs.observationObjectDigest || assignment.canonicalAsset?.sha256 !== slot.refs.canonicalSha256) return failure("source_artifact_integrity_invalid", "assignment", "slot_binding_mismatch");
    return Object.freeze({ ok: true, eventType: "judgment_assignment_issued", sourceRefs: [{ track: "T5", artifactType: "judgment-assignment", artifactDigest: assignment.assignmentDigest }], reasonCodes: ["judgment_reviews_pending"] });
  }

  if (stage === "consensus") {
    const verified = verifyConsensusStageArtifact({ consensus: artifacts?.consensus, candidateId: slot.refs.candidateId, observationObjectDigest: slot.refs.observationObjectDigest });
    return verified.ok ? Object.freeze({ ok: true, eventType: "judgment_consensus_sealed", sourceRefs: verified.sourceRefs, reasonCodes: ["consensus_sealed"] }) : verified;
  }

  if (stage === "alignment") {
    const verified = verifyAlignmentStageArtifact({ alignment: artifacts?.alignment, candidateId: slot.refs.candidateId, consensusDigest: slot.refs.consensusDigest });
    return verified.ok ? Object.freeze({ ok: true, eventType: "alignment_registered", sourceRefs: verified.sourceRefs, reasonCodes: ["promotion_policy_reviews_pending"] }) : verified;
  }

  if (stage === "promotion_preflight") {
    if (!HEX64.test(artifacts?.preflightDigest || "") || artifacts?.candidateId !== slot.refs.candidateId || artifacts?.alignmentDigest !== slot.refs.alignmentDigest) return failure("source_artifact_integrity_invalid", "promotionPreflight", "slot_binding_mismatch");
    return Object.freeze({ ok: true, eventType: "promotion_preflight_registered", sourceRefs: [{ track: "T6", artifactType: "promotion-preflight", artifactDigest: artifacts.preflightDigest }], reasonCodes: ["promotion_review_pending"] });
  }

  if (stage === "promotion_decision") {
    const verified = verifyPromotionStageArtifacts({ ...artifacts, candidateId: slot.refs.candidateId, alignmentDigest: slot.refs.alignmentDigest });
    return verified.ok ? Object.freeze({ ok: true, eventType: "promotion_decision_registered", sourceRefs: verified.sourceRefs, reasonCodes: verified.reasonCodes }) : verified;
  }

  if (stage === "terminal") {
    if (!PILOT_TERMINAL_OUTCOMES.includes(artifacts?.outcome)) return failure("campaign_terminal_invalid", "outcome", null);
    return Object.freeze({
      ok: true,
      eventType: "slot_terminal",
      sourceRefs: [{ track: "T7", artifactType: "terminal-outcome", artifactDigest: sha256Hex(`${slot.slotId}:${artifacts.outcome}`) }],
      reasonCodes: [artifacts.outcome, "slot_terminal_recorded"]
    });
  }

  return failure("campaign_stage_invalid", "stage", stage);
}

export async function registerPilotStage({ dataRoot, runId, slotId, stage, artifacts, actorId = "campaign_operator" }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, `stage-${stage}`, async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    const current = currentSlotProjection(bundle, slotId);
    if (!current.ok) return current;
    const prepared = prepareStage({ stage, artifacts, slot: current.slot, plan: bundle.plan });
    if (!prepared.ok) return prepared;
    const appended = await appendBoundEvent(dataRoot, bundle, {
      campaignRunId: runId,
      slotId,
      eventType: prepared.eventType,
      sourceRefs: prepared.sourceRefs,
      reasonCodes: prepared.reasonCodes,
      recordedAt: new Date().toISOString()
    });
    return appended.ok ? Object.freeze({ ok: true, state: appended.state, stage, event: appended.event, projection: appended.projection }) : appended;
  });
}
