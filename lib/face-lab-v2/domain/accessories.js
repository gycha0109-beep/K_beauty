export const ACCESSORIES_ENGINE_VERSION = "face-lab-accessories-engine-v2";

function actions(route) {
  return Array.isArray(route?.actions)
    ? route.actions.filter((item) => item?.domain === "accessories")
    : [];
}

export function buildAccessoriesExecution({ route, targetStyle } = {}) {
  const scope = new Set(Array.isArray(targetStyle?.stylingScope) ? targetStyle.stylingScope : []);
  const exclusions = new Set(
    Array.isArray(targetStyle?.constraints?.hardExclusions)
      ? targetStyle.constraints.hardExclusions
      : []
  );
  const requested =
    (scope.has("accessories") || scope.has("auto_scope")) &&
    !exclusions.has("accessories_disabled");

  if (!requested) {
    return {
      status: "not_requested",
      version: ACCESSORIES_ENGINE_VERSION,
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
      version: ACCESSORIES_ENGINE_VERSION,
      routeId: route?.routeId || null,
      targetProfileVersion: targetStyle?.profileVersion || null,
      value: null,
      reason: "선택한 경로는 액세서리 변화를 사용하지 않습니다.",
      confidence: null,
      evidence: [],
      productSpecificationRefs: [],
      unavailableReason: null
    };
  }

  const visualWeight = [];
  const examples = [];

  list.forEach((item) => {
    if (item.parameter === "visualWeight") {
      visualWeight.push(
        item.direction === "increase"
          ? "얼굴 주변 포인트의 존재감을 높임"
          : "작고 가벼운 포인트 위주로 정리"
      );
      examples.push({
        category: "face_adjacent_accessory",
        direction: item.direction,
        whyItWorks: item.explanation
      });
    }

    if (item.parameter === "visualNoise") {
      visualWeight.push("포인트 수를 줄이고 한두 요소만 남김");
      examples.push({
        category: "face_adjacent_accessory",
        direction: "reduce_count",
        whyItWorks: item.explanation
      });
    }
  });

  return {
    status: "available",
    version: ACCESSORIES_ENGINE_VERSION,
    routeId: route.routeId,
    targetProfileVersion: targetStyle?.profileVersion || null,
    value: {
      scale: [],
      angularity: [],
      curvature: [],
      length: [],
      visualWeight,
      colorContrast: [],
      examples
    },
    reason: list[0].explanation,
    confidence: 0.6,
    evidence: list.map((item) => `style_delta:${item.parameter}`),
    productSpecificationRefs: [],
    unavailableReason: null
  };
}
