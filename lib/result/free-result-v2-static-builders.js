export function buildFinalReportPreviewSections(locale = "ko") {
  const isEnglish = locale === "en";

  if (isEnglish) {
    return [
      {
        key: "routine_execution",
        title: "Morning · night execution routine",
        body: "We organize which product to use, in what order, and at which step."
      },
      {
        key: "situation_routines",
        title: "Situation-based routine changes",
        body: "We adjust the routine for sensitive days, breakout days, outdoor-heavy days, and makeup days."
      },
      {
        key: "avoid_combinations",
        title: "Avoid combinations",
        body: "We point out pairings that can increase irritation or make the routine feel too heavy."
      },
      {
        key: "alternative_strategy",
        title: "Alternative product strategy",
        body: "We explain when and how to switch products instead of relying only on the Top Pick."
      },
      {
        key: "face_lab_expanded",
        title: "Face Lab expanded guide",
        body: "We organize hair direction, avoid styles, and mood keywords that fit your face shape."
      }
    ];
  }

  return [
    {
      key: "routine_execution",
      title: "아침·저녁 실행 루틴",
      body: "제품을 어느 순서로, 어느 단계에서 쓰면 되는지 정리합니다."
    },
    {
      key: "situation_routines",
      title: "상황별 루틴 변형",
      body: "민감한 날, 트러블 올라온 날, 야외활동 많은 날, 메이크업하는 날 기준으로 루틴을 바꿔줍니다."
    },
    {
      key: "avoid_combinations",
      title: "피해야 할 조합",
      body: "같이 쓰면 자극이 커지거나 루틴이 무거워지는 조합을 알려줍니다."
    },
    {
      key: "alternative_strategy",
      title: "대체 제품 사용 전략",
      body: "Top Pick 대신 어떤 제품을 언제 바꿔 쓰면 좋은지 정리합니다."
    },
    {
      key: "face_lab_expanded",
      title: "Face Lab 확장 가이드",
      body: "얼굴형에 맞는 헤어 방향, 피해야 할 스타일, 분위기 키워드를 정리합니다."
    }
  ];
}

export function buildFreeResultV2RoutinePreview(result = null, locale = "ko") {
  if (locale === "en") {
    return {
      morning: "Light reset → moisture hold → UV protection",
      night: "Gentle cleanse → moisture refill → barrier comfort",
      morningSteps: ["Light reset", "Moisture hold", "UV protection"],
      nightSteps: ["Gentle cleanse", "Moisture refill", "Barrier comfort"],
      morningNote: "A light flow that keeps the skin from feeling heavy.",
      nightNote: "A gentle flow that clears residue and supports comfort.",
      gateNote: "Detailed product order and usage frequency are available in the full report."
    };
  }

  return {
    morning: "가볍게 정돈 → 수분 유지 → 자외선 차단",
    night: "순한 세안 → 수분 보충 → 장벽 안정",
    morningSteps: ["가볍게 정돈", "수분 유지", "자외선 차단"],
    nightSteps: ["순한 세안", "수분 보충", "장벽 안정"],
    morningNote: "무겁게 덮기보다 가볍게 유지하는 흐름입니다.",
    nightNote: "잔여감을 순하게 정리하고 장벽을 안정시키는 흐름입니다.",
    gateNote: "세부 제품 순서와 사용 빈도는 전체 리포트에서 확인할 수 있어요."
  };
}

export function buildFreeResultV2FaceLabPreview(faceLabPreview = null, locale = "ko") {
  if (faceLabPreview?.primary || faceLabPreview?.keywords?.length) {
    return {
      primary: faceLabPreview.primary || (locale === "en" ? "Mood preview" : "대표 무드"),
      keywords: (faceLabPreview.keywords || []).slice(0, 4)
    };
  }

  // TODO: replace this fallback after Face Lab free preview always includes a mood and style keywords.
  return {
    primary: locale === "en" ? "Mood preview pending" : "대표 무드 분석 준비 중",
    keywords: [locale === "en" ? "style keywords pending" : "스타일 키워드 준비 중"]
  };
}
