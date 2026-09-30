export const SUNSCREEN_WATER_JCIA_LABEL_MAPPING_VERSION =
  "sunscreen-water-jcia-label-mapping-v1";

export const SUNSCREEN_WATER_JCIA_LABELS = Object.freeze({
  "UV耐水性★": Object.freeze({
    minutes: 40,
    immersionPattern: "20_min_x_2"
  }),
  "UV耐水性☆": Object.freeze({
    minutes: 40,
    immersionPattern: "20_min_x_2"
  }),
  "UV耐水性★★": Object.freeze({
    minutes: 80,
    immersionPattern: "20_min_x_4"
  }),
  "UV耐水性☆☆": Object.freeze({
    minutes: 80,
    immersionPattern: "20_min_x_4"
  })
});

export function mapJciaUvWaterResistanceLabel({
  label,
  market,
  exactSubjectMatch,
  officialProductClaim
}) {
  const mapping = SUNSCREEN_WATER_JCIA_LABELS[label] || null;

  if (market !== "JP") {
    return Object.freeze({
      eligible: false,
      reason: "JCIA_MAPPING_MARKET_NOT_JP",
      projection: null
    });
  }
  if (exactSubjectMatch !== true) {
    return Object.freeze({
      eligible: false,
      reason: "JCIA_MAPPING_EXACT_SUBJECT_REQUIRED",
      projection: null
    });
  }
  if (officialProductClaim !== true) {
    return Object.freeze({
      eligible: false,
      reason: "JCIA_MAPPING_OFFICIAL_PRODUCT_CLAIM_REQUIRED",
      projection: null
    });
  }
  if (!mapping) {
    return Object.freeze({
      eligible: false,
      reason: "JCIA_MAPPING_LABEL_UNSUPPORTED",
      projection: null
    });
  }

  return Object.freeze({
    eligible: true,
    reason: null,
    projection: Object.freeze({
      valueNumber: mapping.minutes,
      valueUnit: "minutes",
      qualifier: Object.freeze({
        metric: "SPF_retention_percentage",
        method_context: "ISO_18861_JCIA_UV_water_resistance",
        timepoint: `after_total_${mapping.minutes}_min_water_immersion`
      }),
      interpretation: "standardized_test_immersion_condition_not_real_world_effect_duration",
      sweatResistanceImplied: false
    })
  });
}
