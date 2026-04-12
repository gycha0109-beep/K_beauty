const MAP = {
  ko: {
    skinType: {
      oily: "지성",
      dry: "건성",
      combination: "복합성",
      not_sure: "잘 모르겠음"
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
      watery: "워터 제형 선호",
      lotion: "로션 제형 선호",
      cream: "크림 제형 선호"
    },
    mostDislikedFeel: {
      sticky: "끈적임 회피",
      greasy: "번들거림 회피",
      heavy: "무거운 사용감 회피",
      fragranced: "강한 향 회피",
      pilling: "밀림 회피"
    },
    defaults: {
      skinType: "피부 기준",
      concern: "현재 고민 기준",
      texture: "제형 선호 반영",
      dislike: "사용감 회피 반영"
    }
  },
  en: {
    skinType: {
      oily: "Oily",
      dry: "Dry",
      combination: "Combination",
      not_sure: "Not sure"
    },
    mainConcern: {
      oiliness: "Oiliness concern",
      dehydration: "Dehydration concern",
      acne: "Breakout concern",
      uneven_tone: "Tone concern",
      pores: "Pore concern",
      redness: "Redness concern",
      barrier: "Barrier concern"
    },
    afternoonSkinChange: {
      more_oily: "more afternoon shine",
      more_dry: "more afternoon dryness",
      red_or_irritated: "more afternoon sensitivity",
      mostly_same: "little afternoon change"
    },
    preferredTexture: {
      gel: "prefers light textures",
      watery: "prefers watery textures",
      lotion: "prefers lotion textures",
      cream: "prefers cream textures"
    },
    mostDislikedFeel: {
      sticky: "avoids stickiness",
      greasy: "avoids greasiness",
      heavy: "avoids heavy textures",
      fragranced: "avoids strong fragrance",
      pilling: "avoids pilling"
    },
    defaults: {
      skinType: "Skin profile",
      concern: "Current concern",
      texture: "Texture preference",
      dislike: "Feel preference"
    }
  }
};

export function buildSkinProfileSummary(form = {}, locale = "ko") {
  const copy = MAP[locale] || MAP.ko;
  const items = [];

  if (form.skinType) {
    const base = copy.skinType[form.skinType] || copy.defaults.skinType;
    const afternoon = copy.afternoonSkinChange[form.afternoonSkinChange];
    items.push(afternoon ? `${base} / ${afternoon}` : base);
  }

  if (form.mainConcern) {
    items.push(copy.mainConcern[form.mainConcern] || copy.defaults.concern);
  }

  if (form.preferredTexture) {
    items.push(copy.preferredTexture[form.preferredTexture] || copy.defaults.texture);
  }

  if (form.mostDislikedFeel) {
    items.push(copy.mostDislikedFeel[form.mostDislikedFeel] || copy.defaults.dislike);
  }

  return items.filter(Boolean).slice(0, 4);
}
