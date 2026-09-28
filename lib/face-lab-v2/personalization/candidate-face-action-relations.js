import {
  FACE_ACTION_RELATION_AUTHORITY
} from "./face-action-relations.js";

export const CANDIDATE_FACE_ACTION_RELATION_VERSION =
  "face-lab-candidate-face-action-relations-v1";

export const CANDIDATE_FACE_ACTION_RELATIONS = Object.freeze([
  Object.freeze({
    relationId: "FL-CAND-001",
    authorityClass:
      FACE_ACTION_RELATION_AUTHORITY.CANDIDATE_HYPOTHESIS,
    sourceFeatureKey: "straightCurveBalance",
    sourceValues: Object.freeze(["curved"]),
    cueReadiness: "READY_FOR_BLIND_HUMAN_CUE_AUDIT",
    authoritySource:
      "face-lab-target-axis-operational-definitions-20260814-v1",
    humanCalibrationRequired: true,
    actionMatch: Object.freeze({
      domain: "eyewear",
      parameter: "curvature",
      direction: "increase",
      reason: "target_softSharp_low"
    }),
    operation: Object.freeze({
      type: "strength_cap",
      strength: "light",
      reason: "candidate_face_fit_curve_alignment",
      expectedEffect:
        "현재 얼굴의 곡선 흐름이 이미 분명하게 읽히므로 안경 프레임의 곡률은 크게 더하기보다 가볍게 보태는 수준으로 제한합니다."
    })
  }),
  Object.freeze({
    relationId: "FL-CAND-002",
    authorityClass:
      FACE_ACTION_RELATION_AUTHORITY.CANDIDATE_HYPOTHESIS,
    sourceFeatureKey: "straightCurveBalance",
    sourceValues: Object.freeze(["straight"]),
    cueReadiness: "READY_FOR_BLIND_HUMAN_CUE_AUDIT",
    authoritySource:
      "face-lab-target-axis-operational-definitions-20260814-v1",
    humanCalibrationRequired: true,
    actionMatch: Object.freeze({
      domain: "eyewear",
      parameter: "angularity",
      direction: "increase",
      reason: "target_softSharp_high"
    }),
    operation: Object.freeze({
      type: "strength_cap",
      strength: "light",
      reason: "candidate_face_fit_straight_alignment",
      expectedEffect:
        "현재 얼굴의 직선 흐름이 이미 분명하게 읽히므로 안경 프레임의 각은 크게 더하기보다 가볍게 보태는 수준으로 제한합니다."
    })
  })
]);
