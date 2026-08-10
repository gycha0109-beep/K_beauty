import {
  PILOT_CAMPAIGN_PROJECTION_SCHEMA_VERSION,
  PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION,
  PILOT_DIVERSIFIED_CAMPAIGN_PROJECTION_SCHEMA_VERSION,
  PILOT_TERMINAL_OUTCOMES,
  validatePilotProjection
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { validateCampaignEventLedger } from "./events.js";
import { verifyPilotCampaignPlanIntegrity, verifyPilotCampaignRunIntegrity, verifyPilotSlotIntegrity } from "./plan.js";

const TECHNICAL_TERMINALS = new Set([
  "generation_failed_no_asset",
  "candidate_import_failed",
  "cancelled_budget_exhausted",
  "cancelled_campaign_stop",
  "cancelled_operator",
  "cancelled_ungenerated_wave"
]);
const OBSERVATION_TECHNICAL_REASONS = new Set([
  "provider_transport_failure",
  "provider_contract_parse_failure",
  "execution_claim_failed_before_observation_publication"
]);

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function terminalReason(event) {
  return event.reasonCodes.find((code) => PILOT_TERMINAL_OUTCOMES.includes(code)) || null;
}

function refDigest(event, artifactType) {
  return event.sourceRefs.find((ref) => ref.artifactType === artifactType)?.artifactDigest || null;
}

function artifactToken(event, prefix) {
  const type = event.sourceRefs.find((ref) => ref.artifactType.startsWith(prefix))?.artifactType;
  return type ? type.slice(prefix.length) : null;
}

export function projectPilotSlot(slot, orderedEvents) {
  let state = "planned";
  let terminalOutcome = null;
  let candidateId = null;
  let candidateDigest = null;
  let canonicalSha256 = null;
  let observationRunDigest = null;
  let observationObjectDigest = null;
  let observationRunId = null;
  let consensusDigest = null;
  let alignmentDigest = null;
  let promotionDecisionDigest = null;
  let activeG4 = null;
  let generationAttempts = 0;
  let generationRetries = 0;
  let observationRuns = 0;
  let authoritativeObservationRuns = 0;
  let observationRecoveryRuns = 0;

  for (const event of orderedEvents) {
    if (terminalOutcome) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "event_after_terminal");
    switch (event.eventType) {
      case "generation_packet_issued":
        if (!(state === "planned" || state === "generation_retry_reserved")) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "packet_transition");
        if (generationAttempts >= 2) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "attempt_limit");
        generationAttempts += 1;
        state = "awaiting_generation_handoff";
        break;
      case "generation_handoff_registered": {
        if (state !== "awaiting_generation_handoff") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "handoff_transition");
        const outcome = event.reasonCodes.find((code) => ["generation_asset_ready", "provider_no_output", "provider_refusal_without_asset", "local_transfer_incomplete"].includes(code));
        if (!outcome) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "handoff_outcome_missing");
        state = outcome === "generation_asset_ready" ? "import_preflight_ready" : "generation_handoff_failed";
        break;
      }
      case "generation_retry_reserved":
        if (state !== "generation_handoff_failed" || generationAttempts !== 1 || candidateDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "retry_transition");
        generationRetries += 1;
        state = "generation_retry_reserved";
        break;
      case "candidate_registered": {
        if (state !== "import_preflight_ready") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "candidate_transition");
        const digest = refDigest(event, "candidate-manifest");
        const id = artifactToken(event, "candidate-id-");
        const imageSha = refDigest(event, "canonical-image-sha");
        if (!digest || !/^cand_[a-f0-9]{24}$/.test(id || "") || !/^[a-f0-9]{64}$/.test(imageSha || "")) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "candidate_reference_missing");
        if (candidateDigest && (candidateDigest !== digest || candidateId !== id || canonicalSha256 !== imageSha)) return failure("registered_candidate_replacement_attempted", `slots.${slot.slotId}`, null);
        candidateDigest = digest;
        candidateId = id;
        canonicalSha256 = imageSha;
        state = "awaiting_observation_authorization";
        break;
      }
      case "observation_authorization_recorded":
        if (state !== "awaiting_observation_authorization") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "observation_authorization_transition");
        if (event.reasonCodes.includes("observation_recovery_reserved")) {
          if (observationObjectDigest !== null) return failure("observation_recovery_not_allowed", `slots.${slot.slotId}`, "authoritative_observation_exists");
          observationRecoveryRuns += 1;
        }
        state = "awaiting_observation";
        break;
      case "observation_registered": {
        if (state !== "awaiting_observation") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "observation_transition");
        const runDigest = refDigest(event, "observation-run");
        const objectDigest = refDigest(event, "observation-object");
        const runId = artifactToken(event, "observation-run-id-");
        if (!runDigest || !/^obs_[a-f0-9]{24}$/.test(runId || "")) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "observation_reference_missing");
        observationRuns += 1;
        observationRunDigest = runDigest;
        observationRunId = runId;
        const technicalReason = event.reasonCodes.find((code) => OBSERVATION_TECHNICAL_REASONS.has(code));
        if (technicalReason) {
          if (objectDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "technical_observation_has_object");
          state = "awaiting_observation_authorization";
          break;
        }
        if (!objectDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "observation_object_missing");
        observationObjectDigest = objectDigest;
        authoritativeObservationRuns += 1;
        state = event.reasonCodes.includes("observation_valid_ineligible") ? "observation_valid_ineligible" : "awaiting_blind_review";
        break;
      }
      case "judgment_assignment_issued":
        if (state !== "awaiting_blind_review" || !observationObjectDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "judgment_assignment_transition");
        state = "awaiting_consensus";
        break;
      case "judgment_consensus_sealed":
        if (!(state === "awaiting_blind_review" || state === "awaiting_consensus")) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "consensus_transition");
        consensusDigest = refDigest(event, "judgment-consensus");
        if (!consensusDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "consensus_reference_missing");
        state = "consensus_sealed";
        break;
      case "alignment_registered":
        if (state !== "consensus_sealed") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "alignment_transition");
        alignmentDigest = refDigest(event, "intent-alignment");
        if (!alignmentDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "alignment_reference_missing");
        state = "awaiting_promotion_policy_reviews";
        break;
      case "promotion_preflight_registered":
        if (state !== "awaiting_promotion_policy_reviews") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "promotion_preflight_transition");
        state = "awaiting_promotion_review";
        break;
      case "promotion_decision_registered":
        if (!(state === "awaiting_promotion_policy_reviews" || state === "awaiting_promotion_review")) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "promotion_decision_transition");
        promotionDecisionDigest = refDigest(event, "promotion-decision");
        if (!promotionDecisionDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "promotion_reference_missing");
        if (event.reasonCodes.includes("promoted_g4")) {
          const gradeRecordDigest = refDigest(event, "g4-grade-record");
          const promotionKey = refDigest(event, "promotion-key");
          const splitCouplingKeysDigest = refDigest(event, "split-coupling-keys");
          if (!gradeRecordDigest || !promotionKey || !splitCouplingKeysDigest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "g4_reference_missing");
          activeG4 = { slotId: slot.slotId, gradeRecordDigest, promotionKey, splitCouplingKeysDigest };
        }
        state = "promotion_decision_registered";
        break;
      case "slot_terminal": {
        const outcome = terminalReason(event);
        if (!outcome) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "terminal_outcome_missing");
        const allowed =
          (state === "generation_handoff_failed" && generationAttempts === 2 && outcome === "generation_failed_no_asset") ||
          (state === "import_preflight_ready" && outcome === "candidate_import_failed") ||
          (state === "observation_valid_ineligible" && outcome === "observation_valid_ineligible") ||
          (["awaiting_observation_authorization", "awaiting_observation"].includes(state) && observationRuns > 0 && !observationObjectDigest && outcome === "observation_failed") ||
          (["awaiting_blind_review", "awaiting_consensus"].includes(state) && outcome === "judgment_incomplete") ||
          (state === "promotion_decision_registered" && ["promoted_g4", "retained_g3_negative_control", "promotion_held", "promotion_rejected"].includes(outcome)) ||
          (["planned", "generation_retry_reserved", "generation_handoff_failed"].includes(state) && ["cancelled_budget_exhausted", "cancelled_campaign_stop", "cancelled_operator"].includes(outcome)) ||
          (state === "awaiting_generation_handoff" && generationAttempts === 1 && generationRetries === 0 && outcome === "cancelled_ungenerated_wave");
        if (!allowed) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, `terminal_transition:${state}:${outcome}`);
        terminalOutcome = outcome;
        state = "terminal";
        break;
      }
      default:
        return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, `unknown_slot_event:${event.eventType}`);
    }
  }

  return Object.freeze({
    ok: true,
    slot: deepFreeze({
      slotId: slot.slotId,
      conditionId: slot.conditionId,
      conditionOrdinal: slot.conditionOrdinal,
      waveOrdinal: slot.waveOrdinal,
      ...(slot.subjectVariant ? { subjectVariant: slot.subjectVariant, subjectVariantDigest: slot.subjectVariantDigest } : {}),
      state,
      terminalOutcome,
      checkpointReady: observationObjectDigest !== null || (terminalOutcome !== null && TECHNICAL_TERMINALS.has(terminalOutcome)),
      generationAttempts,
      generationRetries,
      observationRuns,
      authoritativeObservationRuns,
      observationRecoveryRuns,
      refs: { candidateId, candidateDigest, canonicalSha256, observationRunId, observationRunDigest, observationObjectDigest, consensusDigest, alignmentDigest, promotionDecisionDigest },
      activeG4
    })
  });
}

function runProjection(events, slotProjections, waveCount) {
  let runStatus = "active";
  const issuedWaves = new Set();
  const approvedWaves = new Set();
  const stoppedWaves = new Set();
  const cancelledWaves = new Set();
  for (const event of events) {
    if (event.eventType === "run_started") continue;
    if (event.eventType === "wave_issued") {
      const wave = Number(event.sourceRefs.find((ref) => ref.artifactType.startsWith("wave-"))?.artifactType.slice(5));
      if (!Number.isInteger(wave) || wave < 1 || wave > waveCount || issuedWaves.has(wave)) return failure("campaign_event_chain_invalid", "run", "wave_issue_invalid");
      if (wave > 1 && !approvedWaves.has(wave - 1)) return failure("campaign_event_chain_invalid", "run", "wave_without_checkpoint");
      issuedWaves.add(wave);
    } else if (event.eventType === "wave_cancelled") {
      const wave = Number(event.sourceRefs.find((ref) => ref.artifactType.startsWith("wave-cancellation-"))?.artifactType.slice(18));
      if (!Number.isInteger(wave) || wave < 1 || wave > waveCount || !issuedWaves.has(wave) || approvedWaves.has(wave) || stoppedWaves.has(wave) || cancelledWaves.has(wave)) return failure("campaign_event_chain_invalid", "run", "wave_cancellation_invalid");
      cancelledWaves.add(wave);
    } else if (event.eventType === "checkpoint_approved") {
      const wave = Number(event.sourceRefs.find((ref) => ref.artifactType.startsWith("checkpoint-wave-"))?.artifactType.slice(16));
      if (![1,2].includes(wave) || !issuedWaves.has(wave) || approvedWaves.has(wave)) return failure("campaign_event_chain_invalid", "run", "checkpoint_invalid");
      approvedWaves.add(wave);
    } else if (event.eventType === "checkpoint_stopped") {
      const wave = Number(event.sourceRefs.find((ref) => ref.artifactType.startsWith("checkpoint-wave-"))?.artifactType.slice(16));
      if (![1,2].includes(wave) || !issuedWaves.has(wave)) return failure("campaign_event_chain_invalid", "run", "checkpoint_stop_invalid");
      stoppedWaves.add(wave);
      runStatus = "stopped";
    } else if (event.eventType === "run_paused") runStatus = "paused";
    else if (event.eventType === "run_resumed") {
      if (runStatus !== "paused") return failure("campaign_event_chain_invalid", "run", "resume_without_pause");
      runStatus = "active";
    } else if (event.eventType === "run_closed") {
      if (runStatus === "closed") return failure("campaign_event_chain_invalid", "run", "duplicate_close");
      runStatus = "closed";
    }
  }
  const waveStatus = Array.from({ length: waveCount }, (_, index) => index + 1).map((waveOrdinal) => {
    const waveSlots = slotProjections.filter((slot) => slot.waveOrdinal === waveOrdinal);
    let status = "not_issued";
    if (cancelledWaves.has(waveOrdinal)) status = "cancelled";
    else if (stoppedWaves.has(waveOrdinal)) status = "stopped";
    else if (approvedWaves.has(waveOrdinal)) status = "approved";
    else if (issuedWaves.has(waveOrdinal)) {
      if (waveSlots.every((slot) => slot.terminalOutcome !== null)) status = "complete";
      else if (waveSlots.every((slot) => slot.checkpointReady) && waveOrdinal < 3) status = "awaiting_checkpoint";
      else status = "active";
    }
    return { waveOrdinal, status };
  });
  return Object.freeze({ ok: true, runStatus, waveStatus: Object.freeze(waveStatus) });
}

export function derivePilotCampaignProjection({ plan, run, slots, events }) {
  if (!verifyPilotCampaignPlanIntegrity(plan) || !verifyPilotCampaignRunIntegrity(run, plan) || !Array.isArray(slots) || slots.length !== plan.objective.primarySlotCount || !slots.every((slot) => verifyPilotSlotIntegrity(slot, run, plan))) return failure("campaign_projection_invalid", "source");
  const ledger = validateCampaignEventLedger(events, { campaignRunId: run.campaignRunId, slotIds: slots.map((slot) => slot.slotId) });
  if (!ledger.ok) return ledger;
  const runEvents = ledger.orderedByChain.__run__ || [];
  if (runEvents.length === 0 || runEvents[0].eventType !== "run_started") return failure("campaign_event_chain_invalid", "run", "run_started_missing");
  const slotProjections = [];
  for (const slot of slots) {
    const projected = projectPilotSlot(slot, ledger.orderedByChain[slot.slotId] || []);
    if (!projected.ok) return projected;
    slotProjections.push(projected.slot);
  }
  const runProjected = runProjection(runEvents, slotProjections, plan.checkpointPolicy.waveCount);
  if (!runProjected.ok) return runProjected;

  const terminalOutcomeCounts = Object.fromEntries(PILOT_TERMINAL_OUTCOMES.map((outcome) => [outcome, 0]));
  for (const slot of slotProjections) if (slot.terminalOutcome) terminalOutcomeCounts[slot.terminalOutcome] += 1;
  const reasonCodeCounts = {};
  for (const event of events) for (const code of event.reasonCodes) reasonCodeCounts[code] = (reasonCodeCounts[code] || 0) + 1;
  const budget = {
    generationAttemptsUsed: slotProjections.reduce((sum, slot) => sum + slot.generationAttempts, 0),
    generationRetryReserveUsed: slotProjections.reduce((sum, slot) => sum + slot.generationRetries, 0),
    observationRunsUsed: slotProjections.reduce((sum, slot) => sum + slot.observationRuns, 0),
    observationRecoveryRunsUsed: slotProjections.reduce((sum, slot) => sum + slot.observationRecoveryRuns, 0)
  };
  const authoritativeObservationRuns = slotProjections.reduce((sum, slot) => sum + slot.authoritativeObservationRuns, 0);
  if (
    budget.generationAttemptsUsed > plan.budgets.maxGenerationAttemptsTotal ||
    budget.generationRetryReserveUsed > plan.budgets.technicalGenerationRetryReserve ||
    budget.observationRunsUsed > plan.budgets.maxObservationRunsTotal ||
    budget.observationRecoveryRunsUsed > plan.budgets.maxObservationRecoveryRuns ||
    authoritativeObservationRuns > plan.budgets.maxAuthoritativeObservationRuns
  ) return failure("budget_hard_cap_exceeded", "budget");

  const latestEventDigest = sha256Hex(stableStringify(Object.values(ledger.heads).sort()));
  const activeG4Refs = slotProjections.map((slot) => slot.activeG4).filter(Boolean).sort((a,b) => a.slotId.localeCompare(b.slotId));
  const semantic = {
    schemaVersion: plan.schemaVersion === PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION ? PILOT_DIVERSIFIED_CAMPAIGN_PROJECTION_SCHEMA_VERSION : PILOT_CAMPAIGN_PROJECTION_SCHEMA_VERSION,
    campaignRunId: run.campaignRunId,
    planDigest: plan.planDigest,
    latestEventDigest,
    runStatus: runProjected.runStatus,
    waveStatus: runProjected.waveStatus,
    budget,
    denominators: {
      plannedPrimarySlots: plan.objective.primarySlotCount,
      issuedPrimarySlots: slotProjections.filter((slot) => slot.generationAttempts > 0).length,
      generationHandoffs: events.filter((event) => event.eventType === "generation_handoff_registered").length,
      registeredCandidates: slotProjections.filter((slot) => slot.refs.candidateDigest).length,
      authoritativeObservations: authoritativeObservationRuns,
      sealedConsensus: slotProjections.filter((slot) => slot.refs.consensusDigest).length,
      alignments: slotProjections.filter((slot) => slot.refs.alignmentDigest).length,
      promotionDecisions: slotProjections.filter((slot) => slot.refs.promotionDecisionDigest).length,
      terminalSlots: slotProjections.filter((slot) => slot.terminalOutcome).length
    },
    terminalOutcomeCounts,
    reasonCodeCounts: Object.fromEntries(Object.entries(reasonCodeCounts).sort(([a],[b]) => a.localeCompare(b))),
    activeG4Refs,
    slotProjections: slotProjections.sort((a,b) => a.slotId.localeCompare(b.slotId))
  };
  const projectionDigest = sha256Hex(stableStringify(semantic));
  const projection = deepFreeze({ ...semantic, projectionDigest });
  return validatePilotProjection(projection).ok
    ? Object.freeze({ ok: true, projection, ledger })
    : failure("campaign_projection_invalid", "$", null);
}
