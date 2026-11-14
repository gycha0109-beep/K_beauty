"use client";
import SafeProductImage from "@/components/common/SafeProductImage";
import { resolvePremiumFunctionalDisplayModel } from "@/lib/premium-functional-display-model";
import { saved, list, functionalMatrix, groupVerdicts, productName } from "@/lib/full-report-view";
import { Header, Badge, Disclosure, Evidence, Notice, Empty, Icon, styles } from "./ReportUI";

const RELATIONS = {
  ko: { supports_goal: "이번 목표와 연결", different_goal: "다른 목표의 제품", duplicate_axis: "같은 기능 축 중복", not_evaluable: "평가 정보 부족", empty_slot: "현재 미사용", unknown_usage: "사용 여부 미확인" },
  en: { supports_goal: "Supports this goal", different_goal: "Different goal", duplicate_axis: "Overlapping axis", not_evaluable: "Not evaluable", empty_slot: "Not in use", unknown_usage: "Unknown usage" }
};
function VerdictList({ items, report, locale }) {
  const en = locale === "en";
  return items.length ? groupVerdicts(report, items).map(({ selection, items: grouped }, i) => {
    const item = grouped[0];
    return <Disclosure key={item.slotKey || i} title={<span className={styles.matrixItem}><Icon name={item.status === "keep" ? "check" : "bottle"}/>{selection ? productName(selection, locale) : item.title}</span>}>{grouped.map((entry, j) => <div key={j}><Badge status={entry.status} locale={locale}/><p>{entry.slotKey?.split(".")[0].toUpperCase()}</p><Evidence item={entry} locale={locale}/></div>)}</Disclosure>;
  }) : <Empty>{en ? "No saved items" : "저장된 항목 없음"}</Empty>;
}
export default function PremiumFunctionalDecisionSection({ report = {}, decisions = [], locale = "ko", onNavigate }) {
  const en = locale === "en";
  const hasSavedPlan = Boolean(saved(report, "functionalPlan"));
  // Only invoke the existing legacy adapter when actual saved decisions exist.
  // Its default START is not authority for a missing/unknown report.
  const legacyLead = list(decisions).find((item) => item.status === "now") || list(decisions)[0];
  const knownLegacy = ["now", "pause"].includes(legacyLead?.status);
  const model = hasSavedPlan || knownLegacy ? resolvePremiumFunctionalDisplayModel({ report, decisions, locale }) : null;
  const plan = model?.functionalPlan || null;
  const audit = model?.routineAudit || saved(report, "functionalRoutineAudit");
  const matrix = functionalMatrix(report, plan);
  const guide = plan?.routineGuide || {};
  const relations = RELATIONS[en ? "en" : "ko"];
  const findings = list(saved(report, "currentProductFindings")?.findings || audit?.findings);
  const condition = plan?.reviewCondition || guide.review;
  const sequence = [
    [en ? "Now" : "지금", guide.weeklyAction || plan?.baseApproach],
    [en ? "Routine to follow" : plan?.planMode === "HOLD" ? "피부가 안정될 때까지" : "현재 적용할 루틴", guide.order],
    [en ? "When the review condition is met" : "재검토 조건 충족 후", condition]
  ].filter(([, body]) => body);
  return <section className={styles.page} data-report-section="plan" data-plan-mode={plan?.planMode || "UNKNOWN"}>
    <Header number="03" title={en ? "Next change plan" : "다음 변화 플랜"} locale={locale} onNavigate={onNavigate}/>
    <div className={styles.hero}><Badge status={plan?.planMode === "HOLD" ? "hold" : plan?.planMode === "START" ? "keep" : "unknown"}>{plan?.planMode || "UNKNOWN"}</Badge><h3>{plan?.planSummary || (en ? "More information is needed." : "다음 판단을 위한 정보가 필요해요.")}</h3>{plan?.direction && <p>{plan.direction}</p>}</div>
    <div className={styles.matrix}>
      <article className={styles.matrixCell} data-tone="keep"><h3>{en ? "Keep this time" : "이번에 유지할 것"}<span>{groupVerdicts(report, matrix.keep).length}</span></h3><VerdictList items={matrix.keep} report={report} locale={locale}/></article>
      <article className={styles.matrixCell} data-tone="next"><h3>{en ? "Try next" : "다음으로 시도할 것"}<span>{matrix.next.length}</span></h3>{matrix.next.map((product, i) => <Disclosure key={product.id || i} title={<span className={styles.matrixItem}><SafeProductImage product={product} alt="" fallback={<Icon/>}/>{product.name}</span>}><p>{product.brand}</p><p>{product.reason}</p><p>{en ? "Candidate only; not added to your products." : "검토 후보이며 현재 제품에 추가되지 않았어요."}</p></Disclosure>)}{!matrix.next.length && <Empty>{plan?.planMode === "HOLD" ? (en ? "Review after the saved condition is met" : "재검토 조건 충족 후 확인") : en ? "No available saved candidates" : "표시 가능한 저장 후보 없음"}</Empty>}</article>
      <article className={styles.matrixCell} data-tone="hold"><h3>{en ? "Defer for now" : "지금은 미룰 것"}<span>{groupVerdicts(report, matrix.hold).length}</span></h3><VerdictList items={matrix.hold} report={report} locale={locale}/>{plan?.planMode === "HOLD" && <p className={styles.action}>{en ? "New active expansion is on hold" : "새 기능성 확장은 보류"}</p>}</article>
      <article className={styles.matrixCell} data-tone="review"><h3>{en ? "Review further" : "추가로 검토할 것"}<span>{groupVerdicts(report, matrix.review).length}</span></h3><VerdictList items={matrix.review} report={report} locale={locale}/></article>
    </div>
    {sequence.length > 0 && <><h3 className={styles.heading}>{en ? "Conditional plan" : "변화 순서"}</h3><ol className={styles.sequence}>{sequence.map(([title, body], i) => <li key={title}><span>{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></>}
    {condition && <Notice><strong>{en ? "Review condition" : "재검토 조건"}</strong><p>{condition}</p></Notice>}
    {(list(plan?.avoidWith).length > 0 || guide.avoid) && <Disclosure title={en ? "Combinations to avoid" : "함께 사용할 때 주의"}><p>{list(plan?.avoidWith).join(" · ")}</p><p>{guide.avoid}</p></Disclosure>}
    <Disclosure title={en ? "Plan and current-product evidence" : "플랜과 현재 제품 판단 근거"}>
      {plan && <><p>{plan.primaryConcern} · {plan.allowedIntensity} · {plan.status}</p><p>{plan.whyPriority}</p><p>{guide.time} · {guide.frequency}</p></>}
      {plan?.candidateExposureSuppressed && <p>{en ? "Candidate display withheld" : "후보 노출 보류"} · {plan.candidateExposureSuppressionReason}</p>}
      {audit && <><p>{audit.status} · {audit.message}</p><p>{audit.actionMessage}</p></>}
      {findings.map((item, i) => <p key={i}>{item.productName || item.category} · {relations[item.relationToPlan] || item.relationToPlan || (en ? "Unknown" : "미확인")}</p>)}
      {matrix.canExpose && list(plan?.budgetAlternatives).length > 0 && <><h3>{en ? "Budget alternatives" : "예산별 대안"}</h3>{plan.budgetAlternatives.map((item, i) => <p key={i}>{(item.product || item).name}</p>)}</>}
      {!plan && <Empty>{en ? "This saved report has no functional decision." : "이 저장 리포트에는 기능성 판단이 없어요."}</Empty>}
      {!hasSavedPlan && list(decisions).map((item, i) => <div key={i}><p>{item.title} · {item.status}</p><Evidence item={item} locale={locale}/><p>{item.nextAction}</p></div>)}
    </Disclosure>
  </section>;
}
