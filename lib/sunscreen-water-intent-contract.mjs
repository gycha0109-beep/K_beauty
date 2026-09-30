export const SUNSCREEN_WATER_INTENT_CONTRACT_VERSION =
  "sunscreen-water-intent-contract-v1";

export const SUNSCREEN_WATER_INTENT_FIELD = "water_resistance_needed";
export const SUNSCREEN_WATER_INTENT_RECOMMENDATION_KEY =
  "waterResistanceNeeded";

export const SUNSCREEN_WATER_INTENT_STATE = Object.freeze({
  REQUIRED: "required",
  NOT_REQUIRED: "not_required",
  UNKNOWN: "unknown"
});

function isNullableBoolean(value) {
  return value === null || typeof value === "boolean";
}

export function normalizeSunscreenWaterIntent(value) {
  if (!isNullableBoolean(value)) {
    return Object.freeze({
      ok: false,
      error: "WATER_RESISTANCE_NEEDED_INVALID",
      value: null,
      state: SUNSCREEN_WATER_INTENT_STATE.UNKNOWN,
      rankingIntentAvailable: false
    });
  }

  const state =
    value === true
      ? SUNSCREEN_WATER_INTENT_STATE.REQUIRED
      : value === false
        ? SUNSCREEN_WATER_INTENT_STATE.NOT_REQUIRED
        : SUNSCREEN_WATER_INTENT_STATE.UNKNOWN;

  return Object.freeze({
    ok: true,
    error: null,
    value,
    state,
    rankingIntentAvailable: value === true
  });
}

export function evaluateSunscreenWaterIntentControl({
  waterResistanceNeeded,
  outdoorExposure
}) {
  const water = normalizeSunscreenWaterIntent(waterResistanceNeeded);
  if (!water.ok) return water;

  const outdoor =
    outdoorExposure === null || typeof outdoorExposure === "boolean"
      ? outdoorExposure
      : null;

  return Object.freeze({
    version: SUNSCREEN_WATER_INTENT_CONTRACT_VERSION,
    canonicalField: SUNSCREEN_WATER_INTENT_FIELD,
    recommendationAnswerKey: SUNSCREEN_WATER_INTENT_RECOMMENDATION_KEY,
    waterResistanceNeeded: water.value,
    state: water.state,
    rankingIntentAvailable: water.rankingIntentAvailable,
    outdoorExposure: outdoor,
    derivedFromOutdoorExposure: false,
    blockReason:
      water.value === true
        ? null
        : water.value === false
          ? "water_resistance_not_requested"
          : "water_resistance_intent_not_available"
  });
}
