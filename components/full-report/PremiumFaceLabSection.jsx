"use client";

import { useState } from "react";
import { buildUnavailablePremiumFaceLab, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";

const COPY = {
  ko: {
    title: "Face Lab",
    body: "업로드한 사진에서 읽힌 인상과 표현 방향이에요.",
    fallbackTitle: "사진 기반 Face Lab 결과가 준비되지 않았어요.",
    fallbackBody: "다음 분석에서는 사진을 함께 등록하면 인상과 표현 방향도 확인할 수 있어요.",
    imageAlt: "Face Lab 분석 이미지",
    keywords: "키워드",
    directions: "표현 방향",
    companion: "피부 관리 방향과 함께 참고할 수 있는 표현 언어예요."
  },
  en: {
    title: "Face Lab",
    body: "Impression and style direction read from the uploaded photo.",
    fallbackTitle: "Photo-based Face Lab results are not ready.",
    fallbackBody: "In the next analysis, add a photo to see impression and expression direction too.",
    imageAlt: "Face Lab analysis image",
    keywords: "Keywords",
    directions: "Style directions",
    companion: "Use this as expression language alongside the skin-care direction."
  }
};

function getCopy(locale = "ko") {
  return COPY[locale] || COPY.ko;
}

function FaceLabImage({ src, alt, locale = "ko" }) {
  const copy = getCopy(locale);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[0.5rem] border border-zinc-200 bg-zinc-50 px-4 text-center text-xs font-medium leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
        {copy.fallbackTitle}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || copy.imageAlt}
      onError={() => setFailed(true)}
      className="aspect-[4/5] w-full rounded-[0.5rem] object-cover object-center"
    />
  );
}

export default function PremiumFaceLabSection({ faceLabSummary, photoUrl = "", locale = "ko" }) {
  const copy = getCopy(locale);
  const summary = sanitizePremiumFaceLabSummary(
    faceLabSummary || buildUnavailablePremiumFaceLab(photoUrl, copy.imageAlt)
  );
  const imageUrl = summary.imageUrl || photoUrl || null;

  if (summary.status !== "available") {
    return (
      <section className="space-y-4">
        <section className="ui-card p-5 sm:p-6">
          <p className="ui-kicker">FACE LAB</p>
          <h2 className="ui-title mt-2 text-xl leading-tight">{copy.title}</h2>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
        </section>

        <section className="ui-card-subtle p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
            <FaceLabImage src={imageUrl} alt={summary.imageAlt || copy.imageAlt} locale={locale} />
            <div className="min-w-0">
              <h3 className="ui-title text-lg leading-tight break-words">{copy.fallbackTitle}</h3>
              <p className="ui-text-secondary mt-2 text-sm leading-6 break-words">{copy.fallbackBody}</p>
            </div>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">FACE LAB</p>
        <h2 className="ui-title mt-2 text-xl leading-tight">{copy.title}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
      </section>

      <section className="ui-card-subtle p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <FaceLabImage src={imageUrl} alt={summary.imageAlt || copy.imageAlt} locale={locale} />
          <div className="min-w-0">
            <p className="ui-kicker">{copy.companion}</p>
            <h3 className="ui-title mt-2 text-xl leading-tight break-words">
              {summary.impressionTitle || copy.title}
            </h3>
            {summary.impressionSummary ? (
              <p className="ui-text-secondary mt-2 text-sm leading-6 break-words">
                {summary.impressionSummary}
              </p>
            ) : null}

            {summary.keywords.length ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{copy.keywords}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.keywords.map((keyword) => (
                    <span key={keyword} className="ui-chip-compact max-w-full px-3 py-1.5 break-words">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {summary.styleDirections.length ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{copy.directions}</p>
          <div className="mt-3 grid gap-3">
            {summary.styleDirections.map((item) => (
              <article key={item.key} className="rounded-[0.5rem] border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
                <h4 className="text-sm font-semibold leading-6 text-zinc-900 break-words dark:text-zinc-100">
                  {item.title}
                </h4>
                <p className="mt-1 text-sm leading-6 text-zinc-700 break-words dark:text-zinc-300">
                  {item.summary}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {summary.caution ? (
        <p className="rounded-[0.5rem] border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-xs font-medium leading-5 text-zinc-600 break-words dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-300">
          {summary.caution}
        </p>
      ) : null}
    </section>
  );
}
