"use client";

import { useMemo, useState } from "react";

const FLOW_COPY = {
  ko: {
    badge: "Skin Match",
    headline: "몇 가지 질문으로",
    headlineAccent: "내 피부를 더 정확히 분석할게요",
    description: "사진에서 보이지 않는 생활 패턴과 사용감을 함께 확인합니다.",
    questionCount: "질문",
    required: "필수",
    optional: "선택",
    multiple: "복수 선택",
    next: "다음",
    back: "이전으로",
    startAnalyze: "분석 시작",
    needAnswer: "필수 항목을 먼저 선택해주세요.",
    maxSelect: (count) => `최대 ${count}개까지 선택할 수 있어요.`,
    selected: "선택됨",
    stages: [
      { key: "photo", label: "사진 촬영" },
      { key: "skin", label: "피부 상태" },
      { key: "lifestyle", label: "생활 습관" },
      { key: "preference", label: "선호도" },
      { key: "analyze", label: "분석 완료" }
    ]
  },
  en: {
    badge: "Skin Match",
    headline: "A few questions",
    headlineAccent: "make your skin read more precise",
    description: "We combine your photo with skin feel, lifestyle, and texture preferences.",
    questionCount: "Question",
    required: "Required",
    optional: "Optional",
    multiple: "Multiple",
    next: "Next",
    back: "Back",
    startAnalyze: "Start analysis",
    needAnswer: "Please answer the required question first.",
    maxSelect: (count) => `You can select up to ${count}.`,
    selected: "Selected",
    stages: [
      { key: "photo", label: "Photo" },
      { key: "skin", label: "Skin" },
      { key: "lifestyle", label: "Lifestyle" },
      { key: "preference", label: "Preference" },
      { key: "analyze", label: "Analysis" }
    ]
  }
};

const QUESTION_SCREENS = {
  ko: [
    {
      id: "skin-basics",
      stage: "skin",
      hint: "피부 기본 컨디션을 먼저 정리하고 있어요.",
      questions: [
        {
          id: "skinType",
          title: "평소 피부 타입에 가장 가까운 것은?",
          subtitle: "잘 모르겠다면 가장 자주 느끼는 상태를 골라주세요.",
          type: "single",
          required: true,
          options: [
            { value: "oily", label: "지성", description: "오후에 유분이 많이 올라와요" },
            { value: "dry", label: "건성", description: "세안 후 당김이 자주 있어요" },
            { value: "combination", label: "복합성", description: "T존은 번들, 볼은 건조해요" },
            { value: "not_sure", label: "잘 모르겠음", description: "다른 답변과 함께 판단할게요" }
          ]
        },
        {
          id: "sensitivity",
          title: "피부가 쉽게 예민해지는 편인가요?",
          subtitle: "화끈거림, 따가움, 붉어짐 기준으로 골라주세요.",
          type: "single",
          required: true,
          options: [
            { value: "low", label: "낮음", description: "대체로 편안한 편이에요" },
            { value: "medium", label: "보통", description: "컨디션에 따라 달라져요" },
            { value: "high", label: "높음", description: "쉽게 따갑거나 붉어져요" }
          ]
        }
      ]
    },
    {
      id: "skin-concerns",
      stage: "skin",
      hint: "선택한 고민을 바탕으로 루틴 우선순위를 잡을게요.",
      questions: [
        {
          id: "mainConcerns",
          title: "가장 신경 쓰이는 피부 고민은?",
          subtitle: "최대 4개까지 선택할 수 있어요.",
          type: "multiple",
          required: true,
          maxSelect: 4,
          options: [
            { value: "oiliness", label: "유분", description: "번들거림과 피지감" },
            { value: "dehydration", label: "건조", description: "속당김과 수분 부족감" },
            { value: "acne", label: "트러블", description: "올라오는 부위와 흔들림" },
            { value: "pores", label: "모공", description: "결과 표면 정돈" },
            { value: "redness", label: "붉은기", description: "열감과 예민한 반응" },
            { value: "barrier", label: "장벽 약화", description: "쉽게 무너지는 컨디션" },
            { value: "uneven_tone", label: "톤 불균일", description: "칙칙함과 맑은 인상" }
          ]
        }
      ]
    },
    {
      id: "daily-feel",
      stage: "lifestyle",
      hint: "수분 밸런스와 오후 변화 패턴을 함께 확인 중이에요.",
      questions: [
        {
          id: "postWashFeeling",
          title: "세안 직후 피부는 어떤 느낌인가요?",
          type: "single",
          required: false,
          options: [
            { value: "tight", label: "당김이 있음", description: "세안 후 빠르게 건조해져요" },
            { value: "comfortable", label: "편안함", description: "크게 불편하지 않아요" },
            { value: "still_oily", label: "유분감 있음", description: "세안 직후에도 번들거려요" }
          ]
        },
        {
          id: "afternoonSkinChange",
          title: "오후가 되면 피부가 어떻게 변하나요?",
          type: "single",
          required: false,
          options: [
            { value: "more_oily", label: "더 번들거림", description: "유분이 빠르게 올라와요" },
            { value: "more_dry", label: "더 건조함", description: "당김이 뒤늦게 올라와요" },
            { value: "red_or_irritated", label: "예민해짐", description: "붉거나 따가운 편이에요" },
            { value: "mostly_same", label: "큰 변화 없음", description: "대체로 유지돼요" }
          ]
        }
      ]
    },
    {
      id: "routine-habits",
      stage: "lifestyle",
      hint: "생활 환경이 루틴 부담을 만들 수 있는지 살펴보고 있어요.",
      questions: [
        {
          id: "cleansingFrequency",
          title: "하루 세안 횟수는 어느 정도인가요?",
          type: "single",
          required: false,
          options: [
            { value: "once", label: "하루 1회", description: "저녁 중심으로 정리해요" },
            { value: "twice", label: "하루 2회", description: "아침과 저녁 모두 세안해요" },
            { value: "3_plus", label: "3회 이상", description: "운동이나 외출 후 자주 해요" }
          ]
        },
        {
          id: "environmentExposure",
          title: "피부에 영향을 주는 환경이 있나요?",
          subtitle: "해당되는 것만 가볍게 선택하세요.",
          type: "multiple",
          required: false,
          options: [
            { value: "heat", label: "열감", description: "뜨거운 환경에 자주 있어요" },
            { value: "humidity", label: "습한 환경", description: "답답함이 쉽게 느껴져요" },
            { value: "mask", label: "마스크", description: "마찰이 신경 쓰여요" },
            { value: "kitchen", label: "주방/열기", description: "열과 유분 노출이 있어요" },
            { value: "outdoor", label: "야외활동", description: "자외선 노출이 길어요" },
            { value: "aircon", label: "에어컨", description: "건조한 바람을 자주 맞아요" }
          ]
        }
      ]
    },
    {
      id: "texture-preference",
      stage: "preference",
      hint: "사용감 선호를 반영해 오래 쓰기 쉬운 제품 방향을 잡을게요.",
      questions: [
        {
          id: "preferredTexture",
          title: "선호하는 제품 제형은 무엇인가요?",
          type: "single",
          required: false,
          options: [
            { value: "gel", label: "젤", description: "가볍고 산뜻한 느낌" },
            { value: "watery", label: "워터리", description: "빠르게 스며드는 느낌" },
            { value: "lotion", label: "로션", description: "수분과 보습의 균형" },
            { value: "cream", label: "크림", description: "감싸주는 마무리" }
          ]
        },
        {
          id: "mostDislikedFeel",
          title: "가장 피하고 싶은 사용감은?",
          type: "single",
          required: false,
          options: [
            { value: "sticky", label: "끈적임", description: "피부 위에 남는 느낌" },
            { value: "greasy", label: "번들거림", description: "유분막이 많은 느낌" },
            { value: "heavy", label: "무거움", description: "답답하게 덮이는 느낌" },
            { value: "fragranced", label: "강한 향", description: "향이 오래 남는 제품" },
            { value: "pilling", label: "밀림", description: "메이크업 전후 밀리는 느낌" }
          ]
        }
      ]
    },
    {
      id: "finish-preference",
      stage: "preference",
      hint: "선케어와 프로필 정보를 추천 맥락에만 가볍게 반영합니다.",
      questions: [
        {
          id: "sunscreenConsiderations",
          title: "선크림을 고를 때 고려하는 사항은?",
          subtitle: "해당되는 것만 선택하세요.",
          type: "multiple",
          required: false,
          options: [
            { value: "whiteCastHate", label: "백탁 적음", description: "하얗게 뜨는 느낌은 피하고 싶어요" },
            { value: "toneUpWanted", label: "톤업", description: "맑아 보이는 마무리를 원해요" },
            { value: "makeupUse", label: "메이크업 궁합", description: "베이스가 밀리지 않아야 해요" },
            { value: "eyeSensitive", label: "눈시림 적음", description: "눈 주변 자극이 적어야 해요" }
          ]
        },
        {
          id: "genderPreference",
          title: "성별을 선택해주세요",
          subtitle: "선택하지 않아도 분석은 가능합니다.",
          type: "single",
          required: false,
          allowNone: true,
          options: [
            { value: "female", label: "여성", description: "여성 기준 표현을 참고해요" },
            { value: "male", label: "남성", description: "남성 기준 표현을 참고해요" },
            { value: "unspecified", label: "선택 안 함", description: "공통 기준으로 정리해요" }
          ]
        }
      ]
    }
  ],
  en: [
    {
      id: "skin-basics",
      stage: "skin",
      hint: "Checking the baseline condition first.",
      questions: [
        {
          id: "skinType",
          title: "Which skin type feels closest to you?",
          subtitle: "If unsure, choose what you feel most often.",
          type: "single",
          required: true,
          options: [
            { value: "oily", label: "Oily", description: "Oil comes up quickly in the afternoon" },
            { value: "dry", label: "Dry", description: "Skin feels tight after cleansing" },
            { value: "combination", label: "Combination", description: "T-zone oily, cheeks dry" },
            { value: "not_sure", label: "Not sure", description: "We will read it with other answers" }
          ]
        },
        {
          id: "sensitivity",
          title: "Does your skin become reactive easily?",
          subtitle: "Think of stinging, flushing, or redness.",
          type: "single",
          required: true,
          options: [
            { value: "low", label: "Low", description: "Usually comfortable" },
            { value: "medium", label: "Normal", description: "Changes by condition" },
            { value: "high", label: "High", description: "Stings or reddens easily" }
          ]
        }
      ]
    },
    {
      id: "skin-concerns",
      stage: "skin",
      hint: "We will use these concerns to set routine priority.",
      questions: [
        {
          id: "mainConcerns",
          title: "What skin concerns matter most now?",
          subtitle: "Select up to 4.",
          type: "multiple",
          required: true,
          maxSelect: 4,
          options: [
            { value: "oiliness", label: "Oiliness", description: "Shine and sebum" },
            { value: "dehydration", label: "Dehydration", description: "Tightness and low water feel" },
            { value: "acne", label: "Breakouts", description: "Spots and unstable areas" },
            { value: "pores", label: "Pores", description: "Texture and surface look" },
            { value: "redness", label: "Redness", description: "Heat and reactive feel" },
            { value: "barrier", label: "Barrier", description: "Easily disrupted condition" },
            { value: "uneven_tone", label: "Uneven tone", description: "Dullness and uneven look" }
          ]
        }
      ]
    },
    {
      id: "daily-feel",
      stage: "lifestyle",
      hint: "Reading hydration balance and afternoon change.",
      questions: [
        {
          id: "postWashFeeling",
          title: "How does your skin feel right after cleansing?",
          type: "single",
          required: false,
          options: [
            { value: "tight", label: "Tight", description: "Gets dry quickly" },
            { value: "comfortable", label: "Comfortable", description: "No major discomfort" },
            { value: "still_oily", label: "Still oily", description: "Shine remains after cleansing" }
          ]
        },
        {
          id: "afternoonSkinChange",
          title: "What changes by the afternoon?",
          type: "single",
          required: false,
          options: [
            { value: "more_oily", label: "More oily", description: "Oil rises quickly" },
            { value: "more_dry", label: "More dry", description: "Tightness comes later" },
            { value: "red_or_irritated", label: "Reactive", description: "Red or stingy" },
            { value: "mostly_same", label: "Mostly same", description: "Stays stable" }
          ]
        }
      ]
    },
    {
      id: "routine-habits",
      stage: "lifestyle",
      hint: "Checking whether environment adds routine stress.",
      questions: [
        {
          id: "cleansingFrequency",
          title: "How often do you cleanse per day?",
          type: "single",
          required: false,
          options: [
            { value: "once", label: "Once", description: "Mostly at night" },
            { value: "twice", label: "Twice", description: "Morning and night" },
            { value: "3_plus", label: "3+ times", description: "Often after exercise or outdoor time" }
          ]
        },
        {
          id: "environmentExposure",
          title: "Any environment that affects your skin?",
          subtitle: "Select only what applies.",
          type: "multiple",
          required: false,
          options: [
            { value: "heat", label: "Heat", description: "Hot environments" },
            { value: "humidity", label: "Humidity", description: "Feels suffocating" },
            { value: "mask", label: "Mask", description: "Friction matters" },
            { value: "kitchen", label: "Kitchen heat", description: "Heat and oil exposure" },
            { value: "outdoor", label: "Outdoor", description: "Long UV exposure" },
            { value: "aircon", label: "Aircon", description: "Dry airflow" }
          ]
        }
      ]
    },
    {
      id: "texture-preference",
      stage: "preference",
      hint: "Texture preference helps keep the routine usable.",
      questions: [
        {
          id: "preferredTexture",
          title: "Which texture do you prefer?",
          type: "single",
          required: false,
          options: [
            { value: "gel", label: "Gel", description: "Light and fresh" },
            { value: "watery", label: "Watery", description: "Absorbs quickly" },
            { value: "lotion", label: "Lotion", description: "Balanced hydration" },
            { value: "cream", label: "Cream", description: "Sealing finish" }
          ]
        },
        {
          id: "mostDislikedFeel",
          title: "Which finish do you want to avoid most?",
          type: "single",
          required: false,
          options: [
            { value: "sticky", label: "Sticky", description: "Stays on top" },
            { value: "greasy", label: "Greasy", description: "Oily film" },
            { value: "heavy", label: "Heavy", description: "Feels covered" },
            { value: "fragranced", label: "Strong scent", description: "Lingering fragrance" },
            { value: "pilling", label: "Pilling", description: "Rolls under makeup" }
          ]
        }
      ]
    },
    {
      id: "finish-preference",
      stage: "preference",
      hint: "Sunscreen and profile answers are used only as light context.",
      questions: [
        {
          id: "sunscreenConsiderations",
          title: "What matters when choosing sunscreen?",
          subtitle: "Select what applies.",
          type: "multiple",
          required: false,
          options: [
            { value: "whiteCastHate", label: "Low white cast", description: "Avoids chalky finish" },
            { value: "toneUpWanted", label: "Tone-up", description: "A brighter finish" },
            { value: "makeupUse", label: "Makeup fit", description: "Does not pill under base" },
            { value: "eyeSensitive", label: "Low eye sting", description: "Gentler around eyes" }
          ]
        },
        {
          id: "genderPreference",
          title: "Choose gender preference",
          subtitle: "You can skip this.",
          type: "single",
          required: false,
          allowNone: true,
          options: [
            { value: "female", label: "Female", description: "Use female-oriented wording" },
            { value: "male", label: "Male", description: "Use male-oriented wording" },
            { value: "unspecified", label: "Prefer not to say", description: "Use neutral wording" }
          ]
        }
      ]
    }
  ]
};

function getAnswerValue(form, id) {
  if (id === "sunscreenConsiderations") {
    return ["whiteCastHate", "toneUpWanted", "makeupUse", "eyeSensitive"].filter((key) => Boolean(form[key]));
  }

  if (id === "mainConcerns" || id === "environmentExposure") {
    return Array.isArray(form[id]) ? form[id] : [];
  }

  return form[id] || "";
}

function hasAnswer(question, form) {
  const value = getAnswerValue(form, question.id);

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

const QUESTION_HIGHLIGHTS = {
  ko: {
    skinType: "피부 타입",
    sensitivity: "예민해지는",
    mainConcerns: "피부 고민",
    postWashFeeling: "세안 직후",
    afternoonSkinChange: "오후",
    cleansingFrequency: "세안 횟수",
    environmentExposure: "환경",
    preferredTexture: "제품 제형",
    mostDislikedFeel: "피하고 싶은 사용감",
    sunscreenConsiderations: "선크림",
    genderPreference: "성별"
  },
  en: {
    skinType: "skin type",
    sensitivity: "reactive",
    mainConcerns: "skin concerns",
    postWashFeeling: "right after cleansing",
    afternoonSkinChange: "afternoon",
    cleansingFrequency: "cleanse",
    environmentExposure: "environment",
    preferredTexture: "texture",
    mostDislikedFeel: "avoid",
    sunscreenConsiderations: "sunscreen",
    genderPreference: "gender"
  }
};

const OPTION_ICON_KEYS = {
  oily: "droplet",
  dry: "waves",
  combination: "balance",
  not_sure: "question",
  low: "level-low",
  medium: "level-medium",
  high: "level-high",
  oiliness: "droplet",
  dehydration: "waves",
  acne: "spot",
  pores: "dots",
  redness: "blush",
  barrier: "shield",
  uneven_tone: "sparkle",
  tight: "waves",
  comfortable: "balance",
  still_oily: "droplet",
  more_oily: "droplet",
  more_dry: "waves",
  red_or_irritated: "blush",
  mostly_same: "balance",
  once: "wash",
  twice: "wash",
  "3_plus": "wash",
  heat: "sun",
  humidity: "waves",
  mask: "shield",
  kitchen: "heat",
  outdoor: "sun",
  aircon: "wind",
  gel: "gel",
  watery: "droplet",
  lotion: "lotion",
  cream: "cream",
  sticky: "sparkle",
  greasy: "droplet",
  heavy: "weight",
  fragranced: "sparkle",
  pilling: "dots",
  whiteCastHate: "sun-shield",
  toneUpWanted: "sparkle",
  makeupUse: "brush",
  eyeSensitive: "eye",
  female: "profile",
  male: "profile",
  unspecified: "question"
};

const COMPACT_QUESTION_IDS = new Set([
  "sensitivity",
  "cleansingFrequency",
  "environmentExposure",
  "sunscreenConsiderations"
]);

function formatProgressNumber(value) {
  return String(value).padStart(2, "0");
}

function renderHighlightedTitle(title, highlightText) {
  if (!highlightText || typeof title !== "string" || !title.includes(highlightText)) {
    return title;
  }

  const [before, ...rest] = title.split(highlightText);

  return (
    <>
      {before}
      <span className="bg-[linear-gradient(90deg,#e76b91_0%,#ff8066_100%)] bg-clip-text text-transparent dark:bg-[linear-gradient(90deg,#ef6387_0%,#ff8068_100%)]">
        {highlightText}
      </span>
      {rest.join(highlightText)}
    </>
  );
}

function MiniIcon({ type, className = "h-3.5 w-3.5" }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className
  };

  switch (type) {
    case "droplet":
      return <svg {...commonProps}><path d="M12 3s5 5.4 5 10a5 5 0 0 1-10 0c0-4.6 5-10 5-10Z" /></svg>;
    case "waves":
      return <svg {...commonProps}><path d="M4 8c2 1.4 4 1.4 6 0s4-1.4 6 0 3 1.4 4 0" /><path d="M4 14c2 1.4 4 1.4 6 0s4-1.4 6 0 3 1.4 4 0" /></svg>;
    case "balance":
      return <svg {...commonProps}><path d="M5 12h14" /><path d="M8 8h8" /><circle cx="8" cy="16" r="2" /><circle cx="16" cy="16" r="2" /></svg>;
    case "shield":
    case "sun-shield":
      return <svg {...commonProps}><path d="M12 3 19 6v5c0 4.2-2.7 7.5-7 9-4.3-1.5-7-4.8-7-9V6l7-3Z" /><path d="M12 8v6" /></svg>;
    case "spot":
      return <svg {...commonProps}><circle cx="12" cy="12" r="3" /><path d="M5 8h.01M18 7h.01M7 17h.01M17 16h.01" /></svg>;
    case "dots":
      return <svg {...commonProps}><circle cx="7" cy="8" r="1" /><circle cx="12" cy="7" r="1" /><circle cx="17" cy="8" r="1" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /></svg>;
    case "blush":
      return <svg {...commonProps}><path d="M7 15c1.2 1 2.8 1 4 0" /><path d="M13 15c1.2 1 2.8 1 4 0" /><path d="M8 9h.01M16 9h.01" /></svg>;
    case "sparkle":
      return <svg {...commonProps}><path d="M12 3l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6L12 3Z" /><path d="M18 15l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" /></svg>;
    case "wash":
      return <svg {...commonProps}><path d="M5 15h14" /><path d="M7 18h10" /><path d="M9 6c0 2-2 2-2 4a2 2 0 0 0 4 0c0-2-2-2-2-4Z" /></svg>;
    case "sun":
    case "heat":
      return <svg {...commonProps}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "wind":
      return <svg {...commonProps}><path d="M4 9h10a2 2 0 1 0-2-2" /><path d="M4 14h13a2 2 0 1 1-2 2" /></svg>;
    case "brush":
      return <svg {...commonProps}><path d="M14 4l6 6-8 8-6-6 8-8Z" /><path d="M4 20c2 0 4-.8 5.5-2.5" /></svg>;
    case "gel":
    case "lotion":
    case "cream":
      return <svg {...commonProps}><path d="M8 6h8" /><path d="M9 6v14h6V6" /><path d="M10 3h4v3h-4z" /></svg>;
    case "eye":
      return <svg {...commonProps}><path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2" /></svg>;
    case "weight":
      return <svg {...commonProps}><path d="M7 9h10l2 11H5L7 9Z" /><path d="M9 9a3 3 0 0 1 6 0" /></svg>;
    case "profile":
      return <svg {...commonProps}><circle cx="12" cy="8" r="3" /><path d="M5 20c1.2-3 3.6-5 7-5s5.8 2 7 5" /></svg>;
    case "level-low":
    case "level-medium":
    case "level-high":
      return <svg {...commonProps}><path d="M6 18V12" /><path d="M12 18V8" /><path d="M18 18V5" /></svg>;
    default:
      return <svg {...commonProps}><circle cx="12" cy="12" r="8" /><path d="M12 8v.01M11 12h1v4h1" /></svg>;
  }
}

function SurveyProgress({ stages, currentStage }) {
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.key === currentStage));

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="relative grid grid-cols-5 gap-0">
        <span className="pointer-events-none absolute left-[10%] right-[10%] top-3 h-px bg-[#ead2ca] dark:bg-[#4a303c]" />
        {stages.map((stage, index) => {
          const active = index === currentIndex;
          const done = index < currentIndex;

          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center gap-1.5 text-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold transition ${
                  active || done
                    ? "border-transparent bg-[linear-gradient(90deg,#e76b91_0%,#ff8066_100%)] text-white dark:bg-[linear-gradient(90deg,#ef6387_0%,#ff8068_100%)]"
                    : "border-[#ead2ca] bg-[#fffaf6]/70 text-[#9b7280] opacity-80 dark:border-white/15 dark:bg-white/[0.035] dark:text-[#9e7f8c]"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={`mt-0.5 rounded-full px-1 text-[9px] font-semibold leading-4 ${
                  active
                    ? "bg-[#fff4f1] text-[#28121b] dark:bg-[#160d13] dark:text-[#fff8f3]"
                    : "bg-[#fff4f1] text-[#9b7280] dark:bg-[#160d13] dark:text-[#9e7f8c]"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OptionButton({ option, selected, onClick, multiple, selectedText, compact }) {
  const iconKey = option.visualKey || OPTION_ICON_KEYS[option.value] || "question";
  const checkClassName = `option-check-pop flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[linear-gradient(90deg,#df4776_0%,#ff7666_100%)] text-[10px] font-bold text-white shadow-sm ring-1 ring-white/50 transition duration-200 ${
    selected ? "scale-100 opacity-100" : "scale-75 opacity-0"
  }`;

  if (!compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`group relative min-h-[128px] rounded-[1.25rem] border px-3.5 py-4 text-center transition duration-200 ease-out will-change-transform hover:-translate-y-0.5 active:scale-[0.99] ${
          selected
            ? "-translate-y-0.5 border-[#dc4775] bg-[linear-gradient(135deg,rgba(244,96,130,0.12),rgba(255,119,93,0.065))] shadow-[0_12px_28px_rgba(231,107,145,0.10)] ring-1 ring-[#e76b91]/18 dark:border-[#ef6387] dark:bg-[linear-gradient(135deg,rgba(244,96,130,0.11),rgba(255,119,93,0.055))] dark:ring-[#ef6387]/10"
            : "border-[#ead2ca] bg-[#fffaf6]/70 hover:border-[#dbaea4] hover:bg-white dark:border-white/[0.13] dark:bg-white/[0.04] dark:hover:border-[#6a4050] dark:hover:bg-white/[0.06]"
        }`}
      >
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center">
          <span
            className={checkClassName}
            aria-label={selected ? selectedText : undefined}
          >
            ✓
          </span>
        </span>

        <span className="flex h-full min-h-[96px] flex-col items-center justify-center gap-3.5">
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full border transition duration-200 ${
              selected
                ? "border-[#df527c]/32 bg-white/42 text-[#df527c] shadow-[inset_0_0_18px_rgba(231,107,145,0.08)] dark:border-[#ef6387]/32 dark:bg-white/[0.04] dark:text-[#ff9aa8]"
                : "border-[#ead2ca]/70 bg-white/18 text-[#9b7280]/48 dark:border-white/[0.085] dark:bg-white/[0.022] dark:text-[#d7c1c7]/42"
            }`}
          >
            <MiniIcon type={iconKey} className="h-8 w-8" />
          </span>
          <span className="block max-w-full break-keep text-[16px] font-bold leading-5 tracking-[-0.01em] text-[#1f1016] dark:text-[#fffaf7]">
            {option.label}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative min-h-[46px] rounded-[1.05rem] border px-3 py-2.5 text-left transition duration-200 ease-out will-change-transform hover:-translate-y-0.5 active:scale-[0.99] ${
        selected
          ? "-translate-y-0.5 border-[#dc4775] bg-[linear-gradient(135deg,rgba(244,96,130,0.16),rgba(255,119,93,0.09))] shadow-[0_10px_24px_rgba(231,107,145,0.12)] ring-1 ring-[#e76b91]/25 dark:border-[#ef6387] dark:bg-[linear-gradient(135deg,rgba(244,96,130,0.14),rgba(255,119,93,0.075))] dark:ring-[#ef6387]/10"
          : "border-[#ead2ca] bg-[#fffaf6]/78 hover:border-[#dbaea4] hover:bg-white dark:border-white/[0.15] dark:bg-white/[0.055] dark:hover:border-[#6a4050] dark:hover:bg-white/[0.075]"
      }`}
    >
      <span className="grid grid-cols-[26px_minmax(0,1fr)_24px] items-center gap-2.5">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition duration-200 ${
            selected
              ? "scale-[1.02] border-[#df527c]/35 bg-white/45 text-[#df527c]/55 dark:border-[#ef6387]/35 dark:bg-white/[0.045] dark:text-[#ff9aa8]/55"
              : "border-[#ead2ca]/80 bg-white/25 text-[#9b7280]/45 dark:border-white/[0.09] dark:bg-white/[0.025] dark:text-[#d7c1c7]/45"
          }`}
        >
          <MiniIcon type={iconKey} className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block whitespace-normal break-keep text-[14.5px] font-bold leading-5 tracking-[-0.01em] text-[#1f1016] dark:text-[#fffaf7]">
            {option.label}
          </span>
          {option.description ? (
            <span className="option-description-single mt-0.5 block text-[11px] leading-4 text-[#6d4856]/78 dark:text-[#d7c1c7]/82">
              {option.description}
            </span>
          ) : null}
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          <span
            className={checkClassName}
            aria-label={selected ? selectedText : undefined}
          >
            ✓
          </span>
        </span>
      </span>
    </button>
  );
}

function OptionGrid({ question, form, onChange, copy, onMessage }) {
  const value = getAnswerValue(form, question.id);
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const compact = question.type === "multiple" || question.options.length >= 5 || COMPACT_QUESTION_IDS.has(question.id);
  const gridClass = compact
    ? "grid-cols-1 gap-2 sm:grid-cols-2"
    : question.options.length <= 3
      ? "grid-cols-1 gap-2.5"
      : "grid-cols-2 gap-2.5";

  const toggleOption = (optionValue) => {
    if (question.type === "multiple") {
      const nextValues = values.includes(optionValue)
        ? values.filter((item) => item !== optionValue)
        : [...values, optionValue];

      if (question.maxSelect && nextValues.length > question.maxSelect) {
        onMessage(copy.maxSelect(question.maxSelect));
        return;
      }

      onMessage("");
      onChange(question.id, nextValues);
      return;
    }

    onMessage("");
    onChange(question.id, optionValue);
  };

  return (
    <div className={`grid ${gridClass}`}>
      {question.options.map((option) => (
        <OptionButton
          key={`${question.id}-${option.value}`}
          option={option}
          selected={values.includes(option.value)}
          multiple={question.type === "multiple"}
          selectedText={copy.selected}
          compact={compact}
          onClick={() => toggleOption(option.value)}
        />
      ))}
    </div>
  );
}

function SurveyQuestionCard({ question, form, onChange, copy, onMessage, locale }) {
  const highlightText = question.highlightText || QUESTION_HIGHLIGHTS[locale]?.[question.id];

  return (
    <article className="ui-card-subtle p-3.5 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-chip-compact text-[10px]">
              {question.type === "multiple" ? copy.multiple : question.required ? copy.required : copy.optional}
            </span>
            {question.maxSelect ? (
              <span className="ui-chip-compact text-[10px]">
                {copy.maxSelect(question.maxSelect)}
              </span>
            ) : null}
          </div>
          <h3 className="ui-title mt-2.5 text-[1.5rem] leading-[1.16] sm:text-[1.62rem]">
            {renderHighlightedTitle(question.title, highlightText)}
          </h3>
          {question.subtitle ? (
            <p className="ui-text-secondary mt-1.5 text-[13px] leading-5 sm:text-sm sm:leading-6">
              {question.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <OptionGrid
          question={question}
          form={form}
          onChange={onChange}
          copy={copy}
          onMessage={onMessage}
        />
      </div>
    </article>
  );
}

function SurveyHintPanel({ hint, locale }) {
  const label = locale === "en" ? "AI note" : "AI 메모";

  return (
    <aside className="rounded-[1rem] border border-[#ead2ca]/70 bg-[linear-gradient(135deg,rgba(255,248,243,0.70),rgba(255,240,241,0.48))] px-3.5 py-2.5 dark:border-white/[0.10] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(239,99,135,0.035))]">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ead2ca] bg-white/70 text-[#e76b91] dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-[#ff9aa8]">
          <MiniIcon type="sparkle" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d5b6b] dark:text-[#9e7f8c]">
            {label}
          </p>
          <p className="ui-text-secondary mt-0.5 text-xs leading-5">
            {hint}
          </p>
        </div>
      </div>
    </aside>
  );
}

export default function SurveyFlow({ locale = "ko", form, onAnswerChange, onBackToPhoto, onComplete, error }) {
  const copy = FLOW_COPY[locale] || FLOW_COPY.ko;
  const screens = useMemo(() => QUESTION_SCREENS[locale] || QUESTION_SCREENS.ko, [locale]);
  const questions = useMemo(() => (
    screens.flatMap((screen) => screen.questions.map((question) => ({
      ...question,
      screenId: screen.id,
      stage: screen.stage,
      hint: screen.hint
    })))
  ), [screens]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [message, setMessage] = useState("");
  const currentQuestion = questions[questionIndex] || questions[0];
  const totalQuestions = questions.length;
  const currentStageLabel = copy.stages.find((stage) => stage.key === currentQuestion.stage)?.label || currentQuestion.stage;

  const screenIsValid = currentQuestion.required ? hasAnswer(currentQuestion, form) : true;

  const scrollToTop = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = () => {
    if (!screenIsValid) {
      setMessage(copy.needAnswer);
      return;
    }

    setMessage("");

    if (questionIndex >= questions.length - 1) {
      onComplete();
      return;
    }

    setQuestionIndex((current) => current + 1);
    scrollToTop();
  };

  const handleBack = () => {
    setMessage("");

    if (questionIndex === 0) {
      onBackToPhoto();
      return;
    }

    setQuestionIndex((current) => current - 1);
    scrollToTop();
  };

  return (
    <section className="flex flex-1 flex-col pt-1">
      <div className="space-y-3">
        <div className="text-center">
          <span className="ui-chip-soft text-[10px]">{copy.badge}</span>
          <h2 className="ui-title mx-auto mt-2 max-w-xs text-[1.42rem] leading-[1.14] sm:max-w-sm sm:text-[1.65rem]">
            {copy.headline}
            <span className="block bg-[linear-gradient(90deg,#e76b91_0%,#ff8066_100%)] bg-clip-text text-transparent dark:bg-[linear-gradient(90deg,#ef6387_0%,#ff8068_100%)]">
              {copy.headlineAccent}
            </span>
          </h2>
          <p className="ui-text-secondary mx-auto mt-1 max-w-sm text-[11.5px] leading-5 sm:text-sm sm:leading-6">
            {copy.description}
          </p>
        </div>

        <SurveyProgress stages={copy.stages} currentStage={currentQuestion.stage} />

        <div className="ui-card p-3 sm:p-4">
          <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
            <span className="rounded-full border border-[#ead2ca] bg-white/45 px-3 py-1 text-[11px] font-semibold text-[#6e4050] backdrop-blur dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-[#f4d7df]">
              {currentStageLabel}
            </span>
            <p className="ui-text-faint text-xs font-semibold tabular-nums">
              {formatProgressNumber(questionIndex + 1)} / {formatProgressNumber(totalQuestions)}
            </p>
          </div>

          <div key={`${currentQuestion.screenId}-${currentQuestion.id}`} className="survey-card-enter">
            <SurveyQuestionCard
              question={currentQuestion}
              form={form}
              onChange={onAnswerChange}
              copy={copy}
              onMessage={setMessage}
              locale={locale}
            />
          </div>

          <div className="mt-2.5">
            <SurveyHintPanel hint={currentQuestion.hint} locale={locale} />
          </div>

          {message || error ? (
            <p className="ui-text-danger mt-4 text-sm font-medium">
              {message || error}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-[0.38fr_0.62fr] gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="ui-button-secondary px-4 py-3 text-sm font-semibold"
          >
            {copy.back}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="ui-button-primary px-5 py-3 text-sm font-semibold"
          >
            {questionIndex >= questions.length - 1 ? copy.startAnalyze : copy.next}
          </button>
        </div>
      </div>

      <style jsx>{`
        .survey-card-enter {
          animation: survey-card-enter 220ms ease;
        }

        :global(.option-check-pop) {
          animation: option-check-pop 180ms ease-out;
        }

        :global(.option-description-clamp) {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        :global(.option-description-single) {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @keyframes survey-card-enter {
          from {
            opacity: 0;
            transform: translateY(14px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes option-check-pop {
          from {
            opacity: 0.3;
            transform: scale(0.85);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </section>
  );
}
