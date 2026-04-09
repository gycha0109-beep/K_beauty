"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import UploadPreview from "@/components/UploadPreview";
import SurveyForm from "@/components/SurveyForm";
import SubmitButton from "@/components/SubmitButton";
import ErrorMessage from "@/components/ErrorMessage";
import {
  TEST_RESULT_PRESETS,
  FACE_LAB_TEST_PRESETS,
  getTestResultPreset,
  getFaceLabTestPreset
} from "@/lib/test-result-presets";

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
  { id: "skin", label: "Skin Match" },
  { id: "face-lab", label: "Face Lab" }
];

const previewCards = [
  {
    id: "skin-preview",
    eyebrow: "Skin Match Preview",
    title: "Top Pick 중심 리포트",
    accent: "SKIN1004 Madagascar Centella Ampoule",
    body: "유분과 자극 반응을 함께 눌러 주는 쪽으로 정리된 메인 추천 결과입니다.",
    chips: ["Top Pick", "Low irritation", "Price $$"],
    footer: "오후 유분과 붉은기 흐름을 먼저 다루는 리포트"
  },
  {
    id: "face-preview",
    eyebrow: "Face Lab Preview",
    title: "스타일 확장 분석",
    accent: "차분한 설득형 · Oval Shape",
    body: "얼굴형, 분위기, 닮은꼴, 컬러 톤을 짧고 가볍게 이어서 보는 보조 분석입니다.",
    chips: ["Face Shape", "Look-alike", "Color Tone"],
    footer: "Skin Match 뒤에 가볍게 넓혀 보는 확장 결과"
  }
];

const featureCards = [
  { title: "Skin Match", description: "피부 타입과 고민에 맞는 K-뷰티 제품 추천" },
  { title: "Top Pick", description: "지금 가장 먼저 볼 1순위 제품 제안" },
  { title: "Face Lab", description: "얼굴형, 분위기, 닮은꼴, 컬러 톤 확장 분석" },
  { title: "Save & Compare", description: "결과 저장, 공유, 비교를 위한 흐름" }
];

const faceLabFeatures = [
  {
    id: "physiognomy",
    label: "Physiognomy",
    title: "Physiognomy",
    description: "보이는 특징을 바탕으로 인상 해석을 정리합니다."
  },
  {
    id: "face_shape_hairstyle",
    label: "Face Shape & Hairstyle",
    title: "Face Shape & Hairstyle",
    description: "얼굴형을 기준으로 어울리는 헤어 방향을 제안합니다."
  },
  {
    id: "lookalike_celebrities",
    label: "Look-alike Celebrities",
    title: "Look-alike Celebrities",
    description: "비슷한 인상 흐름의 셀럽 레퍼런스를 보여줍니다."
  },
  {
    id: "color_tone_recommendation",
    label: "Color Tone Recommendation",
    title: "Color Tone Recommendation",
    description: "톤 방향과 어울리는 색 흐름을 가볍게 정리합니다."
  }
];

const faceFeatureSlots = [
  { key: "eye", label: "Eye", icon: "👁", keywords: ["눈", "눈매", "시선"] },
  { key: "mouth", label: "Mouth", icon: "👄", keywords: ["입", "입꼬리", "입선"] },
  { key: "jaw", label: "Jaw", icon: "🧭", keywords: ["턱", "턱선", "하관"] },
  { key: "shape", label: "Face Shape", icon: "🪞", keywords: ["얼굴형", "윤곽", "비율", "형태"] }
];

const trustLines = [
  "얼굴 이미지와 입력 정보를 바탕으로 결과를 생성합니다.",
  "제품 추천은 현재 DB와 추천 로직을 함께 사용하며 결과는 참고용입니다."
];

const utilityItems = [
  { title: "Skin Match", body: "메인 추천 결과를 빠르게 확인합니다." },
  { title: "Top Pick", body: "가장 먼저 볼 제품 1개를 바로 보여줍니다." },
  { title: "Face Lab", body: "스타일과 분위기를 넓게 보는 확장 분석입니다." }
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

function scrollToId(id) {
  if (typeof document === "undefined") {
    return;
  }

  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function CompactSectionHeader({ eyebrow, title, description }) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-[11px] uppercase tracking-[0.2em] text-black/40">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-[2rem]">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-6 text-black/64">{description}</p> : null}
    </div>
  );
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

  const handlePresetPreview = (presetId) => {
    const preset = getTestResultPreset(presetId);

    if (!preset) {
      return;
    }

    sessionStorage.setItem("skinTestSubmission", JSON.stringify(preset.submission));
    sessionStorage.setItem("skinTestResult", JSON.stringify(preset.result));
    router.push("/result");
  };

  const handleFaceLabPresetPreview = (presetId) => {
    const preset = getFaceLabTestPreset(presetId);

    if (!preset) {
      return;
    }

    setActiveTab("face-lab");
    setActiveFaceFeature("physiognomy");
    setFaceLabError("");
    setFaceLabResult(preset.result);
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
        <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
          <div className="rounded-[1.3rem] border border-[#d6b487] bg-[linear-gradient(135deg,#f4e4cf_0%,#fff8f0_100%)] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#7d5724]">Headline</p>
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
            <p className="mt-3 text-lg font-semibold leading-7 text-ink sm:text-xl">
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
        <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
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
        <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
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
        <div className="space-y-4 rounded-[1.5rem] border border-black/5 bg-[#faf6f0] p-4 sm:p-5">
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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <div className="space-y-6 sm:space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-black/5 bg-[linear-gradient(145deg,#fffdf9_0%,#f7efe5_100%)] shadow-soft">
          <div className="grid gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-black/55">
                Skin Match First
              </div>
              <h1 className="mt-4 max-w-3xl text-[2.15rem] font-semibold tracking-tight text-ink sm:text-[3.4rem] sm:leading-[1.08]">
                사진 한 장으로 받는 K-뷰티 · 스타일 추천 리포트
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-black/68 sm:text-lg">
                피부 상태에 맞는 제품 추천부터 얼굴형, 분위기, 닮은꼴, 컬러 톤까지 한 번에 분석합니다.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => scrollToId("start-report")}
                  className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  사진으로 시작하기
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId("result-preview")}
                  className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/90 px-6 py-3 text-sm font-semibold text-black/72 transition hover:border-black/20 hover:bg-white"
                >
                  결과 예시 보기
                </button>
              </div>

              <p className="mt-4 text-sm text-black/52">회원가입 없이 바로 테스트할 수 있습니다</p>
            </div>

            <div className="rounded-[1.6rem] border border-black/5 bg-white/88 p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-black/38">What You Get</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-[#faf4ec] px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Skin Match가 메인 결과입니다</p>
                  <p className="mt-1 text-sm leading-6 text-black/64">
                    제품 추천과 Top Pick이 먼저 나오고, 바로 구매 판단까지 이어집니다.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#faf8f2] px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Face Lab은 가볍게 넓혀 보는 확장 분석입니다</p>
                  <p className="mt-1 text-sm leading-6 text-black/64">
                    메인 결과 뒤에 스타일 방향과 인상 흐름을 덧붙여 보는 보조 모듈입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="result-preview" className="space-y-4">
          <CompactSectionHeader
            eyebrow="Preview"
            title="결과 예시"
            description="실제 결과 화면이 어떤 느낌인지 빠르게 확인할 수 있습니다."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {previewCards.map((card) => (
              <div
                key={card.id}
                className="rounded-[1.4rem] border border-black/5 bg-white/90 p-4 shadow-soft"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/38">{card.eyebrow}</p>
                <h3 className="mt-2 text-base font-semibold text-ink">{card.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#7d5724]">{card.accent}</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{card.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-black/10 bg-[#faf6f0] px-3 py-1 text-[11px] font-medium text-black/58"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs font-medium text-black/62">{card.footer}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="start-report"
          className="rounded-[2rem] border border-black/5 bg-white/88 p-5 shadow-soft sm:p-7"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/40">Start Report</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[2rem]">
                사진으로 바로 리포트를 시작하세요
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/64">
                Skin Match가 메인 결과이고, Face Lab은 같은 사진으로 이어서 볼 수 있는 확장 분석입니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TEST_RESULT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetPreview(preset.id)}
                    className="rounded-full border border-dashed border-black/15 bg-[#faf6f0] px-3 py-1.5 text-xs font-medium text-black/62 transition hover:border-black/25 hover:bg-white"
                  >
                    테스트 결과: {preset.summaryLabel}
                  </button>
                ))}
              </div>
            </div>
            <div className="inline-flex rounded-full border border-black/10 bg-[#faf4ec] px-4 py-2 text-xs font-medium text-black/60">
              Skin Match 우선 · Face Lab 확장
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-[1.5rem] border border-black/5 bg-[#fffdf9] p-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
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
                <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
                  <UploadPreview
                    imageFile={imageFile}
                    previewUrl={previewUrl}
                    onChange={handleImageChange}
                    onClear={clearImage}
                  />
                  <SurveyForm
                    form={form}
                    onChange={handleChange}
                    onCheckboxChange={handleCheckboxChange}
                  />
                  <ErrorMessage message={error} />
                  <SubmitButton disabled={isLoading}>
                    {isLoading ? "결과 생성 중..." : "결과 생성하기"}
                  </SubmitButton>
                </form>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="rounded-2xl border border-[#d6b487]/70 bg-[linear-gradient(135deg,#f8ebd9_0%,#fffaf3_100%)] px-4 py-4 text-sm leading-6 text-black/68">
                    Face Lab은 메인 추천 뒤에 이어서 보는 확장 리포트입니다. 사진은 그대로 쓰고 원하는 항목만 가볍게 확인할 수 있습니다.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {FACE_LAB_TEST_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleFaceLabPresetPreview(preset.id)}
                        className="rounded-full border border-dashed border-black/15 bg-[#faf6f0] px-3 py-1.5 text-xs font-medium text-black/62 transition hover:border-black/25 hover:bg-white"
                      >
                        {preset.buttonLabel}
                      </button>
                    ))}
                  </div>

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
                          className={`rounded-[1.3rem] border px-4 py-4 text-left transition ${
                            isActive
                              ? "border-ink bg-[#f4eee4] shadow-soft"
                              : "border-black/10 bg-white hover:border-black/20"
                          }`}
                        >
                          <p className="text-sm font-semibold text-ink">{feature.label}</p>
                          <p className="mt-1 text-sm leading-6 text-black/64">{feature.description}</p>
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
                    {faceLabLoading ? "Face Lab 분석 중..." : "Face Lab 분석하기"}
                  </button>

                  {faceLabLoading ? (
                    <LoadingSpinner label="Face Lab 결과를 생성하고 있습니다..." />
                  ) : null}

                  {faceLabResult ? (
                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-black/5 bg-white px-4 py-4">
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

                      {renderFaceLabResult()}
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <aside>
              <div className="rounded-[1.5rem] border border-black/5 bg-[#faf5ee] p-4 sm:p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/38">Quick Guide</p>
                <div className="mt-4 space-y-3">
                  {utilityItems.map((item) => (
                    <div key={item.title} className="rounded-2xl bg-white/85 px-4 py-3">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-black/64">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-4">
          <CompactSectionHeader
            eyebrow="Value"
            title="한 번의 업로드로 피부와 스타일을 함께 분석합니다"
            description="Skin Analysis는 실제 추천과 제품 선택에 집중하고, Face Lab은 얼굴형과 분위기를 더 넓게 볼 수 있도록 설계했습니다."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.35rem] border border-black/5 bg-white/90 px-4 py-4 shadow-soft"
              >
                <p className="text-base font-semibold text-ink">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-black/64">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-black/5 bg-white/88 px-5 py-4 shadow-soft">
          <p className="text-[11px] uppercase tracking-[0.2em] text-black/40">사용 방법</p>
          <p className="mt-3 text-sm leading-7 text-black/68 sm:text-[15px]">
            사진 업로드 <span className="mx-2 text-black/30">→</span> 결과 확인{" "}
            <span className="mx-2 text-black/30">→</span> 추천 제품과 스타일 확인{" "}
            <span className="mx-2 text-black/30">→</span> 저장하거나 공유하기
          </p>
        </section>

        <section className="space-y-2 px-1">
          {trustLines.map((line) => (
            <p key={line} className="text-sm leading-6 text-black/48">
              {line}
            </p>
          ))}
        </section>

        <section className="overflow-hidden rounded-[1.8rem] border border-[#d6b487] bg-[linear-gradient(135deg,#f2e3cf_0%,#fff8f1_100%)] px-5 py-7 shadow-soft sm:px-8 sm:py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#7d5724]">Final CTA</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[2rem]">
                지금 내 얼굴로 바로 확인해보세요
              </h2>
              <p className="mt-2 text-sm leading-6 text-black/68">
                피부 추천부터 Face Lab 결과까지 사진 한 장으로 바로 확인할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => scrollToId("start-report")}
              className="inline-flex items-center justify-center rounded-full bg-[#1f1811] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              무료로 시작하기
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
