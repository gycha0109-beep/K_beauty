export const LOOK_COMPOSER_VERSION = "face-lab-look-composer-v1";

function available(result) {
  return result?.status === "available" && result.value;
}

function domainSummary(name, result) {
  if (!available(result)) return null;

  const map = {
    hair: result.value.examples?.[0]?.label || result.value.silhouette?.[0] || result.reason,
    grooming: result.value.brows?.[0] || result.value.facialHair?.[0] || result.reason,
    makeup:
      result.value.eyes?.direction?.[0] ||
      result.value.lips?.direction?.[0] ||
      result.value.complexion?.direction?.[0] ||
      result.reason,
    color: result.value.applicationNotes?.[0] || result.value.temperatureDirection || result.reason,
    eyewear:
      result.value.angularity?.[0] ||
      result.value.curvature?.[0] ||
      result.value.visualWeight?.[0] ||
      result.reason,
    accessories: result.value.visualWeight?.[0] || result.reason
  };

  const summary = map[name];
  return summary ? { domain: name, summary } : null;
}

export function buildLookComposer({
  route,
  targetStyle,
  styleDelta,
  hair,
  grooming,
  makeup,
  color,
  eyewear,
  accessories
} = {}) {
  if (!route || !targetStyle || targetStyle.status !== "available") {
    return {
      status: "unavailable",
      version: LOOK_COMPOSER_VERSION,
      looks: [],
      visualConflicts: [],
      evidence: [],
      confidence: null,
      unavailableReason: "route_or_target_unavailable"
    };
  }

  const pieces = [
    domainSummary("hair", hair),
    domainSummary("grooming", grooming),
    domainSummary("makeup", makeup),
    domainSummary("color", color),
    domainSummary("eyewear", eyewear),
    domainSummary("accessories", accessories)
  ].filter(Boolean);

  if (!pieces.length) {
    return {
      status: "insufficient_evidence",
      version: LOOK_COMPOSER_VERSION,
      looks: [],
      visualConflicts: [],
      evidence: [],
      confidence: null,
      unavailableReason: "no_execution_domains_available"
    };
  }

  const conflicts = Array.isArray(styleDelta?.conflicts)
    ? styleDelta.conflicts.map((item, index) => ({
        conflictId: `style-delta-conflict-${index + 1}`,
        domains: [],
        description: item.description,
        impact: item.type,
        resolution: item.resolution || null
      }))
    : [];

  const strongAccentCount = (route.actions || []).filter(
    (item) =>
      item.strength === "strong" &&
      ["makeup", "accessories", "eyewear"].includes(item.domain)
  ).length;

  if (strongAccentCount >= 2) {
    conflicts.push({
      conflictId: "accent-overload",
      domains: ["makeup", "accessories", "eyewear"],
      description: "강한 포인트가 둘 이상 겹치면 추구미보다 개별 요소가 먼저 보일 수 있습니다.",
      impact: "visual_weight_competition",
      resolution: "주 포인트 하나를 남기고 나머지는 한 단계 낮춥니다."
    });
  }

  const titleLabels = targetStyle.targetLabels?.slice(0, 2) || [];

  return {
    status: "available",
    version: LOOK_COMPOSER_VERSION,
    looks: [
      {
        lookId: `look-${route.routeId}`,
        routeId: route.routeId,
        title: route.title,
        summary: pieces.map((item) => item.summary).slice(0, 3).join(" · "),
        targetLabels: titleLabels,
        hairRef: available(hair) ? hair.version : null,
        makeupRef: available(makeup) ? makeup.version : null,
        colorRef: available(color) ? color.version : null,
        groomingRef: available(grooming) ? grooming.version : null,
        eyewearRef: available(eyewear) ? eyewear.version : null,
        accessoriesRef: available(accessories) ? accessories.version : null,
        whyItWorks: route.whyThisRoute,
        conflictsResolved: conflicts
          .filter((item) => item.resolution)
          .map((item) => item.resolution),
        remainingTradeoffs: route.constraintFit?.softTradeoffs || []
      }
    ],
    visualConflicts: conflicts,
    evidence: [
      ...(styleDelta?.evidence || []),
      ...pieces.map((item) => `execution_domain:${item.domain}`)
    ],
    confidence: typeof styleDelta?.confidence === "number" ? styleDelta.confidence : null,
    unavailableReason: null
  };
}
