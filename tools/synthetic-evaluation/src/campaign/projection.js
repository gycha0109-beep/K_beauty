import {
  PILOT_CAMPAIGN_PROJECTION_SCHEMA_VERSION,
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
  "cancelled_operator"
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

export function projectPilotSlot(slot, orderedEvents) {
  let state = "planned";
  let terminalOutcome = null;
  let candidateDigest = null;
  let observationDigest = null;
  let consensusDigest = null;
  let alignmentDigest = null;
  let promotionDecisionDigest = null;
  let activeG4 = null;
  let generationAttempts = 0;
  let generationRetries = 0;
  let observationRuns = 0;
  let observationRecoveryRuns = 0;

  for (const event of orderedEvents) {
    if (terminalOutcome) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "event_after_terminal");
    switch (event.eventType) {
      case "generation_packet_issued":
        if (!(state === "planned" || state === "generation_retry_reserved")) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "packet_transition");
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
        if (state !== "generation_handoff_failed" || generationAttempts >= 2) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "retry_transition");
        generationRetries += 1;
        state = "generation_retry_reserved";
        break;
      case "candidate_registered": {
        if (state !== "import_preflight_ready") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "candidate_transition");
        const digest = refDigest(event, "candidate-manifest");
        if (!digest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "candidate_reference_missing");
        if (candidateDigest && candidateDigest !== digest) return failure("registered_candidate_replacement_attempted", `slots.${slot.slotId}`, null);
        candidateDigest = digest;
        state = "awaiting_observation_authorization";
        break;
      }
      case "observation_authorization_recorded":
        if (state !== "awaiting_observation_authorization") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "observation_authorization_transition");
        if (event.reasonCodes.includes("observation_recovery_reserved")) observationRecoveryRuns += 1;
        state = "awaiting_observation";
        break;
      case "observation_registered": {
        if (!(state === "awaiting_observation" || state === "awaiting_observation_authorization")) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "observation_transition");
        const digest = refDigest(event, "observation-run");
        if (!digest) return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "observation_reference_missing");
        observationDigest = digest;
        observationRuns += 1;
        state = event.reasonCodes.includes("observation_valid_ineligible") ? "observation_valid_ineligible" : "awaiting_blind_review";
        break;
      }
      case "judgment_assignment_issued":
        if (state !== "awaiting_blind_review") return failure("campaign_event_chain_invalid", `slots.${slot.slotId}`, "judgment_assignment_transition");
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
          (state === "generation_handoff_failed" && outcome === "generation_failed_no_asset") ||
          (state === "import_preflight_ready" && outcome === "candidate_import_failed") ||
          (state === "observation_valid_ineligible" && outcome === "observation_valid_ineligible") ||
          (["awaiting_observation_authorization", "awaiting_observation"].includes(state) && outcome === "observation_failed") ||
          (["awaiting_blind_review", "awaiting_consensus"].includes(state) && outcome === "judgment_incomplete") ||
          (state === "promotion_decision_registered" && ["promoted_g4", "retained_g3_negative_control", "promotion_held", "promotion_rejected"].includes(outcome)) ||
          (["planned", "generation_retry_reserved", "generation_handoff_failed"].includes(state) && ["cancelled_budget_exhausted", "cancelled_campaign_stop", "cancelled_operator"].includes(outcome));
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
      state,
      terminalOutcome,
      checkpointReady: observationDigest !== null || (terminalOutcome !== null && TECHNICAL_TERMINALS.has(terminalOutcome)),
      generationAttempts,
      generationRetries,
      observationRuns,
      observationRecoveryRuns,
      refs: { candidateDigest, observationDigest, consensusDigest, alignmentDigest, promotionDecisionDigest },
      activeG4
    })
  });
}

function runProjection(events, slotProjections) {
  let runStatus = "active";
  const issuedWaves = new Set();
  const approvedWaves = new Set();
  const stoppedWaves = new Set();
  for (const event of events) {
    if (event.eventType === "run_started") continue;
    if (event.eventType === "wave_issued") {
      const wave = Number(event.sourceRefs.find((ref) => ref.artifactType.startsWith("wave-"))?.artifactType.slice(5));
      if (![1,2,3].includes(wave) || issuedWaves.has(wave)) return failure("campaign_event_chain_invalid", "run", "wave_issue_invalid");
      if (wave > 1 && !approvedWaves.has(wave - 1)) return failure("campaign_event_chain_invalid", "run", "wave_without_checkpoint");
      issuedWaves.add(wave);
    } else if (event.eventType === "checkpoint_approved") {
      const wave = Number(event.sourceRefs.find((ref) => ref.artifactType.startsWith("checkpoint-wave-"))?.artifactType.slice(16));
      if (![1,2].includes(wave) || !issuedWaves.has(wave)) return failure("campaign_event_chain_invalid", "run", "checkpoint_invalid");
      approvedWaves.add(wave);
    } else if (event.eventType === "checkpoint_stopped") {
      const wave = Number(event.sourceRefs.find((ref) => ref.artifactType.startsWith("checkpoint-wave-"))?.artifactType.slice(16));
      stoppedWaves.add(wave);
      runStatus = "stopped";
    } else if (event.eventType === "run_paused") runStatus = "paused";
    else if (event.eventType === "run_resumed") {
      if (runStatus !== "paused") return failure("campaign_event_chain_invalid", "run", "resume_without_pause");
      runStatus = "active";
    } else if (event.eventType === "run_closed") runStatus = "closed";
  }
  const waveStatus = [1,2,3].map((waveOrdinal) => {
    const slots = slotProjections.filter((slot) => slot.waveOrdinal === waveOrdinal);
    let status = "not_issued";
    if (stoppedWaves.has(waveOrdinal)) status = "stopped";
    else if (approvedWaves.has(waveOrdinal)) status = "approved";
    else if (issuedWaves.has(waveOrdinal)) {
      if (slots.every((slot) => slot.terminalOutcome !== null)) status = "complete";
      else if (slots.every((slot) => slot.checkpointReady) && waveOrdinal < 3) status = "awaiting_checkpoint";
      else status = "active";
    }
    return { waveOrdinal, status };
  });
  return Object.freeze({ ok: true, runStatus, waveStatus: Object.freeze(waveStatus), issuedWaves, approvedWaves });
}

export function derivePilotCampaignProjection({ plan, run, slots, events }) {
  if (!verifyPilotCampaignPlanIntegrity(plan) || !verifyPilotCampaignRunIntegrity(run, plan) || !Array.isArray(slots) || slots.length !== 20 || !slots.every((slot) => verifyPilotSlotIntegrity(slot, run, plan))) return failure("campaign_projection_invalid", "source");
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
  const runProjected = runProjection(runEvents, slotProjections);
  if (!runProjected.ok) return runProjected;

  const terminalOutcomeCounts = Object.fromEntries(PILOT_TERMINAL_OUTCOMES.map((outcome) => [outcome, 0]));
  for (const slot of slotProjections) if (slot.terminalOutcome) terminalOutcomeCounts[slot.terminalOutcome] += 1;
  const reasonCodeCounts = {};
  for (const event of events) for (const code of event.reasonCodes) reasonCodeCounts[code] = (reasonCodeCounts[code] || 0) + 1;
  const latestEventDigest = sha256Hex(stableStringify(Object.values(ledger.heads).sort()));
  const budget = {
    generationAttemptsUsed: slotProjections.reduce((sum, slot) => sum + slot.generationAttempts, 0),
    generationRetryReserveUsed: slotProjections.reduce((sum, slot) => sum + slot.generationRetries, 0),
    observationRunsUsed: slotProjections.reduce((sum, slot) => sum + slot.observationRuns, 0),
    observationRecoveryRunsUsed: slotProjections.reduce((sum, slot) => sum + slot.observationRecoveryRuns, 0)
  };
  if (budget.generationAttemptsUsed > plan.budgets.maxGenerationAttemptsTotal || budget.generationRetryReserveUsed > plan.budgets.technicalGenerationRetryReserve || budget.observationRunsUsed > plan.budgets.maxObservationRunsTotal || budget.observationRecoveryRunsUsed > plan.budgets.maxObservationRecoveryRuns) return failure("budget_hard_cap_exceeded", "budget");
  const activeG4Refs = slotProjections.map((slot) => slot.activeG4).filter(Boolean).sort((a,b) => a.slotId.localeCompare(b.slotId));
  const semantic = {
    schemaVersion: PILOT_CAMPAIGN_PROJECTION_SCHEMA_VERSION,
    campaignRunId: run.campaignRunId,
    planDigest: plan.planDigest,
    latestEventDigest,
    runStatus: runProjected.runStatus,
    waveStatus: runProjected.waveStatus,
    budget,
    denominators: {
      plannedPrimarySlots: 20,
      issuedPrimarySlots: slotProjections.filter((slot) => slot.generationAttempts > 0).length,
      generationHandoffs: events.filter((event) => event.eventType === "generation_handoff_registered").length,
      registeredCandidates: slotProjections.filter((slot) => slot.refs.candidateDigest).length,
      authoritativeObservations: slotProjections.filter((slot) => slot.refs.observationDigest).length,
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
  return validatePilotProjection(projection).ok ? Object.freeze({ ok: true, projection, ledger }) : failure("campaign_projection_invalid", "$", null);
}
