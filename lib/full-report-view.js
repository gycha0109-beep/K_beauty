// Read-only joins and display ordering. Policy, persistence and unknown states stay upstream.
export const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
export const words = (value) => typeof value === "string" ? value : "";
export const saved = (report, key) => report?.[key] ?? report?.decisionBundle?.[key];
export const selections = (report) => list(Array.isArray(report?.currentProducts) ? report.currentProducts : report?.currentProducts?.selections);
export const verdicts = (report) => list(saved(report, "currentProductVerdicts"));
export const snapshot = (item) => item?.productSnapshot || item?.product || null;
export function productName(item, locale = "ko") {
  const product = snapshot(item);
  if (["selected", "not_in_db"].includes(item?.status) && (product?.name || product?.productName)) return product.name || product.productName;
  return locale === "en"
    ? ({ not_in_db: "In use · not in database", not_using: "Not using", selected: "Selected product" }[item?.status] || "Usage unanswered")
    : ({ not_in_db: "사용 중 · DB 미등록", not_using: "사용 안 함", selected: "선택한 제품" }[item?.status] || "사용 여부 미응답");
}
export function intakeSignal(report, field) {
  const intake = report?.premiumIntake;
  if (intake?.stepStates?.recentContext !== "answered") return intake?.stepStates?.recentContext === "skipped" ? "skipped" : "unknown";
  return ["yes", "no"].includes(intake?.answers?.[field]) ? intake.answers[field] : "unknown";
}
export function reviewItems(report) {
  // Attention ordering only; never a cause ranking or a newly calculated verdict.
  const rank = { hold: 0, check_needed: 1, adjust: 2 };
  return verdicts(report).filter((item) => item.status in rank).sort((a, b) => rank[a.status] - rank[b.status]);
}
export function selectionForVerdict(report, verdict) {
  const items = selections(report);
  if (verdict?.productId) {
    const byId = items.find((item) => String(snapshot(item)?.id || item.productId || "") === String(verdict.productId));
    return byId || null;
  }
  const category = words(verdict?.slotKey).split(".").at(-1);
  return items.find((item) => item.category === category) || null;
}
export function verdictForSelection(report, selection, mode, compatibleSlotKeys = []) {
  if (!selection || !["selected", "not_in_db"].includes(selection.status)) return null;
  const id = snapshot(selection)?.id || selection.productId;
  return verdicts(report).find((item) => {
    if (!words(item.slotKey).startsWith(`${mode}.`)) return false;
    if (item.productId) return Boolean(id) && String(item.productId) === String(id);
    return item.slotKey === `${mode}.${selection.category}` || compatibleSlotKeys.includes(item.slotKey);
  }) || null;
}
export function groupVerdicts(report, items) {
  const groups = new Map();
  for (const item of items) {
    const selection = selectionForVerdict(report, item);
    // Combine AM/PM only for an identified selection and identical verdict status.
    const key = selection ? `${selections(report).indexOf(selection)}:${item.status}` : item.slotKey;
    if (!groups.has(key)) groups.set(key, { selection, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}
export function conditionItems(conditionPlan, responses) {
  // An explicit canonical empty array is authoritative; do not revive legacy scenarios.
  return list(Array.isArray(conditionPlan?.responses) ? conditionPlan.responses : responses);
}
export function functionalMatrix(report, plan) {
  const items = verdicts(report);
  const canExpose = plan?.planMode === "START" && plan?.candidateExposureSuppressed !== true;
  return {
    keep: items.filter((item) => item.status === "keep"),
    next: canExpose ? list(plan?.productCandidates) : [],
    hold: items.filter((item) => item.status === "hold"),
    review: items.filter((item) => ["adjust", "check_needed"].includes(item.status)),
    canExpose
  };
}
