const TEST_PHOTO_URL = "/test-assets/kakao-test-face.png";

function product(overrides = {}) {
  return {
    id: overrides.id || "test-product",
    name: overrides.name || "다이브인 저분자 히알루론산 세럼",
    brand: overrides.brand || "토리든",
    category: overrides.category || "serum",
    step: overrides.step || "serum_ampoule",
    concerns: overrides.concerns || ["pores", "oiliness", "dehydration"],
    matched_signals: overrides.matched_signals || {
      pores: true,
      oiliness: true,
      dehydration: true
    },
    texture: overrides.texture || "light",
    finish: overrides.finish || "fresh",
    sensitivity_safe: overrides.sensitivity_safe ?? true,
    irritation_risk: overrides.irritation_risk || "low",
    price_range: overrides.price_range || "$$",
    image_url: overrides.image_url || "",
    buy_link: overrides.buy_link || "",
    reason: overrides.reason || "사진과 설문 흐름에서 번들거림과 수분 부족감이 함께 보여, 무겁지 않은 수분 세럼을 먼저 두는 구성이 안정적입니다.",
    explanation: overrides.explanation || "피부 표면은 가볍게 정돈하면서 수분감을 보완하는 역할이라 아침과 저녁 루틴에 모두 연결하기 쉽습니다.",
    why_picked: overrides.why_picked || "유분감과 수분감의 균형을 맞추는 데 먼저 쓰기 좋은 제품입니다.",
    ...overrides
  };
}

const topPick = product({
  id: "test-torriden-dive-in-serum",
  name: "다이브인 저분자 히알루론산 세럼",
  brand: "토리든",
  category: "serum",
  step: "serum_ampoule"
});

const lightToner = product({
  id: "test-anua-heartleaf-toner",
  name: "어성초 77 수딩 토너",
  brand: "아누아",
  category: "toner_essence",
  step: "toner_essence",
  concerns: ["pores", "oiliness", "redness"],
  matched_signals: { pores: true, oiliness: true, redness: true },
  price_range: "$",
  reason: "번들거림이 먼저 올라오는 날에는 세럼 전에 결을 가볍게 정리하는 대안으로 볼 수 있습니다.",
  explanation: "토너 단계에서 얇게 깔아 다음 단계 부담을 낮추는 역할입니다."
});

const cleanser = product({
  id: "test-cosrx-cleanser",
  name: "약산성 굿모닝 젤 클렌저",
  brand: "코스알엑스",
  category: "cleanser",
  step: "cleanser",
  concerns: ["oiliness", "pores", "barrier"],
  matched_signals: { oiliness: true, pores: true, barrier: true },
  price_range: "$",
  reason: "저녁에는 피지와 선크림 잔여감을 부드럽게 정리하는 클렌저 축으로 쓰기 좋습니다.",
  explanation: "세안 강도를 올리기보다 짧고 가볍게 정리하는 쪽에 맞춘 제품입니다."
});

const sunscreen = product({
  id: "test-roundlab-sunscreen",
  name: "자작나무 수분 선크림",
  brand: "라운드랩",
  category: "sunscreen",
  step: "sunscreen",
  concerns: ["uv", "dehydration", "barrier"],
  matched_signals: { uv: true, dehydration: true, barrier: true },
  price_range: "$$",
  reason: "아침에는 수분감이 끊기지 않게 마무리하면서 야외 노출을 대비하는 선택지입니다.",
  explanation: "가볍게 마무리되는 선케어 단계로 연결하기 좋습니다."
});

const faceLab = {
  base_data: {
    face_shape: "balanced oval",
    landmarks: ["eye focus", "balanced lower face", "soft jaw line"]
  },
  features: {
    face_shape_hairstyle: {
      summary: "눈의 집중도가 또렷하고 얼굴선은 균형형 타원 흐름으로 보입니다.",
      recommendations: [
        "윗선은 가볍게 살리고 옆라인은 과하게 넓히지 않는 스타일이 안정적입니다.",
        "중간 길이 레이어와 자연스러운 앞머리 흐름이 잘 맞습니다."
      ],
      avoid: [
        "너무 무거운 앞머리나 넓은 옆볼륨은 얼굴 중심선을 가릴 수 있습니다."
      ]
    },
    color_tone_recommendation: {
      palette: ["soft beige", "peach", "coral", "cream"],
      recommendations: [
        "부드러운 베이지와 피치 톤을 기본으로 두면 인상이 깨끗하게 정리됩니다."
      ],
      avoid: [
        "강한 대비의 원색을 넓게 쓰기보다 작은 포인트로 제한합니다."
      ]
    }
  }
};

const premiumReport = {
  topPickDetailedReason: "톤과 유분 흐름이 함께 보이는 상태라, 무거운 보정 제품보다 가볍게 수분을 보완하는 세럼 축을 먼저 두는 편이 안정적입니다.",
  topPickReasonBlocks: [
    {
      key: "why",
      label: "왜 1순위인지",
      body: "번들거림과 수분 부족감이 같이 보이므로, 루틴을 무겁게 늘리기보다 얇은 수분 세럼을 먼저 두는 구성이 맞습니다."
    },
    {
      key: "evidence",
      label: "사진/설문 근거",
      body: "사진에서는 T존의 유분 표현과 볼 쪽 수분감 저하가 함께 보이고, 설문에서는 산뜻한 마무리를 선호하는 흐름으로 잡았습니다."
    },
    {
      key: "usage",
      label: "사용 방향",
      body: "토너 다음 단계에서 소량만 먼저 사용하고, 답답한 날에는 같은 단계의 더 가벼운 제품으로 조절합니다."
    }
  ],
  currentProducts: {
    selections: [
      {
        category: "sunscreen",
        status: "not_in_db"
      },
      {
        category: "moisturizer",
        status: "not_using"
      },
      {
        category: "cleanser",
        status: "selected",
        productId: "test-current-cleanser",
        productSnapshot: {
          id: "test-current-cleanser",
          brand: "Test Brand",
          name: "Current Cleanser",
          category: "cleanser",
          product_form: "",
          image_url: ""
        }
      },
      {
        category: "serum",
        status: "selected",
        productId: "missing-current-serum",
        productSnapshot: null
      }
    ],
    summary: {
      total: 4,
      selectedCount: 2,
      notInDbCount: 1,
      notUsingCount: 1,
      sunscreenStatus: "not_in_db"
    }
  },
  supportingProducts: [
    {
      role: "same_role_alternative",
      roleLabel: "같은 역할 대체 · 토너/에센스",
      product: lightToner,
      reason: "세럼 사용감이 부담스러운 날에는 토너 단계에서 결을 먼저 정리하는 대안입니다.",
      usage: "세안 직후 얇게 한 번만 바르고 다음 단계는 줄입니다.",
      relationToTopPick: "1순위 제품보다 더 가볍게 시작하고 싶을 때 같은 흐름 안에서 바꿔 볼 수 있습니다."
    },
    {
      role: "supporting_concern",
      roleLabel: "보조 고민 보완 · 클렌저",
      product: cleanser,
      reason: "피지와 잔여감이 쌓인 저녁에는 세안 단계에서 먼저 정리하는 역할입니다.",
      usage: "저녁에 짧게 사용하고, 뽀득하게 문지르지 않습니다.",
      relationToTopPick: "세럼이 보완 단계라면 이 제품은 루틴의 시작점을 정리하는 역할입니다."
    },
    {
      role: "supporting_concern",
      roleLabel: "아침 보호 · 선케어",
      product: sunscreen,
      reason: "아침에는 수분감과 자외선 보호를 함께 유지하는 마무리 단계입니다.",
      usage: "아침 마지막 단계에서 충분히 바르고 야외 시간이 길면 덧바릅니다.",
      relationToTopPick: "1순위 제품으로 수분감을 잡은 뒤 낮 시간 보호를 이어주는 선택지입니다."
    }
  ],
  fullRoutine: {
    morning: [
      "가벼운 세안 후 토너로 결을 정리합니다.",
      "세럼은 소량만 두고 선크림으로 마무리합니다."
    ],
    night: [
      "클렌저로 선크림과 피지 잔여감을 부드럽게 정리합니다.",
      "토너 다음 세럼을 얇게 바르고 보습은 답답하지 않게 마무리합니다."
    ],
    morningSteps: [
      {
        order: 1,
        stepName: "가벼운 정리",
        productRole: "toner_essence",
        product: lightToner,
        instruction: "수분감이 끊기지 않게 얇게 깔아줍니다.",
        frequency: "매일 아침",
        caution: "여러 보조 제품을 겹치지 않습니다."
      },
      {
        order: 2,
        stepName: "수분 보완",
        productRole: "serum_ampoule",
        product: topPick,
        instruction: "토너 다음 단계에서 소량만 사용합니다.",
        frequency: "필요 시",
        caution: "답답하면 양을 줄입니다."
      },
      {
        order: 3,
        stepName: "보호 마무리",
        productRole: "sunscreen",
        product: sunscreen,
        instruction: "아침 마지막 단계에서 충분히 바릅니다.",
        frequency: "매일 아침",
        caution: "야외 시간이 길면 덧바릅니다."
      }
    ],
    nightSteps: [
      {
        order: 1,
        stepName: "세안",
        productRole: "cleanser",
        product: cleanser,
        instruction: "선크림과 피지를 남김 없이 부드럽게 정리합니다.",
        frequency: "매일 저녁",
        caution: "뽀득하게 벗겨내는 세안은 피합니다."
      },
      {
        order: 2,
        stepName: "결 정리",
        productRole: "toner_essence",
        product: lightToner,
        instruction: "피부 표면을 얇게 정리합니다.",
        frequency: "매일 저녁",
        caution: "패드 사용은 마찰을 줄입니다."
      },
      {
        order: 3,
        stepName: "수분 보완",
        productRole: "serum_ampoule",
        product: topPick,
        instruction: "건조한 부위 중심으로 얇게 사용합니다.",
        frequency: "필요 시",
        caution: "같은 밤 여러 활성 제품과 겹치지 않습니다."
      }
    ]
  },
  routineVariants: [
    {
      title: "야외 외출이 긴 날",
      items: [
        "선크림 지속력과 덧바르기 편한 루틴을 우선합니다.",
        "앞단 보습을 두껍게 만들지 않습니다.",
        "자외선 노출을 막겠다고 루틴을 과하게 겹치지 않습니다."
      ]
    },
    {
      title: "예민한 날",
      items: [
        "기능성 단계보다 진정과 보습을 먼저 봅니다.",
        "각질 케어나 고기능 제품은 줄입니다.",
        "새 제품을 추가하지 말고 사용량을 줄입니다."
      ]
    },
    {
      title: "트러블이 올라온 날",
      items: [
        "전체 얼굴을 강하게 관리하지 말고 올라온 부위만 가볍게 봅니다.",
        "리치한 보습과 두꺼운 베이스는 줄입니다.",
        "스팟 케어와 강한 세럼을 같은 밤에 겹치지 않습니다."
      ]
    },
    {
      title: "메이크업 하는 날",
      items: [
        "밀림을 줄이기 위해 스킨케어 단계를 얇게 가져갑니다.",
        "미끌거리는 세럼과 리치한 크림은 줄입니다.",
        "선크림이 자리 잡은 뒤 베이스를 올립니다."
      ]
    }
  ],
  avoidCombinations: [
    "강한 클렌징 + 마찰 큰 패드",
    "건조한 세정감 + 매트한 마무리",
    "세럼 + 리치 보습제 + 선크림 + 베이스를 쉬는 시간 없이 겹치기"
  ],
  budgetAlternatives: [
    lightToner,
    cleanser,
    sunscreen
  ],
  routineStructure: {
    type: "am_pm",
    label: "AM / PM 전략"
  }
};

export function buildTestSubmission() {
  return {
    imageName: "KakaoTalk_20260519_103509611.png",
    imagePreviewDataUrl: TEST_PHOTO_URL,
    form: {
      skinType: "combination",
      mainConcern: "pores",
      secondaryConcerns: ["oiliness", "dehydration"],
      preferredFinish: "fresh",
      sensitivity: "low",
      sunscreenPreference: ["lightweight", "no_pilling"]
    }
  };
}

export function buildTestResult() {
  return {
    meta: {
      source: "test_fixture",
      mocked: true
    },
    skinType: "combination",
    topCategory: "serum_ampoule",
    priority: {
      axis: "pores",
      label: "모공",
      score: 84
    },
    routineStructure: {
      type: "am_pm",
      label: "AM / PM 전략"
    },
    directionSummary: "사진에서는 T존의 유분 표현과 볼 쪽 수분감 저하가 함께 보여, 무겁게 덮기보다 얇은 수분 보완과 산뜻한 마무리를 우선으로 잡았습니다.",
    photoObservations: {
      summary: "사진 기준으로 T존에는 유분 표현이 약하게 보이고, 볼 주변은 수분감이 조금 낮아 보입니다.",
      signals: [
        {
          key: "oiliness",
          label: "유분 표현",
          area: "T존",
          confidence: "medium",
          description: "이마와 코 주변에 유분 표현이 약하게 보입니다."
        },
        {
          key: "dehydration",
          label: "수분감 저하",
          area: "볼 주변",
          confidence: "low",
          description: "볼 주변은 상대적으로 건조해 보이는 경향이 있습니다."
        }
      ],
      surveyAlignment: {
        status: "mixed",
        note: "설문에서는 산뜻한 마무리를 선호했고, 사진에서도 유분 표현과 수분감 저하가 함께 보여 복합적인 방향으로 정리했습니다."
      }
    },
    topPick,
    alternative: lightToner,
    categoryPicks: [lightToner, cleanser, sunscreen],
    altPicks: [lightToner, cleanser, sunscreen],
    budgetAlternatives: [lightToner, cleanser, sunscreen],
    morning: premiumReport.fullRoutine.morning,
    night: premiumReport.fullRoutine.night,
    avoid: premiumReport.avoidCombinations,
    faceLab,
    premiumReport
  };
}

export function seedTestResultSession() {
  if (typeof window === "undefined") {
    return;
  }

  const submission = buildTestSubmission();
  const result = buildTestResult();

  window.sessionStorage.setItem("skinTestSubmission", JSON.stringify(submission));
  window.sessionStorage.setItem("skinTestResult", JSON.stringify(result));
  window.sessionStorage.setItem("skinTestFaceLabFull", JSON.stringify(faceLab));
}
