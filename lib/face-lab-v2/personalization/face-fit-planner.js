import {
  FACE_ACTION_RELATION_AUTHORITY
} from "./face-action-relations.js";
import {
  CANDIDATE_FACE_ACTION_RELATIONS,
  CANDIDATE_FACE_ACTION_RELATION_VERSION
} from "./candidate-face-action-relations.js";

export const FACE_FIT_PLANNER_VERSION =
  "face-lab-face-fit-planner-v1";

const STRENGTH_RANK = Object.freeze({
  light: 1,
  moderate: 2,
  strong: 3
});

function keyFeatureDirection(profile, key) {
  return profile?.keyFeatures?.find(
    (item) => item?.key === key
  )?.direction || null;
}

function matchesAction(action, relation) {
  const match = relation?.actionMatch || {};
  return (
    action?.domain === match.domain &&
    action?.parameter === match.parameter &&
    action?.direction === match.direction &&
    action?.reason === match.reason
  );
}

function matchesSourceValue(currentFaceProfile, relation) {
  const sourceValue = keyFeatureDirection(
    currentFaceProfile,
    relation.sourceFeatureKey
  );
  return {
    sourceValue,
    matched: relation.sourceValues.includes(sourceValue)
  };
}

function capStrength(currentStrength, cap) {
  const currentRank = STRENGTH_RANK[currentStrength] || 0;
  const capRank = STRENGTH_RANK[cap] || 0;
  if (!currentRank || !capRank || currentRank <= capRank) {
    return currentStrength;
  }
  return cap;
}

function appendUnique(values, value) {
  return values.includes(value) ? values : [...values, value];
}

function applyRelation(action, relation, sourceValue) {
  const operation = relation.operation || {};
  const before = {
    strength: action.strength,
    reason: action.reason,
    expectedEffect: action.expectedEffect
  };

  let nextStrength = action.strength;
  if (operation.type === "strength_cap") {
    nextStrength = capStrength(
      action.strength,
      operation.strength
    );
  }

  if (nextStrength === action.strength) {
    return {
      changed: false,
      action: {
        ...action,
        evidence: [...(action.evidence || [])]
      },
      ledgerEntry: null
    };
  }

  let evidence = [...(action.evidence || [])];
  evidence = appendUnique(
    evidence,
    "face_feature:" +
      relation.sourceFeatureKey +
      "=" +
      sourceValue
  );
  evidence = appendUnique(
    evidence,
    "candidate_relation:" + relation.relationId
  );

  const next = {
    ...action,
    strength: nextStrength,
    expectedEffect:
      operation.expectedEffect || action.expectedEffect,
    reason: operation.reason || action.reason,
    evidence,
    candidatePersonalization: {
      policyVersion: FACE_FIT_PLANNER_VERSION,
      relationId: relation.relationId,
      authorityClass: relation.authorityClass,
      sourceFeatureKey: relation.sourceFeatureKey,
      sourceValue,
      operation: operation.type,
      baseReason: action.reason,
      relationRegistryVersion:
        CANDIDATE_FACE_ACTION_RELATION_VERSION
    }
  };

  return {
    changed: true,
    action: next,
    ledgerEntry: {
      relationId: relation.relationId,
      authorityClass: relation.authorityClass,
      sourceFeatureKey: relation.sourceFeatureKey,
      sourceValue,
      domain: action.domain,
      parameter: action.parameter,
      operation: operation.type,
      before,
      after: {
        strength: next.strength,
        reason: next.reason,
        expectedEffect: next.expectedEffect
      }
    }
  };
}

export function applyFaceFitPersonalization(
  actions,
  currentFaceProfile
) {
  const ledger = [];

  const personalizedActions = (
    Array.isArray(actions) ? actions : []
  ).map((item) => {
    let next = {
      ...item,
      evidence: [...(item?.evidence || [])]
    };

    if (next.constraintState === "blocked") {
      return next;
    }

    for (const relation of CANDIDATE_FACE_ACTION_RELATIONS) {
      if (
        relation.authorityClass !==
        FACE_ACTION_RELATION_AUTHORITY.CANDIDATE_HYPOTHESIS
      ) {
        continue;
      }

      if (!matchesAction(next, relation)) continue;

      const source = matchesSourceValue(
        currentFaceProfile,
        relation
      );
      if (!source.matched) continue;

      const applied = applyRelation(
        next,
        relation,
        source.sourceValue
      );
      next = applied.action;
      if (applied.ledgerEntry) {
        ledger.push(applied.ledgerEntry);
      }
    }

    return next;
  });

  return {
    actions: personalizedActions,
    personalizationLedger: ledger,
    relationRegistryVersion:
      CANDIDATE_FACE_ACTION_RELATION_VERSION,
    plannerVersion: FACE_FIT_PLANNER_VERSION
  };
}
