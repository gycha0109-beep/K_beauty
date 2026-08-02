import {
  GENERATION_RETRY_ALLOWED_REASONS,
  GENERATION_RETRY_FORBIDDEN_REASONS,
  OBSERVATION_RECOVERY_ALLOWED_REASONS,
  OBSERVATION_RECOVERY_FORBIDDEN_OUTCOMES,
  PILOT_BUDGET,
  PILOT_CAMPAIGN_PLAN_SCHEMA_VERSION,
  PILOT_CAMPAIGN_RUN_SCHEMA_VERSION,
  PILOT_CONDITIONS,
  PILOT_IMMEDIATE_STOP_REASONS,
  PILOT_PAUSE_REASONS,
  PILOT_QUESTION_ID,
  PILOT_SLOT_SCHEMA_VERSION,
  validatePilotCampaignPlan,
  validatePilotCampaignRun,
  validatePilotSlot
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { buildPilotSourceFreeze, verifyPilotSourceFreeze } from "./source-freeze.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function planSemantic(plan) {
  const { planDigest, authoredAt, ...semantic } = plan;
  return semantic;
}

function runSemantic(run) {
  const { campaignRunId, runIdentityDigest, startedAt, ...semantic } = run;
  return semantic;
}

function slotSemantic(slot) {
  const { slotId, slotIdentityDigest, ...semantic } = slot;
  return semantic;
}

export function compilePilotCampaignPlan({
  campaignId,
  campaignVersion,
  comparisonGroupId = null,
  providerProfileId,
  authoredBy,
  authoredAt = new Date().toISOString()
}) {
  if (!TOKEN.test(campaignId || "") || !TOKEN.test(campaignVersion || "") || !(comparisonGroupId === null || TOKEN.test(comparisonGroupId || "")) || !TOKEN.test(authoredBy || "") || !Number.isFinite(Date.parse(authoredAt)) || new Date(authoredAt).toISOString() !== authoredAt) {
    return failure("campaign_plan_invalid", "$");
  }
  const freeze = buildPilotSourceFreeze(providerProfileId);
  if (!freeze.ok) return freeze;
  const matrix = Object.entries(PILOT_CONDITIONS).map(([conditionId, row]) => ({
    conditionId,
    fixtureId: row.fixtureId,
    primarySlots: row.primarySlots,
    waveAllocation: [...row.waveAllocation]
  }));
  const value = {
    schemaVersion: PILOT_CAMPAIGN_PLAN_SCHEMA_VERSION,
    campaignId,
    campaignVersion,
    comparisonGroupId,
    objective: {
      questionId: PILOT_QUESTION_ID,
      purpose: "skin_cue_control",
      primarySlotCount: 20,
      interpretationOwner: "t8"
    },
    sourceFreeze: freeze.sourceFreeze,
    matrix,
    budgets: { ...PILOT_BUDGET },
    retryPolicy: {
      generationRetryAllowedReasons: [...GENERATION_RETRY_ALLOWED_REASONS],
      generationRetryForbiddenReasons: [...GENERATION_RETRY_FORBIDDEN_REASONS],
      registeredCandidateReplacement: "forbidden",
      observationRecoveryAllowedReasons: [...OBSERVATION_RECOVERY_ALLOWED_REASONS],
      observationRecoveryForbiddenOutcomes: [...OBSERVATION_RECOVERY_FORBIDDEN_OUTCOMES]
    },
    checkpointPolicy: {
      waveCount: 3,
      wavePrimarySlotCounts: [4, 8, 8],
      manualApprovalRequired: true,
      readinessBoundary: "authoritative_t4_or_technical_terminal"
    },
    stopPolicy: {
      immediateStopReasons: [...PILOT_IMMEDIATE_STOP_REASONS],
      pauseReasons: [...PILOT_PAUSE_REASONS],
      lowYieldAutomaticStop: false
    },
    outputPolicy: {
      retainAllRegisteredCandidates: true,
      retainAllTerminalOutcomes: true,
      reportAuthority: "t8",
      splitAuthority: "t9"
    },
    authoredBy,
    authoredAt
  };
  const planDigest = sha256Hex(stableStringify(planSemantic(value)));
  const plan = deepFreeze({ ...value, planDigest });
  const validation = validatePilotCampaignPlan(plan);
  return validation.ok ? Object.freeze({ ok: true, plan }) : validation;
}

export function verifyPilotCampaignPlanIntegrity(plan) {
  if (!validatePilotCampaignPlan(plan).ok || !verifyPilotSourceFreeze(plan.sourceFreeze)) return false;
  const digest = sha256Hex(stableStringify(planSemantic(plan)));
  return digest === plan.planDigest;
}

function waveForConditionOrdinal(ordinal) {
  if (ordinal === 1) return 1;
  if (ordinal <= 3) return 2;
  return 3;
}

export function createPilotCampaignRun({ plan, runNonce, startedBy, startedAt = new Date().toISOString() }) {
  if (!verifyPilotCampaignPlanIntegrity(plan)) return failure("campaign_plan_invalid", "plan");
  if (!TOKEN.test(runNonce || "") || !TOKEN.test(startedBy || "") || !Number.isFinite(Date.parse(startedAt)) || new Date(startedAt).toISOString() !== startedAt) return failure("campaign_run_invalid", "$");
  const semantic = {
    schemaVersion: PILOT_CAMPAIGN_RUN_SCHEMA_VERSION,
    campaignPlanDigest: plan.planDigest,
    providerProfileId: plan.sourceFreeze.providerProfileId,
    sourceFreezeDigest: plan.sourceFreeze.sourceFreezeDigest,
    runNonce,
    startedBy
  };
  const runIdentityDigest = sha256Hex(stableStringify(semantic));
  const run = deepFreeze({
    ...semantic,
    campaignRunId: `crun_${runIdentityDigest.slice(0, 24)}`,
    startedAt,
    runIdentityDigest
  });
  if (!validatePilotCampaignRun(run).ok) return failure("campaign_run_invalid", "$", null);

  const slots = [];
  for (const conditionId of ["A", "B", "C", "D"]) {
    for (let conditionOrdinal = 1; conditionOrdinal <= 5; conditionOrdinal += 1) {
      const slotValue = {
        schemaVersion: PILOT_SLOT_SCHEMA_VERSION,
        campaignRunId: run.campaignRunId,
        conditionId,
        conditionOrdinal,
        waveOrdinal: waveForConditionOrdinal(conditionOrdinal),
        fixtureDigest: plan.sourceFreeze.fixtureObjectDigests[conditionId]
      };
      const slotIdentityDigest = sha256Hex(stableStringify(slotValue));
      const slot = deepFreeze({
        ...slotValue,
        slotId: `slot_${slotIdentityDigest.slice(0, 24)}`,
        slotIdentityDigest
      });
      if (!validatePilotSlot(slot).ok) return failure("campaign_slot_invalid", `slots.${conditionId}.${conditionOrdinal}`);
      slots.push(slot);
    }
  }
  slots.sort((left, right) => left.waveOrdinal - right.waveOrdinal || left.conditionId.localeCompare(right.conditionId) || left.conditionOrdinal - right.conditionOrdinal);
  return Object.freeze({ ok: true, run, slots: Object.freeze(slots) });
}

export function verifyPilotCampaignRunIntegrity(run, plan) {
  if (!validatePilotCampaignRun(run).ok || !verifyPilotCampaignPlanIntegrity(plan)) return false;
  const digest = sha256Hex(stableStringify(runSemantic(run)));
  return run.campaignPlanDigest === plan.planDigest && run.sourceFreezeDigest === plan.sourceFreeze.sourceFreezeDigest && run.providerProfileId === plan.sourceFreeze.providerProfileId && run.runIdentityDigest === digest && run.campaignRunId === `crun_${digest.slice(0, 24)}`;
}

export function verifyPilotSlotIntegrity(slot, run, plan) {
  if (!validatePilotSlot(slot).ok || !verifyPilotCampaignRunIntegrity(run, plan)) return false;
  const digest = sha256Hex(stableStringify(slotSemantic(slot)));
  return slot.campaignRunId === run.campaignRunId && slot.fixtureDigest === plan.sourceFreeze.fixtureObjectDigests[slot.conditionId] && slot.waveOrdinal === waveForConditionOrdinal(slot.conditionOrdinal) && slot.slotIdentityDigest === digest && slot.slotId === `slot_${digest.slice(0, 24)}`;
}
