import type { SupportedLocale } from "@bejewely/shared";

export const MOBILE_HEALTH_DISCLAIMER: Record<SupportedLocale, string> = {
  en: "BEJEWELY is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Results are cosmetic skin-care guidance only. For medical advice, diagnosis, or treatment, consult a qualified healthcare professional.",
  ko: "BEJEWELY는 의료기기가 아니며 어떠한 질환도 진단·치료·치유·예방하지 않습니다. 결과는 화장품·스킨케어 참고용 안내입니다. 의학적 조언·진단·치료가 필요한 경우 자격을 갖춘 의료 전문가와 상담하세요."
};

const STRONG_MEDICAL_CLAIM_PATTERNS = [
  /\bmedical\s+device\b/i,
  /\b(?:diagnos(?:e|es|ed|ing|is|tic)|clinician[-\s]?equivalent|doctor[-\s]?equivalent)\b/i,
  /\b(?:treat|treats|treated|treating|cure|cures|cured|curing|prevent|prevents|prevented|preventing)\b.{0,48}\b(?:disease|medical\s+condition|disorder|infection|allergy|eczema|psoriasis|dermatitis|rosacea|acne)\b/i,
  /\b(?:disease|medical\s+condition|disorder|infection|allergy|eczema|psoriasis|dermatitis|rosacea|acne)\b.{0,48}\b(?:treat|treats|treated|treating|cure|cures|cured|curing|prevent|prevents|prevented|preventing)\b/i,
  /(?:의료기기|의학적\s*진단|의료진\s*대체|의사와\s*(?:동일|동등)|질환을?\s*진단)/,
  /(?:치료|치유|완치|예방).{0,30}(?:질환|질병|감염|알레르기|습진|건선|피부염|주사(?:피부염)?|여드름)/,
  /(?:질환|질병|감염|알레르기|습진|건선|피부염|주사(?:피부염)?|여드름).{0,30}(?:치료|치유|완치|예방)/
] as const;

function hasStrongMedicalClaim(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;

  if (typeof value === "string") {
    return STRONG_MEDICAL_CLAIM_PATTERNS.some((pattern) => pattern.test(value));
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasStrongMedicalClaim(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasStrongMedicalClaim(item, depth + 1)
    );
  }

  return false;
}

function projectRenderedProduct(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const product = value as Record<string, unknown>;
  return {
    brand: product.brand,
    name: product.name,
    reason: product.reason,
    comparisonReason: product.comparison_reason
  };
}

export function hasForbiddenMobileAnalyzeMedicalClaim(result: Record<string, unknown>) {
  const userFacingBoundary = {
    summary: result.summary,
    topPick: projectRenderedProduct(result.topPick),
    alternative: projectRenderedProduct(result.alternative),
    amFocus: result.amFocus,
    pmFocus: result.pmFocus,
    morning: result.morning,
    night: result.night,
    warnings: result.warnings,
    notice: result.meta && typeof result.meta === "object"
      ? (result.meta as Record<string, unknown>).notice
      : undefined
  };

  return hasStrongMedicalClaim(userFacingBoundary);
}
