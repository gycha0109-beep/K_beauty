"use client";

import { Component, useMemo, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import UploadPreview from "@/components/UploadPreview";

const FACE_LAB_FEATURES = [
  {
    id: "physiognomy",
    label: "Physiognomy",
    title: "Physiognomy"
  },
  {
    id: "face_shape_hairstyle",
    label: "Face Shape & Hairstyle",
    title: "Face Shape & Hairstyle"
  },
  {
    id: "lookalike_celebrities",
    label: "Look-alike Celebrities",
    title: "Look-alike Celebrities"
  },
  {
    id: "color_tone_recommendation",
    label: "Color Tone Recommendation",
    title: "Color Tone Recommendation"
  }
];

const FACE_FEATURE_SLOTS = [
  { key: "eye", label: "Eye", icon: "👀", keywords: ["눈", "눈매", "시선", "eye"] },
  { key: "mouth", label: "Mouth", icon: "👄", keywords: ["입", "입꼬리", "입선", "mouth"] },
  { key: "jaw", label: "Jaw", icon: "🗿", keywords: ["턱", "턱선", "하관", "jaw"] },
  { key: "shape", label: "Face Shape", icon: "🪞", keywords: ["얼굴형", "윤곽", "비율", "형태", "shape"] }
];

function buildFeatureBlocks(items = []) {
  const blocks = FACE_FEATURE_SLOTS.map((slot) => ({ ...slot, text: "" }));
  const remaining = items.map((item) => String(item || ""));

  blocks.forEach((slot) => {
    const matchIndex = remaining.findIndex((item) =>
      slot.keywords.some((keyword) => item.toLowerCase().includes(keyword.toLowerCase()))
    );

    if (matchIndex !== -1) {
      slot.text = remaining[matchIndex];
      remaining.splice(matchIndex, 1);
    }
  });

  blocks.forEach((slot) => {
    if (!slot.text && remaining.length) {
      slot.text = remaining.shift();
    }
  });

  return blocks.filter((slot) => slot.text).slice(0, 4);
}

function renderColorValues(colorValues = {}, labels = {}) {
  return [
    { label: labels.undertone, value: colorValues?.undertone },
    { label: labels.brightness, value: colorValues?.brightness },
    { label: labels.contrast, value: colorValues?.contrast },
    { label: labels.saturation, value: colorValues?.saturation }
  ].filter((item) => item.label && item.value);
}

function isValidFaceLabResult(result) {
  return Boolean(
    result?.features?.physiognomy &&
      result?.features?.face_shape_hairstyle &&
      result?.features?.lookalike_celebrities &&
      result?.features?.color_tone_recommendation
  );
}

class FaceLabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("FaceLab render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function FaceLabContent({
  locale = "ko",
  copy,
  imageFile,
  previewUrl,
  onImageChange,
  onClearImage,
  presets = [],
  onPresetPreview,
  faceLabResult,
  faceLabError,
  faceLabLoading,
  onAnalyze
}) {
  const [activeFaceFeature, setActiveFaceFeature] = useState("physiognomy");
  const faceLabUi = copy?.faceLabUi || {};
  const selectedFaceFeature =
    FACE_LAB_FEATURES.find((feature) => feature.id === activeFaceFeature) || FACE_LAB_FEATURES[0];
  const safeResult = isValidFaceLabResult(faceLabResult) ? faceLabResult : null;
  const faceLabBaseData = safeResult?.base_data ?? null;
  const featureResult = safeResult?.features?.[activeFaceFeature] ?? null;

  const featureBlocks = useMemo(
    () => buildFeatureBlocks(safeResult?.features?.physiognomy?.feature_based_interpretation ?? []),
    [safeResult]
  );
  const colorValueItems = useMemo(
    () => renderColorValues(safeResult?.base_data?.color_values, faceLabUi),
    [safeResult, faceLabUi]
  );

  if (!copy) {
    return null;
  }

  return (
    <FaceLabErrorBoundary
      fallback={
        <div className="rounded-[1.5rem] border border-[#d6b487] bg-[#fff9f2] px-4 py-5 text-sm leading-6 text-black/72">
          분석 화면을 불러오는 중 문제가 발생했습니다. 다시 시도해주세요.
        </div>
      }
    >
      <div className="mt-5 space-y-5">
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                try {
                  onPresetPreview?.(preset.id);
                  setActiveFaceFeature("physiognomy");
                } catch (error) {
                  console.error("FaceLab preset error:", error);
                }
              }}
              className="rounded-full border border-dashed border-black/15 bg-[#faf6f0] px-3 py-1.5 text-xs font-medium text-black/62 transition hover:border-black/25 hover:bg-white"
            >
              {copy?.facePresetLabels?.[preset.id] || preset.buttonLabel}
            </button>
          ))}
        </div>

        <UploadPreview
          imageFile={imageFile ?? null}
          previewUrl={previewUrl ?? ""}
          onChange={onImageChange}
          onClear={onClearImage}
          locale={locale}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {FACE_LAB_FEATURES.map((feature) => {
            const isActive = activeFaceFeature === feature.id;

            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => setActiveFaceFeature(feature.id)}
                className={`rounded-[1.3rem] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-ink bg-[#f4eee4] shadow-soft"
                    : "border-black/10 bg-white hover:border-black/20"
                }`}
              >
                <p className="text-sm font-semibold text-ink">{feature.label}</p>
              </button>
            );
          })}
        </div>

        <ErrorMessage message={faceLabError} />

        {!imageFile ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[#fffdf9] px-4 py-5 text-sm leading-6 text-black/58">
            {locale === "en"
              ? "Upload a photo and then open Face Lab analysis."
              : "사진을 업로드하면 Face Lab 분석을 시작할 수 있습니다."}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            try {
              onAnalyze?.();
            } catch (error) {
              console.error("FaceLab action error:", error);
            }
          }}
          disabled={faceLabLoading}
          className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {faceLabLoading ? copy.faceLabLoading : copy.faceLabButton}
        </button>

        {faceLabLoading ? <LoadingSpinner label={copy.faceLabSpinner} /> : null}

        {!faceLabLoading && imageFile && !safeResult && !faceLabError ? (
          <div className="rounded-[1.5rem] border border-black/5 bg-[#fffdf9] px-4 py-5 text-sm leading-6 text-black/58">
            {locale === "en"
              ? "The result will appear here after the analysis finishes."
              : "분석이 끝나면 여기에 Face Lab 결과가 표시됩니다."}
          </div>
        ) : null}

        {safeResult && featureResult ? (
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-black/5 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#efe6da] px-3 py-1 text-xs font-medium text-ink">
                  {faceLabUi.faceLab}
                </span>
                <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/65">
                  {faceLabUi.shape} {safeResult?.base_data?.face_shape || "-"}
                </span>
                <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/65">
                  {selectedFaceFeature?.title}
                </span>
              </div>

              {faceLabBaseData?.landmarks?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {faceLabBaseData.landmarks.slice(0, 4).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-black/10 bg-[#faf6f0] px-3 py-1 text-xs text-black/65"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {activeFaceFeature === "physiognomy" ? (
              <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
                <div className="rounded-[1.3rem] border border-[#d6b487] bg-[linear-gradient(135deg,#f4e4cf_0%,#fff8f0_100%)] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#7d5724]">{faceLabUi.headline}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#7d5724] px-3 py-1 text-xs font-semibold text-white">
                      {featureResult?.headline_label}
                    </span>
                    {(featureResult?.interpretation_axes || []).map((axis) => (
                      <span
                        key={axis}
                        className="rounded-full border border-[#d6b487] bg-white/70 px-3 py-1 text-xs font-medium text-[#7d5724]"
                      >
                        {axis}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-lg font-semibold leading-7 text-ink sm:text-xl">
                    {featureResult?.headline_result}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.overall}</p>
                  <p className="mt-2 text-sm leading-6 text-black/75">{featureResult?.overall_impression}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.featureAnalysis}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {featureBlocks.map((block) => (
                      <div key={block.key} className="rounded-2xl bg-white px-4 py-4">
                        <p className="text-sm font-semibold text-ink">
                          <span className="mr-2">{block.icon}</span>
                          {block.label}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-black/75">{block.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.tendency}</p>
                  <div className="mt-2 space-y-1">
                    {(featureResult?.real_tendency || []).slice(0, 2).map((item, index) => (
                      <p key={`tendency-${index}`} className="text-sm leading-6 text-black/75">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-3 rounded-2xl bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.strengths}</p>
                    {(featureResult?.strengths || []).slice(0, 3).map((item, index) => (
                      <div
                        key={`strength-${index}`}
                        className="rounded-2xl bg-[#faf6f0] px-4 py-3 text-sm leading-6 text-black/75"
                      >
                        • {item}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-2xl bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.cautions}</p>
                    {(featureResult?.cautions || []).slice(0, 2).map((item, index) => (
                      <div
                        key={`caution-${index}`}
                        className="rounded-2xl bg-[#faf6f0] px-4 py-3 text-sm leading-6 text-black/75"
                      >
                        • {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeFaceFeature === "face_shape_hairstyle" ? (
              <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
                <div className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.summary}</p>
                  <p className="mt-2 text-sm leading-6 text-black/75">{featureResult?.summary}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(featureResult?.recommendations || []).slice(0, 3).map((item, index) => (
                    <div key={`hair-${index}`} className="rounded-2xl bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-black/40">
                        {faceLabUi.recommendation} {index + 1}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-black/75">{item}</p>
                    </div>
                  ))}
                  {(featureResult?.avoid || []).slice(0, 2).map((item, index) => (
                    <div key={`avoid-${index}`} className="rounded-2xl bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.avoid}</p>
                      <p className="mt-2 text-sm leading-6 text-black/75">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeFaceFeature === "lookalike_celebrities" ? (
              <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
                <div className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.summary}</p>
                  <p className="mt-2 text-sm leading-6 text-black/75">{featureResult?.summary}</p>
                </div>
                <div className="grid gap-3">
                  {(featureResult?.matches || []).slice(0, 3).map((item, index) => (
                    <div key={`celeb-${index}`} className="rounded-2xl bg-white px-4 py-4">
                      <p className="text-sm font-semibold text-ink">{item?.name}</p>
                      <p className="mt-2 text-sm leading-6 text-black/75">{item?.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeFaceFeature === "color_tone_recommendation" ? (
              <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
                <div className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.summary}</p>
                  <p className="mt-2 text-sm leading-6 text-black/75">{featureResult?.summary}</p>
                </div>

                {colorValueItems.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {colorValueItems.map((item) => (
                      <div key={item.label} className="rounded-2xl bg-white px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-black/40">{item.label}</p>
                        <p className="mt-2 text-sm font-medium text-ink">{item.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.palette}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(featureResult?.palette || []).slice(0, 4).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-black/10 bg-[#faf6f0] px-3 py-1 text-xs font-medium text-black/70"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.avoid}</p>
                    <div className="mt-2 space-y-2">
                      {(featureResult?.avoid || []).slice(0, 2).map((item, index) => (
                        <p key={`tone-avoid-${index}`} className="text-sm leading-6 text-black/75">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.recommendations}</p>
                  <div className="mt-2 space-y-2">
                    {(featureResult?.recommendations || []).slice(0, 3).map((item, index) => (
                      <p key={`tone-rec-${index}`} className="text-sm leading-6 text-black/75">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </FaceLabErrorBoundary>
  );
}

export default function FaceLab(props) {
  try {
    return <FaceLabContent {...props} />;
  } catch (error) {
    console.error("FaceLab component error:", error);

    return (
      <div className="mt-5 rounded-[1.5rem] border border-[#d6b487] bg-[#fff9f2] px-4 py-5 text-sm leading-6 text-black/72">
        분석 중 문제가 발생했습니다. 다시 시도해주세요.
      </div>
    );
  }
}
