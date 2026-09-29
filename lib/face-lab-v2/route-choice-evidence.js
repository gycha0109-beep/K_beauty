export const FACE_LAB_ROUTE_CHOICE_EVIDENCE_VERSION =
  "face-lab-route-choice-evidence-v1";

const COMMITTED_SELECTION_STATES = new Set([
  "user_selected",
  "single_route_auto"
]);

function cleanString(value, limit = 120) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : null;
}

function cleanStringList(values, limit = 12) {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .map((value) => cleanString(value))
      .filter(Boolean)
  )].slice(0, limit);
}

function normalizeAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const domain = cleanString(value.domain, 80);
  const parameter = cleanString(value.parameter, 80);
  const direction = cleanString(value.direction, 80);
  const strength = cleanString(value.strength, 40);

  if (!domain || !parameter || !direction) return null;

  return {
    domain,
    parameter,
    direction,
    strength
  };
}

export function normalizeFaceLabRouteChoiceEvidence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  if (value.schemaVersion !== FACE_LAB_ROUTE_CHOICE_EVIDENCE_VERSION) {
    return null;
  }

  const selectionState = cleanString(value.selectionState, 40);
  if (!COMMITTED_SELECTION_STATES.has(selectionState)) {
    return null;
  }

  const choiceType =
    selectionState === "user_selected"
      ? "explicit_user"
      : "single_option_auto";

  const routeId = cleanString(value.routeId, 80);
  const strategy = cleanString(value.strategy, 80);
  if (!routeId || !strategy) return null;

  const actions = (Array.isArray(value.actions) ? value.actions : [])
    .map(normalizeAction)
    .filter(Boolean)
    .slice(0, 8);

  return {
    schemaVersion: FACE_LAB_ROUTE_CHOICE_EVIDENCE_VERSION,
    selectionState,
    choiceType,
    preferenceEligible: selectionState === "user_selected",
    routeId,
    strategy,
    routeGeneratorVersion: cleanString(value.routeGeneratorVersion, 120),
    recommendationPriority: cleanString(value.recommendationPriority, 80),
    targetLabels: cleanStringList(value.targetLabels, 4),
    domains: cleanStringList(value.domains, 8),
    changeTolerance: cleanString(value.changeTolerance, 40),
    changeMagnitude: cleanString(value.changeMagnitude, 40),
    dailyEffort: cleanString(value.dailyEffort, 40),
    maintenance: cleanString(value.maintenance, 40),
    costBand: cleanString(value.costBand, 40),
    reversibility: cleanString(value.reversibility, 40),
    actions,
    capturedAt:
      typeof value.capturedAt === "string" &&
      Number.isFinite(Date.parse(value.capturedAt))
        ? value.capturedAt
        : null
  };
}

export function buildFaceLabRouteChoiceEvidence(
  canonicalV2,
  { capturedAt = null } = {}
) {
  const routes = canonicalV2?.routes;
  const selectionState = routes?.selectionState || null;

  if (!COMMITTED_SELECTION_STATES.has(selectionState)) {
    return null;
  }

  const route = (routes?.routes || []).find(
    (item) => item?.routeId === routes?.selectedRouteId
  );

  if (!route) return null;

  return normalizeFaceLabRouteChoiceEvidence({
    schemaVersion: FACE_LAB_ROUTE_CHOICE_EVIDENCE_VERSION,
    selectionState,
    routeId: route.routeId,
    strategy: route.strategy || route.routeId,
    routeGeneratorVersion:
      canonicalV2?.lineage?.routeGeneratorVersion || routes?.version || null,
    recommendationPriority:
      canonicalV2?.targetStyle?.recommendationPriority || null,
    targetLabels: canonicalV2?.targetStyle?.targetLabels || [],
    domains: route.domains || [],
    changeTolerance: canonicalV2?.targetStyle?.changeTolerance || null,
    changeMagnitude: route.changeMagnitude || null,
    dailyEffort: route.dailyEffort || null,
    maintenance: route.maintenance || null,
    costBand: route.costBand || null,
    reversibility: route.reversibility || null,
    actions: (route.actions || []).map((item) => ({
      domain: item.domain,
      parameter: item.parameter,
      direction: item.direction,
      strength: item.strength || null
    })),
    capturedAt:
      capturedAt || new Date().toISOString()
  });
}
