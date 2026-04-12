const MAP = {
  skinType: {
    oily: "지성",
    dry: "건성",
    combination: "복합성",
    not_sure: "피부 타입 탐색 중"
  },
  mainConcern: {
    oiliness: "유분 고민",
    dehydration: "건조 고민",
    acne: "트러블 고민",
    uneven_tone: "톤 고민",
    pores: "모공 고민",
    redness: "붉은기 고민",
    barrier: "장벽 고민"
  },
  afternoonSkinChange: {
    more_oily: "오후 유분 증가",
    more_dry: "오후 건조 심화",
    red_or_irritated: "오후 예민함 증가",
    mostly_same: "오후에도 큰 변화 없음"
  },
  preferredTexture: {
    gel: "가벼운 제형 선호",
    watery: "산뜻한 워터 제형 선호",
    lotion: "부드러운 로션 제형 선호",
    cream: "보습감 있는 크림 선호"
  },
  mostDislikedFeel: {
    sticky: "끈적임 회피",
    greasy: "번들거림 회피",
    heavy: "무거운 사용감 회피",
    fragranced: "강한 향 회피",
    pilling: "밀림 회피"
  }
};

export function buildSkinProfileSummary(form = {}) {
  const items = [];

  if (form.skinType) {
    const base = MAP.skinType[form.skinType] || "피부 타입 기준";
    const afternoon = MAP.afternoonSkinChange[form.afternoonSkinChange];
    items.push(afternoon ? `${base} / ${afternoon}` : base);
  }

  if (form.mainConcern) {
    items.push(MAP.mainConcern[form.mainConcern] || "현재 고민 기준");
  }

  if (form.preferredTexture) {
    items.push(MAP.preferredTexture[form.preferredTexture] || "제형 선호 반영");
  }

  if (form.mostDislikedFeel) {
    items.push(MAP.mostDislikedFeel[form.mostDislikedFeel] || "사용감 회피 조건 반영");
  }

  return items.filter(Boolean).slice(0, 4);
}
