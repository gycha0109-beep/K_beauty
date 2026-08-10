import {
  GENERATION_RETRY_ALLOWED_REASONS,
  GENERATION_RETRY_FORBIDDEN_REASONS,
  OBSERVATION_RECOVERY_ALLOWED_REASONS,
  OBSERVATION_RECOVERY_FORBIDDEN_OUTCOMES,
  PILOT_BUDGET,
  PILOT_CAMPAIGN_PLAN_SCHEMA_VERSION,
  PILOT_CAMPAIGN_RUN_SCHEMA_VERSION,
  PILOT_CONDITIONS,
  PILOT_DIVERSIFIED_BUDGET,
  PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION,
  PILOT_DIVERSIFIED_SLOT_SCHEMA_VERSION,
  PILOT_IMMEDIATE_STOP_REASONS,
  PILOT_PAUSE_REASONS,
  PILOT_QUESTION_ID,
  PILOT_SLOT_SCHEMA_VERSION,
  PILOT_SUBJECT_AGE_BANDS,
  PILOT_SUBJECT_PRESENTATIONS,
  PILOT_SUBJECT_REGIONAL_APPEARANCE_HINTS,
  validatePilotCampaignPlan,
  validatePilotCampaignRun,
  validatePilotSlot
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { buildPilotSourceFreeze, verifyPilotSourceFreeze } from "./source-freeze.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SUBJECT_VARIANT_KEYS = Object.freeze(["conditionId", "conditionOrdinal", "adultAgeBand", "presentation", "regionalAppearanceHint"]);

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

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function subjectVariantSemantic(value) {
  return Object.fromEntries(SUBJECT_VARIANT_KEYS.map((key) => [key, value[key]]));
}

export function createPilotSubjectVariant(value) {
  if (!exactKeys(value, SUBJECT_VARIANT_KEYS) || !["A", "B", "C", "D"].includes(value.conditionId) || ![1, 2].includes(value.conditionOrdinal) || !PILOT_SUBJECT_AGE_BANDS.includes(value.adultAgeBand) || !PILOT_SUBJECT_PRESENTATIONS.includes(value.presentation) || !PILOT_SUBJECT_REGIONAL_APPEARANCE_HINTS.includes(value.regionalAppearanceHint)) return failure("campaign_subject_matrix_invalid", "subjectVariants");
  const semantic = subjectVariantSemantic(value);
  return Object.freeze({ ok: true, variant: deepFreeze({ ...semantic, subjectVariantDigest: sha256Hex(stableStringify(semantic)) }) });
}

function normalizeSubjectVariants(values) {
  if (!Array.isArray(values) || values.length !== 8) return failure("campaign_subject_matrix_invalid", "subjectVariants");
  const variants = [];
  for (const value of values) {
    const created = createPilotSubjectVariant(value);
    if (!created.ok) return created;
    variants.push(created.variant);
  }
  variants.sort((left, right) => left.conditionId.localeCompare(right.conditionId) || left.conditionOrdinal - right.conditionOrdinal);
  const expected = [];
  for (const conditionId of ["A", "B", "C", "D"]) for (const conditionOrdinal of [1, 2]) expected.push(`${conditionId}:${conditionOrdinal}`);
  if (variants.map((variant) => `${variant.conditionId}:${variant.conditionOrdinal}`).some((key, index) => key !== expected[index])) return failure("campaign_subject_matrix_invalid", "subjectVariants");
  return Object.freeze({ ok: true, variants: Object.freeze(variants) });
}

export function compilePilotCampaignPlan({
  campaignId,
  campaignVersion,
  comparisonGroupId = null,
  providerProfileId,
  authoredBy,
  authoredAt = new Date().toISOString(),
  subjectVariants
}) {
  if (!TOKEN.test(campaignId || "") || !TOKEN.test(campaignVersion || "") || !(comparisonGroupId === null || TOKEN.test(comparisonGroupId || "")) || !TOKEN.test(authoredBy || "") || !Number.isFinite(Date.parse(authoredAt)) || new Date(authoredAt).toISOString() !== authoredAt) {
    return failure("campaign_plan_invalid", "$");
  }
  const freeze = buildPilotSourceFreeze(providerProfileId);
  if (!freeze.ok) return freeze;
  const diversified = subjectVariants !== undefined;
  const normalized = diversified ? normalizeSubjectVariants(subjectVariants) : null;
  if (normalized && !normalized.ok) return normalized;
  const matrix = Object.entries(PILOT_CONDITIONS).map(([conditionId, row]) => ({
    conditionId,
    fixtureId: row.fixtureId,
    primarySlots: diversified ? 2 : row.primarySlots,
    waveAllocation: diversified ? [2] : [...row.waveAllocation]
  }));
  const value = {
    schemaVersion: diversified ? PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION : PILOT_CAMPAIGN_PLAN_SCHEMA_VERSION,
    campaignId,
    campaignVersion,
    comparisonGroupId,
    objective: {
      questionId: PILOT_QUESTION_ID,
      purpose: "skin_cue_control",
      primarySlotCount: diversified ? 8 : 20,
      interpretationOwner: "t8"
    },
    sourceFreeze: freeze.sourceFreeze,
    matrix,
    ...(diversified ? { subjectVariants: normalized.variants } : {}),
    budgets: { ...(diversified ? PILOT_DIVERSIFIED_BUDGET : PILOT_BUDGET) },
    retryPolicy: {
      generationRetryAllowedReasons: [...GENERATION_RETRY_ALLOWED_REASONS],
      generationRetryForbiddenReasons: [...GENERATION_RETRY_FORBIDDEN_REASONS],
      registeredCandidateReplacement: "forbidden",
      observationRecoveryAllowedReasons: [...OBSERVATION_RECOVERY_ALLOWED_REASONS],
      observationRecoveryForbiddenOutcomes: [...OBSERVATION_RECOVERY_FORBIDDEN_OUTCOMES]
    },
    checkpointPolicy: {
      waveCount: diversified ? 1 : 3,
      wavePrimarySlotCounts: diversified ? [8] : [4, 8, 8],
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
  if (plan.schemaVersion === PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION) {
    for (const variant of plan.subjectVariants) {
      const semantic = subjectVariantSemantic(variant);
      if (variant.subjectVariantDigest !== sha256Hex(stableStringify(semantic))) return false;
    }
  }
  const digest = sha256Hex(stableStringify(planSemantic(plan)));
  return digest === plan.planDigest;
}

function waveForConditionOrdinal(plan, conditionId, ordinal) {
  const row = plan.matrix.find((item) => item.conditionId === conditionId);
  let upper = 0;
  for (let index = 0; index < row.waveAllocation.length; index += 1) {
    upper += row.waveAllocation[index];
    if (ordinal <= upper) return index + 1;
  }
  return null;
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
  const diversified = plan.schemaVersion === PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION;
  for (const conditionId of ["A", "B", "C", "D"]) {
    const row = plan.matrix.find((item) => item.conditionId === conditionId);
    for (let conditionOrdinal = 1; conditionOrdinal <= row.primarySlots; conditionOrdinal += 1) {
      const variant = diversified ? plan.subjectVariants.find((item) => item.conditionId === conditionId && item.conditionOrdinal === conditionOrdinal) : null;
      const slotValue = {
        schemaVersion: diversified ? PILOT_DIVERSIFIED_SLOT_SCHEMA_VERSION : PILOT_SLOT_SCHEMA_VERSION,
        campaignRunId: run.campaignRunId,
        conditionId,
        conditionOrdinal,
        waveOrdinal: waveForConditionOrdinal(plan, conditionId, conditionOrdinal),
        fixtureDigest: plan.sourceFreeze.fixtureObjectDigests[conditionId],
        ...(variant ? {
          subjectVariant: {
            adultAgeBand: variant.adultAgeBand,
            presentation: variant.presentation,
            regionalAppearanceHint: variant.regionalAppearanceHint
          },
          subjectVariantDigest: variant.subjectVariantDigest
        } : {})
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
  const diversified = plan.schemaVersion === PILOT_DIVERSIFIED_CAMPAIGN_PLAN_SCHEMA_VERSION;
  const variant = diversified ? plan.subjectVariants.find((item) => item.conditionId === slot.conditionId && item.conditionOrdinal === slot.conditionOrdinal) : null;
  const subjectMatches = diversified
    ? variant && slot.subjectVariantDigest === variant.subjectVariantDigest && stableStringify(slot.subjectVariant) === stableStringify({ adultAgeBand: variant.adultAgeBand, presentation: variant.presentation, regionalAppearanceHint: variant.regionalAppearanceHint })
    : slot.subjectVariant === undefined && slot.subjectVariantDigest === undefined;
  return slot.campaignRunId === run.campaignRunId && slot.fixtureDigest === plan.sourceFreeze.fixtureObjectDigests[slot.conditionId] && slot.waveOrdinal === waveForConditionOrdinal(plan, slot.conditionId, slot.conditionOrdinal) && subjectMatches && slot.slotIdentityDigest === digest && slot.slotId === `slot_${digest.slice(0, 24)}`;
}
