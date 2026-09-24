export const GROOMING_ENGINE_VERSION = "face-lab-grooming-engine-v1";

function relevantActions(route) {
  return Array.isArray(route?.actions)
    ? route.actions.filter((item) => ["brow_grooming", "facial_hair"].includes(item?.domain))
    : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildGroomingExecution({ route, targetStyle } = {}) {
  const scope = new Set(Array.isArray(targetStyle?.stylingScope) ? targetStyle.stylingScope : []);
  const requested = scope.has("brow_grooming") || scope.has("facial_hair") || scope.has("auto_scope");

  if (!requested) {
    return {
      status: "not_requested",
      version: GROOMING_ENGINE_VERSION,
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

  const actions = relevantActions(route);
  if (!actions.length) {
    return {
      status: "not_applicable",
      version: GROOMING_ENGINE_VERSION,
      routeId: route?.routeId || null,
      targetProfileVersion: targetStyle?.profileVersion || null,
      value: null,
      reason: "선택한 경로는 별도의 그루밍 변화를 사용하지 않습니다.",
      confidence: null,
      evidence: [],
      productSpecificationRefs: [],
      unavailableReason: null
    };
  }

  const brows = [];
  const facialHair = [];
  const maintenancePlan = [];

  actions.forEach((item) => {
    if (item.domain === "brow_grooming") {
      if (item.parameter === "definition") brows.push("눈썹 경계를 한 단계 더 또렷하게 정리");
      if (item.parameter === "angularity") brows.push("눈썹의 꺾이는 각을 완화하고 자연스러운 흐름 유지");
      if (item.parameter === "shapeControl") brows.push("눈썹 시작점·산·꼬리의 형태를 흐트러지지 않게 정리");
      maintenancePlan.push("매일 모양을 새로 만들기보다 기본 정리 상태를 유지");
    }

    if (item.domain === "facial_hair") {
      facialHair.push(item.explanation);
    }
  });

  return {
    status: "available",
    version: GROOMING_ENGINE_VERSION,
    routeId: route.routeId,
    targetProfileVersion: targetStyle?.profileVersion || null,
    value: {
      brows: unique(brows),
      complexion: [],
      lipTone: [],
      facialHair: unique(facialHair),
      sideburns: [],
      hairline: [],
      maintenancePlan: unique(maintenancePlan)
    },
    reason: actions[0].explanation,
    confidence: 0.7,
    evidence: actions.map((item) => `style_delta:${item.parameter}`),
    productSpecificationRefs: [],
    unavailableReason: null
  };
}
