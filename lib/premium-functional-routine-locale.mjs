// Presentation only: do not infer new cadence, ordering or ingredient exclusions.
export function buildFunctionalRoutineGuideLines(plan = {}, locale = "ko") {
  const guide = plan?.routineGuide && typeof plan.routineGuide === "object"
    ? plan.routineGuide
    : {};
  const en = locale === "en";
  return [
    plan?.planMode === "HOLD"
      ? (en ? "Hold: do not add a new active for now." : "보류: 현재 새 기능성을 추가하지 마세요.")
      : null,
    guide.time ? `${en ? "Timing" : "사용 시간"} · ${guide.time}` : null,
    guide.order || null,
    guide.frequency ? `${en ? "Frequency" : "사용 빈도"} · ${guide.frequency}` : null,
    guide.avoid ? `${en ? "Avoid or adjust" : "피하거나 조정"} · ${guide.avoid}` : null,
    guide.review || plan?.reviewCondition || null
  ].filter((value) => typeof value === "string" && value.trim());
}
