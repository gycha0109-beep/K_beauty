import {
  createFaceLabV2CanonicalResult
} from "./result-contract.js";
import {
  buildCurrentFaceProfile,
  buildFaceLabV2Quality
} from "./current-face-profile.js";
import {
  buildTargetStyleProfile,
  TARGET_STYLE_MAPPER_VERSION
} from "./target-style-mapper.js";
import { TARGET_STYLE_REGISTRY_VERSION } from "./target-style-registry.js";
import { buildStyleDelta, STYLE_DELTA_VERSION } from "./style-delta.js";
import {
  buildStyleRoutes,
  STYLE_ROUTE_GENERATOR_VERSION
} from "./route-generator.js";
import {
  buildHairExecution,
  HAIR_ENGINE_VERSION
} from "./domain/hair.js";
import {
  buildGroomingExecution,
  GROOMING_ENGINE_VERSION
} from "./domain/grooming.js";
import {
  buildMakeupExecution,
  MAKEUP_ENGINE_VERSION
} from "./domain/makeup.js";
import {
  buildColorExecution,
  COLOR_ENGINE_VERSION
} from "./domain/color.js";
import {
  buildEyewearExecution,
  EYEWEAR_ENGINE_VERSION
} from "./domain/eyewear.js";
import {
  buildAccessoriesExecution,
  ACCESSORIES_ENGINE_VERSION
} from "./domain/accessories.js";
import {
  buildLookComposer,
  LOOK_COMPOSER_VERSION
} from "./look-composer.js";
import {
  buildArchetypeFunProjection,
  ARCHETYPE_FUN_VERSION
} from "./archetype-fun.js";

export const FACE_LAB_V2_COMPOSER_VERSION = "face-lab-v2-composer-v1";

function selectRoute(routes, selectedRouteId) {
  const list = Array.isArray(routes?.routes) ? routes.routes : [];
  if (!list.length) return null;

  if (selectedRouteId) {
    const selected = list.find((route) => route.routeId === selectedRouteId);
    if (selected) return selected;
  }

  if (routes.defaultRouteId) {
    const fallback = list.find((route) => route.routeId === routes.defaultRouteId);
    if (fallback) return fallback;
  }

  return list[0];
}

function buildProductHandoff(productSpecifications) {
  if (!productSpecifications.length) {
    return {
      status: "not_requested",
      specifications: [],
      matches: [],
      catalogVersion: null
    };
  }

  return {
    status: "partial",
    specifications: productSpecifications.map((spec) => ({
      specId: spec.specId,
      domain: "makeup",
      category: spec.category,
      requiredAttributes: {
        hueFamily: spec.hueFamily,
        undertone: spec.undertone,
        depth: spec.depth,
        chroma: spec.chroma,
        opacity: spec.opacity,
        finish: spec.finish,
        glossLevel: spec.glossLevel,
        blurLevel: spec.blurLevel,
        shimmerLevel: spec.shimmerLevel,
        diffusion: spec.diffusion,
        buildability: spec.buildability
      },
      preferredAttributes: {},
      excludedAttributes: {
        constraints: spec.constraints
      }
    })),
    matches: [],
    catalogVersion: null
  };
}

export function buildFaceLabV2Canonical({
  analysis,
  surveyAnswers = {},
  targetFinderResult = null,
  selectedRouteId = null,
  locale = "ko",
  resultId = null,
  analyzedAt = null
} = {}) {
  const currentFaceProfile = buildCurrentFaceProfile(analysis, { locale });
  const quality = buildFaceLabV2Quality(analysis);
  const targetStyle = buildTargetStyleProfile({
    surveyAnswers,
    targetFinderResult
  });
  const archetypeFun = buildArchetypeFunProjection(analysis, { locale });

  const lineageBase = {
    photoAnalysisRef: null,
    observationContractVersion: analysis?.schemaVersion || null,
    faceRepresentationVersion: currentFaceProfile?.profileVersion || null,
    faceSpaceVersion: currentFaceProfile?.faceSpaceVersion || null,
    targetSurveyVersion: surveyAnswers?.schemaVersion || "face-lab-target-style-survey-v1",
    targetRegistryVersion: TARGET_STYLE_REGISTRY_VERSION,
    targetFinderSetVersion: targetFinderResult?.candidateSetVersion || null,
    targetMapperVersion: TARGET_STYLE_MAPPER_VERSION,
    styleDeltaVersion: null,
    routeGeneratorVersion: null,
    hairEngineVersion: null,
    makeupEngineVersion: null,
    colorEngineVersion: null,
    groomingEngineVersion: null,
    eyewearEngineVersion: null,
    accessoriesEngineVersion: null,
    lookComposerVersion: null,
    archetypeFunVersion: ARCHETYPE_FUN_VERSION,
    catalogVersion: null,
    skinMatchSnapshotRef: null,
    composerVersion: FACE_LAB_V2_COMPOSER_VERSION
  };

  if (targetStyle.status !== "available") {
    return createFaceLabV2CanonicalResult({
      resultId,
      analyzedAt,
      quality,
      currentFaceProfile,
      targetStyle,
      archetypeFun,
      lineage: lineageBase,
      failureReason: targetStyle.status === "needs_confirmation"
        ? "target_style_needs_confirmation"
        : null
    });
  }

  const styleDelta = buildStyleDelta({
    currentFaceProfile,
    targetStyle
  });

  const routes = buildStyleRoutes(styleDelta, { locale, targetStyle });
  const selectedRoute = selectRoute(routes, selectedRouteId);

  const routesWithSelection = selectedRoute
    ? { ...routes, selectedRouteId: selectedRoute.routeId }
    : routes;

  const hair = buildHairExecution({
    route: selectedRoute,
    targetStyle,
    currentFaceProfile
  });

  const grooming = buildGroomingExecution({
    route: selectedRoute,
    targetStyle
  });

  const makeupExecution = buildMakeupExecution({
    route: selectedRoute,
    targetStyle
  });

  const color = buildColorExecution({
    route: selectedRoute,
    targetStyle
  });

  const eyewear = buildEyewearExecution({
    route: selectedRoute,
    targetStyle
  });

  const accessories = buildAccessoriesExecution({
    route: selectedRoute,
    targetStyle
  });

  const looks = buildLookComposer({
    route: selectedRoute,
    targetStyle,
    styleDelta,
    hair,
    grooming,
    makeup: makeupExecution.result,
    color,
    eyewear,
    accessories
  });

  const productHandoff = buildProductHandoff(
    makeupExecution.productSpecifications
  );

  return createFaceLabV2CanonicalResult({
    resultId,
    analyzedAt,
    quality,
    currentFaceProfile,
    targetStyle,
    styleDelta,
    routes: routesWithSelection,
    hair,
    makeup: makeupExecution.result,
    color,
    grooming,
    eyewear,
    accessories,
    looks,
    archetypeFun,
    productHandoff,
    lineage: {
      ...lineageBase,
      styleDeltaVersion: STYLE_DELTA_VERSION,
      routeGeneratorVersion: STYLE_ROUTE_GENERATOR_VERSION,
      hairEngineVersion: HAIR_ENGINE_VERSION,
      makeupEngineVersion: MAKEUP_ENGINE_VERSION,
      colorEngineVersion: COLOR_ENGINE_VERSION,
      groomingEngineVersion: GROOMING_ENGINE_VERSION,
      eyewearEngineVersion: EYEWEAR_ENGINE_VERSION,
      accessoriesEngineVersion: ACCESSORIES_ENGINE_VERSION,
      lookComposerVersion: LOOK_COMPOSER_VERSION
    }
  });
}
