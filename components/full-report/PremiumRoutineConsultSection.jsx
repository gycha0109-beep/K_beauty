"use client";
import { useState } from "react";
import SafeProductImage from "@/components/common/SafeProductImage";
import { getCurrentProductCategoryLabel, getCurrentProductRoutineSlots, resolveCurrentProductSemantics } from "@/lib/current-products";
import { getCurrentProductVerdictSlotKey } from "@/lib/current-product-verdicts";
import { list, saved, selections, verdictForSelection, snapshot, productName } from "@/lib/full-report-view";
import { Header, Badge, Disclosure, Evidence, Notice, Empty, Icon, Next, styles } from "./ReportUI";

const USAGE = {
  ko: { morning: "아침 사용", evening: "저녁 사용", both: "아침 · 저녁 사용", occasional: "가끔 사용", daily: "매일", few_times_week: "주 몇 회", weekly_or_less: "주 1회 이하", as_needed: "필요할 때", good: "만족", okay: "보통", bad: "불편함", unknown: "잘 모르겠음" },
  en: { morning: "AM use", evening: "PM use", both: "AM · PM use", occasional: "Occasionally", daily: "Daily", few_times_week: "A few times a week", weekly_or_less: "Weekly or less", as_needed: "As needed", good: "Satisfied", okay: "Okay", bad: "Uncomfortable", unknown: "Unsure" }
};
const ROLE_CATEGORIES = { cleanser: ["cleanser"], hydration_base: ["toner_essence", "toner_pad", "moisturizer"], functional_leave_on: ["treatment"], sunscreen: ["sunscreen"] };

function productVerdict(report, selection, mode) {
  if (!selection || selection.status === "not_using" || !["selected", "not_in_db"].includes(selection.status)) return null;
  const category = resolveCurrentProductSemantics(selection)?.canonicalCategory || selection.category;
  const slots = getCurrentProductRoutineSlots(selection).filter((slot) => slot.mode === mode);
  return verdictForSelection(report, selection, mode, slots.map((slot) => getCurrentProductVerdictSlotKey(mode, slot.slot, category)));
}
function RoutineRow({ step, selection, index, report, mode, locale }) {
  const en = locale === "en";
  const usage = USAGE[en ? "en" : "ko"];
  const verdict = productVerdict(report, selection, mode);
  const product = snapshot(selection);
  return <details className={styles.routineRow}>
    <summary><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><div><h3>{selection ? getCurrentProductCategoryLabel(selection.category, locale) : step.title || step.stepName || (en ? "Saved step" : "저장된 단계")}</h3><div className={styles.productLine}>{product ? <SafeProductImage product={product} alt="" className={styles.productImage} fallback={<span className={styles.productPlaceholder}><Icon/></span>}/> : <span className={styles.productPlaceholder}><Icon/></span>}<div><p>{selection ? productName(selection, locale) : en ? "Current product not recorded" : "현재 제품 미기록"}</p><p className={styles.metadata}>{[usage[selection?.useTime] || (en ? "Time not recorded" : "사용 시간 미기록"), usage[selection?.useFrequency]].filter(Boolean).join(" · ")}</p>{verdict && verdict.status !== "keep" && <p className={styles.action}>{verdict.adjustment || verdict.title}</p>}</div></div></div><span className={styles.rowEnd}>{verdict ? <Badge status={verdict.status} locale={locale}/> : <Badge>{selection?.status === "not_using" ? (en ? "Not using" : "미사용") : en ? "Unknown" : "미확인"}</Badge>}<Icon name="arrow"/></span></summary>
    <div className={styles.detailBody}>
      {step.title && <p>{en ? "Routine step" : "루틴 단계"} · {step.title}{step.status ? ` · ${step.status}` : ""}</p>}
      {(step.action || step.instruction) && <p>{step.action || step.instruction}</p>}{step.frequency && <p>{en ? "Recommended frequency" : "권장 빈도"} · {step.frequency}</p>}
      {selection?.satisfaction && <p>{en ? "Satisfaction" : "사용 만족도"} · {usage[selection.satisfaction] || selection.satisfaction}</p>}
      {selection?.status === "not_in_db" && <p>{en ? "In use; detailed product fit is unknown." : "사용 중인 제품이며, DB 미등록으로 상세 적합도는 미확인이에요."}</p>}
      {verdict ? <Evidence item={verdict} locale={locale}/> : <p>{en ? "No product verdict is stored for this window." : "이 시간대의 개별 제품 판단은 저장되지 않았어요."}</p>}
      <Evidence item={{ caution: step.caution, adjustment: step.adjustment !== step.caution ? step.adjustment : null, reasonCodes: step.reasonCodes }} locale={locale}/>
      {step.product && <Disclosure title={en ? "Saved step candidate" : "이 단계의 저장된 후보"}><p>{step.product.name}</p></Disclosure>}
    </div>
  </details>;
}
export default function PremiumRoutineConsultSection({ report = {}, morningSteps = [], nightSteps = [], locale = "ko", onNavigate }) {
  const [mode, setMode] = useState("am");
  const en = locale === "en";
  const plan = saved(report, "routinePlan");
  const canonical = mode === "am" ? plan?.morningSteps : plan?.nightSteps;
  const steps = list(Array.isArray(canonical) ? canonical : mode === "am" ? morningSteps : nightSteps);
  const used = new Set();
  const rows = steps.flatMap((step) => {
    const categories = ROLE_CATEGORIES[step.productRole] || [];
    const products = selections(report).filter((selection) => {
      const category = resolveCurrentProductSemantics(selection)?.canonicalCategory || selection.category;
      const timeMatches = !selection.useTime || ["both", "occasional", mode === "am" ? "morning" : "evening"].includes(selection.useTime);
      if (used.has(selection) || !categories.includes(category) || !timeMatches) return false;
      used.add(selection); return true;
    });
    return products.length ? products.map((selection) => ({ step, selection })) : [{ step, selection: null }];
  });
  const remaining = selections(report).filter((selection) => !used.has(selection));
  return <section className={styles.page} data-report-section="routine" data-routine-source={Array.isArray(canonical) ? "canonical" : "legacy_adapter"}>
    <Header number="01" title={en ? "Current routine review" : "현재 루틴 점검"} locale={locale} onNavigate={onNavigate}/>
    <div className={styles.segmented} aria-label={en ? "Routine time" : "루틴 시간"}>{["am", "pm"].map((time) => <button type="button" key={time} aria-pressed={mode === time} onClick={() => setMode(time)}>{time.toUpperCase()}<Icon name={time === "am" ? "sun" : "moon"}/></button>)}</div>
    <ol className={styles.routineList}>{rows.map((row, i) => <li key={`${mode}-${i}`}><RoutineRow {...row} index={i} report={report} mode={mode} locale={locale}/></li>)}</ol>
    {!steps.length && <Empty>{en ? "No saved routine order." : "저장된 루틴 순서가 없어요."}</Empty>}
    {remaining.length > 0 && <Disclosure title={en ? "Other recorded products" : "그 외 입력한 현재 제품"}>{remaining.map((selection, i) => <RoutineRow key={i} step={{}} selection={selection} index={i} report={report} mode={mode} locale={locale}/>)}</Disclosure>}
    {list(report.avoidCombinations).length > 0 && <Disclosure title={en ? "Routine cautions" : "루틴 주의사항"}>{report.avoidCombinations.map((item, i) => <Notice key={i}>{item}</Notice>)}</Disclosure>}
    <Next onClick={() => onNavigate?.("problem-tracking")}>{en ? "Review change signals" : "변화 신호 확인하기"}</Next>
  </section>;
}
