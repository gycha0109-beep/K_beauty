// Read-only presentation helpers. Never re-run policies or turn missing evidence into a verdict.
export const FULL_REPORT_SECTIONS = [
  { key: "today-start-hub", ko: "오늘의 리포트", en: "Today's report", icon: "note" },
  { key: "morning-routine", ko: "현재 루틴 점검", en: "Current routine review", icon: "bottle", focus: ["current_product_fit", "routine_order"] },
  { key: "problem-tracking", ko: "문제 추적", en: "Issue tracking", icon: "search", focus: [] },
  { key: "product-plan", ko: "다음 변화 플랜", en: "Next change plan", icon: "bars", focus: ["functional_addition"] },
  { key: "adjustment-guide", ko: "상황별 대응", en: "Situational care", icon: "shield", focus: ["condition_response"] }
];

export const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
export const text = (value) => typeof value === "string" ? value : "";
export const verdictLabels = { keep: ["그대로 사용", "Keep using"], adjust: ["사용 방식 조정", "Adjust use"], hold: ["잠시 보류", "Pause"], check_needed: ["확인 필요", "Check needed"] };
export function verdictLabel(status, locale) { return (verdictLabels[status] || verdictLabels.check_needed)[locale === "en" ? 1 : 0]; }
export function verdictCounts(report) {
  // Counts are saved slot verdict counts, not unique product counts; AM/PM can differ.
  const items = list(report?.currentProductVerdicts);
  return Object.fromEntries(Object.keys(verdictLabels).map((status) => [status, items.filter((item) => item.status === status).length]));
}
export function savedPlan(report) { return report?.functionalPlan || report?.decisionBundle?.functionalPlan || null; }
export function savedAudit(report) { return report?.functionalRoutineAudit || report?.decisionBundle?.functionalRoutineAudit || null; }
export function finalAction(report, locale = "ko") {
  // Effective canonical guidance is already resolved upstream. No risk priority is recomputed here.
  const plan = savedPlan(report);
  return text(plan?.routineGuide?.weeklyAction) || text(savedAudit(report)?.actionMessage) || text(plan?.baseApproach) ||
    (locale === "en" ? "More information is needed before deciding your next action." : "다음 행동을 결정하기 전에 저장된 정보를 확인해 주세요.");
}
export function intakeAnswer(report, field, locale = "ko") {
  const intake = report?.premiumIntake;
  const state = intake?.stepStates?.recentContext || "unknown";
  if (state !== "answered") return locale === "en" ? (state === "skipped" ? "Skipped" : "Unknown") : (state === "skipped" ? "응답 건너뜀" : "확인 필요");
  const value = intake?.answers?.[field];
  return locale === "en" ? ({ yes: "Reported", no: "Not reported", unknown: "Unknown" }[value] || "Unknown") : ({ yes: "있다고 응답", no: "없다고 응답", unknown: "확인 필요" }[value] || "확인 필요");
}
export function focusedSection(report) {
  const intake = report?.premiumIntake;
  if (intake?.stepStates?.decisionFocus !== "answered") return null;
  return FULL_REPORT_SECTIONS.find((section) => section.focus?.includes(intake.decisionFocus))?.key || null;
}
