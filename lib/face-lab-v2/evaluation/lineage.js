import { createHash } from "node:crypto";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";

export const FACE_LAB_V2_LINEAGE_EVALUATOR_VERSION =
  "face-lab-v2-recommendation-lineage-evaluator-v1";

const STRENGTH_RANK = Object.freeze({
  light: 1,
  moderate: 2,
  strong: 3
});

const EXECUTION_KEY = Object.freeze({
  hair: "hair",
  brow_grooming: "grooming",
  facial_hair: "grooming",
  makeup: "makeup",
  color: "color",
  eyewear: "eyewear",
  accessories: "accessories"
});

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 16);
}

function sameStringSet(left, right) {
  const a = [...new Set(Array.isArray(left) ? left : [])].sort();
  const b = [...new Set(Array.isArray(right) ? right : [])].sort();
  return stableStringify(a) === stableStringify(b);
}

function selectedRoute(canonical) {
  return (canonical?.routes?.routes || []).find(
    (route) => route.routeId === canonical?.routes?.selectedRouteId
  ) || null;
}

function activePriorities(canonical) {
  return (canonical?.styleDelta?.priorities || []).filter(
    (item) => item?.constraintState === "allowed"
  );
}

function findSourcePriority(priorities, action) {
  return priorities.find((item) =>
    item?.domain === action?.domain &&
    item?.parameter === action?.parameter &&
    item?.direction === action?.direction &&
    (item?.reason || null) === (action?.reason || null) &&
    item?.expectedEffect === action?.explanation &&
    sameStringSet(item?.evidence, action?.evidence)
  ) || null;
}

function routeStrengthDoesNotEscalate(priority, action) {
  const sourceRank = STRENGTH_RANK[priority?.strength] || 0;
  const routeRank = STRENGTH_RANK[action?.strength] || 0;
  return sourceRank > 0 && routeRank > 0 && routeRank <= sourceRank;
}

function executionHasActionEvidence(result, action) {
  return Array.isArray(result?.evidence) &&
    result.evidence.includes(`style_delta:${action.parameter}`);
}

function hasAnyString(values) {
  return Array.isArray(values) &&
    values.some((item) => typeof item === "string" && item.trim());
}

function hairHasPayload(value) {
  if (!value) return false;
  return [
    "parting",
    "fringe",
    "crownVolume",
    "sideVolume",
    "templeCoverage",
    "faceLineExposure",
    "lengthDirection",
    "layerDirection",
    "curvature",
    "texture",
    "silhouette",
    "avoidOrModerate"
  ].some((key) => hasAnyString(value[key])) ||
    (Array.isArray(value.examples) && value.examples.length > 0);
}

function groomingHasPayload(value) {
  if (!value) return false;
  return [
    "brows",
    "facialHair",
    "sideburns",
    "hairline",
    "maintenancePlan"
  ].some((key) => hasAnyString(value[key]));
}

function techniqueHasPayload(technique) {
  if (!technique) return false;
  return [
    "placement",
    "direction",
    "finish",
    "colorDirection"
  ].some((key) => hasAnyString(technique[key])) ||
    (typeof technique.whyItWorks === "string" && technique.whyItWorks.trim());
}

function makeupHasPayload(value) {
  if (!value) return false;
  return [
    "brows",
    "eyes",
    "blush",
    "lips",
    "complexion",
    "contourHighlight"
  ].some((key) => techniqueHasPayload(value[key])) ||
    hasAnyString(value.avoidOrModerate);
}

function colorHasPayload(value) {
  if (!value) return false;
  return Boolean(
    value.temperatureDirection ||
    value.depthDirection ||
    value.chromaDirection ||
    value.contrastDirection ||
    hasAnyString(value.preferredFamilies) ||
    hasAnyString(value.moderateFamilies) ||
    hasAnyString(value.applicationNotes) ||
    hasAnyString(value.qualityWarnings)
  );
}

function eyewearHasPayload(value) {
  if (!value) return false;
  return [
    "frameWidth",
    "frameHeight",
    "angularity",
    "curvature",
    "rimThickness",
    "bridgeDirection",
    "browAlignment",
    "visualWeight",
    "colorContrast"
  ].some((key) => hasAnyString(value[key])) ||
    (Array.isArray(value.examples) && value.examples.length > 0);
}

function accessoriesHasPayload(value) {
  if (!value) return false;
  return [
    "scale",
    "angularity",
    "curvature",
    "length",
    "visualWeight",
    "colorContrast"
  ].some((key) => hasAnyString(value[key])) ||
    (Array.isArray(value.examples) && value.examples.length > 0);
}

function executionHasPayload(key, result) {
  if (!result || result.status !== "available") return false;

  if (key === "hair") return hairHasPayload(result.value);
  if (key === "grooming") return groomingHasPayload(result.value);
  if (key === "makeup") return makeupHasPayload(result.value);
  if (key === "color") return colorHasPayload(result.value);
  if (key === "eyewear") return eyewearHasPayload(result.value);
  if (key === "accessories") return accessoriesHasPayload(result.value);

  return false;
}

function addFailure(failures, {
  caseId,
  evaluatorId,
  expected,
  observed,
  likelyLayer,
  action = null
}) {
  const payload = {
    caseId,
    evaluatorId,
    severity: "hard",
    expected,
    observed,
    likelyLayer,
    action
  };

  failures.push({
    ...payload,
    fingerprint: fingerprint(payload)
  });
}

function evaluateRouteLineage(caseId, canonical, failures) {
  const route = selectedRoute(canonical);
  if (!route) return;

  const priorities = activePriorities(canonical);

  for (const action of route.actions || []) {
    const source = findSourcePriority(priorities, action);

    if (!source) {
      addFailure(failures, {
        caseId,
        evaluatorId: "E4-route-source-lineage",
        expected: "selected route action has an exact allowed Style Delta source",
        observed: {
          domain: action.domain,
          parameter: action.parameter,
          direction: action.direction,
          reason: action.reason,
          evidence: action.evidence
        },
        likelyLayer: "route_generator",
        action: `${action.domain}:${action.parameter}`
      });
      continue;
    }

    if (!routeStrengthDoesNotEscalate(source, action)) {
      addFailure(failures, {
        caseId,
        evaluatorId: "E4-route-strength-lineage",
        expected: `route strength <= Style Delta strength (${source.strength})`,
        observed: action.strength,
        likelyLayer: "route_generator",
        action: `${action.domain}:${action.parameter}`
      });
    }
  }
}

function evaluateExecutionLineage(caseId, canonical, failures) {
  const route = selectedRoute(canonical);
  if (!route) return;

  const grouped = new Map();

  for (const action of route.actions || []) {
    const key = EXECUTION_KEY[action.domain];
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(action);
  }

  for (const [key, actions] of grouped.entries()) {
    const result = canonical[key];

    if (!result || result.status !== "available") {
      addFailure(failures, {
        caseId,
        evaluatorId: "E4-execution-status-lineage",
        expected: `${key}:available for selected-route actions`,
        observed: result?.status || "missing",
        likelyLayer: `${key}_execution`,
        action: actions.map((item) => `${item.domain}:${item.parameter}`).join("|")
      });
      continue;
    }

    for (const action of actions) {
      if (!executionHasActionEvidence(result, action)) {
        addFailure(failures, {
          caseId,
          evaluatorId: "E4-execution-evidence-lineage",
          expected: `style_delta:${action.parameter}`,
          observed: result.evidence || [],
          likelyLayer: `${key}_execution`,
          action: `${action.domain}:${action.parameter}`
        });
      }
    }

    if (!executionHasPayload(key, result)) {
      addFailure(failures, {
        caseId,
        evaluatorId: "E4-empty-available-execution",
        expected: `${key} available result contains at least one user-visible execution payload`,
        observed: result.value,
        likelyLayer: `${key}_execution`,
        action: actions.map((item) => `${item.domain}:${item.parameter}`).join("|")
      });
    }
  }
}

function evaluateLookLineage(caseId, canonical, failures) {
  if (canonical?.looks?.status !== "available") return;

  const route = selectedRoute(canonical);
  const look = canonical.looks?.looks?.[0];

  if (!route || !look) {
    addFailure(failures, {
      caseId,
      evaluatorId: "E4-look-route-lineage",
      expected: "available Look Composer output references the selected route",
      observed: {
        selectedRouteId: canonical?.routes?.selectedRouteId || null,
        lookRouteId: look?.routeId || null
      },
      likelyLayer: "look_composer"
    });
    return;
  }

  if (look.routeId !== route.routeId) {
    addFailure(failures, {
      caseId,
      evaluatorId: "E4-look-route-lineage",
      expected: route.routeId,
      observed: look.routeId,
      likelyLayer: "look_composer"
    });
  }

  for (const piece of look.pieces || []) {
    const result = canonical[piece.domain];
    if (!result || result.status !== "available") {
      addFailure(failures, {
        caseId,
        evaluatorId: "E4-look-execution-lineage",
        expected: `${piece.domain}:available`,
        observed: result?.status || "missing",
        likelyLayer: "look_composer"
      });
    }

    const evidenceToken = `execution_domain:${piece.domain}`;
    if (!(canonical.looks.evidence || []).includes(evidenceToken)) {
      addFailure(failures, {
        caseId,
        evaluatorId: "E4-look-evidence-lineage",
        expected: evidenceToken,
        observed: canonical.looks.evidence || [],
        likelyLayer: "look_composer"
      });
    }

    if (typeof piece.summary !== "string" || !piece.summary.trim()) {
      addFailure(failures, {
        caseId,
        evaluatorId: "E4-look-empty-piece",
        expected: "non-empty look piece summary",
        observed: piece.summary || null,
        likelyLayer: "look_composer"
      });
    }
  }
}

export function runFaceLabV2RecommendationLineageEvaluation(cases = []) {
  const failures = [];
  let actionableCaseCount = 0;
  let selectedRouteActionCount = 0;
  let availableExecutionDomainCount = 0;
  let lookPieceCount = 0;
  const executionDomainCounts = {};

  for (const caseDef of cases) {
    const canonical = buildFaceLabV2Canonical({
      analysis: caseDef.analysis,
      surveyAnswers: caseDef.surveyAnswers,
      resultId: `${caseDef.caseId}-lineage`
    });

    const route = selectedRoute(canonical);
    if (!route) continue;

    actionableCaseCount += 1;
    selectedRouteActionCount += (route.actions || []).length;

    evaluateRouteLineage(caseDef.caseId, canonical, failures);
    evaluateExecutionLineage(caseDef.caseId, canonical, failures);
    evaluateLookLineage(caseDef.caseId, canonical, failures);

    for (const key of [
      "hair",
      "grooming",
      "makeup",
      "color",
      "eyewear",
      "accessories"
    ]) {
      if (canonical[key]?.status === "available") {
        availableExecutionDomainCount += 1;
        executionDomainCounts[key] = (executionDomainCounts[key] || 0) + 1;
      }
    }

    lookPieceCount += canonical.looks?.looks?.[0]?.pieces?.length || 0;
  }

  return {
    reportVersion: "face-lab-v2-recommendation-lineage-report-v1",
    evaluatorVersion: FACE_LAB_V2_LINEAGE_EVALUATOR_VERSION,
    summary: {
      inputCaseCount: cases.length,
      actionableCaseCount,
      selectedRouteActionCount,
      availableExecutionDomainCount,
      lookPieceCount,
      hardFailureCount: failures.length,
      executionDomainCounts
    },
    failures
  };
}
