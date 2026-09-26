export const EYEWEAR_ENGINE_VERSION = "face-lab-eyewear-engine-v2";

function actions(route) {
  return Array.isArray(route?.actions)
    ? route.actions.filter((item) => item?.domain === "eyewear")
    : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildEyewearExecution({ route, targetStyle } = {}) {
  const scope = new Set(Array.isArray(targetStyle?.stylingScope) ? targetStyle.stylingScope : []);
  const exclusions = new Set(
    Array.isArray(targetStyle?.constraints?.hardExclusions)
      ? targetStyle.constraints.hardExclusions
      : []
  );
  const requested =
    (scope.has("eyewear") || scope.has("auto_scope")) &&
    !exclusions.has("eyewear_disabled");

  if (!requested) {
    return {
      status: "not_requested",
      version: EYEWEAR_ENGINE_VERSION,
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
      version: EYEWEAR_ENGINE_VERSION,
      routeId: route?.routeId || null,
      targetProfileVersion: targetStyle?.profileVersion || null,
      value: null,
      reason: "선택한 경로는 안경 변화를 사용하지 않습니다.",
      confidence: null,
      evidence: [],
      productSpecificationRefs: [],
      unavailableReason: null
    };
  }

  const angularity = [];
  const curvature = [];
  const rimThickness = [];
  const visualWeight = [];

  list.forEach((item) => {
    if (item.parameter === "angularity") angularity.push("직선과 각이 읽히는 프레임을 우선");
    if (item.parameter === "curvature") curvature.push("곡선이 섞인 프레임으로 외곽선을 완화");
    if (item.parameter === "rimDefinition") rimThickness.push("프레임 마감과 상단 라인이 흐리지 않은 디자인");
    if (item.parameter === "visualWeight") {
      visualWeight.push(
        item.direction === "increase"
          ? "프레임 존재감을 한 단계 높임"
          : "얇고 가벼운 프레임 쪽으로 이동"
      );
    }
  });

  return {
    status: "available",
    version: EYEWEAR_ENGINE_VERSION,
    routeId: route.routeId,
    targetProfileVersion: targetStyle?.profileVersion || null,
    value: {
      frameWidth: [],
      frameHeight: [],
      angularity: unique(angularity),
      curvature: unique(curvature),
      rimThickness: unique(rimThickness),
      bridgeDirection: [],
      browAlignment: [],
      visualWeight: unique(visualWeight),
      colorContrast: [],
      examples: []
    },
    reason: list[0].explanation,
    confidence: 0.62,
    evidence: list.map((item) => `style_delta:${item.parameter}`),
    productSpecificationRefs: [],
    unavailableReason: null
  };
}
