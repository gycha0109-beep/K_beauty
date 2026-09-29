export const TARGET_INTENT_POLICY_VERSION =
  "face-lab-target-intent-policy-v1";

export const FACE_LAB_RECOMMENDATION_PRIORITY = Object.freeze({
  FACE_HARMONY: "face_harmony",
  TARGET_FORWARD: "target_forward"
});

const RECOMMENDATION_PRIORITY_VALUES = new Set(
  Object.values(FACE_LAB_RECOMMENDATION_PRIORITY)
);

export function normalizeFaceLabRecommendationPriority(value) {
  return RECOMMENDATION_PRIORITY_VALUES.has(value)
    ? value
    : FACE_LAB_RECOMMENDATION_PRIORITY.FACE_HARMONY;
}

export function isTargetForwardRecommendationPriority(value) {
  return normalizeFaceLabRecommendationPriority(value) ===
    FACE_LAB_RECOMMENDATION_PRIORITY.TARGET_FORWARD;
}
