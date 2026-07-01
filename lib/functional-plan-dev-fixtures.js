const BASE_PRODUCTS = {
  poreSerum: {
    id: "dev-pore-serum",
    brand: "Dev Fixture",
    name: "포어 밸런스 세럼",
    category: "treatment",
    product_form: "serum",
    concerns: ["pores", "oiliness"],
    texture: "가벼운 세럼",
    finish: "산뜻한 마무리",
    priceLabel: "28,000원",
    position: "주요 고민 추천",
    ingredientLabels: ["피지·각질 케어"],
    reason: "모공·피부결 목표에 맞춰 한 가지 기능성 축으로 시작하는 화면용 후보입니다."
  },
  textureAmpoule: {
    id: "dev-texture-ampoule",
    brand: "Dev Fixture",
    name: "텍스처 케어 앰플",
    category: "treatment",
    product_form: "ampoule",
    concerns: ["pores"],
    texture: "워터리 앰플",
    finish: "자연스러운 마무리",
    priceLabel: "36,000원",
    position: "균형형",
    ingredientLabels: ["결 개선 기능성"],
    reason: "피부결 목표를 분리해 낮은 빈도로 확인하는 화면용 후보입니다."
  },
  porePad: {
    id: "dev-pore-pad",
    brand: "Dev Fixture",
    name: "포어 클리어 토너 패드",
    category: "toner_pad",
    concerns: ["pores", "oiliness"],
    texture: "패드",
    finish: "fresh",
    priceLabel: "19,000원",
    position: "가성비",
    ingredientLabels: ["각질 정체 케어"],
    reason: "같은 목표 안에서 토너 패드 포지션을 비교하기 위한 fixture 후보입니다."
  },
  barrierAmpoule: {
    id: "dev-barrier-ampoule",
    brand: "Dev Fixture",
    name: "장벽 진정 앰플",
    category: "treatment",
    product_form: "ampoule",
    concerns: ["barrier", "redness"],
    texture: "워터리",
    finish: "calm",
    priceLabel: "24,000원",
    position: "보조 고민 솔루션",
    ingredientLabels: ["진정·장벽"],
    reason: "주요 고민을 방해하지 않는 보조 안정화 방향을 보여주는 fixture 후보입니다."
  },
  premiumSerum: {
    id: "dev-premium-serum",
    brand: "Dev Fixture",
    name: "프리미엄 결 케어 세럼",
    category: "treatment",
    product_form: "serum",
    concerns: ["pores"],
    texture: "실키 세럼",
    finish: "natural",
    priceLabel: "52,000원",
    position: "프리미엄",
    ingredientLabels: ["결 개선 기능성"],
    reason: "같은 기능성 목표 안에서 높은 가격대 포지션을 비교하기 위한 fixture 후보입니다."
  }
};

const DEFAULT_FUNCTIONAL_PLAN = {
  primaryConcern: "모공·피부결",
  secondaryConcern: "유분 밸런스",
  direction: "피지·각질 정체를 한 가지 기능성 축으로 정리",
  planMode: "START",
  planSummary: "이번에는 모공·피부결 개선을 먼저 잡고, 피지·각질 케어 또는 결 개선 기능성 중 하나만 낮은 빈도로 시작합니다.",
  whyPriority: "설문 점수에서 모공·피부결 신호가 가장 앞서고, 유분 밸런스가 보조 고민으로 따라옵니다.",
  baseApproach: "피부가 안정적인 날 저녁 루틴에서 한 가지 기능성만 분리해 확인합니다.",
  ingredientLabels: ["피지·각질 케어", "결 개선 기능성"],
  productCandidates: [
    BASE_PRODUCTS.poreSerum,
    BASE_PRODUCTS.textureAmpoule,
    BASE_PRODUCTS.porePad
  ],
  secondarySolution: {
    title: "유분 밸런스",
    direction: "피지 조절은 주요 기능성을 방해하지 않는 선에서 가볍게 유지합니다.",
    products: [BASE_PRODUCTS.barrierAmpoule]
  },
  budgetAlternatives: [
    { ...BASE_PRODUCTS.porePad, position: "가성비", priceLabel: "19,000원" },
    { ...BASE_PRODUCTS.poreSerum, position: "균형", priceLabel: "28,000원" },
    { ...BASE_PRODUCTS.premiumSerum, position: "프리미엄", priceLabel: "52,000원" }
  ],
  routineGuide: {
    time: "저녁 루틴",
    order: "세안 → 수분 토너 → 기능성 세럼 → 보습제",
    frequency: "처음 2주는 주 2회",
    avoid: "각질 패드, 스크럽, 다른 결 개선 기능성 중첩",
    review: "3~4주 후 피부가 편안하면 빈도 조정 검토",
    weeklyAction: "이번 주에는 저녁 루틴에서 한 가지 기능성만 낮은 빈도로 확인하세요."
  }
};

function makeScenario(overrides = {}) {
  return {
    id: overrides.id,
    label: overrides.label,
    description: overrides.description || "개발용 기능성 플랜 화면 확인 fixture",
    functionalPlan: {
      ...DEFAULT_FUNCTIONAL_PLAN,
      ...(overrides.functionalPlan || {})
    },
    routineAudit: {
      status: "NO_ROUTINE_DATA",
      title: "현재 제품 점검",
      selectedProduct: null,
      selectedProducts: [],
      hasNotInDb: false,
      message: "제품 선택 없이 계속해 현재 루틴의 적합도와 중복 여부는 점검하지 않았습니다.",
      actionMessage: "추천 플랜은 피부 상태 기준으로만 확인하세요.",
      context: "",
      ...(overrides.routineAudit || {})
    }
  };
}

export const FUNCTIONAL_PLAN_DEV_SCENARIOS = [
  makeScenario({
    id: "start-no-routine-data",
    label: "START + NO_ROUTINE_DATA",
    functionalPlan: {
      planMode: "START"
    }
  }),
  makeScenario({
    id: "start-unknown",
    label: "START + UNKNOWN",
    functionalPlan: {
      planMode: "START"
    },
    routineAudit: {
      status: "UNKNOWN",
      hasNotInDb: true,
      message: "사용 중인 제품은 있지만 기능성 정보를 확인하지 못해 현재 루틴 점검에서는 제외했습니다.",
      actionMessage: "not_in_db 제품명이나 브랜드명으로 기능성을 추정하지 않습니다."
    }
  }),
  makeScenario({
    id: "start-mismatch",
    label: "START + MISMATCH",
    routineAudit: {
      status: "MISMATCH",
      selectedProduct: {
        name: "장벽 진정 앰플",
        category: "세럼/기능성",
        evidence: "DB concerns: 장벽, 붉음"
      },
      message: "현재 제품은 다른 고민 축에는 연결되지만 이번 주요 고민을 직접 다루는 제품은 아닙니다.",
      actionMessage: "현재 제품은 유지하되 주요 고민 보완 후보를 별도로 비교하세요."
    }
  }),
  makeScenario({
    id: "optimize",
    label: "OPTIMIZE",
    routineAudit: {
      status: "OPTIMIZE",
      selectedProduct: {
        name: "포어 밸런스 세럼",
        category: "세럼/기능성",
        evidence: "DB concerns: 모공, 피지"
      },
      message: "현재 사용 중인 제품이 모공·피부결 목표와 연결됩니다.",
      actionMessage: "새 제품을 추가하기보다 현재 제품을 주 2~3회 안정적으로 유지하세요."
    }
  }),
  makeScenario({
    id: "consolidate",
    label: "CONSOLIDATE",
    routineAudit: {
      status: "CONSOLIDATE",
      selectedProduct: {
        name: "포어 밸런스 세럼",
        category: "세럼/기능성",
        evidence: "대표 제품 · DB concerns: 모공"
      },
      selectedProducts: [
        { name: "포어 밸런스 세럼", category: "세럼/기능성", evidence: "DB concerns: 모공" },
        { name: "포어 클리어 토너 패드", category: "토너 패드", evidence: "DB concerns: 모공, 피지" }
      ],
      message: "같은 주요 기능성 축 제품이 여러 개 겹칩니다.",
      actionMessage: "대표 제품 하나를 중심으로 유지하고 같은 목적의 신규 추가는 미루세요."
    }
  }),
  makeScenario({
    id: "hold-no-routine-data",
    label: "HOLD + NO_ROUTINE_DATA",
    functionalPlan: {
      planMode: "HOLD",
      planSummary: "민감도·붉음·장벽 부담이 높아 이번 기간에는 신규 기능성 추가를 보류합니다.",
      baseApproach: "편안한 보습·수분 축을 먼저 고정하고, 모공·피부결 기능성은 피부가 안정된 뒤 다시 검토합니다.",
      routineGuide: {
        time: "이번 기간",
        order: "새 기능성 추가 없이 편안했던 수분·보습 단계 중심으로 유지",
        frequency: "부담 신호가 줄 때까지 기존 편안한 빈도 유지",
        avoid: "각질 패드, 스크럽, 새로운 결 개선 기능성 동시 추가",
        review: "붉음·당김·불편감이 줄면 다음 단계 기능성 검토",
        weeklyAction: "이번 주는 새 후보를 저장하지 않고 피부 안정 여부를 먼저 확인하세요."
      }
    }
  }),
  makeScenario({
    id: "hold-adjust",
    label: "HOLD + ADJUST",
    functionalPlan: {
      planMode: "HOLD",
      planSummary: "현재 피부 부담 신호가 높아 새 기능성 추가보다 사용 방식 조절이 우선입니다.",
      routineGuide: {
        time: "이번 기간",
        order: "현재 루틴에서 편안한 보습·수분 축은 유지하고 기능성 단계는 빈도만 낮춰 확인",
        frequency: "부담이 줄 때까지 주 1~2회 이하로 조절",
        avoid: "토너 패드, 스크럽, 다른 결 개선 기능성 중첩",
        review: "2주 동안 붉음·당김이 줄면 기존 빈도 복귀 여부 검토",
        weeklyAction: "새 제품을 추가하지 말고 현재 제품의 사용 간격부터 조절하세요."
      }
    },
    routineAudit: {
      status: "ADJUST",
      selectedProduct: {
        name: "결 케어 토너 패드",
        category: "토너 패드",
        evidence: "DB concerns: 모공"
      },
      message: "제품이 반드시 문제라고 단정할 수는 없지만 지금 방식은 조절해보세요.",
      actionMessage: "같은 날 스크럽·각질 단계와 겹치지 말고 빈도를 낮춰 확인하세요.",
      context: "민감도·붉음·장벽 부담 신호가 동시에 높은 fixture입니다."
    }
  }),
  makeScenario({
    id: "start-replace-candidate",
    label: "START + REPLACE_CANDIDATE",
    routineAudit: {
      status: "REPLACE_CANDIDATE",
      selectedProduct: {
        name: "고강도 결 케어 세럼",
        category: "세럼/기능성",
        evidence: "DB concerns: 모공 · irritation_risk: high"
      },
      message: "현재 피부 상태와 부담 충돌 가능성이 있어 다음 교체 시점에 다른 방향을 검토해보세요.",
      actionMessage: "바로 사용을 멈추라고 단정하지 않고, 다음 구매 시점에 낮은 부담 후보와 비교하세요.",
      replacementContext: "대체 후보는 같은 기능성 목표 안에서 낮은 빈도 도입을 전제로 비교합니다."
    }
  }),
  makeScenario({
    id: "next-optimize",
    label: "NEXT + OPTIMIZE",
    functionalPlan: {
      primaryConcern: "수분 균형",
      secondaryConcern: "모공·피부결",
      direction: "수분·보습·장벽 균형",
      planMode: "NEXT",
      planSummary: "현재 주요 우선순위는 수분 균형이며, 모공·피부결 기능성은 다음 단계로 남겨둡니다.",
      whyPriority: "속건조와 장벽 신호가 먼저 보여 이번 주는 수분 균형을 우선합니다.",
      baseApproach: "현재 잘 맞는 기능성 제품은 유지하되 새 기능성 확장은 다음 단계로 둡니다.",
      productCandidates: [BASE_PRODUCTS.barrierAmpoule],
      secondarySolution: {
        title: "모공·피부결",
        direction: "현재 제품을 유지하고 피부가 안정된 뒤 빈도를 검토합니다.",
        products: [BASE_PRODUCTS.poreSerum]
      },
      budgetAlternatives: [
        { ...BASE_PRODUCTS.barrierAmpoule, position: "균형", priceLabel: "24,000원" },
        { ...BASE_PRODUCTS.poreSerum, position: "다음 단계", priceLabel: "28,000원" }
      ],
      routineGuide: {
        time: "저녁 루틴",
        order: "현재 잘 맞는 기능성 제품은 기존 위치에 두고 수분·보습 단계를 먼저 안정화",
        frequency: "현재 편안했던 빈도 유지",
        avoid: "새 기능성 후보의 같은 주 추가 중첩",
        review: "3~4주 후 수분 균형이 안정되면 모공·피부결 방향 재검토",
        weeklyAction: "이번 주는 현재 제품을 유지하고 수분 균형을 우선 확인하세요."
      }
    },
    routineAudit: {
      status: "OPTIMIZE",
      selectedProduct: {
        name: "포어 밸런스 세럼",
        category: "세럼/기능성",
        evidence: "DB concerns: 모공"
      },
      message: "현재 제품은 잘 맞지만 이번 주요 우선순위는 수분 균형입니다.",
      actionMessage: "현재 제품은 유지하고 새 기능성 추가는 다음 재검토 시점에 확인하세요."
    }
  })
];
