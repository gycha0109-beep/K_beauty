export const HAIR_ENGINE_VERSION = "face-lab-hair-engine-v1";

function actionsForRoute(route) {
  return Array.isArray(route?.actions)
    ? route.actions.filter((item) => item?.domain === "hair")
    : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function translateAction(item) {
  switch (item.parameter) {
    case "outlineDefinition":
      return {
        parting: ["가르마와 외곽선을 더 또렷하게 정리"],
        silhouette: ["불필요한 옆 퍼짐을 줄인 정돈된 실루엣"],
        example: {
          styleKey: "defined-part-clean-outline",
          label: "정돈된 가르마 + 클린 외곽",
          whyItWorks: item.explanation,
          requiredParameters: ["part_definition", "outline_control"]
        }
      };
    case "curvature":
      return {
        curvature: item.direction === "maintain" ? ["현재 곡선 흐름을 자연스럽게 유지"] : ["부드러운 곡선과 C/S컬 흐름 추가"],
        layerDirection: ["얼굴선 주변 레이어를 무겁지 않게 연결"],
        example: {
          styleKey: "soft-curve-layers",
          label: "소프트 커브 레이어",
          whyItWorks: item.explanation,
          requiredParameters: ["curvature", "light_layers"]
        }
      };
    case "finishControl":
      return {
        texture: ["잔머리와 표면 질감을 과하게 흩뜨리지 않고 정돈"],
        silhouette: ["실루엣의 경계를 일정하게 유지"],
        example: {
          styleKey: "controlled-finish",
          label: "컨트롤드 피니시",
          whyItWorks: item.explanation,
          requiredParameters: ["finish_control"]
        }
      };
    case "textureFreedom":
      return {
        texture: ["완전히 고정하지 않은 자연스러운 텍스처"],
        curvature: ["원래 결을 살리는 가벼운 움직임"],
        example: {
          styleKey: "natural-texture",
          label: "내추럴 텍스처",
          whyItWorks: item.explanation,
          requiredParameters: ["texture_freedom"]
        }
      };
    case "silhouetteControl":
      return {
        silhouette: ["얼굴 주변 볼륨 포인트를 분산시키지 않고 정돈"],
        sideVolume: ["사이드 볼륨을 필요 이상으로 넓히지 않음"],
        example: {
          styleKey: "calm-silhouette",
          label: "차분한 실루엣",
          whyItWorks: item.explanation,
          requiredParameters: ["silhouette_control"]
        }
      };
    case "movement":
      return {
        layerDirection: ["가벼운 레이어와 움직임 추가"],
        curvature: ["고정된 직선보다 자연스러운 흐름 허용"],
        example: {
          styleKey: "light-movement-layers",
          label: "라이트 무브먼트 레이어",
          whyItWorks: item.explanation,
          requiredParameters: ["movement", "layers"]
        }
      };
    default:
      return {};
  }
}

export function buildHairExecution({ route, targetStyle } = {}) {
  const scope = new Set(Array.isArray(targetStyle?.stylingScope) ? targetStyle.stylingScope : []);

  if (!scope.has("hair") && !scope.has("auto_scope")) {
    return {
      status: "not_requested",
      version: HAIR_ENGINE_VERSION,
      routeId: route?.routeId || null,
      targetProfileVersion: targetStyle?.profileVersion || null,
      value: null,
      reason: null,
      confidence: null,
      evidence: [],
      productSpecificationRefs: [],
      unavailableReason: null
    };
  }

  const actions = actionsForRoute(route);
  if (!actions.length) {
    return {
      status: "not_applicable",
      version: HAIR_ENGINE_VERSION,
      routeId: route?.routeId || null,
      targetProfileVersion: targetStyle?.profileVersion || null,
      value: null,
      reason: "선택한 경로는 헤어 변화 없이 추구미에 접근합니다.",
      confidence: null,
      evidence: [],
      productSpecificationRefs: [],
      unavailableReason: null
    };
  }

  const translated = actions.map(translateAction);
  const examples = translated.map((item) => item.example).filter(Boolean);

  return {
    status: "available",
    version: HAIR_ENGINE_VERSION,
    routeId: route.routeId,
    targetProfileVersion: targetStyle?.profileVersion || null,
    value: {
      parting: unique(translated.flatMap((item) => item.parting || [])),
      fringe: unique(translated.flatMap((item) => item.fringe || [])),
      crownVolume: unique(translated.flatMap((item) => item.crownVolume || [])),
      sideVolume: unique(translated.flatMap((item) => item.sideVolume || [])),
      templeCoverage: unique(translated.flatMap((item) => item.templeCoverage || [])),
      faceLineExposure: unique(translated.flatMap((item) => item.faceLineExposure || [])),
      lengthDirection: unique(translated.flatMap((item) => item.lengthDirection || [])),
      layerDirection: unique(translated.flatMap((item) => item.layerDirection || [])),
      curvature: unique(translated.flatMap((item) => item.curvature || [])),
      texture: unique(translated.flatMap((item) => item.texture || [])),
      silhouette: unique(translated.flatMap((item) => item.silhouette || [])),
      examples,
      avoidOrModerate: []
    },
    reason: actions[0].explanation,
    confidence: 0.72,
    evidence: actions.map((item) => `style_delta:${item.parameter}`),
    productSpecificationRefs: [],
    unavailableReason: null
  };
}
