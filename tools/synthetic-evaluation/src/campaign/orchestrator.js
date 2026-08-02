import { PILOT_TERMINAL_OUTCOMES } from "@bejewely/face-contracts";
import { compilePilotCampaignPlan, createPilotCampaignRun } from "./plan.js";
import { appendPilotCampaignEvent, createPilotCampaignEvent } from "./events.js";
import { issueGenerationWorkPacket, finalizeGenerationHandoff, verifyGenerationHandoffIntegrity } from "./generation.js";
import { derivePilotCampaignProjection } from "./projection.js";
import { authorizeWaveIssue, createPilotCheckpointApproval, verifyPilotCheckpointApprovalIntegrity } from "./checkpoint.js";
import { createPilotCampaignCloseout } from "./closeout.js";
import {
  campaignPacketRelativePath,
  nativePath,
  readCampaignBundle,
  saveCampaignEvent,
  saveCheckpoint,
  saveCloseout,
  saveCompiledCampaign,
  saveGenerationHandoff,
  saveGenerationPacket,
  saveProjection,
  withCampaignWriterClaim,
  writeImmutableJson
} from "./storage.js";
import {
  verifyAlignmentStageArtifact,
  verifyCandidateStageArtifacts,
  verifyConsensusStageArtifact,
  verifyObservationStageArtifacts,
  verifyPromotionStageArtifacts
} from "./stage-adapters.js";
import { sha256Hex, stableStringify } from "../shared/canonical-json.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function eventKey(input) {
  return stableStringify({
    campaignRunId: input.campaignRunId,
    slotId: input.slotId ?? null,
    eventType: input.eventType,
    sourceRefs: [...(input.sourceRefs || [])].sort((a,b) => stableStringify(a).localeCompare(stableStringify(b))),
    reasonCodes: [...new Set(input.reasonCodes || [])].sort()
  });
}

async function appendEventValidated({ dataRoot, bundle, events, input }) {
  const existing = events.find((event) => eventKey(event) === eventKey(input));
  if (existing) return Object.freeze({ ok: true, state: "existing", event: existing, events });
  const appended = appendPilotCampaignEvent(events, input, { campaignRunId: bundle.run.campaignRunId, slotIds: bundle.slots.map((slot) => slot.slotId) });
  if (!appended.ok) return appended;
  const projected = derivePilotCampaignProjection({ ...bundle, events: appended.events });
  if (!projected.ok) return projected;
  await saveCampaignEvent(dataRoot, appended.event);
  return Object.freeze({ ok: true, state: "appended", event: appended.event, events: appended.events, projection: projected.projection });
}

function slotById(bundle, slotId) {
  return bundle.slots.find((slot) => slot.slotId === slotId) || null;
}

function currentProjection(bundle, events = bundle.events) {
  return derivePilotCampaignProjection({ plan: bundle.plan, run: bundle.run, slots: bundle.slots, events });
}

export async function compileAndStorePilotCampaign({ dataRoot, planDraft, runNonce, startedBy, startedAt = new Date().toISOString() }) {
  const compiled = compilePilotCampaignPlan(planDraft);
  if (!compiled.ok) return compiled;
  const runResult = createPilotCampaignRun({ plan: compiled.plan, runNonce, startedBy, startedAt });
  if (!runResult.ok) return runResult;
  const initial = createPilotCampaignEvent({
    campaignRunId: runResult.run.campaignRunId,
    eventType: "run_started",
    sourceRefs: [
      { track: "T7", artifactType: "campaign-plan", artifactDigest: compiled.plan.planDigest },
      { track: "T7", artifactType: "campaign-run", artifactDigest: runResult.run.runIdentityDigest }
    ],
    reasonCodes: ["campaign_plan_valid", "campaign_source_freeze_valid"],
    recordedAt: startedAt
  });
  if (!initial.ok) return initial;
  const stored = await saveCompiledCampaign({ dataRoot, plan: compiled.plan, run: runResult.run, slots: runResult.slots, initialEvent: initial.event });
  const projectionResult = derivePilotCampaignProjection({ plan: compiled.plan, run: runResult.run, slots: runResult.slots, events: [initial.event] });
  if (!projectionResult.ok) return projectionResult;
  await saveProjection(dataRoot, projectionResult.projection);
  return Object.freeze({ ok: true, state: stored.createdCount > 0 ? "compiled" : "existing", plan: compiled.plan, run: runResult.run, slots: runResult.slots, projection: projectionResult.projection, writesPerformed: stored.createdCount + 1 });
}

async function persistGenerationArtifacts(dataRoot, packetResult) {
  const spec = packetResult.finalizedSpec;
  const prompt = packetResult.compiledPrompt;
  const specPath = `objects/generation/spec/by-digest/${spec.specDigest.slice(0,2)}/${spec.specDigest}.json`;
  const promptPath = packetResult.packet.promptArtifactRef;
  await writeImmutableJson(nativePath(dataRoot, specPath), spec);
  await writeImmutableJson(nativePath(dataRoot, promptPath), prompt);
  return { specPath, promptPath };
}

export async function issuePilotWave({ dataRoot, runId, waveOrdinal, actorId = "campaign_operator" }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, `issue-wave-${waveOrdinal}`, async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    let events = [...bundle.events];
    const before = currentProjection(bundle, events);
    if (!before.ok) return before;
    if (before.projection.runStatus !== "active") return failure("campaign_run_not_active", "runStatus", before.projection.runStatus);
    const authorization = authorizeWaveIssue(waveOrdinal, bundle.checkpoints);
    if (!authorization.ok) return authorization;
    const waveStatus = before.projection.waveStatus.find((item) => item.waveOrdinal === waveOrdinal)?.status;
    if (waveStatus === "not_issued") {
      const waveDigest = sha256Hex(`${runId}:wave:${waveOrdinal}`);
      const appended = await appendEventValidated({
        dataRoot,
        bundle,
        events,
        input: {
          campaignRunId: runId,
          slotId: null,
          eventType: "wave_issued",
          sourceRefs: [{ track: "T7", artifactType: `wave-${waveOrdinal}`, artifactDigest: waveDigest }],
          reasonCodes: [],
          recordedAt: new Date().toISOString()
        }
      });
      if (!appended.ok) return appended;
      events = [...appended.events];
    } else if (!["active", "awaiting_checkpoint", "complete"].includes(waveStatus)) return failure("campaign_wave_invalid", "waveStatus", waveStatus);

    const slots = bundle.slots.filter((slot) => slot.waveOrdinal === waveOrdinal);
    for (const slot of slots) {
      const slotEvents = events.filter((event) => event.slotId === slot.slotId);
      if (slotEvents.some((event) => event.eventType === "generation_packet_issued")) continue;
      const projection = currentProjection(bundle, events);
      if (!projection.ok) return projection;
      if (projection.projection.budget.generationAttemptsUsed >= bundle.plan.budgets.maxGenerationAttemptsTotal) return failure("budget_hard_cap_exceeded", "generationAttempts", null);
      const packetResult = issueGenerationWorkPacket({ plan: bundle.plan, run: bundle.run, slot, attemptOrdinal: 1 });
      if (!packetResult.ok) return packetResult;
      await persistGenerationArtifacts(dataRoot, packetResult);
      await saveGenerationPacket(dataRoot, packetResult.packet);
      const appended = await appendEventValidated({
        dataRoot,
        bundle,
        events,
        input: {
          campaignRunId: runId,
          slotId: slot.slotId,
          eventType: "generation_packet_issued",
          sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: packetResult.packet.packetDigest }],
          reasonCodes: [],
          recordedAt: new Date().toISOString()
        }
      });
      if (!appended.ok) return appended;
      events = [...appended.events];
    }
    const after = currentProjection(bundle, events);
    if (!after.ok) return after;
    await saveProjection(dataRoot, after.projection);
    return Object.freeze({ ok: true, waveOrdinal, packetsIssued: slots.length, projection: after.projection });
  });
}

export async function registerPilotGenerationHandoff({ dataRoot, runId, slotId, packetId, handoffDraft, actorId = "campaign_operator" }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, "generation-handoff", async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    const slot = slotById(bundle, slotId);
    if (!slot) return failure("campaign_slot_invalid", "slotId", null);
    const packet = bundle.packets.find((item) => item.packetId === packetId && item.slotId === slotId);
    if (!packet) return failure("generation_packet_invalid", "packetId", null);
    const finalized = finalizeGenerationHandoff({ packet, ...handoffDraft });
    if (!finalized.ok) return finalized;
    await saveGenerationHandoff(dataRoot, finalized.handoff, packet);
    const reasonCode = finalized.handoff.outcome === "asset_ready" ? "generation_asset_ready" : finalized.handoff.outcome;
    const appended = await appendEventValidated({
      dataRoot,
      bundle,
      events: [...bundle.events],
      input: {
        campaignRunId: runId,
        slotId,
        eventType: "generation_handoff_registered",
        sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: finalized.handoff.handoffDigest }],
        reasonCodes: [reasonCode],
        recordedAt: finalized.handoff.generatedAt
      }
    });
    if (!appended.ok) return appended;
    await saveProjection(dataRoot, appended.projection);
    return Object.freeze({ ok: true, handoff: finalized.handoff, retryEligible: finalized.handoff.outcome !== "asset_ready" && packet.attemptOrdinal < 2, projection: appended.projection });
  });
}

export async function reservePilotGenerationRetry({ dataRoot, runId, slotId, actorId = "campaign_operator" }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, "generation-retry", async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    const slot = slotById(bundle, slotId);
    if (!slot) return failure("campaign_slot_invalid", "slotId", null);
    let events = [...bundle.events];
    const projection = currentProjection(bundle, events);
    if (!projection.ok) return projection;
    const projectedSlot = projection.projection.slotProjections.find((item) => item.slotId === slotId);
    if (projectedSlot?.state !== "generation_handoff_failed" || projectedSlot.generationAttempts !== 1 || projectedSlot.refs.candidateDigest) return failure("generation_retry_not_allowed", "slot", projectedSlot?.state || null);
    if (projection.projection.budget.generationRetryReserveUsed >= bundle.plan.budgets.technicalGenerationRetryReserve || projection.projection.budget.generationAttemptsUsed >= bundle.plan.budgets.maxGenerationAttemptsTotal) return failure("generation_attempt_budget_exhausted", "budget", null);
    const lastHandoffEvent = events.filter((event) => event.slotId === slotId && event.eventType === "generation_handoff_registered").at(-1);
    const reason = lastHandoffEvent?.reasonCodes.find((code) => bundle.plan.retryPolicy.generationRetryAllowedReasons.includes(code));
    if (!reason) return failure("generation_retry_not_allowed", "reason", null);
    let appended = await appendEventValidated({
      dataRoot,
      bundle,
      events,
      input: {
        campaignRunId: runId,
        slotId,
        eventType: "generation_retry_reserved",
        sourceRefs: [{ track: "T7", artifactType: "retry-reservation", artifactDigest: sha256Hex(`${slotId}:2:${reason}`) }],
        reasonCodes: ["generation_retry_reserved"],
        recordedAt: new Date().toISOString()
      }
    });
    if (!appended.ok) return appended;
    events = [...appended.events];
    const packetResult = issueGenerationWorkPacket({ plan: bundle.plan, run: bundle.run, slot, attemptOrdinal: 2 });
    if (!packetResult.ok) return packetResult;
    await persistGenerationArtifacts(dataRoot, packetResult);
    await saveGenerationPacket(dataRoot, packetResult.packet);
    appended = await appendEventValidated({
      dataRoot,
      bundle,
      events,
      input: {
        campaignRunId: runId,
        slotId,
        eventType: "generation_packet_issued",
        sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: packetResult.packet.packetDigest }],
        reasonCodes: [],
        recordedAt: new Date().toISOString()
      }
    });
    if (!appended.ok) return appended;
    await saveProjection(dataRoot, appended.projection);
    return Object.freeze({ ok: true, packet: packetResult.packet, projection: appended.projection });
  });
}

export async function registerPilotStage({ dataRoot, runId, slotId, stage, artifacts, actorId = "campaign_operator" }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, `stage-${stage}`, async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    const slot = slotById(bundle, slotId);
    if (!slot) return failure("campaign_slot_invalid", "slotId", null);
    const projection = currentProjection(bundle);
    if (!projection.ok) return projection;
    const currentSlot = projection.projection.slotProjections.find((item) => item.slotId === slotId);
    let verified;
    let eventType;
    let reasonCodes = [];
    if (stage === "candidate") {
      verified = verifyCandidateStageArtifacts(artifacts);
      eventType = "candidate_registered";
      reasonCodes = ["candidate_registered_to_slot"];
    } else if (stage === "observation_authorization") {
      if (!/^[a-f0-9]{64}$/.test(artifacts?.authorizationDigest || "") || artifacts?.explicitProviderAuthorization !== true || typeof artifacts?.apiKeyEnvName !== "string" || artifacts.apiKeyEnvName.length < 1) return failure("observation_authorization_required", "artifacts", null);
      verified = { ok: true, sourceRefs: [{ track: "T7", artifactType: "observation-authorization", artifactDigest: artifacts.authorizationDigest }] };
      eventType = "observation_authorization_recorded";
      reasonCodes = artifacts.recovery === true ? ["observation_recovery_reserved"] : [];
      if (artifacts.recovery === true && (currentSlot.refs.observationDigest || currentSlot.observationRecoveryRuns >= bundle.plan.budgets.maxObservationRecoveryRuns)) return failure("observation_recovery_not_allowed", "artifacts.recovery", null);
    } else if (stage === "observation") {
      verified = verifyObservationStageArtifacts(artifacts);
      eventType = "observation_registered";
      reasonCodes = [verified.validIneligible ? "observation_valid_ineligible" : "observation_registered"];
    } else if (stage === "judgment_assignment") {
      if (!/^[a-f0-9]{64}$/.test(artifacts?.assignmentDigest || "")) return failure("source_artifact_integrity_invalid", "assignment", null);
      verified = { ok: true, sourceRefs: [{ track: "T5", artifactType: "judgment-assignment", artifactDigest: artifacts.assignmentDigest }] };
      eventType = "judgment_assignment_issued";
      reasonCodes = ["judgment_reviews_pending"];
    } else if (stage === "consensus") {
      verified = verifyConsensusStageArtifact({ ...artifacts, candidateId: artifacts.consensus?.candidateId, observationDigest: artifacts.consensus?.observationDigest });
      eventType = "judgment_consensus_sealed";
      reasonCodes = ["consensus_sealed"];
    } else if (stage === "alignment") {
      verified = verifyAlignmentStageArtifact({ ...artifacts, candidateId: artifacts.alignment?.candidate?.candidateId, consensusDigest: artifacts.alignment?.consensus?.consensusDigest });
      eventType = "alignment_registered";
      reasonCodes = ["promotion_policy_reviews_pending"];
    } else if (stage === "promotion_preflight") {
      if (!/^[a-f0-9]{64}$/.test(artifacts?.preflightDigest || "")) return failure("source_artifact_integrity_invalid", "promotionPreflight", null);
      verified = { ok: true, sourceRefs: [{ track: "T6", artifactType: "promotion-preflight", artifactDigest: artifacts.preflightDigest }] };
      eventType = "promotion_preflight_registered";
      reasonCodes = ["promotion_review_pending"];
    } else if (stage === "promotion_decision") {
      verified = verifyPromotionStageArtifacts({ ...artifacts, candidateId: artifacts.decision?.candidateId });
      eventType = "promotion_decision_registered";
      reasonCodes = verified.reasonCodes || [];
    } else if (stage === "terminal") {
      if (!PILOT_TERMINAL_OUTCOMES.includes(artifacts?.outcome)) return failure("campaign_terminal_invalid", "outcome", null);
      verified = { ok: true, sourceRefs: [{ track: "T7", artifactType: "terminal-outcome", artifactDigest: sha256Hex(`${runId}:${slotId}:${artifacts.outcome}`) }] };
      eventType = "slot_terminal";
      reasonCodes = [artifacts.outcome, "slot_terminal_recorded"];
    } else return failure("campaign_stage_invalid", "stage", stage);
    if (!verified.ok) return verified;
    const appended = await appendEventValidated({
      dataRoot,
      bundle,
      events: [...bundle.events],
      input: { campaignRunId: runId, slotId, eventType, sourceRefs: verified.sourceRefs, reasonCodes, recordedAt: new Date().toISOString() }
    });
    if (!appended.ok) return appended;
    await saveProjection(dataRoot, appended.projection);
    return Object.freeze({ ok: true, stage, event: appended.event, projection: appended.projection });
  });
}

export async function submitPilotCheckpoint({ dataRoot, runId, checkpointDraft, actorId = "checkpoint_reviewer" }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, "checkpoint", async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    let events = [...bundle.events];
    const projected = currentProjection(bundle, events);
    if (!projected.ok) return projected;
    const created = createPilotCheckpointApproval({ projection: projected.projection, ...checkpointDraft });
    if (!created.ok) return created;
    await saveCheckpoint(dataRoot, created.approval);
    const requested = await appendEventValidated({
      dataRoot, bundle, events,
      input: { campaignRunId: runId, slotId: null, eventType: "checkpoint_requested", sourceRefs: [{ track: "T7", artifactType: `checkpoint-wave-${created.approval.completedWaveOrdinal}`, artifactDigest: created.approval.approvalDigest }], reasonCodes: [], recordedAt: created.approval.approvedAt }
    });
    if (!requested.ok) return requested;
    events = [...requested.events];
    const decisionEventType = created.approval.decision === "continue" ? "checkpoint_approved" : created.approval.decision === "stop" ? "checkpoint_stopped" : "run_paused";
    let decided = await appendEventValidated({
      dataRoot, bundle, events,
      input: { campaignRunId: runId, slotId: null, eventType: decisionEventType, sourceRefs: [{ track: "T7", artifactType: `checkpoint-wave-${created.approval.completedWaveOrdinal}`, artifactDigest: created.approval.approvalDigest }], reasonCodes: [`checkpoint_${created.approval.decision}`], recordedAt: created.approval.approvedAt }
    });
    if (!decided.ok) return decided;
    events = [...decided.events];
    if (created.approval.decision === "stop") {
      for (const slot of bundle.slots) {
        const slotProjection = decided.projection.slotProjections.find((item) => item.slotId === slot.slotId);
        if (slotProjection.terminalOutcome || slotProjection.generationAttempts > 0) continue;
        const cancelled = await appendEventValidated({
          dataRoot, bundle, events,
          input: { campaignRunId: runId, slotId: slot.slotId, eventType: "slot_terminal", sourceRefs: [{ track: "T7", artifactType: "campaign-stop", artifactDigest: created.approval.approvalDigest }], reasonCodes: ["cancelled_campaign_stop", "slot_terminal_recorded"], recordedAt: created.approval.approvedAt }
        });
        if (!cancelled.ok) return cancelled;
        events = [...cancelled.events];
        decided = cancelled;
      }
    }
    const finalProjection = currentProjection(bundle, events);
    if (!finalProjection.ok) return finalProjection;
    await saveProjection(dataRoot, finalProjection.projection);
    return Object.freeze({ ok: true, approval: created.approval, projection: finalProjection.projection });
  });
}

export async function resumePilotCampaign({ dataRoot, runId, actorId = "campaign_operator" }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, "resume", async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    const projected = currentProjection(bundle);
    if (!projected.ok) return projected;
    if (projected.projection.runStatus !== "paused") return Object.freeze({ ok: true, state: "unchanged", projection: projected.projection });
    const appended = await appendEventValidated({
      dataRoot, bundle, events: [...bundle.events],
      input: { campaignRunId: runId, slotId: null, eventType: "run_resumed", sourceRefs: [{ track: "T7", artifactType: "resume", artifactDigest: projected.projection.projectionDigest }], reasonCodes: [], recordedAt: new Date().toISOString() }
    });
    if (!appended.ok) return appended;
    await saveProjection(dataRoot, appended.projection);
    return Object.freeze({ ok: true, state: "resumed", projection: appended.projection });
  });
}

export async function closePilotCampaign({ dataRoot, runId, closedBy, actorId = closedBy }) {
  return withCampaignWriterClaim(dataRoot, runId, actorId, "close", async () => {
    const bundle = await readCampaignBundle(dataRoot, runId);
    const before = currentProjection(bundle);
    if (!before.ok) return before;
    if (before.projection.denominators.terminalSlots !== 20) return failure("campaign_closeout_not_ready", "terminalSlots", before.projection.denominators.terminalSlots);
    const appended = await appendEventValidated({
      dataRoot, bundle, events: [...bundle.events],
      input: { campaignRunId: runId, slotId: null, eventType: "run_closed", sourceRefs: [{ track: "T7", artifactType: "final-projection", artifactDigest: before.projection.projectionDigest }], reasonCodes: [before.projection.runStatus === "stopped" ? "campaign_closed_stopped" : "campaign_closed_complete"], recordedAt: new Date().toISOString() }
    });
    if (!appended.ok) return appended;
    const finalProjected = derivePilotCampaignProjection({ plan: bundle.plan, run: bundle.run, slots: bundle.slots, events: appended.events });
    if (!finalProjected.ok) return finalProjected;
    const closeoutResult = createPilotCampaignCloseout({ plan: bundle.plan, run: bundle.run, projection: finalProjected.projection, ledger: finalProjected.ledger, checkpointApprovals: bundle.checkpoints.filter(verifyPilotCheckpointApprovalIntegrity), closedBy });
    if (!closeoutResult.ok) return closeoutResult;
    await saveProjection(dataRoot, finalProjected.projection);
    await saveCloseout(dataRoot, closeoutResult.closeout);
    return Object.freeze({ ok: true, closeout: closeoutResult.closeout, projection: finalProjected.projection });
  });
}

export async function getPilotCampaignStatus({ dataRoot, runId }) {
  const bundle = await readCampaignBundle(dataRoot, runId);
  const projected = currentProjection(bundle);
  return projected.ok ? Object.freeze({ ok: true, projection: projected.projection }) : projected;
}

export function nextPilotSlotAction(slotProjection) {
  const actions = {
    planned: "issue_wave",
    awaiting_generation_handoff: "submit_generation_handoff",
    generation_handoff_failed: "reserve_generation_retry_or_terminal",
    generation_retry_reserved: "issue_retry_packet",
    import_preflight_ready: "run_t3_import",
    awaiting_observation_authorization: "authorize_t4_observation",
    awaiting_observation: "run_t4_observation",
    observation_valid_ineligible: "record_terminal_ineligible",
    awaiting_blind_review: "issue_t5_assignment",
    awaiting_consensus: "collect_t5_reviews",
    consensus_sealed: "run_t5_alignment",
    awaiting_promotion_policy_reviews: "run_t6_policy_reviews",
    awaiting_promotion_review: "run_t6_promotion_review",
    promotion_decision_registered: "record_terminal_promotion_outcome",
    terminal: "none"
  };
  return actions[slotProjection.state] || "manual_integrity_review";
}
