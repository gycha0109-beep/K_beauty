"use client";
import { useState } from "react";
import SafeProductImage from "@/components/common/SafeProductImage";
import { buildCurrentProductRoutineSlots } from "@/lib/current-products";
import { list } from "@/lib/full-report-presentation";
import ReportCurrentProducts from "./ReportCurrentProducts";
import { Header, Hero, CTA, Counts, Heading, Disclosure, Icon, Badge, Warning, Empty, styles } from "./ReportUI";

export default function PremiumRoutineConsultSection({ report = {}, freeResult, morningSteps = [], nightSteps = [], locale = "ko", onNavigate, buildSteps }) {
  const [mode, setMode] = useState("morning");
  const en = locale === "en";
  const plan = report?.routinePlan || report?.decisionBundle?.routinePlan;
  const source = mode === "morning" ? plan?.morningSteps : plan?.nightSteps;
  const canonicalSteps = Array.isArray(source) ? source : null;
  const currentProductSlots = buildCurrentProductRoutineSlots(report.currentProducts, locale);
  const steps = canonicalSteps || buildSteps({ mode, freeResult, report, morningSteps, nightSteps, locale, currentProductSlots });
  return <section className={styles.page} data-report-section="routine" data-routine-source={canonicalSteps ? "canonical" : "legacy_adapter"}>
    <Header title={en ? "Current routine review" : "현재 루틴 점검"} body={en ? "Review the order and products in your saved routine." : "지금 사용 중인 루틴을 점검하고 개선점을 확인해요."} locale={locale} onNavigate={onNavigate}/>
    <Hero title={en ? "Your routine, reviewed" : "지금 루틴은"} body={en ? "Product verdict counts are separate from routine step states." : "현재 제품의 판단을 모았어요. 루틴 단계 상태와 제품 판단은 구분해서 확인하세요."} actions={<><CTA onClick={() => onNavigate("product-plan")}>{en ? "Next change plan" : "다음 변화 플랜 보기"}</CTA><CTA secondary onClick={() => onNavigate("today-start-hub")}>{en ? "Previous" : "이전"}</CTA></>}><Counts compact report={report} locale={locale}/></Hero>
    <div className={styles.tabs} role="tablist" aria-label={en ? "Routine time" : "루틴 시간대"}>{["morning", "night"].map((time) => <button key={time} role="tab" aria-selected={time === mode} aria-controls="routine-panel" id={`routine-tab-${time}`} onClick={() => setMode(time)}><Icon name={time === "morning" ? "sun" : "moon"}/>{time === "morning" ? (en ? "Morning routine" : "아침 루틴") : (en ? "Evening routine" : "저녁 루틴")}</button>)}</div>
    <div role="tabpanel" id="routine-panel" aria-labelledby={`routine-tab-${mode}`}>
      <ol className={styles.timeline}>{list(steps).map((step, i) => <li key={i}><span className={styles.number}>{String(step.order || i + 1).padStart(2, "0")}</span><div className={styles.stepImage}><Icon name="bottle"/></div><div><h3>{step.title || step.stepName}</h3><p>{step.action || step.instruction}</p>{step.frequency && <p>{step.frequency}</p>}{list(step.currentProducts).map((product, j) => <p key={j}>{product.productName || product.label} · {product.helperText}</p>)}{(step.caution || step.adjustment) && <Warning>{step.caution || step.adjustment}</Warning>}{step.product && <Disclosure title={en ? "Saved step candidate" : "이 단계 저장 후보"}><SafeProductImage product={step.product} alt={step.product.name || ""} className={styles.smallProduct} fallback={<Icon name="bottle"/>}/><p>{step.product.name}</p></Disclosure>}</div><Badge status={({ 유지:"keep", 고정:"keep", Keep:"keep", Fixed:"keep", 감량:"adjust", Reduce:"adjust", "필요 시":"adjust", "As needed":"adjust", 보류:"hold", Hold:"hold" })[step.status]} locale={locale}>{step.status || (en ? "Check needed" : "확인 필요")}</Badge></li>)}</ol>
      {!steps.length && <Empty>{en ? "No saved routine steps." : "저장된 루틴 순서가 없어요."}</Empty>}
    </div>
    <Heading>{en ? "Current products" : "현재 사용 제품"}</Heading>
    <ReportCurrentProducts report={report} locale={locale} mode={mode === "morning" ? "am" : "pm"}/>
    {list(report.avoidCombinations).length > 0 && <Warning>{report.avoidCombinations.join(" · ")}</Warning>}
    <Disclosure title={en ? "Product decision evidence" : "제품별 판단 근거 보기"}><ReportCurrentProducts report={report} locale={locale} evidenceOnly/></Disclosure>
  </section>;
}
