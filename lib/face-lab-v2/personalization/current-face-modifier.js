import {
  FACE_ACTION_RELATIONS,
  FACE_ACTION_RELATION_AUTHORITY
} from "./face-action-relations.js";
import {
  isTargetForwardRecommendationPriority
} from "../target-intent.js";

export const CURRENT_FACE_MODIFIER_VERSION =
  "face-lab-current-face-modifier-v1";

function keyFeatureDirection(profile, key) {
  return profile?.keyFeatures?.find((item) => item?.key === key)?.direction || null;
}

function matchesAction(action, relation) {
  return (
    action?.domain === relation?.actionMatch?.domain &&
    action?.parameter === relation?.actionMatch?.parameter
  );
}

function relationSourceValue(currentFaceProfile, relation) {
  return keyFeatureDirection(
    currentFaceProfile,
    relation.sourceFeatureKey
  );
}

function matchesSourceValue(value, relation) {
  return relation.sourceValues.includes(value);
}

function buildFaceEvidence(relation, sourceValue) {
  const prefix = relation?.evidence?.prefix || "face_feature";
  return relation?.evidence?.includeSourceValue
    ? prefix + ":" + relation.sourceFeatureKey + "=" + sourceValue
    : prefix + ":" + relation.sourceFeatureKey;
}

function applyOperation(action, relation, sourceValue) {
  const next = {
    ...action,
    evidence: [...(Array.isArray(action?.evidence) ? action.evidence : [])]
  };
  const operation = relation.operation || {};

  if (operation.parameter) next.parameter = operation.parameter;
  if (operation.direction) next.direction = operation.direction;
  if (operation.strength) next.strength = operation.strength;
  if (operation.expectedEffect) next.expectedEffect = operation.expectedEffect;
  if (operation.reason) next.reason = operation.reason;

  next.evidence.push(buildFaceEvidence(relation, sourceValue));
  return next;
}

function cloneConflict(conflict) {
  if (!conflict) return null;
  return {
    ...conflict,
    domains: [...(Array.isArray(conflict.domains) ? conflict.domains : [])]
  };
}

export function applyCurrentFaceModifiers(
  actions,
  currentFaceProfile,
  { recommendationPriority = null } = {}
) {
  const sourceActions = Array.isArray(actions) ? actions : [];

  if (isTargetForwardRecommendationPriority(recommendationPriority)) {
    return {
      actions: sourceActions.map((item) => ({
        ...item,
        evidence: [...(Array.isArray(item?.evidence) ? item.evidence : [])]
      })),
      conflicts: []
    };
  }

  const conflicts = [];

  const modifiedActions = sourceActions.map((item) => {
    const baseline = {
      ...item,
      evidence: [...(Array.isArray(item?.evidence) ? item.evidence : [])]
    };

    const relation = FACE_ACTION_RELATIONS.find((candidate) => {
      if (
        candidate.authorityClass !==
        FACE_ACTION_RELATION_AUTHORITY.CURRENT_CONTRACT
      ) {
        return false;
      }

      if (!matchesAction(item, candidate)) return false;

      const sourceValue = relationSourceValue(
        currentFaceProfile,
        candidate
      );
      return matchesSourceValue(sourceValue, candidate);
    });

    if (!relation) return baseline;

    const sourceValue = relationSourceValue(
      currentFaceProfile,
      relation
    );
    const modified = applyOperation(
      baseline,
      relation,
      sourceValue
    );

    const conflict = cloneConflict(relation.conflict);
    if (conflict) conflicts.push(conflict);

    return modified;
  });

  return {
    actions: modifiedActions,
    conflicts
  };
}
