export const SUNSCREEN_PROTECTION_SHADOW_SCORING_VERSION =
  "sunscreen-protection-shadow-scoring-v1";

export const SUNSCREEN_PROTECTION_SHADOW_WEIGHTS = Object.freeze({
  spf: Object.freeze({
    spf_50_plus_band: 6,
    spf_30_49: 4,
    spf_15_29: 2,
    spf_below_15: 0
  }),
  uva: Object.freeze({
    uva_high: 6,
    uva_medium_high: 4,
    uva_medium: 2,
    uva_low: 1
  }),
  waterResistance: Object.freeze({
    water_80_plus: 10,
    water_40_79: 7,
    water_1_39: 4
  })
});

function scoreBucket(group, bucket) {
  if (!bucket) return 0;
  const score = Number(
    SUNSCREEN_PROTECTION_SHADOW_WEIGHTS[group]?.[bucket] || 0
  );
  return Number.isFinite(score) && score > 0 ? score : 0;
}

function axisEnabled(audit, axis) {
  return audit?.axes?.[axis]?.rankingUseful === true;
}

export function buildSunscreenProtectionShadowAdjustment({
  baselineScore,
  protection,
  audit,
  outdoorExposure
}) {
  const safeBaseline = Number.isFinite(Number(baselineScore))
    ? Number(baselineScore)
    : 0;

  const potentialAdjustments = Object.freeze({
    spf: scoreBucket("spf", protection?.spf?.bucket),
    uva: scoreBucket("uva", protection?.uva?.bucket),
    waterResistance: scoreBucket(
      "waterResistance",
      protection?.waterResistance?.bucket
    )
  });

  const outdoor = outdoorExposure === true;
  const spfEnabled = outdoor && axisEnabled(audit, "spf");
  const uvaEnabled = outdoor && axisEnabled(audit, "uva");

  const appliedAdjustments = Object.freeze({
    spf: spfEnabled ? potentialAdjustments.spf : 0,
    uva: uvaEnabled ? potentialAdjustments.uva : 0,
    waterResistance: 0
  });

  const appliedTotal =
    appliedAdjustments.spf +
    appliedAdjustments.uva +
    appliedAdjustments.waterResistance;

  const enabledAxes = [];
  if (spfEnabled) enabledAxes.push("spf");
  if (uvaEnabled) enabledAxes.push("uva");

  const blockedAxes = [];
  if (!outdoor) {
    blockedAxes.push("spf:not_outdoor", "uva:not_outdoor");
  } else {
    if (!axisEnabled(audit, "spf")) blockedAxes.push("spf:not_ranking_useful");
    if (!axisEnabled(audit, "uva")) blockedAxes.push("uva:not_ranking_useful");
  }
  blockedAxes.push("waterResistance:water_resistance_intent_not_available");

  return Object.freeze({
    version: SUNSCREEN_PROTECTION_SHADOW_SCORING_VERSION,
    baselineScore: safeBaseline,
    potentialAdjustments,
    appliedAdjustments,
    appliedTotal,
    shadowScore: safeBaseline + appliedTotal,
    enabledAxes: Object.freeze(enabledAxes),
    blockedAxes: Object.freeze(blockedAxes)
  });
}
