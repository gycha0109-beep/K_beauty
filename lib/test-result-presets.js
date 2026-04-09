const sharedProducts = {
  centellaAmpoule: {
    id: "skin1004-centella-ampoule",
    name: "Madagascar Centella Ampoule",
    brand: "SKIN1004",
    category: "serum",
    step: "Serum",
    texture: "watery",
    finish: "light",
    use_time: "both",
    price_range: "$$",
    labels: ["Best Match", "Low irritation"],
    buy_link: "https://www.skin1004.com/products/skin1004-madagascar-centella-ampoule"
  },
  dokdoCleanser: {
    id: "roundlab-dokdo-cleanser",
    name: "1025 Dokdo Cleanser",
    brand: "Round Lab",
    category: "cleanser",
    step: "Cleanser",
    texture: "gel",
    finish: "light",
    use_time: "both",
    price_range: "$",
    labels: ["Lightweight Option"],
    buy_link: "https://roundlab.com/products/1025-dokdo-cleanser"
  },
  anuaToner: {
    id: "anua-heartleaf-toner",
    name: "Heartleaf 77 Soothing Toner",
    brand: "Anua",
    category: "toner_essence",
    step: "Toner / Essence",
    texture: "watery",
    finish: "light",
    use_time: "both",
    price_range: "$$",
    labels: ["Low irritation"],
    buy_link: "https://anua.com/products/heartleaf-77-soothing-toner"
  },
  oatCream: {
    id: "purito-oat-gel-cream",
    name: "Oat-In Calming Gel Cream",
    brand: "Purito",
    category: "moisturizer",
    step: "Moisturizer",
    texture: "gel",
    finish: "natural",
    use_time: "both",
    price_range: "$$",
    labels: ["Barrier-Friendly", "Lightweight Option"],
    buy_link: "https://purito.com/product/oat-in-calming-gel-cream/"
  },
  drgSun: {
    id: "drg-green-mild-sun",
    name: "Green Mild Up Sun+",
    brand: "Dr.G",
    category: "sunscreen",
    step: "Sunscreen",
    texture: "lotion",
    finish: "matte",
    use_time: "day",
    price_range: "$$",
    labels: ["Low irritation"],
    buy_link: "https://dr-g.com/products/dr-g-green-mild-up-skin-sun-lotion"
  },
  aesturaCream: {
    id: "aestura-atobarrier-cream",
    name: "Atobarrier 365 Cream",
    brand: "AESTURA",
    category: "moisturizer",
    step: "Moisturizer",
    texture: "cream",
    finish: "dewy",
    use_time: "night",
    price_range: "$$$",
    labels: ["Best Match", "Barrier-Friendly"],
    buy_link: "https://int.aestura.com/products/atobarrier365-cream"
  },
  isntreeToner: {
    id: "isntree-hyaluronic-toner",
    name: "Ultra-Low Molecular Hyaluronic Toner",
    brand: "Isntree",
    category: "toner_essence",
    step: "Toner / Essence",
    texture: "watery",
    finish: "dewy",
    use_time: "both",
    price_range: "$$",
    labels: ["Barrier-Friendly"],
    buy_link: ""
  },
  bojSerum: {
    id: "beautyofjoseon-glow-serum",
    name: "Glow Serum",
    brand: "Beauty of Joseon",
    category: "serum",
    step: "Serum",
    texture: "lotion",
    finish: "natural",
    use_time: "night",
    price_range: "$$",
    labels: ["Barrier-Friendly"],
    buy_link: "https://beautyofjoseon.com/products/glow-serum-propolis-niacinamide"
  },
  kraveCleanser: {
    id: "krave-matcha-hemp-cleanser",
    name: "Matcha Hemp Hydrating Cleanser",
    brand: "KraveBeauty",
    category: "cleanser",
    step: "Cleanser",
    texture: "gel",
    finish: "natural",
    use_time: "both",
    price_range: "$$",
    labels: ["Low irritation"],
    buy_link: "https://www.cultbeauty.com/p/kravebeauty-matcha-hemp-hydrating-cleanser-120ml/14897319/"
  },
  bojSun: {
    id: "beautyofjoseon-relief-sun",
    name: "Relief Sun",
    brand: "Beauty of Joseon",
    category: "sunscreen",
    step: "Sunscreen",
    texture: "lotion",
    finish: "natural",
    use_time: "day",
    price_range: "$$",
    labels: ["Lightweight Option"],
    buy_link: "https://the-beautyofjoseon.store/products/relief-sun-rice-probiotics-spf50-pa"
  }
};

function withScore(product, score, reason, comparisonReason) {
  return {
    ...product,
    score,
    reason,
    comparison_reason: comparisonReason
  };
}

export const TEST_RESULT_PRESETS = [
  {
    id: "oily-quick",
    buttonLabel: "지성 · 유분 고민",
    summaryLabel: "지성 / 유분 / 끈적임 싫음",
    submission: {
      form: {
        skinType: "oily",
        sensitivity: "medium",
        mainConcern: "oiliness",
        cleansingFrequency: "twice",
        preferredTexture: "gel",
        postWashFeeling: "still_oily",
        afternoonSkinChange: "more_oily",
        environmentExposure: ["humidity", "mask"],
        mostDislikedFeel: "sticky"
      },
      imageName: "test-oily-profile.jpg"
    },
    result: {
      summary: "오후로 갈수록 유분이 빠르게 올라오는 편입니다.\n무거운 마무리보다 가볍고 정리되는 루틴이 더 잘 맞습니다.\n끈적임을 줄이면서 자극은 과하게 올리지 않는 쪽이 좋습니다.",
      strategy: "유분 지연과 가벼운 레이어링을 우선으로 두고, 번들 막이 늦게 올라오는 제품부터 맞추세요.",
      morning: [
        "젤 클렌저로 과하지 않게 세안하기",
        "워터리 토너와 진정 세럼으로 얇게 정리하기",
        "번들 마무리가 적은 선크림으로 마무리하기"
      ],
      night: [
        "저녁에는 잔여감 없이 세정 마치기",
        "붉은기와 유분 흐름을 같이 보는 세럼 얹기",
        "무겁지 않은 젤 크림으로 얇게 마무리하기"
      ],
      avoid: [
        "유분이 빠른데 크림을 여러 겹 두껍게 바르기",
        "끈적이는 선크림을 계속 반복해서 쓰기",
        "강한 세정으로 속당김까지 같이 만들기"
      ],
      topPick: withScore(
        sharedProducts.centellaAmpoule,
        18,
        "가볍게 흡수되고 잔여감이 덜 남아 유분이 빠르게 올라오는 피부에서도 루틴이 무겁게 남지 않습니다.",
        "자극 반응이 늦게 올라와 마스크가 있는 날에도 붉은 기운이 덜 남습니다."
      ),
      categoryPicks: [
        withScore(
          sharedProducts.dokdoCleanser,
          15,
          "세정 후 표면이 미끄럽게 남지 않아 번들거림이 빠른 피부에서도 다음 단계가 답답하게 겹치지 않습니다.",
          "피지 막이 급하게 뜨지 않아 오후 표면이 더 빨리 정리됩니다."
        ),
        withScore(
          sharedProducts.anuaToner,
          14,
          "워터리한 결로 빠르게 스며들어 마스크 환경에서도 끈적임이 길게 남지 않습니다.",
          "레이어를 얇게 쌓기 쉬워 유분이 몰리는 날에도 겉도는 느낌이 줄어듭니다."
        ),
        withScore(
          sharedProducts.oatCream,
          13,
          "젤 크림 마무리라 보습은 남기면서도 유분 위에 막처럼 얹히는 느낌이 덜합니다.",
          "무게감이 적어 저녁에도 레이어링 부담이 줄어듭니다."
        ),
        withScore(
          sharedProducts.drgSun,
          14,
          "마무리가 보송하게 정리돼 습한 날에도 선크림 특유의 답답함이 덜 남습니다.",
          "번들 막이 늦게 올라와 오후 광이 빠르게 번지는 흐름을 덜어줍니다."
        )
      ],
      alternative: withScore(
        sharedProducts.bojSun,
        12,
        "표면이 비교적 얇게 정리돼 선크림 무게감에 예민한 날 가볍게 돌려 쓰기 쉽습니다.",
        "밀림이 적어 베이스 전 단계에서 흐름이 끊기지 않습니다."
      ),
      products: [],
      funInsight: {
        title: "Optional Skin Note",
        description: "끈적임 기피가 강한 편이라 제품력보다 마무리감 차이에서 만족도가 크게 갈릴 가능성이 있습니다."
      },
      scoring: { preset: "oily-quick" },
      meta: {
        source: "preset",
        notice: "테스트용 가상 결과입니다. API 호출 없이 바로 확인 중입니다."
      }
    }
  },
  {
    id: "dry-cream",
    buttonLabel: "건성 · 건조 고민",
    summaryLabel: "건성 / 건조 / 크림 선호",
    submission: {
      form: {
        skinType: "dry",
        sensitivity: "medium",
        mainConcern: "dehydration",
        cleansingFrequency: "once",
        preferredTexture: "cream",
        postWashFeeling: "tight",
        afternoonSkinChange: "more_dry",
        environmentExposure: ["aircon"],
        mostDislikedFeel: "pilling"
      },
      imageName: "test-dry-profile.jpg"
    },
    result: {
      summary: "세안 후 당김이 오래 남고 오후로 갈수록 건조감이 더 올라오는 편입니다.\n수분층보다 보습 유지력이 체감에 더 크게 작동합니다.\n가벼움보다 마무리 안정감이 먼저 필요한 상태입니다.",
      strategy: "보습 유지력과 레이어링 안정감을 우선으로 두고, 밤에 체감 차이가 큰 보습 제품부터 맞추세요.",
      morning: [
        "세안은 짧고 부드럽게 마무리하기",
        "수분 토너를 먼저 얹고 보습 세럼을 연결하기",
        "건조하게 뜨지 않는 선크림으로 마무리하기"
      ],
      night: [
        "세안 후 바로 수분 토너로 당김 끊기",
        "보습감이 이어지는 세럼을 충분히 얹기",
        "크림으로 마무리해 수분막이 새지 않게 하기"
      ],
      avoid: [
        "당김이 남는데 젤 타입만 고집하기",
        "보습 단계 없이 선크림만 단독으로 마무리하기",
        "밤에도 산뜻함만 기준으로 제품을 고르기"
      ],
      topPick: withScore(
        sharedProducts.aesturaCream,
        19,
        "보습막이 더 안정적으로 남아 세안 후 당김이 긴 피부에서도 밤사이 메마름이 빠르게 올라오지 않습니다.",
        "크림 층이 헐겁게 무너지지 않아 건조감이 오래 남는 날에도 표면이 쉽게 들뜨지 않습니다."
      ),
      categoryPicks: [
        withScore(
          sharedProducts.kraveCleanser,
          14,
          "세안 후 땅기는 속도가 더 완만해 건조 피부에서도 첫 단계부터 당김이 심하게 남지 않습니다.",
          "세정 뒤 메마름이 급하게 오르지 않아 다음 단계 연결이 쉬워집니다."
        ),
        withScore(
          sharedProducts.isntreeToner,
          15,
          "묽게 들어가지만 수분층이 쉽게 비지 않아 에어컨 환경에서도 건조감이 오래 끌지 않습니다.",
          "토너 단계에서 당김이 먼저 끊겨 크림이 덜 겉돕니다."
        ),
        withScore(
          sharedProducts.bojSerum,
          16,
          "로션에 가까운 결이라 크림 전 단계에서 속보습을 채우면서도 레이어가 쉽게 밀리지 않습니다.",
          "보습층이 완만하게 이어져 밤 루틴에서 들뜸이 덜 생깁니다."
        ),
        withScore(
          sharedProducts.bojSun,
          13,
          "건조한 피부에서도 선크림만 따로 뜨지 않아 아침 마무리가 퍽퍽하게 갈라지지 않습니다.",
          "표면 건조가 덜 올라와 메이크업 전 단계가 더 매끈하게 이어집니다."
        )
      ],
      alternative: withScore(
        sharedProducts.isntreeToner,
        13,
        "아침에 무거운 단계가 부담스러울 때 당김을 먼저 끊는 용도로 돌려 쓰기 쉽습니다.",
        "수분층이 얇게 이어져 크림 전 단계가 덜 뭉칩니다."
      ),
      products: [],
      funInsight: {
        title: "Optional Skin Note",
        description: "건조 고민은 제형 취향보다도 세안 직후 첫 2단계에서 만족도가 크게 갈릴 가능성이 있습니다."
      },
      scoring: { preset: "dry-cream" },
      meta: {
        source: "preset",
        notice: "테스트용 가상 결과입니다. API 호출 없이 바로 확인 중입니다."
      }
    }
  }
];

export function getTestResultPreset(id) {
  const preset = TEST_RESULT_PRESETS.find((item) => item.id === id);

  if (!preset) {
    return null;
  }

  const products = [
    preset.result.topPick,
    ...(preset.result.categoryPicks || []),
    ...(preset.result.alternative ? [preset.result.alternative] : [])
  ].filter(Boolean);

  return {
    ...preset,
    result: {
      ...preset.result,
      products
    }
  };
}

export const FACE_LAB_TEST_PRESETS = [
  {
    id: "sharp-leader",
    buttonLabel: "가상 결과: 선명한 리더형",
    summaryLabel: "눈매 또렷 · 턱선 분명",
    result: {
      base_data: {
        landmarks: ["또렷한 눈매", "단단한 입선", "분명한 턱선", "세로 중심이 모이는 얼굴형"],
        face_shape: "structured oval",
        embedding: ["focused", "controlled", "clear"],
        color_values: {
          undertone: "neutral-warm",
          brightness: "medium",
          contrast: "medium-high",
          saturation: "muted"
        }
      },
      features: {
        physiognomy: {
          headline_label: "선명한 리더형",
          headline_result: "시선 집중도가 높고 표현 제어가 강한 주도형 인상입니다.",
          overall_impression:
            "첫인상에서 방향을 빠르게 잡는 느낌이 있고, 말보다 판단이 먼저 보이는 타입으로 읽히기 쉽습니다.",
          interpretation_axes: ["리더형", "집중형"],
          feature_based_interpretation: [
            "눈매가 또렷하고 모이는 축이 분명해 시선 집중도가 높아지고, 판단이 빠른 인상으로 이어집니다.",
            "입선이 단단하게 닫혀 있어 감정 노출이 줄어들고, 표현을 조절하는 사람처럼 보입니다.",
            "턱선 경계가 분명해 방향 고정감이 커지고, 쉽게 흔들리지 않는 인상으로 이어집니다.",
            "얼굴 중앙선이 정리돼 보여 시각적 중심이 생기고, 주도성이 먼저 읽히는 분위기로 남습니다."
          ],
          real_tendency: [
            "실제로는 말을 길게 하기보다 판단 기준을 먼저 세우고 움직이는 편으로 보일 가능성이 있습니다.",
            "관계에서는 천천히 열리지만 한번 방향을 정하면 태도가 분명해 보일 수 있습니다."
          ],
          strengths: [
            "중요한 순간에 결정을 미루지 않는 인상",
            "표현보다 기준이 먼저 보이는 구조",
            "집중력이 높아 보이는 시선 흐름"
          ],
          cautions: [
            "처음에는 거리가 조금 있어 보일 수 있습니다.",
            "표정 변화가 적으면 단호하게 읽힐 가능성이 있습니다."
          ]
        },
        face_shape_hairstyle: {
          summary:
            "얼굴 중심선과 턱선 정리가 분명해 선을 살리되 무겁지 않게 정리하는 스타일이 가장 잘 맞습니다.",
          recommendations: [
            "옆선을 정리한 중단발 레이어가 중심선을 더 또렷하게 보여줍니다.",
            "가르마가 보이는 스타일이 시선 방향을 분명하게 잡아줍니다.",
            "앞머리는 너무 두껍지 않게 두어 눈매 선명도를 살리는 편이 좋습니다."
          ],
          avoid: [
            "무거운 일자 앞머리는 시선 집중도를 덜 살릴 수 있습니다.",
            "옆 볼륨이 과하면 중심선 정리가 흐려질 수 있습니다."
          ]
        },
        lookalike_celebrities: {
          summary: "눈매 선명도와 입선 제어가 같이 보이는 인상 흐름입니다.",
          matches: [
            {
              name: "한소희",
              reason: "눈매 선명도와 입선 긴장도가 닮아 있어 또렷하고 집중된 인상이 비슷하게 읽힙니다."
            },
            {
              name: "전지현",
              reason: "얼굴 중심 축이 정리돼 보여 시선이 먼저 모이는 인상 흐름이 닮았습니다."
            },
            {
              name: "수지",
              reason: "선이 과하지 않으면서도 중심이 분명해 차분한 주도성이 보이는 결이 비슷합니다."
            }
          ]
        },
        color_tone_recommendation: {
          summary: "대비가 너무 높지 않은 차분한 색이 중심선을 선명하게 보여주는 편입니다.",
          palette: ["Muted beige", "Dusty rose", "Soft khaki", "Warm taupe"],
          recommendations: [
            "탁도가 약간 있는 뉴트럴 톤이 얼굴 구조를 정돈해 보이게 합니다.",
            "명도가 너무 높지 않은 색이 눈매 대비를 자연스럽게 살려줍니다.",
            "선명한 원색보다 부드럽게 눌린 색이 전체 인상을 더 정리해 줍니다."
          ],
          avoid: [
            "채도가 너무 높은 색은 구조보다 색이 먼저 보일 수 있습니다.",
            "차가운 고대비 조합은 인상을 과하게 날카롭게 만들 수 있습니다."
          ]
        }
      }
    }
  },
  {
    id: "friendly-coordinator",
    buttonLabel: "가상 결과: 친화적 조율형",
    summaryLabel: "눈 곡선 완만 · 입꼬리 여유",
    result: {
      base_data: {
        landmarks: ["완만한 눈 곡선", "열린 눈 간격", "자연스러운 입꼬리", "부드럽게 이어지는 윤곽"],
        face_shape: "soft oval",
        embedding: ["open", "balanced", "warm"],
        color_values: {
          undertone: "warm",
          brightness: "medium-high",
          contrast: "soft",
          saturation: "soft"
        }
      },
      features: {
        physiognomy: {
          headline_label: "친화적 조율형",
          headline_result: "접근 장벽이 낮고 분위기를 부드럽게 조절하는 인상입니다.",
          overall_impression:
            "처음 만나는 자리에서도 긴장감을 낮추는 쪽으로 읽히기 쉽고, 관계 안에서 분위기를 정리하는 역할로 보일 수 있습니다.",
          interpretation_axes: ["친화형", "신중형"],
          feature_based_interpretation: [
            "눈의 곡선이 완만해 시각적 압박이 줄어들고, 상대가 먼저 말을 걸기 쉬운 분위기로 이어집니다.",
            "눈 간격이 답답하지 않게 열려 있어 표정 긴장도가 낮아지고, 접근 장벽이 낮은 인상으로 남습니다.",
            "입꼬리가 자연스럽게 풀려 있어 감정 완충력이 커 보이고, 대화 흐름을 부드럽게 받는 사람처럼 보입니다.",
            "윤곽선이 부드럽게 이어져 대비가 과하지 않아 관계 안에서 조율하는 쪽의 인상으로 읽히기 쉽습니다."
          ],
          real_tendency: [
            "실제로는 강하게 밀어붙이기보다 상대 반응을 보며 속도를 맞추는 편으로 보일 가능성이 있습니다.",
            "갈등 상황에서도 분위기를 먼저 가라앉히는 쪽으로 움직일 수 있습니다."
          ],
          strengths: [
            "처음 만나는 자리에서 말문이 열리기 쉬운 인상",
            "표정 긴장도가 낮아 대화 흐름이 부드럽게 이어지는 구조",
            "관계 안에서 중간 역할을 맡기 쉬운 분위기"
          ],
          cautions: [
            "선이 약하면 결정 강도가 낮게 보일 수 있습니다.",
            "의견을 아끼면 존재감이 늦게 드러날 수 있습니다."
          ]
        },
        face_shape_hairstyle: {
          summary:
            "부드럽게 이어지는 윤곽이 장점이라 과한 각을 만들기보다 결을 살리는 스타일이 더 자연스럽습니다.",
          recommendations: [
            "레이어가 자연스럽게 흐르는 미디엄 길이가 얼굴 곡선을 잘 살려줍니다.",
            "가벼운 시스루 앞머리가 눈매 압박을 줄이지 않고 분위기를 유지해 줍니다.",
            "옆 볼륨을 너무 죽이지 않는 스타일이 부드러운 윤곽을 더 예쁘게 보여줍니다."
          ],
          avoid: [
            "각이 강한 커트는 본래의 유연한 인상을 줄일 수 있습니다.",
            "너무 무거운 일자선은 표정의 여유를 가릴 수 있습니다."
          ]
        },
        lookalike_celebrities: {
          summary: "완만한 눈 곡선과 여유 있는 입선이 먼저 보이는 인상 흐름입니다.",
          matches: [
            {
              name: "박보영",
              reason: "눈 곡선이 완만하고 표정 긴장도가 낮아 접근 장벽이 낮은 인상이 비슷하게 읽힙니다."
            },
            {
              name: "아이유",
              reason: "입선의 여유와 부드러운 중심선이 닮아 차분하게 열리는 분위기가 비슷합니다."
            },
            {
              name: "김태리",
              reason: "윤곽 대비가 과하지 않아 자연스럽게 시선이 머무는 인상 결이 닮았습니다."
            }
          ]
        },
        color_tone_recommendation: {
          summary: "부드러운 명도 변화가 있는 색이 표정의 여유를 가장 자연스럽게 살려줍니다.",
          palette: ["Soft coral", "Warm beige", "Muted apricot", "Light olive"],
          recommendations: [
            "부드럽게 눌린 웜톤이 표정 결을 가장 자연스럽게 살려줍니다.",
            "명도가 너무 낮지 않은 색이 눈매의 열린 느낌을 유지해 줍니다.",
            "쨍한 색보다 톤이 정리된 색이 얼굴 분위기를 더 오래 남깁니다."
          ],
          avoid: [
            "고대비 블랙 위주 조합은 부드러운 결을 줄일 수 있습니다.",
            "형광기 있는 색은 얼굴보다 색이 먼저 튈 수 있습니다."
          ]
        }
      }
    }
  }
];

export function getFaceLabTestPreset(id) {
  return FACE_LAB_TEST_PRESETS.find((item) => item.id === id) || null;
}
