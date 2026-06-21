export const INITIAL_FORM = {
  skinType: "",
  sensitivity: "",
  genderPreference: "unspecified",
  mainConcern: "",
  mainConcerns: [],
  cleansingFrequency: "",
  preferredTexture: "",
  postWashFeeling: "",
  afternoonSkinChange: "",
  environmentExposure: [],
  mostDislikedFeel: "",
  whiteCastHate: false,
  toneUpWanted: false,
  makeupUse: false,
  eyeSensitive: false
};

export const OPTIONAL_DEFAULTS = {
  cleansingFrequency: "twice",
  preferredTexture: "lotion",
  postWashFeeling: "comfortable",
  afternoonSkinChange: "mostly_same",
  environmentExposure: [],
  mostDislikedFeel: "sticky"
};

export const ONBOARDING_COPY = {
  ko: {
    intro: {
      badge: "Skin Match",
      title: "내 피부에 맞는 K-뷰티 루틴, 지금 바로 진단",
      description: "사진 1장과 몇 가지 질문으로 맞춤 루틴을 찾아드립니다."
    },
    description: {
      title: "진단은 이렇게 진행됩니다",
      description: "지금 필요한 정보만 짧게 보고, 다음 단계로 바로 넘어가면 됩니다.",
      points: [
        {
          title: "피부 상태 분석",
          body: "사진과 핵심 답변을 바탕으로 지금 피부 흐름을 정리합니다."
        },
        {
          title: "맞춤 제품 추천",
          body: "가장 먼저 시작할 제품과 함께 보면 좋은 추천을 나눠서 보여줍니다."
        },
        {
          title: "아침/저녁 루틴 가이드",
          body: "지금 바로 따라가기 쉬운 루틴 순서까지 한 번에 정리합니다."
        }
      ]
    },
    photo: {
      eyebrow: "STEP 1",
      title: "정면 얼굴 사진을 업로드해주세요.",
      description: "밝은 곳에서 찍은 정면 사진일수록 더 안정적으로 분석됩니다.",
      helper: "JPG, PNG, WEBP 지원",
      uploaded: "업로드 완료",
      change: "사진 바꾸기",
      remove: "삭제",
      empty: "사진을 올리면 다음 단계로 넘어갈 수 있어요."
    },
    basic: {
      eyebrow: "STEP 2",
      title: "핵심 정보만 먼저 알려주세요",
      description: "결과 품질에 가장 크게 영향을 주는 항목만 먼저 받습니다.",
      skinType: "피부 타입",
      sensitivity: "민감도",
      mainConcern: "주요 고민",
      multiSelectHint: "복수 선택 가능"
    },
    extra: {
      eyebrow: "STEP 3",
      title: "선택 입력으로 결과를 조금 더 다듬을게요",
      description: "건너뛰어도 진단은 가능합니다. 입력하면 추천이 더 세밀해집니다.",
      preferredTexture: "선호 사용감",
      postWashFeeling: "세안 직후 느낌",
      afternoonSkinChange: "오후 피부 변화",
      mostDislikedFeel: "가장 싫은 사용감",
      cleansingFrequency: "세안 빈도",
      environmentToggle: "피부가 예민해질 수 있는 특수 환경이 있다면 추가하기",
      environmentDescription: "해당되는 환경만 가볍게 체크해주세요.",
      environmentExposure: "환경 노출"
    },
    loading: {
      title: "당신의 피부에 맞는 루틴을 분석 중입니다...",
      description: "피부 프로필과 추천 루틴을 정리하고 있어요."
    },
    faceLab: {
      title: "Face Lab",
      description: "사진 한 장으로 얼굴형, 인상 흐름, 닮은 분위기까지 가볍게 확인해보세요.",
      button: "Face Lab 보기",
      loading: "Face Lab 분석 중...",
      spinner: "Face Lab 결과를 생성하고 있습니다...",
      errorLoad: "Face Lab 결과를 불러오지 못했습니다."
    },
    topActions: {
      faceLab: "Face Lab",
      skinMatch: "Skin Match"
    },
    cta: {
      start: "시작하기",
      next: "다음",
      analyze: "진단 시작하기",
      back: "이전",
      skip: "건너뛰기"
    },
    progress: {
      stepLabel: "STEP"
    },
    errors: {
      needPhoto: "사진을 먼저 업로드해주세요.",
      completeBasicSurvey: "핵심 질문을 먼저 선택해주세요.",
      analyzeFailed: "결과 생성에 실패했습니다.",
      productSourceUnavailable: "추천 제품 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      unexpected: "예상하지 못한 오류가 발생했습니다."
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
    },
    faceLabLoading: "Face Lab 분석 중...",
    faceLabButton: "Face Lab 보기",
    faceLabSpinner: "Face Lab 결과를 생성하고 있습니다...",
    optionLabels: {
      skinType: {
        oily: "지성",
        dry: "건성",
        combination: "복합성",
        not_sure: "잘 모르겠음"
      },
      sensitivity: {
        low: "낮음",
        medium: "보통",
        high: "높음"
      },
      mainConcern: {
        oiliness: "유분",
        dehydration: "건조",
        acne: "트러블",
        uneven_tone: "톤 불균일",
        pores: "모공",
        redness: "붉은기",
        barrier: "장벽 약화"
      },
      preferredTexture: {
        gel: "가벼운 젤",
        watery: "워터 타입",
        lotion: "로션 타입",
        cream: "크림 타입"
      },
      postWashFeeling: {
        tight: "당김이 남음",
        comfortable: "편안함",
        still_oily: "세안 직후에도 번들거림"
      },
      afternoonSkinChange: {
        more_oily: "오후에 더 번들거림",
        more_dry: "오후에 더 건조함",
        red_or_irritated: "오후에 더 예민해짐",
        mostly_same: "큰 변화 없음"
      },
      mostDislikedFeel: {
        sticky: "끈적임",
        greasy: "번들거림",
        heavy: "무거운 느낌",
        fragranced: "강한 향",
        pilling: "밀림"
      },
      cleansingFrequency: {
        once: "하루 1회",
        twice: "하루 2회",
        "3_plus": "하루 3회 이상"
      },
      environmentExposure: {
        heat: "더운 환경",
        humidity: "습한 환경",
        mask: "마스크 착용",
        kitchen: "주방/열기 노출",
        outdoor: "야외 활동",
        aircon: "에어컨 바람"
      }
    }
  },
  en: {
    intro: {
      badge: "Skin Match",
      title: "A K-beauty routine matched to your skin, in minutes",
      description: "Upload one photo and answer a few questions to find your routine."
    },
    description: {
      title: "Here is what the diagnosis gives you",
      description: "Only the essentials, one step at a time.",
      points: [
        {
          title: "Skin condition analysis",
          body: "We organize your current skin flow from the photo and core answers."
        },
        {
          title: "Personalized product picks",
          body: "You get one top pick first, then a short list of supporting options."
        },
        {
          title: "Morning and night routine guide",
          body: "We turn the recommendation into a practical routine you can actually follow."
        }
      ]
    },
    photo: {
      eyebrow: "STEP 1",
      title: "Please upload a front-facing face photo.",
      description: "A bright front-facing photo gives the most stable result.",
      helper: "JPG, PNG, WEBP supported",
      uploaded: "Uploaded",
      change: "Change photo",
      remove: "Remove",
      empty: "Upload a photo to continue."
    },
    basic: {
      eyebrow: "STEP 2",
      title: "Tell us the essentials first",
      description: "These answers shape the result the most.",
      skinType: "Skin type",
      sensitivity: "Sensitivity",
      genderPreference: "Gender (optional)",
      mainConcern: "Main concern",
      multiSelectHint: "Multiple selection allowed"
    },
    extra: {
      eyebrow: "STEP 3",
      title: "A few optional details can refine the result",
      description: "You can skip this step, but filling it in helps the recommendation feel tighter.",
      preferredTexture: "Preferred texture",
      postWashFeeling: "After-cleansing feel",
      afternoonSkinChange: "Afternoon skin change",
      mostDislikedFeel: "Most disliked feel",
      cleansingFrequency: "Cleansing frequency",
      environmentToggle: "Add if you have special environments that can trigger sensitivity",
      environmentDescription: "Only select what really applies.",
      environmentExposure: "Environment exposure"
    },
    loading: {
      title: "Analyzing a routine that fits your skin...",
      description: "We are organizing your skin profile and routine now."
    },
    faceLab: {
      title: "Face Lab",
      description: "Use one photo to check face shape, overall vibe, and look-alike references.",
      button: "Open Face Lab",
      loading: "Analyzing Face Lab...",
      spinner: "Generating your Face Lab result...",
      errorLoad: "Could not load the Face Lab result."
    },
    topActions: {
      faceLab: "Face Lab",
      skinMatch: "Skin Match"
    },
    cta: {
      start: "Start",
      next: "Next",
      analyze: "Start Diagnosis",
      back: "Back",
      skip: "Skip"
    },
    progress: {
      stepLabel: "STEP"
    },
    errors: {
      needPhoto: "Please upload a photo first.",
      completeBasicSurvey: "Please answer the core questions first.",
      analyzeFailed: "Failed to generate the result.",
      productSourceUnavailable: "We could not load recommendation products. Please try again shortly.",
      unexpected: "Something unexpected went wrong."
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
    },
    faceLabLoading: "Analyzing Face Lab...",
    faceLabButton: "Open Face Lab",
    faceLabSpinner: "Generating your Face Lab result...",
    optionLabels: {
      skinType: {
        oily: "Oily",
        dry: "Dry",
        combination: "Combination",
        not_sure: "Not sure"
      },
      genderPreference: {
        female: "Female",
        male: "Male",
        unspecified: "Prefer not to say"
      },
      sensitivity: {
        low: "Low",
        medium: "Medium",
        high: "High"
      },
      mainConcern: {
        oiliness: "Oiliness",
        dehydration: "Dehydration",
        acne: "Breakouts",
        uneven_tone: "Uneven tone",
        pores: "Pores",
        redness: "Redness",
        barrier: "Barrier"
      },
      preferredTexture: {
        gel: "Light gel",
        watery: "Watery",
        lotion: "Lotion",
        cream: "Cream"
      },
      postWashFeeling: {
        tight: "Feels tight",
        comfortable: "Feels comfortable",
        still_oily: "Still oily after cleansing"
      },
      afternoonSkinChange: {
        more_oily: "More oily",
        more_dry: "More dry",
        red_or_irritated: "More reactive",
        mostly_same: "Mostly the same"
      },
      mostDislikedFeel: {
        sticky: "Sticky",
        greasy: "Greasy",
        heavy: "Heavy",
        fragranced: "Strong fragrance",
        pilling: "Pilling"
      },
      cleansingFrequency: {
        once: "Once a day",
        twice: "Twice a day",
        "3_plus": "3+ times a day"
      },
      environmentExposure: {
        heat: "Heat",
        humidity: "Humidity",
        mask: "Mask",
        kitchen: "Kitchen heat",
        outdoor: "Outdoor time",
        aircon: "Air conditioning"
      }
    }
  }
};

export const OPTION_SETS = {
  skinType: ["oily", "dry", "combination", "not_sure"],
  sensitivity: ["low", "medium", "high"],
  genderPreference: ["female", "male", "unspecified"],
  mainConcern: ["oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"],
  preferredTexture: ["gel", "watery", "lotion", "cream"],
  postWashFeeling: ["tight", "comfortable", "still_oily"],
  afternoonSkinChange: ["more_oily", "more_dry", "red_or_irritated", "mostly_same"],
  mostDislikedFeel: ["sticky", "greasy", "heavy", "fragranced", "pilling"],
  booleanChoice: ["true", "false"],
  sunscreenConsiderations: ["whiteCastHate", "toneUpWanted", "makeupUse", "eyeSensitive"],
  cleansingFrequency: ["once", "twice", "3_plus"],
  environmentExposure: ["heat", "humidity", "mask", "kitchen", "outdoor", "aircon"]
};
