"use client";
import { saved, words } from "@/lib/full-report-view";
import { Icon } from "./ReportUI";
import styles from "./TodayStartPlanStep.module.css";
const ORBS = {
  routine: { label: "ROUTINE CONSULT", icon: "sun" },
  functional: { label: "FUNCTIONAL PLAN", icon: "bottle" },
  condition: { label: "CONDITION RESPONSE", icon: "moon" },
  tracking: { label: "SIGNAL INVESTIGATION", icon: "search" }
};
export function SkinMatchHubQuickCard({ action, onNavigate, locale = "ko", planMode }) {
  const art = ORBS[action.id];
  return <button type="button" className={styles.satellite} data-orb={action.id}
    aria-label={locale === "en" ? `Open ${action.title}` : `${action.title} 섹션으로 이동`}
    onClick={() => onNavigate?.(action.target)}>
    <span className={styles.material} aria-hidden="true" />
    <span className={styles.orbIcon}><Icon name={art.icon}/></span>
    <span className={styles.englishLabel}>{art.label}</span>
    <strong>{action.title}</strong>
    <span className={styles.description}>{action.description}</span>
    {action.id === "functional" && <span className={styles.mode} data-mode={planMode}>{planMode}</span>}
    <span className={styles.openArrow} aria-hidden="true">↗</span>
  </button>;
}
export default function TodayStartPlanStep({ report = {}, hubActions = [], locale = "ko", onNavigate, children }) {
  const en = locale === "en";
  const plan = saved(report, "functionalPlan");
  const mode = ["START", "HOLD"].includes(plan?.planMode) ? plan.planMode : "UNKNOWN";
  // The hub reads saved projection text; decoration never infers a skin diagnosis.
  const concern = words(plan?.primaryConcern);
  const summary = words(plan?.planSummary);
  const direction = words(plan?.direction);
  return <section className={styles.hub} data-report-hub data-plan-mode={mode}>
    <header className={styles.brand}><div><p>BEJEWELY</p><span>Premium Full Report</span></div><span className={styles.edition}>SKIN MATCH<br/>PERSONAL GUIDE</span></header>
    <div className={styles.intro}>
      <p className={styles.eyebrow}>{en ? "A guide for your skin journey" : "당신의 피부 여정을 위한 단 하나의 가이드"}</p>
      <h2>{en ? "Your skin, right now." : "지금, 당신의 피부는."}<br/><em>{concern || (en ? "Start with your report." : "리포트에서 확인하세요.")}</em></h2>
      <p className={styles.summary}>{summary || (en ? "Explore the information saved in each section. A current decision has not been recorded." : "각 섹터에서 저장된 정보를 확인하세요. 현재 판단 정보는 기록되어 있지 않아요.")}</p>
    </div>
    <div className={styles.cosmos}>
      <svg className={styles.orbits} viewBox="0 0 360 530" fill="none" aria-hidden="true">
        <ellipse cx="180" cy="262" rx="151" ry="207" transform="rotate(32 180 262)"/>
        <ellipse cx="180" cy="262" rx="143" ry="205" transform="rotate(-38 180 262)"/>
        <ellipse cx="180" cy="262" rx="160" ry="147"/>
        <path d="M26 100Q190 4 325 100M34 431Q167 531 330 403"/>
        {[[93,64],[260,72],[337,266],[43,318],[92,448],[281,418],[157,119],[228,459]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2"/>)}
      </svg>
      <div className={styles.core}>
        <span className={styles.coreKicker}>YOUR SKIN RIGHT NOW</span>
        <h3>{concern || (en ? "Your saved skin report" : "나의 피부 리포트")}</h3>
        <span className={styles.divider} aria-hidden="true">◆</span>
        <p>{direction || (en ? "Check the available information in each section." : "기록된 정보를 각 섹터에서 살펴보세요.")}</p>
      </div>
      {hubActions.map(action => <SkinMatchHubQuickCard key={action.id} action={action} locale={locale} onNavigate={onNavigate} planMode={mode}/>)}
    </div>
    <p className={styles.signoff}>{en ? "Understand your skin. Find your next step." : <>피부를 이해하는 시간.<br/>나에게 맞는 다음 한 걸음.</>}</p>
    <div className={styles.dock}><span className={styles.dockTitle}>REPORT DOCK</span><div className={styles.dockActions}>
      <a href="#skin-match-input-context" onClick={() => { const context = document.getElementById("skin-match-input-context"); if (context) context.open = true; }}><Icon name="bottle"/><span>{en ? "Input context" : "입력 맥락"}<small>{en ? "Recorded answers" : "기록한 정보 보기"}</small></span></a>
      <button type="button" onClick={() => onNavigate?.("problem-tracking")}><Icon name="search"/><span>{en ? "Decision evidence" : "판단 근거"}<small>{en ? "Review signals" : "확인할 신호 보기"}</small></span></button>
    </div></div>
    <details id="skin-match-input-context" className={styles.context}><summary>{en ? "Products and intake details" : "현재 제품 · 입력 정보 상세"}</summary>{children}</details>
  </section>;
}
