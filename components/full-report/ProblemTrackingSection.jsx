"use client";
import { intakeAnswer, list } from "@/lib/full-report-presentation";
import { Header, Hero, CTA, Heading, Badge, Disclosure, Evidence, Warning, Empty, Icon, styles } from "./ReportUI";

export default function ProblemTrackingSection({ report = {}, locale = "ko", onNavigate }) {
  const en = locale === "en";
  const verdicts = list(report.currentProductVerdicts);
  const checks = verdicts.filter((item) => ["adjust", "hold", "check_needed"].includes(item.status));
  const keep = verdicts.filter((item) => item.status === "keep");
  const inputs = [[en ? "Recent product change" : "최근 제품 변경", intakeAnswer(report, "recentlyChangedProduct", locale)], [en ? "Recent reaction" : "최근 반응", intakeAnswer(report, "productReaction", locale)], [en ? "Frequency change" : "사용 빈도 변화", en ? "No change history is saved" : "변경 이력 정보 부족"]];
  return <section className={styles.page} data-report-section="tracking">
    <Header title={en ? "Issue tracking" : "문제 추적"} body={en ? "Review recorded changes and reactions, without assuming causation." : "지금 나타난 피부 이슈의 단서를 함께 살펴봐요."} locale={locale} onNavigate={onNavigate}/>
    <Hero investigation title={en ? "Review what changed, one item at a time." : "최근 바뀐 것부터 하나씩 확인해보세요."} body={en ? "Responses are context, not proof that a product caused a reaction." : "최근 변경과 반응 응답을 확인해요. 특정 제품이 원인이라는 뜻은 아니에요."} actions={<CTA onClick={() => onNavigate("product-plan")}>{en ? "Next change plan" : "다음 변화 플랜 보기"}</CTA>}><div className={styles.signalRow}>{inputs.map(([title, value]) => <Badge key={title} status="check_needed">{title} · {value}</Badge>)}</div></Hero>
    <div className={styles.decisionFlow}>{inputs.map(([title, value], i) => <div key={title}><Icon name={i === 0 ? "note" : i === 1 ? "search" : "clock"}/><small>0{i + 1}</small><h3>{title}</h3><p>{value}</p></div>)}</div>
    <Heading note={en ? "Saved product verdicts, not a cause ranking" : "원인 순위가 아닌, 저장된 제품별 확인 사항이에요."}>{en ? "Items to check" : "먼저 확인할 항목"}</Heading>
    {checks.length ? <div className={styles.trackingGrid}>{checks.map((item, i) => <article className={styles.card} key={item.slotKey || i}><Icon name="bottle"/><h3>{item.title}</h3><Badge status={item.status} locale={locale}/><p>{item.summary}</p><p className={styles.actionText}>{item.adjustment}</p><Disclosure title={en ? "Evidence" : "판단 근거"}><Evidence items={item.reasons}/><Evidence items={item.reevaluateWhen}/></Disclosure></article>)}</div> : <Empty>{en ? "No product-specific investigation is saved." : "제품별 확인 항목이 저장되지 않았어요. 가능한 원인을 새로 추정하지 않았어요."}</Empty>}
    <Heading>{en ? "Saved keep guidance" : "지금 유지할 것"}</Heading>
    {keep.length ? keep.map((item, i) => <article className={styles.keepCard} key={item.slotKey || i}><Icon name="keep"/><div><h3>{item.title}</h3><p>{item.summary}</p></div></article>) : <Empty>{en ? "No keep verdict is saved." : "유지 판단이 저장된 항목이 없어요."}</Empty>}
    <Heading>{en ? "Review sequence" : "확인 순서"}</Heading><Empty>{en ? "This report does not store a cause ranking or a tracking sequence. Review the recorded evidence above." : "이 리포트에는 원인 후보의 우선순위와 추적 순서가 저장되지 않았어요. 위 제품별 근거부터 확인해 주세요."}</Empty>
    <Warning>{en ? "These records do not establish a cause or mean every symptom is currently active." : "특정 제품이 원인으로 확정되거나, 모든 증상이 현재 발생 중이라는 뜻은 아니에요."}</Warning>
    <Disclosure title={en ? "Decision evidence" : "판단 근거 보기"}><p>{en ? "Recent-context response state" : "최근 맥락 응답 상태"}: {report.premiumIntake?.stepStates?.recentContext || "unknown"}</p><Evidence items={checks.flatMap((item) => list(item.reasons))}/></Disclosure>
  </section>;
}
