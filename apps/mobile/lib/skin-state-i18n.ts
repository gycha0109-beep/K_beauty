import type { SupportedLocale } from "@bejewely/shared";

// Keep code-based profile labels aligned with lib/my/i18n.js.
// Unrecognized or user-authored values are displayed verbatim.
const LABELS = {
  ko: {
    skinTypes: {
      dry: "건성", oily: "지성", combination: "복합성", sensitive: "민감성",
      normal: "중성", dehydrated: "수분 부족"
    },
    sensitivities: { low: "낮음", medium: "보통", high: "높음" },
    concerns: {
      pores: "모공", oiliness: "유분", dehydration: "속건조", dryness: "건조",
      redness: "붉음", irritation: "자극", breakout: "트러블", acne: "트러블",
      pigmentation: "잡티", texture: "결", wrinkles: "탄력"
    }
  },
  en: {
    skinTypes: {
      dry: "Dry", oily: "Oily", combination: "Combination", sensitive: "Sensitive",
      normal: "Normal", dehydrated: "Dehydrated"
    },
    sensitivities: { low: "Low", medium: "Medium", high: "High" },
    concerns: {
      pores: "Pores", oiliness: "Oiliness", dehydration: "Dehydration", dryness: "Dryness",
      redness: "Redness", irritation: "Irritation", breakout: "Breakouts", acne: "Breakouts",
      pigmentation: "Dark spots", texture: "Texture", wrinkles: "Firmness"
    }
  }
} as const;

type LabelGroup = keyof typeof LABELS.en;

export function getLocalizedSkinState(
  value: string | null | undefined,
  group: LabelGroup,
  locale: SupportedLocale
): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  const lookup = LABELS[locale][group] as Record<string, string>;
  return lookup[text.toLowerCase()] || text;
}
