import {
  RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS,
  isProtectionFactRankingAuthorityEligible
} from "./recommendation-sunscreen-protection-authority-contract.mjs";

export const SUNSCREEN_PROTECTION_PROJECTION_VERSION =
  "sunscreen-protection-projection-v1";

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findEligibleFact(authorityResult, factKey) {
  if (
    authorityResult?.status !==
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED ||
    !authorityResult.authority ||
    !Array.isArray(authorityResult.authority.currentFacts)
  ) {
    return null;
  }

  const matches = authorityResult.authority.currentFacts.filter(
    (fact) => fact?.fact_key === factKey
  );
  if (matches.length !== 1) return null;
  return isProtectionFactRankingAuthorityEligible(matches[0])
    ? matches[0]
    : null;
}

export function projectSunscreenSpfFact(fact) {
  if (!fact) {
    return Object.freeze({
      eligible: false,
      value: null,
      plusModifier: null,
      bucket: null
    });
  }

  const value = finiteNumber(fact.value_number);
  if (value == null || value <= 0) {
    return Object.freeze({
      eligible: false,
      value: null,
      plusModifier: null,
      bucket: null
    });
  }

  const bucket =
    value >= 50
      ? "spf_50_plus_band"
      : value >= 30
        ? "spf_30_49"
        : value >= 15
          ? "spf_15_29"
          : "spf_below_15";

  return Object.freeze({
    eligible: true,
    value,
    plusModifier:
      fact.qualifier?.plus_modifier === "plus" ? "plus" : "none",
    bucket
  });
}

function uvaProjection(fact) {
  if (!fact) {
    return Object.freeze({
      eligible: false,
      label: null,
      bucket: null
    });
  }

  const label = fact.value_enum;
  const bucket =
    label === "PA++++"
      ? "uva_high"
      : label === "PA+++" || label === "UVA-PF-declared"
        ? "uva_medium_high"
        : label === "PA++"
          ? "uva_medium"
          : label === "PA+"
            ? "uva_low"
            : null;

  return Object.freeze({
    eligible: Boolean(bucket),
    label: bucket ? label : null,
    bucket
  });
}

function waterProjection(fact) {
  if (!fact) {
    return Object.freeze({
      eligible: false,
      minutes: null,
      bucket: null
    });
  }

  const minutes = finiteNumber(fact.value_number);
  if (minutes == null || minutes <= 0 || fact.value_unit !== "minutes") {
    return Object.freeze({
      eligible: false,
      minutes: null,
      bucket: null
    });
  }

  const bucket =
    minutes >= 80
      ? "water_80_plus"
      : minutes >= 40
        ? "water_40_79"
        : "water_1_39";

  return Object.freeze({
    eligible: true,
    minutes,
    bucket
  });
}

export function projectSunscreenProtectionAuthority(record) {
  const productId =
    typeof record?.productId === "string" ? record.productId : null;
  const authority = record?.authority || null;

  return Object.freeze({
    version: SUNSCREEN_PROTECTION_PROJECTION_VERSION,
    productId,
    authorityResolved:
      authority?.status ===
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED,
    spf: projectSunscreenSpfFact(findEligibleFact(authority, "spf_value")),
    uva: uvaProjection(findEligibleFact(authority, "uva_label")),
    waterResistance: waterProjection(
      findEligibleFact(authority, "water_resistance_duration")
    )
  });
}
