"use client";
import { intakeSignal, reviewItems, verdicts, selections, selectionForVerdict, productName } from "@/lib/full-report-view";
import { Header, Badge, Disclosure, Evidence, Notice, Empty, Icon, styles } from "./ReportUI";
export default function ProblemTrackingSection({ report = {}, locale = "ko", onNavigate }) {
  const en = locale === "en";
  const labels = en ? { yes: "Reported", no: "Not reported", unknown: "Unknown", skipped: "Skipped" } : { yes: "있음", no: "없음", unknown: "미확인", skipped: "응답 건너뜀" };
  const items = reviewItems(report);
  const savedVerdicts = verdicts(report);
  const signals = [
    [en ? "Recent product / routine change" : "최근 제품/루틴 변경", labels[intakeSignal(report, "recentlyChangedProduct")]],
    [en ? "Discomfort after product use" : "제품 사용 후 불편 반응", labels[intakeSignal(report, "productReaction")]],
    [en ? "Product information checks" : "제품 정보 확인 필요", savedVerdicts.length ? `${savedVerdicts.filter((v) => v.status === "check_needed").length}${en ? " slots" : "개 슬롯"}` : labels.unknown],
    [en ? "Usage adjustments" : "사용 방식 조정 필요", savedVerdicts.length ? `${savedVerdicts.filter((v) => v.status === "adjust").length}${en ? " slots" : "개 슬롯"}` : labels.unknown]
  ];
  return <section className={styles.page} data-report-section="tracking">
    <Header number="02" title={en ? "Issue tracking" : "문제 추적"} locale={locale} onNavigate={onNavigate}/>
    <div className={`${styles.hero} ${styles.investigation}`}><h3>{en ? "A closer look at your recorded signals." : <>지금 확인할 변화,<br/>하나씩 살펴봐요.</>}</h3><p>{en ? "Changes and reactions recorded in this report." : "리포트에 기록된 변경과 반응을 확인해요."}</p></div>
    <h3 className={styles.heading}>{en ? "Recorded change signals" : "현재 확인된 변화 신호"}</h3>
    <div className={styles.signalList}>{signals.map(([title, value], i) => <div key={title} className={styles.signal}><Icon name={i < 2 ? "search" : "info"}/><span>{title}</span><Badge>{value}</Badge></div>)}</div>
    <h3 className={styles.heading}>{en ? "What to check first" : "먼저 확인할 항목"}</h3>
    <div className={styles.reviewList}>{items.map((item, i) => { const selection = selectionForVerdict(report, item); return <div key={item.slotKey || i} className={styles.reviewRow}><span className={styles.number}>{String(i + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{selection ? productName(selection, locale) : item.slotKey}</p><Disclosure title={en ? "Evidence and next action" : "근거와 조정 방법"}><Evidence item={item} locale={locale}/></Disclosure></div><Badge status={item.status} locale={locale}/></div>; })}</div>
    {!items.length && <Empty>{en ? "No saved product checks to display." : "저장된 제품별 확인 항목이 없어요."}</Empty>}
    <Notice>{en ? "This information cannot establish that a particular product caused a reaction. Counts refer to saved verdict slots, which can differ between AM and PM." : "현재 정보만으로 특정 제품을 직접적인 원인이라고 단정할 수 없어요. 개수는 AM/PM별 판단 슬롯 기준이에요."}</Notice>
    <Disclosure title={en ? "Recorded frequency and satisfaction" : "기록된 사용 빈도와 만족도"}>{selections(report).map((item, i) => <p key={i}>{productName(item, locale)} · {({ daily: en ? "Daily" : "매일", few_times_week: en ? "A few times a week" : "주 몇 회", weekly_or_less: en ? "Weekly or less" : "주 1회 이하", as_needed: en ? "As needed" : "필요할 때" }[item.useFrequency]) || labels.unknown} · {({ good: en ? "Satisfied" : "만족", okay: en ? "Okay" : "보통", bad: en ? "Uncomfortable" : "불편함", unknown: labels.unknown }[item.satisfaction]) || labels.unknown}</p>)}</Disclosure>
  </section>;
}
