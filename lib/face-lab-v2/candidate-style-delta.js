import {
  buildStyleDelta,
  STYLE_DELTA_VERSION
} from "./style-delta.js";
import {
  TARGET_ACTION_POOL_VERSION
} from "./target-action-pool.js";
import {
  CURRENT_FACE_MODIFIER_VERSION
} from "./personalization/current-face-modifier.js";
import {
  applyFaceFitPersonalization,
  FACE_FIT_PLANNER_VERSION
} from "./personalization/face-fit-planner.js";
import {
  CANDIDATE_FACE_ACTION_RELATION_VERSION
} from "./personalization/candidate-face-action-relations.js";

export const CANDIDATE_STYLE_DELTA_VERSION =
  "face-lab-style-delta-candidate-v1";

export function buildCandidateStyleDelta({
  currentFaceProfile,
  targetStyle
} = {}) {
  const current = buildStyleDelta({
    currentFaceProfile,
    targetStyle
  });

  const planned = applyFaceFitPersonalization(
    current.priorities,
    currentFaceProfile
  );

  return {
    ...current,
    version: CANDIDATE_STYLE_DELTA_VERSION,
    priorities: planned.actions,
    candidatePolicy: {
      productionActive: false,
      currentStyleDeltaVersion: STYLE_DELTA_VERSION,
      targetActionPoolVersion: TARGET_ACTION_POOL_VERSION,
      currentFaceModifierVersion:
        CURRENT_FACE_MODIFIER_VERSION,
      candidateRelationRegistryVersion:
        CANDIDATE_FACE_ACTION_RELATION_VERSION,
      faceFitPlannerVersion: FACE_FIT_PLANNER_VERSION
    },
    personalizationLedger:
      planned.personalizationLedger
  };
}
