"use client";
import { saved, words, list, verdicts, reviewItems, selectionForVerdict, productName, snapshot, intakeSignal, functionalMatrix, conditionItems } from "@/lib/full-report-view";
import SafeProductImage from "@/components/common/SafeProductImage";
import { Icon } from "./ReportUI";
import styles from "./TodayStartPlanStep.module.css";
const ORDER = ["routine", "tracking", "functional", "condition"];
const ICONS = { routine: "sun", tracking: "search", functional: "bottle", condition: "moon" };
function ProductPreview({ product, title, subtitle }) {
  return <span className={styles.product}><span className={styles.productImage}><SafeProductImage product={product} fallback={<Icon name="bottle"/>}/></span><span><strong>{title}</strong><small>{subtitle}</small></span><Icon name="arrow"/></span>;
}
export default function TodayStartPlanStep({ report = {}, hubActions = [], locale = "ko", onNavigate, children }) {
  const en = locale === "en";
  const plan = saved(report, "functionalPlan");
  const mode = ["START", "HOLD"].includes(plan?.planMode) ? plan.planMode : "UNKNOWN";
  const items = verdicts(report);
  const review = reviewItems(report);
  const lead = review[0];
  const selection = lead ? selectionForVerdict(report, lead) : null;
  const matrix = functionalMatrix(report, plan);
  const candidate = matrix.next[0]?.product || matrix.next[0];
  const signals = ["recentlyChangedProduct", "productReaction"].map(key => intakeSignal(report, key));
  const knownSignals = signals.every(value => ["yes", "no"].includes(value));
  const scenarios = conditionItems(saved(report, "conditionPlan"), saved(report, "conditionResponses"));
  const scenario = scenarios[0];
  const unknown = en ? "Not recorded" : "미기록";
  const descriptions = en ? {
    routine: "Review the routine you use and each product's saved assessment.", tracking: "Explore recorded changes and what to check first.", functional: "See what to try next and what to hold for now.", condition: "Review situational guidance and routine adjustments."
  } : {
    routine: "내가 사용 중인 루틴을 확인하고, 제품별 상태를 점검해보세요.", tracking: "최근 나타난 변화 신호와 먼저 확인할 항목을 살펴보세요.", functional: "어떤 제품을 시도하고, 어떤 것은 보류할지 확인해보세요.", condition: "특정 상황에 맞춘 대응법과 루틴 변경안을 확인해보세요."
  };
  return <section className={styles.hub} data-report-hub data-plan-mode={mode}>
    <header className={styles.brand}><p>BEJEWELY</p><span>SKIN MATCH PREMIUM</span></header>
    <div className={styles.intro}>
      <span className={styles.heroArt} aria-hidden="true"/>
      <p className={styles.eyebrow}>YOUR SKIN TODAY</p>
      <h2>{words(plan?.planSummary) || (en ? "Your skin. Your next step." : <>나의 피부를 위한<br/>다음 한 걸음.</>)}</h2>
      <p className={styles.summary}>{words(plan?.direction) || (en ? "Explore the information saved in each section. A current decision has not been recorded." : "각 섹터에서 저장된 정보를 확인하세요. 현재 판단 정보는 기록되어 있지 않아요.")}</p>
      <span className={styles.edition}>SKIN MATCH<br/>PERSONAL GUIDE</span>
    </div>
    <div className={styles.grid}>
      {ORDER.map((id, index) => {
        const action = hubActions.find(item => item.id === id);
        if (!action) return null;
        return <button key={id} type="button" className={styles.card} data-hub-sector={id}
          aria-label={en ? `Open ${action.title}` : `${action.title} 섹션으로 이동`} onClick={() => onNavigate?.(action.target)}>
          <span className={styles.cardArt} aria-hidden="true"/>
          <span className={styles.cardTop}><span className={styles.icon}><Icon name={ICONS[id]}/></span><span>{String(index + 1).padStart(2, "0")}</span></span>
          <span className={styles.cardHeading}>{action.title}</span>
          <span className={styles.cardDescription}>{descriptions[id]}</span><span className={styles.open}><Icon name="arrow"/></span>
          <span className={styles.cardDetails}>
            {id === "routine" && <>
              <span className={styles.chips}>{[["keep", en ? "Keep" : "유지"], ["adjust", en ? "Adjust" : "조정"], ["check_needed", en ? "Check" : "확인 필요"], ["hold", en ? "Hold" : "보류"]].map(([status,label]) => <span key={status} data-tone={status}>{label} <b>{items.length ? items.filter(item => item.status === status).length : "—"}</b></span>)}</span>
              <small className={styles.meta}>{items.length ? (en ? "AM/PM verdict slots" : "AM/PM 판단 슬롯 기준") : unknown}</small>
              {lead ? <ProductPreview product={snapshot(selection)} title={selection ? productName(selection, locale) : lead.title} subtitle={lead.title || lead.status}/> : <span className={styles.empty}>{en ? "No saved product checks" : "저장된 제품별 확인 항목이 없어요."}</span>}
            </>}
            {id === "tracking" && <>
              <span className={styles.stats}><span><Icon name="search"/>{en ? "Changes" : "변화 신호"}<b>{knownSignals ? signals.filter(value => value === "yes").length : "—"}</b></span><span><Icon name="info"/>{en ? "Checks" : "확인 슬롯"}<b>{items.length ? review.length : "—"}</b></span></span>
              <span className={styles.notice}><Icon name="info"/>{en ? "These records cannot establish that a particular product caused a reaction." : "현재 정보만으로 특정 제품을 직접적인 원인이라고 단정할 수 없어요."}</span>
            </>}
            {id === "functional" && <>
              <span className={styles.planStats}><span data-tone={mode === "START" ? "keep" : mode === "HOLD" ? "hold" : "unknown"}><b>● {mode}</b><span>{en ? "Visible next candidates" : "다음으로 시도할 후보"}</span><strong>{plan ? `${matrix.next.length}${en ? "" : "개"}` : unknown}</strong></span><span data-tone="hold"><b>{en ? "CURRENT HOLD" : "현재 제품 보류"}</b><span>{en ? "Saved verdict slots" : "저장된 판단 슬롯"}</span><strong>{items.length ? `${matrix.hold.length}${en ? "" : "개"}` : unknown}</strong></span></span>
              {candidate ? <ProductPreview product={candidate} title={candidate.name || candidate.productName} subtitle={en ? "Candidate to review next" : "다음으로 검토할 후보"}/> : <span className={styles.empty}>{plan?.candidateExposureSuppressed ? (en ? "Candidate display withheld" : "현재 후보 노출이 보류되어 있어요.") : (en ? "No saved candidates to display" : "표시할 저장 후보가 없어요.")}</span>}
            </>}
            {id === "condition" && <>
              <span className={styles.scenario}>{scenario?.title || (en ? "No stored scenarios" : "저장된 상황 없음")}<small>{scenario ? (en ? "Saved scenario" : "저장된 상황") : unknown}</small></span>
              <span className={styles.roles}>{[[en ? "Maintain" : "유지", scenario?.maintainRoles], [en ? "Reduce" : "줄이기", scenario && (Array.isArray(scenario.reduceRoles) || Array.isArray(scenario.reduceActions)) ? [...list(scenario.reduceRoles), ...list(scenario.reduceActions)] : null], [en ? "Pause" : "보류", scenario?.pauseRoles]].map(([label,roles]) => <span key={label}><strong>{label}</strong><small>{Array.isArray(roles) ? `${roles.length}${en ? " items" : "개 항목"}` : unknown}</small></span>)}</span>
            </>}
          </span>
        </button>;
      })}
    </div>
    <div className={styles.dock}>
      <span className={styles.bannerIcon}><Icon name="bottle"/></span><div><small>REPORT DOCK</small><h3>{en ? "Input context · Decision evidence" : "입력 맥락 · 판단 근거"}</h3><p>{en ? "Review recorded inputs and supporting signals." : "지금까지의 입력 정보와 주요 판단 근거를 확인할 수 있어요."}</p></div>
      <a href="#skin-match-input-context" onClick={() => { const node = document.getElementById("skin-match-input-context"); if (node) node.open = true; }}>{en ? "View input context" : "입력 맥락 자세히 보기"}<Icon name="arrow"/></a>
    </div>
    <details id="skin-match-input-context" className={styles.context}><summary>{en ? "Products and evidence details" : "현재 제품 · 입력 정보 · 판단 근거 상세"}</summary>{children}<button type="button" onClick={() => onNavigate?.("problem-tracking")}>{en ? "Decision evidence" : "판단 근거 보기"}<Icon name="arrow"/></button></details>
    <button type="button" className={styles.faceBanner} onClick={() => onNavigate?.("face-lab")}><span className={styles.bannerIcon}>✿</span><span><small>FACE LAB</small><strong>{en ? "Explore your Face Lab report" : "Face Lab에서 더 자세히"}</strong><span>{en ? "Open the separate Face Lab experience." : "Face Lab 리포트도 함께 확인해보세요."}</span></span><span className={styles.faceCta}>{en ? "View report" : "리포트 보기"}<Icon name="arrow"/></span></button>
  </section>;
}
