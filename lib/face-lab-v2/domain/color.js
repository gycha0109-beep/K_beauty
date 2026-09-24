export const COLOR_ENGINE_VERSION = "face-lab-color-engine-v1";

function actions(route) {
  return Array.isArray(route?.actions) ? route.actions.filter((item) => item?.domain === "color") : [];
}

export function buildColorExecution({ route, targetStyle } = {}) {
  const scope = new Set(Array.isArray(targetStyle?.stylingScope) ? targetStyle.stylingScope : []);

  if (!scope.has("color") && !scope.has("auto_scope")) {
    return {
      status: "not_requested",
      version: COLOR_ENGINE_VERSION,
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

  const list = actions(route);
  if (!list.length) {
    return {
      status: "not_applicable",
      version: COLOR_ENGINE_VERSION,
      routeId: route?.routeId || null,
      targetProfileVersion: targetStyle?.profileVersion || null,
      value: null,
      reason: "선택한 경로는 컬러 변화를 사용하지 않습니다.",
      confidence: null,
      evidence: [],
      productSpecificationRefs: [],
      unavailableReason: null
    };
  }

  const value = {
    temperatureDirection: null,
    depthDirection: null,
    chromaDirection: null,
    contrastDirection: null,
    preferredFamilies: [],
    moderateFamilies: [],
    applicationNotes: [],
    qualityWarnings: []
  };

  list.forEach((item) => {
    if (item.parameter === "temperatureDirection") {
      const axis = targetStyle?.vector?.warmCool;
      value.temperatureDirection =
        typeof axis === "number" && axis > 0.5 ? "cooler" : "warmer";
      value.applicationNotes.push(item.explanation);
    }

    if (item.parameter === "accentFreshness") {
      value.chromaDirection = "slightly_clearer";
      value.applicationNotes.push(item.explanation);
    }
  });

  return {
    status: "available",
    version: COLOR_ENGINE_VERSION,
    routeId: route.routeId,
    targetProfileVersion: targetStyle?.profileVersion || null,
    value,
    reason: list[0].explanation,
    confidence: 0.64,
    evidence: list.map((item) => `style_delta:${item.parameter}`),
    productSpecificationRefs: [],
    unavailableReason: null
  };
}
