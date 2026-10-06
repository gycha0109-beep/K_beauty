import {
  buildFaceLabV2Canonical
} from "./canonical-composer.js";
import {
  buildFaceLabRenderSpec
} from "./render-adapter.js";
import {
  normalizeFaceLabV2PersistencePayload
} from "./survey-contract.js";
import {
  hashFaceLabAuthorityValue
} from "./simulation-authority-core.js";

export const FACE_LAB_SIMULATION_RENDER_AUTHORITY_VERSION =
  "face-lab-simulation-render-authority-v1";

const COMMITTED_ROUTE_STATES = new Set([
  "user_selected",
  "single_route_auto"
]);

export function normalizeFaceLabSimulationState(rawState) {
  return normalizeFaceLabV2PersistencePayload(rawState);
}

export function buildFaceLabSimulationCanonical({
  analysis,
  normalizedState,
  locale = "ko"
} = {}) {
  return buildFaceLabV2Canonical({
    analysis,
    surveyAnswers:
      normalizedState?.surveyAnswers,
    targetFinderResult:
      normalizedState?.targetFinderResult,
    selectedRouteId:
      normalizedState?.selectedRouteId,
    locale
  });
}

export function hasCommittedFaceLabSimulationRoute(canonicalV2) {
  return Boolean(
    COMMITTED_ROUTE_STATES.has(
      canonicalV2?.routes?.selectionState
    ) &&
    canonicalV2?.appearanceHandoff?.status === "available"
  );
}

export function findFaceLabSimulationCanonicalLook(canonicalV2) {
  if (
    canonicalV2?.looks?.status !== "available" ||
    !Array.isArray(canonicalV2.looks.looks)
  ) {
    return null;
  }

  const routeId =
    canonicalV2?.appearanceHandoff?.routeId;

  if (!routeId) return null;

  return canonicalV2.looks.looks.find(
    (look) => look?.routeId === routeId
  ) || null;
}

export function buildFaceLabSimulationRenderSpec({
  canonicalV2,
  canonicalLook
} = {}) {
  return buildFaceLabRenderSpec({
    appearanceHandoff:
      canonicalV2?.appearanceHandoff,
    look: canonicalLook,
    bindingsBySlot: {},
    presentationPreference:
      canonicalV2
        ?.targetStyle
        ?.presentationPreference ||
      null
  });
}

export function hashFaceLabSimulationRenderSpec(renderSpec) {
  if (renderSpec?.status !== "ready") {
    return null;
  }

  return hashFaceLabAuthorityValue(renderSpec);
}

export function reconstructFaceLabSimulationRenderAuthority({
  analysis,
  rawState,
  locale = "ko"
} = {}) {
  const normalizedState =
    normalizeFaceLabSimulationState(rawState);

  const canonicalV2 =
    buildFaceLabSimulationCanonical({
      analysis,
      normalizedState,
      locale
    });

  if (
    canonicalV2?.targetStyle?.status !== "available"
  ) {
    return {
      version: FACE_LAB_SIMULATION_RENDER_AUTHORITY_VERSION,
      status: "invalid",
      reason: "target_style_not_confirmed"
    };
  }

  if (!hasCommittedFaceLabSimulationRoute(canonicalV2)) {
    return {
      version: FACE_LAB_SIMULATION_RENDER_AUTHORITY_VERSION,
      status: "invalid",
      reason: "route_not_committed"
    };
  }

  const canonicalLook =
    findFaceLabSimulationCanonicalLook(canonicalV2);

  if (!canonicalLook) {
    return {
      version: FACE_LAB_SIMULATION_RENDER_AUTHORITY_VERSION,
      status: "invalid",
      reason: "canonical_look_unavailable"
    };
  }

  const renderSpec =
    buildFaceLabSimulationRenderSpec({
      canonicalV2,
      canonicalLook
    });

  if (renderSpec?.status !== "ready") {
    return {
      version: FACE_LAB_SIMULATION_RENDER_AUTHORITY_VERSION,
      status: "invalid",
      reason: "render_spec_unavailable"
    };
  }

  return {
    version: FACE_LAB_SIMULATION_RENDER_AUTHORITY_VERSION,
    status: "ready",
    reason: "render_authority_reconstructed",
    normalizedState,
    canonicalV2,
    canonicalLook,
    renderSpec,
    renderSpecSha256:
      hashFaceLabSimulationRenderSpec(renderSpec)
  };
}
