export const FACE_ACTION_RELATION_REGISTRY_VERSION =
  "face-lab-face-action-relation-registry-v1";

export const FACE_ACTION_RELATION_AUTHORITY = Object.freeze({
  CURRENT_CONTRACT: "CURRENT_CONTRACT",
  CANDIDATE_HYPOTHESIS: "CANDIDATE_HYPOTHESIS",
  BLOCKED_PENDING_VALIDATION: "BLOCKED_PENDING_VALIDATION"
});

export const FACE_ACTION_RELATIONS = Object.freeze([
  Object.freeze({
    relationId: "FL-CURRENT-001",
    authorityClass: FACE_ACTION_RELATION_AUTHORITY.CURRENT_CONTRACT,
    sourceFeatureKey: "eyeDirection",
    sourceValues: Object.freeze(["upturned"]),
    actionMatch: Object.freeze({
      domain: "makeup",
      parameter: "outerEyeEmphasis"
    }),
    operation: Object.freeze({
      type: "redirect",
      parameter: "eyeDefinition",
      strength: "light",
      expectedEffect:
        "이미 상향 흐름이 보이는 눈매를 더 끌어올리기보다 선명도와 길이 조절로 목표 인상을 보탭니다.",
      reason: "face_modifier_eye_direction_already_upturned"
    }),
    evidence: Object.freeze({
      prefix: "face_feature",
      includeSourceValue: true
    }),
    conflict: Object.freeze({
      type: "over_amplification_guard",
      domains: Object.freeze(["makeup"]),
      description:
        "이미 상향 흐름이 보이는 눈매에 추가 상승 방향을 중첩하지 않습니다.",
      resolution:
        "상승 각도 대신 눈의 선명도와 길이 쪽으로 이동합니다."
    })
  }),
  Object.freeze({
    relationId: "FL-CURRENT-002",
    authorityClass: FACE_ACTION_RELATION_AUTHORITY.CURRENT_CONTRACT,
    sourceFeatureKey: "featureContrast",
    sourceValues: Object.freeze(["high"]),
    actionMatch: Object.freeze({
      domain: "makeup",
      parameter: "selectedFeatureContrast"
    }),
    operation: Object.freeze({
      type: "strength_cap",
      strength: "light",
      expectedEffect:
        "이미 특징 대비가 높은 편이므로 전체 대비를 더 올리기보다 한 부위만 선택적으로 강조합니다.",
      reason: "face_modifier_existing_feature_contrast_high"
    }),
    evidence: Object.freeze({
      prefix: "face_feature",
      includeSourceValue: true
    }),
    conflict: Object.freeze({
      type: "contrast_guard",
      domains: Object.freeze(["makeup"]),
      description:
        "현재 특징 대비가 높은 상태에서 모든 부위의 대비를 함께 올리지 않습니다.",
      resolution:
        "한 부위 중심의 제한된 포인트로 전환합니다."
    })
  }),
  Object.freeze({
    relationId: "FL-CURRENT-003",
    authorityClass: FACE_ACTION_RELATION_AUTHORITY.CURRENT_CONTRACT,
    sourceFeatureKey: "contourDefinition",
    sourceValues: Object.freeze(["defined"]),
    actionMatch: Object.freeze({
      domain: "hair",
      parameter: "outlineDefinition"
    }),
    operation: Object.freeze({
      type: "preserve",
      direction: "maintain",
      strength: "light",
      expectedEffect:
        "이미 윤곽이 선명하게 읽히므로 헤어 외곽은 추가로 날카롭게 만들기보다 정돈된 수준을 유지합니다.",
      reason: "face_modifier_contour_already_defined"
    }),
    evidence: Object.freeze({
      prefix: "face_feature",
      includeSourceValue: true
    }),
    conflict: null
  }),
  Object.freeze({
    relationId: "FL-CURRENT-004",
    authorityClass: FACE_ACTION_RELATION_AUTHORITY.CURRENT_CONTRACT,
    sourceFeatureKey: "straightCurveBalance",
    sourceValues: Object.freeze(["curved"]),
    actionMatch: Object.freeze({
      domain: "hair",
      parameter: "curvature"
    }),
    operation: Object.freeze({
      type: "preserve",
      direction: "maintain",
      strength: "light",
      expectedEffect:
        "이미 곡선 흐름이 보이므로 과한 컬보다 자연스러운 곡선감을 유지하는 쪽으로 제한합니다.",
      reason: "face_modifier_line_already_curved"
    }),
    evidence: Object.freeze({
      prefix: "face_feature",
      includeSourceValue: true
    }),
    conflict: null
  })
]);
