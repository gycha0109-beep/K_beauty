"use client";

import { useMemo } from "react";
import {
  buildPersonalColorObservation
} from "@/lib/face-lab-v2/personal-color/observation";
import {
  buildPersonalColorPaletteCandidate
} from "@/lib/face-lab-v2/personal-color/palette-candidate";

const LABELS = Object.freeze({
  ko: Object.freeze({
    title: "사진에서 관찰된 색감",
    research: "탐색용 참고 계열",
    status: "색상 근거 상태",
    available: "관찰 가능한 색상 신호",
    unavailable: "색상 후보를 제안할 만큼 확인된 근거가 없습니다.",
    axes: { temperature: "겉보기 온도", brightness: "겉보기 명도", saturation: "겉보기 채도" },
    values: {
      warm: "따뜻한 쪽", neutral: "중간", cool: "차가운 쪽",
      low: "낮음", medium: "중간", high: "높음",
      muted: "차분함", balanced: "중간", clear: "선명함"
    }
  }),
  en: Object.freeze({
    title: "Colors observed in the photo",
    research: "Exploratory reference families",
    status: "Color evidence state",
    available: "Visible color evidence",
    unavailable: "There is not enough usable evidence to suggest color families.",
    axes: { temperature: "Apparent temperature", brightness: "Apparent brightness", saturation: "Apparent saturation" },
    values: {
      warm: "Warm appearance", neutral: "Neutral appearance", cool: "Cool appearance",
      low: "Low", medium: "Medium", high: "High",
      muted: "Muted", balanced: "Balanced", clear: "Clear"
    }
  })
});

const REFERENCE_NAMES = Object.freeze({
  espresso: "Espresso", rust: "Rust", ochre: "Ochre",
  caramel: "Caramel", warm_taupe: "Warm taupe", terracotta: "Terracotta",
  ivory: "Ivory", apricot: "Apricot", sand: "Sand",
  charcoal_brown: "Charcoal brown", plum: "Plum", stone: "Stone",
  rose_beige: "Rose beige", taupe: "Taupe", mauve: "Mauve",
  soft_white: "Soft white", oat: "Oat", dusty_rose: "Dusty rose",
  navy: "Navy", slate: "Slate", cool_taupe: "Cool taupe",
  dusty_blue: "Dusty blue", berry: "Berry", lavender: "Lavender",
  powder_blue: "Powder blue"
});

/**
 * M2 developer-only, text-only presentation of *photo appearance*.
 * This is not a season classifier, calibrated skin color sample, a swatch
 * accuracy claim or an approved shopping/shade recommendation. Caller owns
 * the decision to expose this component; there is no production activation.
 */
export default function FaceLabPersonalColorResearchPreview({
  analysis,
  locale = "ko"
}) {
  const copy = LABELS[locale === "en" ? "en" : "ko"];
  const palette = useMemo(() => {
    const observation = buildPersonalColorObservation(analysis);
    return buildPersonalColorPaletteCandidate(observation);
  }, [analysis]);

  const available =
    palette.status === "exploratory" &&
    palette.sourceImagePersisted === false &&
    palette.paletteCandidate?.authority === "photo_appearance_reference_only" &&
    palette.executionPreview?.authority === "not_product_or_shade_advice" &&
    palette.seasonCandidate === null &&
    palette.undertone === null &&
    palette.suitability === null &&
    Array.isArray(palette.paletteCandidate?.familyTokens) &&
    palette.paletteCandidate.familyTokens.length === 3 &&
    palette.paletteCandidate.familyTokens.every(
      (key) => Object.hasOwn(REFERENCE_NAMES, key)
    );

  return (
    <section
      data-testid="face-lab-personal-color-research"
      data-palette-status={available ? "exploratory" : "insufficient_evidence"}
      className="ui-card-subtle p-5 sm:p-6"
    >
      <p className="ui-kicker">FACE LAB · COLOR RESEARCH</p>
      <h3 className="ui-title mt-2 text-lg">{copy.title}</h3>
      {available ? (
        <>
          <p className="ui-text-secondary mt-2 text-xs">{copy.status} · {copy.available}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ["temperature", palette.paletteCandidate.temperature],
              ["brightness", palette.paletteCandidate.brightness],
              ["saturation", palette.paletteCandidate.saturation]
            ].map(([key, value]) => (
              <div key={key} className="rounded-xl border border-zinc-200 bg-white/65 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-xs text-zinc-500">{copy.axes[key]}</p>
                <p className="mt-1 text-sm font-semibold">{copy.values[value]}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold">{copy.research}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {palette.paletteCandidate.familyTokens.map((token) => (
              <span key={token} className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">
                {REFERENCE_NAMES[token]}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="ui-text-secondary mt-3 text-sm leading-6">{copy.unavailable}</p>
      )}
    </section>
  );
}
