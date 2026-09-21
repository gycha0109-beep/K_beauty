"use client";
import { list } from "@/lib/full-report-presentation";
import { Header, Hero, CTA, Heading, Disclosure, Evidence, Warning, Empty, Icon, styles } from "./ReportUI";
const GROUPS = [["maintain", "keep", "유지", "Keep"], ["reduce", "adjust", "줄이기", "Reduce"], ["avoid_for_now", "hold", "잠시 보류", "Pause"]];
export default function PremiumConditionResponseSection({ conditionPlan = null, responses = [], safety = [], locale = "ko", onNavigate, onComplete }) {
  const en = locale === "en";
  const canonicalResponses = Array.isArray(conditionPlan?.responses) ? conditionPlan.responses : null;
  const items = list(canonicalResponses || responses);
  const source = canonicalResponses ? "canonical" : "legacy_snapshot";
  const unknown = items.filter((item) => !GROUPS.some(([key]) => key === item.status));
  return <section className={styles.page} data-report-section="condition" data-condition-source={source}>
    <Header title={en ? "Situational care" : "상황별 대응"} body={en ? "Review temporary guidance for the situations recorded in this report." : "피부가 달라지는 상황에 맞춘 대응 방법을 확인해요."} locale={locale} onNavigate={onNavigate}/>
    <Hero label={en ? "Situational skincare guide" : "상황별 스킨케어 가이드"} title={en ? "Adjust only when the situation applies." : "해당하는 상황에 맞춰 루틴을 조정하세요."} body={en ? "Not every listed situation is happening now. This is temporary guidance, not a new baseline." : "평소 루틴과 구분해서 확인하세요. 아래 상황이 모두 현재 발생했다는 뜻은 아니에요."} actions={<><CTA secondary onClick={() => onNavigate("product-plan")}>{en ? "Previous" : "이전"}</CTA><CTA onClick={onComplete}>{en ? "Finish / My reports" : "완료 / 보관함 보기"}</CTA></>}>
      <div className={styles.compactCounts}>{GROUPS.map(([key, tone, ko, english]) => <div key={key} data-tone={tone}><Icon name={tone}/><div><strong>{en ? english : ko}</strong><p>{items.filter((item) => item.status === key).length}{en ? " items" : "건"}</p></div></div>)}</div>
    </Hero>
    {!items.length && <Empty>{en ? "No situational responses are saved." : "저장된 상황별 대응 데이터가 없어요."}</Empty>}
    {GROUPS.map(([key, tone, ko, english]) => {
      const group = items.filter((item) => item.status === key);
      return group.length ? <section key={key} className={styles.conditionGroup} data-tone={tone}><div className={styles.groupLabel}><Icon name={tone}/><h2>{en ? english : ko}</h2><small>{group.length}{en ? " items" : "건"}</small></div><div>{group.map((item, i) => <article key={item.responseKey || i}><h3>{item.title}</h3><p>{item.summary}</p>{item.action && <p>{item.action}</p>}<Disclosure title={en ? "Decision evidence" : "판단 근거 보기"}><Evidence items={item.reasons}/>{list(item.returnCriteria).length > 0 && <><h4>{en ? "Return criteria" : "복귀 기준"}</h4><Evidence items={item.returnCriteria}/></>}{list(item.escalationCriteria).length > 0 && <><h4>{en ? "Escalation criteria" : "추가 상담 기준"}</h4><Evidence items={item.escalationCriteria}/></>}{item.triggerState && <p>{en ? "Recorded trigger state" : "저장된 상황 상태"}: {item.triggerState}</p>}</Disclosure></article>)}</div></section> : null;
    })}
    {unknown.map((item, i) => <article className={styles.card} key={i}><h3>{item.title}</h3><p>{item.summary}</p><p>{en ? "Status needs review" : "상태 확인 필요"}</p><Evidence items={item.reasons}/></article>)}
    {items.some((item) => item.action) && <><Heading>{en ? "What to do" : "지금 할 일"}</Heading><ol className={styles.actionList}>{items.filter((item) => item.action).map((item, i) => <li key={i}><span>{i + 1}</span><div><strong>{item.title}</strong><p>{item.action}</p></div></li>)}</ol></>}
    {list(safety).length > 0 && <><Heading>{en ? "Saved safety guide" : "공통 안전 가이드"}</Heading><div className={styles.card}><Evidence items={safety}/></div></>}
    <Warning>{conditionPlan?.globalNotice}</Warning>
  </section>;
}
