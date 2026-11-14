"use client";
import { list } from "@/lib/full-report-view";
import styles from "./ReportUI.module.css";
export { styles };
export function Icon({ name = "bottle" }) {
  const paths = { bottle: "M9 3h6v4l2 3v11H7V10l2-3V3Zm0 4h6M7 12h10", sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0", moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z", check: "m5 12 4 4L19 6", minus: "M5 12h14", close: "m6 6 12 12M6 18 18 6", search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0", arrow: "m9 5 7 7-7 7", info: "M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0" };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.bottle}/></svg>;
}
export function Header({ title, number, locale, onNavigate }) {
  return <header className={styles.header}><button type="button" aria-label={locale === "en" ? "Report overview" : "리포트 전체 보기"} onClick={() => onNavigate?.("today-start-hub")}><span aria-hidden="true">‹</span></button><h2>{title}</h2><span className={styles.sectionNumber}>{number}</span></header>;
}
export function Badge({ status, children, locale = "ko" }) {
  const labels = locale === "en" ? { keep: "Keep", adjust: "Adjust", hold: "Pause", check_needed: "Check needed" } : { keep: "유지", adjust: "조정", hold: "보류", check_needed: "확인 필요" };
  return <span className={styles.badge} data-tone={status || "unknown"}>{children || labels[status] || (locale === "en" ? "Unknown" : "미확인")}</span>;
}
export function Disclosure({ title, children }) { return <details className={styles.disclosure}><summary>{title}<Icon name="arrow"/></summary><div className={styles.detailBody}>{children}</div></details>; }
export function Evidence({ item = {}, locale = "ko" }) {
  const en = locale === "en";
  return <>{item.summary && <p>{item.summary}</p>}{list(item.reasons).map((x, i) => <p key={`r${i}`}>{x}</p>)}{item.adjustment && <p>{item.adjustment}</p>}{item.caution && <Notice>{item.caution}</Notice>}{list(item.reevaluateWhen).map((x, i) => <p key={`w${i}`}>{en ? "Review when" : "재검토 조건"} · {x}</p>)}{list(item.reasonCodes).length > 0 && <small>{item.reasonCodes.join(" · ")}</small>}</>;
}
export function Notice({ children }) { return children ? <aside className={styles.notice}><Icon name="info"/><div>{children}</div></aside> : null; }
export function Empty({ children }) { return <p className={styles.empty}>{children}</p>; }
export function Next({ children, onClick }) { return <button type="button" className={styles.next} onClick={onClick}>{children}<Icon name="arrow"/></button>; }
