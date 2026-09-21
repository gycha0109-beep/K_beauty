"use client";
import { Header, Hero, CTA, Counts, Heading, Disclosure, Icon, styles } from "./ReportUI";
import { FULL_REPORT_SECTIONS, finalAction, savedPlan, savedAudit, focusedSection } from "@/lib/full-report-presentation";

export default function TodayStartPlanStep({ report = {}, locale = "ko", onNavigate }) {
  const en = locale === "en";
  const plan = savedPlan(report);
  const audit = savedAudit(report);
  const focus = focusedSection(report);
  return <section className={styles.page} data-report-section="hub">
    <Header home title={en ? "Today's report" : "오늘의 리포트"} body={en ? "Start with the action saved in this report." : "이 리포트에서 우선할 행동부터 확인하세요."} />
    <Hero label={en ? "Final action" : "최종 행동"} title={finalAction(report, locale)} body={audit?.message || (en ? "Review the saved skin and current-product guidance below." : "저장된 피부 기준과 현재 제품 기준을 함께 확인하세요.")} actions={<CTA onClick={() => onNavigate("morning-routine")}>{en ? "Review today's routine" : "오늘 루틴 보기"}</CTA>} />
    <div className={styles.decisionFlow}>{[
      ["note", en ? "Skin guidance" : "현재 상태 · 피부 기준", plan?.planSummary],
      ["search", en ? "Current-product evidence" : "이슈 · 현재 제품 기준", audit?.message],
      ["spark", en ? "Saved action" : "최종 행동", finalAction(report, locale)]
    ].map(([icon, title, body], i) => <div key={icon}><Icon name={icon}/><small>0{i + 1}</small><h3>{title}</h3><p>{body || (en ? "More information needed" : "확인할 정보가 부족해요.")}</p></div>)}</div>
    <Heading>{en ? "At a glance" : "오늘 한눈에 보기"}</Heading><Counts report={report} locale={locale}/>
    <Heading note={en ? "Explore the details" : "더 자세한 내용을 확인해보세요."}>{en ? "Explore your report" : "리포트 살펴보기"}</Heading>
    <div className={styles.menu}>{FULL_REPORT_SECTIONS.slice(1).map((section) => <button key={section.key} aria-label={en ? section.en : section.ko} data-focused={focus === section.key} onClick={() => onNavigate(section.key)}><Icon name={section.icon}/><span><strong>{en ? section.en : section.ko}</strong><small>{focus === section.key ? (en ? "Your selected focus" : "선택하신 관심 주제") : (en ? "Review saved guidance" : "저장된 판단과 안내를 확인하세요.")}</small></span><span aria-hidden="true">›</span></button>)}</div>
    <Disclosure title={en ? "Decision evidence" : "판단 근거 보기"}><p>{plan?.whyPriority || (en ? "No detailed evidence is saved." : "상세 근거가 저장되지 않았어요.")}</p><p>{audit?.actionMessage}</p></Disclosure>
  </section>;
}

