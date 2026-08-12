import {
  SOLO_WAVE_CONDITION_COUNTS,
  SOLO_WAVE_SHAPE_SCHEMA_VERSION,
  SOLO_WAVE_SLOT_COUNTS,
  validateSoloWaveShape
} from "@bejewely/face-contracts";
import { verifyPilotCampaignPlanIntegrity } from "../campaign/plan.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const CONDITIONS = Object.freeze(["A", "B", "C", "D"]);

function failure(code, path = "$", detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function shapeSemantic({ campaignPlanDigest, waveOrdinal, expectedSlotCount, conditionCounts }) {
  return {
    schemaVersion: SOLO_WAVE_SHAPE_SCHEMA_VERSION,
    campaignPlanDigest,
    waveOrdinal,
    expectedSlotCount,
    conditionCounts: Object.fromEntries(CONDITIONS.map((conditionId) => [conditionId, conditionCounts[conditionId]])),
    shapeSource: "campaign_plan"
  };
}

export function deriveSoloWaveShape(plan, waveOrdinal) {
  if (!verifyPilotCampaignPlanIntegrity(plan) || !Number.isInteger(waveOrdinal) || waveOrdinal < 1 || waveOrdinal > plan.checkpointPolicy.waveCount) {
    return failure("solo_wave_shape_invalid", "waveOrdinal");
  }
  const expectedSlotCount = plan.checkpointPolicy.wavePrimarySlotCounts[waveOrdinal - 1];
  const conditionCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const conditionId of CONDITIONS) {
    const row = plan.matrix.find((item) => item.conditionId === conditionId);
    const count = row?.waveAllocation?.[waveOrdinal - 1];
    if (!Number.isInteger(count) || count < 0) return failure("solo_wave_shape_invalid", `matrix.${conditionId}.waveAllocation`);
    conditionCounts[conditionId] = count;
  }
  if (!Number.isInteger(expectedSlotCount) || expectedSlotCount < 1 || Object.values(conditionCounts).reduce((sum, count) => sum + count, 0) !== expectedSlotCount) {
    return failure("solo_wave_shape_invalid", "checkpointPolicy.wavePrimarySlotCounts", { expectedSlotCount, conditionCounts });
  }
  const semantic = shapeSemantic({ campaignPlanDigest: plan.planDigest, waveOrdinal, expectedSlotCount, conditionCounts });
  const waveShape = deepFreeze({ ...semantic, shapeDigest: sha256Hex(stableStringify(semantic)) });
  return validateSoloWaveShape(waveShape).ok ? Object.freeze({ ok: true, waveShape }) : failure("solo_wave_shape_invalid");
}

export function verifySoloWaveShapeIntegrity(waveShape) {
  if (!validateSoloWaveShape(waveShape).ok) return false;
  const { shapeDigest, ...semantic } = waveShape;
  return shapeDigest === sha256Hex(stableStringify(semantic));
}

export function isLegacySoloWaveShape(waveShape) {
  if (!verifySoloWaveShapeIntegrity(waveShape)) return false;
  const expectedSlotCount = SOLO_WAVE_SLOT_COUNTS[waveShape.waveOrdinal];
  const expectedConditions = SOLO_WAVE_CONDITION_COUNTS[waveShape.waveOrdinal];
  return waveShape.expectedSlotCount === expectedSlotCount && CONDITIONS.every((conditionId) => waveShape.conditionCounts[conditionId] === expectedConditions?.[conditionId]);
}

export function verifySoloWaveSlotShape(waveShape, slots) {
  if (!verifySoloWaveShapeIntegrity(waveShape) || !Array.isArray(slots) || slots.length !== waveShape.expectedSlotCount) return false;
  if (new Set(slots.map((slot) => slot?.slotId)).size !== slots.length) return false;
  const ordinals = Object.fromEntries(CONDITIONS.map((conditionId) => [conditionId, []]));
  for (const slot of slots) {
    if (slot?.waveOrdinal !== waveShape.waveOrdinal || !CONDITIONS.includes(slot?.conditionId) || !Number.isInteger(slot?.conditionOrdinal) || slot.conditionOrdinal < 1) return false;
    ordinals[slot.conditionId].push(slot.conditionOrdinal);
  }
  return CONDITIONS.every((conditionId) => {
    const actual = ordinals[conditionId].sort((left, right) => left - right);
    const expected = Array.from({ length: waveShape.conditionCounts[conditionId] }, (_, index) => index + 1);
    return stableStringify(actual) === stableStringify(expected);
  });
}
