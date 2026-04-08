"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import UploadPreview from "@/components/UploadPreview";
import SurveyForm from "@/components/SurveyForm";
import SubmitButton from "@/components/SubmitButton";
import ErrorMessage from "@/components/ErrorMessage";

const initialForm = {
  skinType: "",
  sensitivity: "",
  mainConcern: "",
  cleansingFrequency: "",
  preferredTexture: "",
  postWashFeeling: "",
  afternoonSkinChange: "",
  environmentExposure: [],
  mostDislikedFeel: ""
};

const tabs = [
  { id: "skin", label: "Skin Analysis" },
  { id: "face-lab", label: "Face Lab" }
];

const faceLabFeatures = [
  {
    id: "physiognomy",
    label: "Physiognomy",
    title: "Physiognomy",
    description: "보이는 특징을 해석 축으로 묶어 인상과 성향 흐름을 정리합니다."
  },
  {
    id: "face_shape_hairstyle",
    label: "Face Shape & Hairstyle",
    title: "Face Shape & Hairstyle",
    description: "얼굴형과 윤곽 흐름을 기준으로 어울리는 헤어 방향을 제안합니다."
  },
  {
    id: "lookalike_celebrities",
    label: "Look-alike Celebrities",
    title: "Look-alike Celebrities",
    description: "닮은 분위기의 셀럽 레퍼런스를 가볍게 비교해 보여줍니다."
  },
  {
    id: "color_tone_recommendation",
    label: "Color Tone Recommendation",
    title: "Color Tone Recommendation",
    description: "명도, 대비감, 채도 흐름을 기준으로 색 방향을 추천합니다."
  }
];

const faceFeatureSlots = [
  { key: "eye", label: "Eye", icon: "👀", keywords: ["눈", "눈매", "시선"] },
  { key: "mouth", label: "Mouth", icon: "👄", keywords: ["입", "입꼬리", "입선"] },
  { key: "jaw", label: "Jaw", icon: "🪨", keywords: ["턱", "턱선", "하관"] },
  { key: "shape", label: "Face Shape", icon: "🫧", keywords: ["얼굴형", "윤곽", "비율", "형태"] }
];

function buildFeatureBlocks(items = []) {
  const blocks = faceFeatureSlots.map((slot) => ({ ...slot, text: "" }));
  const remaining = items.map((item) => String(item));

  blocks.forEach((slot) => {
    const matchIndex = remaining.findIndex((item) =>
      slot.keywords.some((keyword) => item.includes(keyword))
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

function renderColorValues(colorValues = {}) {
  return [
    { label: "Undertone", value: colorValues.undertone },
    { label: "Brightness", value: colorValues.brightness },
    { label: "Contrast", value: colorValues.contrast },
    { label: "Saturation", value: colorValues.saturation }
  ].filter((item) => item.value);
}

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("skin");
  const [activeFaceFeature, setActiveFaceFeature] = useState("physiognomy");
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [faceLabLoading, setFaceLabLoading] = useState(false);
  const [faceLabError, setFaceLabError] = useState("");
  const [faceLabResult, setFaceLabResult] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isValid = useMemo(() => {
    return (
      imageFile &&
      form.skinType &&
      form.sensitivity &&
      form.mainConcern &&
      form.cleansingFrequency &&
      form.preferredTexture &&
      form.postWashFeeling &&
      form.afternoonSkinChange &&
      form.mostDislikedFeel
    );
  }, [form, imageFile]);

  const selectedFaceFeature = useMemo(
    () => faceLabFeatures.find((feature) => feature.id === activeFaceFeature) || faceLabFeatures[0],
    [activeFaceFeature]
  );

  const faceLabBaseData = faceLabResult?.base_data || null;
  const physiognomy = faceLabResult?.features?.physiognomy || null;
  const featureBlocks = useMemo(
    () => buildFeatureBlocks(physiognomy?.feature_based_interpretation),
    [physiognomy]
  );
  const colorValueItems = useMemo(
    () => renderColorValues(faceLabResult?.base_data?.color_values),
    [faceLabResult]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setImageFile(null);
      setPreviewUrl("");
      setFaceLabResult(null);
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
    setFaceLabError("");
    setFaceLabResult(null);
  };

  const handleCheckboxChange = (value) => {
    setForm((prev) => {
      const exists = prev.environmentExposure.includes(value);

      return {
        ...prev,
        environmentExposure: exists
          ? prev.environmentExposure.filter((item) => item !== value)
          : [...prev.environmentExposure, value]
      };
    });
  };

  const clearImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImageFile(null);
    setPreviewUrl("");
    setFaceLabResult(null);
    setFaceLabError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValid) {
      setError("사진 1장과 필수 설문 항목을 모두 입력해 주세요.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const payload = new FormData();
      payload.append("image", imageFile);

      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
      });

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: payload
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "결과 생성에 실패했습니다.");
      }

      sessionStorage.setItem(
        "skinTestSubmission",
        JSON.stringify({
          form,
          imageName: imageFile?.name || ""
        })
      );
      sessionStorage.setItem("skinTestResult", JSON.stringify(data));
      router.push("/result");
    } catch (submitError) {
      const message = submitError.message || "예상하지 못한 오류가 발생했습니다.";
      sessionStorage.removeItem("skinTestResult");
      router.push(`/result?error=${encodeURIComponent(message)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceLabAnalyze = async () => {
    if (!imageFile) {
      setFaceLabError("얼굴 사진을 먼저 업로드해 주세요.");
      return;
    }

    setFaceLabError("");
    setFaceLabLoading(true);

    try {
      const payload = new FormData();
      payload.append("image", imageFile);

      const response = await fetch("/api/face-reading", {
        method: "POST",
        body: payload
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Face Lab 분석에 실패했습니다.");
      }

      setFaceLabResult(data);
    } catch (requestError) {
      setFaceLabResult(null);
      setFaceLabError(requestError.message || "Face Lab 결과를 불러오지 못했습니다.");
    } finally {
      setFaceLabLoading(false);
    }
  };

  const renderFaceLabResult = () => {
    if (!faceLabResult) {
      return null;
    }

    const featureResult = faceLabResult.features?.[activeFaceFeature];

    if (!featureResult) {
      return null;
    }

    if (activeFaceFeature === "physiognomy") {
      return (
        <div className="space-y-4 rounded-[1.75rem] border border-black/5 bg-[#faf6f0] p-5">
          <div className="rounded-[1.5rem] border border-[#d6b487] bg-[linear-gradient(135deg,#f4e4cf_0%,#fff8f0_100%)] px-5 py-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.18em] text-[#7d5724]">Headline Label</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#7d5724] px-3 py-1 text-xs font-semibold text-white">
                {featureResult.headline_label}
              </span>
              {(featureResult.interpretation_axes || []).map((axis) => (
                <span
                  key={axis}
                  className="rounded-full border border-[#d6b487] bg-white/70 px-3 py-1 text-xs font-medium text-[#7d5724]"
                >
                  {axis}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xl font-semibold leading-8 text-ink sm:text-2xl">
              {featureResult.headline_result}
            </p>
          </div>

          <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">Overall Impression</p>
            <p className="mt-2 text-sm leading-6 text-black/75">{featureResult.overall_impression}</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">Feature-Based Analysis</p>
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
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">Personality</p>
            <div className="mt-2 space-y-1">
              {(featureResult.real_tendency || []).slice(0, 2).map((item, index) => (
                <p key={`tendency-${index}`} className="text-sm leading-6 text-black/75">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3 rounded-2xl bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">Strengths</p>
              {(featureResult.strengths || []).slice(0, 3).map((item, index) => (
                <div
                  key={`strength-${index}`}
                  className="rounded-2xl bg-[#faf6f0] px-4 py-3 text-sm leading-6 text-black/75"
                >
                  • {item}
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-2xl bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">Weaknesses</p>
              {(featureResult.cautions || []).slice(0, 2).map((item, index) => (
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
      );
    }

    if (activeFaceFeature === "face_shape_hairstyle") {
      return (
        <div className="space-y-4 rounded-[1.75rem] border border-black/5 bg-[#faf6f0] p-5">
          <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">Summary</p>
            <p className="mt-2 text-sm leading-6 text-black/75">{featureResult.summary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(featureResult.recommendations || []).slice(0, 3).map((item, index) => (
              <div key={`hair-${index}`} className="rounded-2xl bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-black/40">
                  Recommendation {index + 1}
                </p>
                <p className="mt-2 text-sm leading-6 text-black/75">{item}</p>
              </div>
            ))}
            {(featureResult.avoid || []).slice(0, 2).map((item, index) => (
              <div key={`avoid-${index}`} className="rounded-2xl bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-black/40">Avoid</p>
                <p className="mt-2 text-sm leading-6 text-black/75">{item}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeFaceFeature === "lookalike_celebrities") {
      return (
        <div className="space-y-4 rounded-[1.75rem] border border-black/5 bg-[#faf6f0] p-5">
          <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">Summary</p>
            <p className="mt-2 text-sm leading-6 text-black/75">{featureResult.summary}</p>
          </div>
          <div className="grid gap-3">
            {(featureResult.matches || []).slice(0, 3).map((item, index) => (
              <div key={`celeb-${index}`} className="rounded-2xl bg-white px-4 py-4">
                <p className="text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-2 text-sm leading-6 text-black/75">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeFaceFeature === "color_tone_recommendation") {
      return (
        <div className="space-y-4 rounded-[1.75rem] border border-black/5 bg-[#faf6f0] p-5">
          <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">Summary</p>
            <p className="mt-2 text-sm leading-6 text-black/75">{featureResult.summary}</p>
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
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">Palette</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(featureResult.palette || []).slice(0, 4).map((item) => (
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
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">Avoid</p>
              <div className="mt-2 space-y-2">
                {(featureResult.avoid || []).slice(0, 2).map((item, index) => (
                  <p key={`tone-avoid-${index}`} className="text-sm leading-6 text-black/75">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">Recommendations</p>
            <div className="mt-2 space-y-2">
              {(featureResult.recommendations || []).slice(0, 3).map((item, index) => (
                <p key={`tone-rec-${index}`} className="text-sm leading-6 text-black/75">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="rounded-[2rem] border border-black/5 bg-white/80 p-5 shadow-soft backdrop-blur sm:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-black/45 sm:text-sm">AI Beauty MVP</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
            K-Beauty AI Skin Test
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-black/65 sm:text-base">
            사진 1장으로 스킨 루틴 추천과 Face Lab 기반 인상 분석을 빠르게 확인할 수 있습니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-ink text-white"
                      : "border border-black/10 bg-white text-black/65 hover:border-black/20"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "skin" ? (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <UploadPreview
                imageFile={imageFile}
                previewUrl={previewUrl}
                onChange={handleImageChange}
                onClear={clearImage}
              />
              <SurveyForm form={form} onChange={handleChange} onCheckboxChange={handleCheckboxChange} />
              <ErrorMessage message={error} />
              <SubmitButton disabled={isLoading}>결과 생성하기</SubmitButton>
            </form>
          ) : (
            <div className="mt-8 space-y-5">
              <UploadPreview
                imageFile={imageFile}
                previewUrl={previewUrl}
                onChange={handleImageChange}
                onClear={clearImage}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                {faceLabFeatures.map((feature) => {
                  const isActive = activeFaceFeature === feature.id;

                  return (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => setActiveFaceFeature(feature.id)}
                      className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-ink bg-[#f4eee4] shadow-soft"
                          : "border-black/10 bg-white hover:border-black/20"
                      }`}
                    >
                      <p className="text-sm font-semibold text-ink">{feature.label}</p>
                      <p className="mt-2 text-sm leading-6 text-black/65">{feature.description}</p>
                    </button>
                  );
                })}
              </div>

              <ErrorMessage message={faceLabError} />

              <button
                type="button"
                onClick={handleFaceLabAnalyze}
                disabled={faceLabLoading}
                className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Analyze Face Lab
              </button>

              {faceLabLoading ? <LoadingSpinner label="Face Lab 결과를 생성하는 중입니다..." /> : null}

              {faceLabResult ? (
                <div className="space-y-4">
                  <div className="rounded-[1.75rem] border border-black/5 bg-white px-5 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#efe6da] px-3 py-1 text-xs font-medium text-ink">
                        Face Lab
                      </span>
                      <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/65">
                        Shape {faceLabResult.base_data?.face_shape || "-"}
                      </span>
                      <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/65">
                        {selectedFaceFeature.title}
                      </span>
                    </div>

                    {faceLabBaseData?.landmarks?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
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

                  {renderFaceLabResult()}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-6">
          <div className="rounded-[2rem] border border-black/5 bg-[#fffdf9]/85 p-6 shadow-soft backdrop-blur sm:p-8">
            <p className="text-sm font-medium text-black/45">How It Works</p>
            <div className="mt-4 grid gap-3">
              {(activeTab === "skin"
                ? [
                    "얼굴 사진 1장을 업로드합니다.",
                    "현재 피부 상태와 사용감을 기준으로 설문을 고릅니다.",
                    "AI 루틴 추천과 제품 매칭을 결과 페이지에서 확인합니다."
                  ]
                : [
                    "얼굴 사진은 한 번만 업로드하면 됩니다.",
                    "Face Lab에서 원하는 분석 기능을 카드로 고릅니다.",
                    "하나의 공용 관찰 결과를 바탕으로 기능별 해석을 나눠 보여줍니다."
                  ]).map((item, index) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-white/70 px-4 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe6da] text-sm font-semibold text-ink">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-black/70">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {isLoading || faceLabLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="rounded-[2rem] border border-black/5 bg-[#f0ebe3]/80 p-6 shadow-soft sm:p-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-black/40">Preview</p>
              <div className="mt-4 grid gap-3">
                {activeTab === "skin" ? (
                  <>
                    <div className="rounded-2xl bg-white/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-black/40">Morning</p>
                      <p className="mt-2 text-sm leading-6 text-black/70">
                        gentle cleanser, light hydration, sunscreen
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-black/40">Products</p>
                      <p className="mt-2 text-sm leading-6 text-black/70">
                        설문과 제품 메타데이터를 기준으로 Top Pick과 카테고리 추천을 보여줍니다.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-black/40">Skin Note</p>
                      <p className="mt-2 text-sm leading-6 text-black/70">
                        지금 피부 흐름에 맞는 루틴 우선순위를 먼저 정리합니다.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl bg-white/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-black/40">Interpretation Axes</p>
                      <p className="mt-2 text-sm leading-6 text-black/70">
                        관찰값을 먼저 묶어 해석 축을 고르고, 그 축을 기준으로 관상 결과 톤을 분리합니다.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-black/40">Shared Analysis</p>
                      <p className="mt-2 text-sm leading-6 text-black/70">
                        landmarks, face shape, embedding, color values를 한 번 만들고 기능별로 재사용합니다.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
