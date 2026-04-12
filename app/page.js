"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import UploadPreview from "@/components/UploadPreview";
import SurveyForm from "@/components/SurveyForm";
import SubmitButton from "@/components/SubmitButton";
import ErrorMessage from "@/components/ErrorMessage";
import { buildSkinProfileSummary } from "@/lib/skin-profile-summary";
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
    title: "Top Pick 리포트",
    accent: "SKIN1004 Madagascar Centella Ampoule",
    body: "유분과 자극 반응을 함께 본 메인 추천 결과입니다.",
    chips: ["Top Pick", "Low irritation", "Price $$"],
    footer: "가장 먼저 볼 제품을 바로 정리한 결과"
  },
  {
    id: "face-preview",
    eyebrow: "Face Lab Preview",
    title: "스타일 확장 분석",
    accent: "차분한 인상 + Oval Shape",
    body: "얼굴형과 분위기를 가볍게 넓혀 보는 보조 분석입니다.",
    chips: ["Face Shape", "Look-alike", "Color Tone"],
    footer: "Skin Match 다음에 이어서 보는 확장 결과"
  }
];

const faceLabFeatures = [
  {
    id: "physiognomy",
    label: "Physiognomy",
    title: "Physiognomy",
    description: "보이는 구조를 기준으로 인상 해석을 정리합니다."
  },
  {
    id: "face_shape_hairstyle",
    label: "Face Shape & Hairstyle",
    title: "Face Shape & Hairstyle",
    description: "얼굴형을 기준으로 어울리는 스타일 방향을 봅니다."
  },
  {
    id: "lookalike_celebrities",
    label: "Look-alike Celebrities",
    title: "Look-alike Celebrities",
    description: "닮은 인상과 구조 포인트를 빠르게 봅니다."
  },
  {
    id: "color_tone_recommendation",
    label: "Color Tone Recommendation",
    title: "Color Tone Recommendation",
    description: "컬러 톤 방향과 어울리는 범위를 정리합니다."
  }
];

const faceFeatureSlots = [
  { key: "eye", label: "Eye", icon: "👀", keywords: ["눈", "눈매", "시선"] },
  { key: "mouth", label: "Mouth", icon: "👄", keywords: ["입", "입꼬리", "입선"] },
  { key: "jaw", label: "Jaw", icon: "🗿", keywords: ["턱", "턱선", "하관"] },
  { key: "shape", label: "Face Shape", icon: "🪞", keywords: ["얼굴형", "윤곽", "비율", "형태"] }
];

const pageCopy = {
  ko: {
    heroTitle: "내 피부에 맞는 K-뷰티 루틴, 지금 바로 진단",
    heroBody: "사진 1장과 몇 가지 질문으로 피부 흐름에 맞는 제품부터 루틴까지 정리해드립니다.",
    startCta: "진단 시작하기",
    reassurance: "회원가입 없이 바로 테스트할 수 있습니다",
    heroBadge: "Skin Match First",
    startReportTitle: "기본 피부 상태를 먼저 알려주세요",
    startReportBody: "Skin Match를 먼저 보고, 필요하면 Face Lab까지 이어서 확인하면 됩니다.",
    presetPrefix: "테스트 결과:",
    submitLoading: "진단 준비 중...",
    faceLabLoading: "Face Lab 분석 중...",
    faceLabButton: "Face Lab 보기",
    faceLabSpinner: "Face Lab 결과를 생성하고 있습니다...",
    profileTitle: "당신의 피부 프로필",
    profileBody: "이 조건을 기준으로 가장 안정적인 루틴을 정리했습니다.",
    errorMissingBasics: "사진과 기본 입력 항목을 먼저 채워 주세요.",
    errorAnalyzeFailed: "결과 생성에 실패했습니다.",
    errorUnexpected: "예상하지 못한 오류가 발생했습니다.",
    errorNeedPhoto: "얼굴 사진을 먼저 업로드해 주세요.",
    errorFaceLabFailed: "Face Lab 분석에 실패했습니다.",
    errorFaceLabLoadFailed: "Face Lab 결과를 불러오지 못했습니다.",
    skinPresetLabels: {
      "oily-quick": "지성 / 유분 / 끈적임 싫음",
      "dry-barrier": "건성 / 건조 / 크림 선호"
    },
    facePresetLabels: {
      "sharp-leader": "가상 결과: 선명한 리더형",
      "warm-coordinator": "가상 결과: 친화적 조율형"
    },
    faceLabUi: {
      headline: "핵심 인상",
      overall: "전체 인상",
      featureAnalysis: "부위별 해석",
      tendency: "성향 흐름",
      strengths: "강점",
      cautions: "주의 포인트",
      summary: "요약",
      recommendation: "추천",
      avoid: "피하면 좋은 방향",
      palette: "추천 팔레트",
      recommendations: "추천 포인트",
      faceLab: "Face Lab",
      shape: "얼굴형",
      undertone: "언더톤",
      brightness: "명도",
      contrast: "대비",
      saturation: "채도"
    }
  },
  en: {
    heroTitle: "A K-beauty routine matched to your skin, in minutes",
    heroBody: "Upload one photo and answer a few questions to get product picks and a practical routine.",
    startCta: "Start Diagnosis",
    reassurance: "Try it instantly without creating an account",
    heroBadge: "Skin Match First",
    startReportTitle: "Tell us the basics of your skin first.",
    startReportBody: "Start with Skin Match, then explore Face Lab if you want a broader style read.",
    presetPrefix: "Test result:",
    submitLoading: "Preparing your diagnosis...",
    faceLabLoading: "Analyzing Face Lab...",
    faceLabButton: "Open Face Lab",
    faceLabSpinner: "Generating your Face Lab result...",
    profileTitle: "Your Skin Profile",
    profileBody: "We organized the most stable routine around these conditions.",
    errorMissingBasics: "Please add a photo and complete the basic fields first.",
    errorAnalyzeFailed: "Failed to generate the result.",
    errorUnexpected: "Something unexpected went wrong.",
    errorNeedPhoto: "Please upload a face photo first.",
    errorFaceLabFailed: "Face Lab analysis failed.",
    errorFaceLabLoadFailed: "Could not load the Face Lab result.",
    skinPresetLabels: {
      "oily-quick": "Oily / oil control / hates stickiness",
      "dry-barrier": "Dry / dehydration / prefers cream"
    },
    facePresetLabels: {
      "sharp-leader": "Sample result: sharp leader",
      "warm-coordinator": "Sample result: warm coordinator"
    },
    faceLabUi: {
      headline: "Headline",
      overall: "Overall Impression",
      featureAnalysis: "Feature-Based Analysis",
      tendency: "Tendency",
      strengths: "Strengths",
      cautions: "Cautions",
      summary: "Summary",
      recommendation: "Recommendation",
      avoid: "Avoid",
      palette: "Palette",
      recommendations: "Recommendations",
      faceLab: "Face Lab",
      shape: "Shape",
      undertone: "Undertone",
      brightness: "Brightness",
      contrast: "Contrast",
      saturation: "Saturation"
    }
  }
};

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

function renderColorValues(colorValues = {}, locale = "ko") {
  const labels = (pageCopy[locale] || pageCopy.ko).faceLabUi;

  return [
    { label: labels.undertone, value: colorValues.undertone },
    { label: labels.brightness, value: colorValues.brightness },
    { label: labels.contrast, value: colorValues.contrast },
    { label: labels.saturation, value: colorValues.saturation }
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

function ProfileSummaryCard({ items, locale = "ko" }) {
  if (!items?.length) {
    return null;
  }

  const copy = pageCopy[locale] || pageCopy.ko;
  const faceLabUi = copy.faceLabUi;

  return (
    <div className="rounded-[1.5rem] border border-[#d6b487] bg-[linear-gradient(135deg,#f4e4cf_0%,#fff9f2_100%)] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5724]">{copy.profileTitle}</p>
      <div className="mt-4 space-y-2.5">
        {items.map((item) => (
          <p key={item} className="text-sm leading-6 text-black/78">
            ✔ {item}
          </p>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-black/64">
        {copy.profileBody}
      </p>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.startsWith("/en") ? "en" : "ko";
  const isEnglish = locale === "en";
  const copy = pageCopy[locale] || pageCopy.ko;
  const [activeTab, setActiveTab] = useState("skin");
  const [activeFaceFeature, setActiveFaceFeature] = useState("physiognomy");
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [profilePreview, setProfilePreview] = useState(null);
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
      form.mainConcern
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
    () => renderColorValues(faceLabResult?.base_data?.color_values, locale),
    [faceLabResult, locale]
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
      setProfilePreview(null);
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
    setFaceLabError("");
    setFaceLabResult(null);
    setProfilePreview(null);
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
    setProfilePreview(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValid) {
      setError(copy.errorMissingBasics);
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
      payload.append("locale", locale);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: payload
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || copy.errorAnalyzeFailed);
      }

      sessionStorage.setItem(
        "skinTestSubmission",
        JSON.stringify({
          form,
          imageName: imageFile?.name || "",
          locale
        })
      );
      sessionStorage.setItem("skinTestResult", JSON.stringify(data));
      setProfilePreview(buildSkinProfileSummary(form, locale));
      setTimeout(() => {
        router.push(locale === "en" ? "/en/result" : "/result");
      }, 1400);
    } catch (submitError) {
      const message = submitError.message || copy.errorUnexpected;
      sessionStorage.removeItem("skinTestResult");
      router.push(`${locale === "en" ? "/en/result" : "/result"}?error=${encodeURIComponent(message)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceLabAnalyze = async () => {
    if (!imageFile) {
      setFaceLabError(copy.errorNeedPhoto);
      return;
    }

    setFaceLabError("");
    setFaceLabLoading(true);

    try {
      const payload = new FormData();
      payload.append("image", imageFile);
      payload.append("locale", locale);

      const response = await fetch("/api/face-reading", {
        method: "POST",
        body: payload
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || copy.errorFaceLabFailed);
      }

      setFaceLabResult(data);
    } catch (requestError) {
      setFaceLabResult(null);
      setFaceLabError(requestError.message || copy.errorFaceLabLoadFailed);
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
    router.push(locale === "en" ? "/en/result" : "/result");
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
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#7d5724]">{faceLabUi.headline}</p>
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
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.overall}</p>
            <p className="mt-2 text-sm leading-6 text-black/75">{featureResult.overall_impression}</p>
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
              {(featureResult.real_tendency || []).slice(0, 2).map((item, index) => (
                <p key={`tendency-${index}`} className="text-sm leading-6 text-black/75">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3 rounded-2xl bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.strengths}</p>
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
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.cautions}</p>
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
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.summary}</p>
            <p className="mt-2 text-sm leading-6 text-black/75">{featureResult.summary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(featureResult.recommendations || []).slice(0, 3).map((item, index) => (
              <div key={`hair-${index}`} className="rounded-2xl bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-black/40">
                  {faceLabUi.recommendation} {index + 1}
                </p>
                <p className="mt-2 text-sm leading-6 text-black/75">{item}</p>
              </div>
            ))}
            {(featureResult.avoid || []).slice(0, 2).map((item, index) => (
              <div key={`avoid-${index}`} className="rounded-2xl bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.avoid}</p>
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
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.summary}</p>
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
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.summary}</p>
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
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.palette}</p>
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
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.avoid}</p>
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
            <p className="text-xs uppercase tracking-[0.14em] text-black/40">{faceLabUi.recommendations}</p>
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
          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="max-w-3xl">
              <div className="mb-4 flex gap-2">
                {[
                  { code: "ko", label: "한국어", href: "/" },
                  { code: "en", label: "English", href: "/en" }
                  ].map((item) => (
                    <Link
                      key={item.code}
                      href={item.href}
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        locale === item.code
                          ? "bg-[#1f1811] text-white"
                          : "border border-black/10 bg-white/80 text-black/60 hover:border-black/20"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="inline-flex rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-black/55">
                  {copy.heroBadge}
                </div>
                <h1 className="mt-4 max-w-3xl text-[2.15rem] font-semibold tracking-tight text-ink sm:text-[3.4rem] sm:leading-[1.08]">
                  {copy.heroTitle}
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-black/68 sm:text-lg">
                  {copy.heroBody}
                </p>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => scrollToId("start-report")}
                    className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    {copy.startCta}
                  </button>
                </div>

              <p className="mt-3 text-sm text-black/52">{copy.reassurance}</p>
            </div>
          </div>
        </section>

        <section
          id="start-report"
          className="rounded-[2rem] border border-black/5 bg-white/88 p-5 shadow-soft sm:p-7"
        >
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/40">Start Report</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[2rem]">{copy.startReportTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-black/58">
                {copy.startReportBody}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TEST_RESULT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetPreview(preset.id)}
                    className="rounded-full border border-dashed border-black/15 bg-[#faf6f0] px-3 py-1.5 text-xs font-medium text-black/62 transition hover:border-black/25 hover:bg-white"
                  >
                    {copy.presetPrefix} {copy.skinPresetLabels[preset.id] || preset.summaryLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
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
                    locale={locale}
                  />
                  <SurveyForm
                    form={form}
                    onChange={handleChange}
                    onCheckboxChange={handleCheckboxChange}
                    locale={locale}
                  />
                  <ErrorMessage message={error} />
                  <SubmitButton disabled={isLoading}>
                    {isLoading ? copy.submitLoading : copy.startCta}
                  </SubmitButton>
                  {profilePreview ? <ProfileSummaryCard items={profilePreview} locale={locale} /> : null}
                </form>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="flex flex-wrap gap-2">
                    {FACE_LAB_TEST_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleFaceLabPresetPreview(preset.id)}
                        className="rounded-full border border-dashed border-black/15 bg-[#faf6f0] px-3 py-1.5 text-xs font-medium text-black/62 transition hover:border-black/25 hover:bg-white"
                      >
                        {copy.facePresetLabels[preset.id] || preset.buttonLabel}
                      </button>
                    ))}
                  </div>

                  <UploadPreview
                    imageFile={imageFile}
                    previewUrl={previewUrl}
                    onChange={handleImageChange}
                    onClear={clearImage}
                    locale={locale}
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
                    {faceLabLoading ? copy.faceLabLoading : copy.faceLabButton}
                  </button>

                  {faceLabLoading ? (
                    <LoadingSpinner label={copy.faceLabSpinner} />
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
          </div>
        </section>

      </div>
    </main>
  );
}







