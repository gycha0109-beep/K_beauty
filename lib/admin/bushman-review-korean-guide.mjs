// 관리자 화면에 표시하는 설명만 담당합니다. 실제 검토값·증거·권한 계약은 수정하지 않습니다.
export const BUSHMAN_REVIEW_GUIDE = Object.freeze({
  category_slot: {
    label: "제품 분류",
    explanation: "공식 제품명이 선크림이며 현재 등록된 제품 분류와 일치합니다.",
    instruction: "이 제품을 '선크림'으로 기록하는 것이 타당한지 확인합니다.",
  },
  skin_types: {
    label: "피부 타입",
    explanation: "건성·복합성·민감성 사용자 후기가 서로 달라 특정 피부 타입에 적합하다고 단정할 수 없습니다.",
    instruction: "특정 피부 타입에 적합하다고 확정하지 않고 '미확정'으로 기록합니다.",
  },
  concerns: {
    label: "피부 고민",
    explanation: "자외선 차단 기능과 일부 후기는 피지·여드름 등 개별 피부 고민에 대한 효과를 입증하지 않습니다.",
    instruction: "피부 고민에 대한 적합성을 '미확정'으로 기록합니다.",
  },
  texture: {
    label: "제형",
    explanation: "가볍게 발린다는 후기와 꾸덕하다는 후기가 함께 있어 제형을 하나로 확정하기 어렵습니다.",
    instruction: "특정 제형으로 추정하지 않고 '미확정'으로 기록합니다.",
  },
  finish: {
    label: "마무리감",
    explanation: "보송하다는 후기와 유분감·답답함을 느꼈다는 후기가 공존합니다.",
    instruction: "마무리감을 하나로 단정하지 않고 '미확정'으로 기록합니다.",
  },
  uv_filter_type: {
    label: "자외선 차단 방식",
    explanation: "기존에 검증된 제품 정보에서 자외선 차단 방식이 '혼합자차'로 확인됐습니다.",
    instruction: "확인된 제품 정보를 바탕으로 '혼합자차'를 기록합니다.",
  },
  sensitivity_safe: {
    label: "민감성 피부 사용",
    explanation: "저자극 표시가 있지만 실제 자극을 경험한 사용자 후기도 있어 누구에게나 안전하다고 확정할 수 없습니다.",
    instruction: "민감성 피부에 무조건 안전하다고 판단하지 않고 '미확정'으로 기록합니다.",
  },
  irritation_risk: {
    label: "자극 위험",
    explanation: "일부 사용자의 자극 사례는 있지만 실제 발생 가능성을 낮음·보통·높음으로 정할 근거가 부족합니다.",
    instruction: "자극 위험 수준을 임의로 정하지 않고 '미확정'으로 기록합니다.",
  },
  tone_up: {
    label: "톤업 효과",
    explanation: "톤업이 없다고 느낀 후기가 있으나 공식 정보만으로 기능의 유무를 확정하기 어렵습니다.",
    instruction: "톤업 기능이 없다고 단정하지 않고 '미확정'으로 기록합니다.",
  },
  white_cast: {
    label: "백탁 현상",
    explanation: "상품 설명에는 백탁 방지라고 적혀 있지만, 실제로 백탁을 느꼈다는 사용자도 있습니다.",
    instruction: "백탁이 전혀 없다고 확정하지 않고 '미확정'으로 기록합니다.",
  },
  eye_sting: {
    label: "눈시림",
    explanation: "눈이 편안했다는 후기와 눈 자극을 경험했다는 후기가 함께 있습니다.",
    instruction: "눈시림 위험을 낮다고 단정하지 않고 '미확정'으로 기록합니다.",
  },
  pilling_risk: {
    label: "화장 밀림",
    explanation: "대체로 잘 발린다는 평가도 있지만 더운 날이나 화장을 두껍게 겹친 경우 밀림 사례가 있습니다.",
    instruction: "밀림 위험을 낮다고 단정하지 않고 '미확정'으로 기록합니다.",
  },
});

export const BUSHMAN_SOURCE_LABELS = Object.freeze({
  BRAND_PRODUCT_31: "부쉬맨 공식 상품 정보",
  HWAHAE_REVIEW_TAGS: "화해 사용자 후기 요약",
  HWAHAE_INDIVIDUAL: "화해 개별 사용자 후기",
  HWAHAE_DRY: "화해 건성 피부 사용자 후기",
  BRAND_PURCHASE_REVIEW_388: "공식몰 구매 후기 ①",
  BRAND_PURCHASE_REVIEW_508: "공식몰 구매 후기 ②",
  BRAND_PURCHASE_REVIEW_4845: "공식몰 구매 후기 ③",
  GOVERNED_UV_FACT: "검증된 제품 차단 방식 정보",
});

export const BUSHMAN_REVIEW_VALUE_LABELS = Object.freeze({
  sunscreen: "선크림",
  hybrid: "혼합자차",
});

export function bushmanReviewStateLabel(state) {
  if (state === "established") return "값 확정 완료";
  if (state === "reviewed_not_established") return "미확정으로 기록 완료";
  if (state === "not_reviewed") return "아직 검토하지 않음";
  return "기록 상태 확인 필요";
}
