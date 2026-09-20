import Image from "next/image";
import styles from "./ReportUI.module.css";
import { verdictLabel, verdictCounts, list } from "@/lib/full-report-presentation";
export { styles };
export function ReportBrand() { return <div className={styles.brand}><Image src="/images/brand/bejewely-icon-light.png" alt="" width={38} height={38}/><span>Skin Match<small>나에게 맞는 스킨케어의 시작</small></span></div>; }

export function Icon({ name = "spark", className }) {
  const paths = {
    spark: "m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z",
    bottle: "M9 3h6v5l3 3v10H6V11l3-3V3Zm0 5h6",
    note: "M6 2h8l4 4v16H6V2Zm8 0v5h4M9 11h6M9 15h6M9 19h4",
    search: "M16 16l6 6M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    bars: "M5 20V12m7 8V4m7 16V8", shield: "m12 2 9 4v7c0 5-9 9-9 9S3 18 3 13V6l9-4Zm-4 10 3 3 5-6",
    keep: "M3 20C3 5 12 5 21 3c0 12-6 19-15 15M3 22 16 9",
    adjust: "M2 6h8m4 0h8M2 12h14m4 0h2M2 18h3m4 0h13M10 3v6m6 0v6M5 15v6",
    hold: "M8 4v16M16 4v16", check_needed: "M12 7v6m0 4v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    sun: "M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
    moon: "M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12", clock: "M12 5v7l4 3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.spark} /></svg>;
}
export function Header({ title, body, locale, onNavigate, home = false }) {
  return <header className={styles.header}>{!home && <nav aria-label={locale === "en" ? "Breadcrumb" : "현재 위치"}><button onClick={() => onNavigate("today-start-hub")}>{locale === "en" ? "Full report" : "풀 리포트"}</button><span>›</span><span aria-current="page">{title}</span></nav>}<p className={styles.kicker}>FULL REPORT</p><h1>{title}</h1><p>{body}</p><div className={styles.headerGlow} aria-hidden="true" /></header>;
}
export function Hero({ label, title, body, children, actions, investigation = false }) {
  return <section className={styles.hero}>{investigation ? <Icon name="search" className={styles.investigationArt} /> : <Image src="/images/full-report/rose-serum.webp" alt="" width={320} height={400} className={styles.heroArt} priority />}<div className={styles.heroCopy}>{label && <span className={styles.heroLabel}><Icon />{label}</span>}<h2>{title}</h2>{body && <p>{body}</p>}</div>{children}<div className={styles.heroActions}>{actions}</div></section>;
}
export function CTA({ children, onClick, secondary = false }) { return <button type="button" className={secondary ? styles.secondary : styles.primary} onClick={onClick}>{children}{!secondary && <span aria-hidden="true">→</span>}</button>; }
export function Disclosure({ title, children, icon = "note" }) { return <details className={styles.disclosure}><summary><Icon name={icon} /><span>{title}</span><span aria-hidden="true">⌄</span></summary><div>{children}</div></details>; }
export function Badge({ status, locale, children }) { return <span className={styles.badge} data-tone={status || "check_needed"}>{children || verdictLabel(status, locale)}</span>; }
export function Heading({ children, note }) { return <div className={styles.sectionHeading}><h2>{children}</h2>{note && <p>{note}</p>}</div>; }
export function Empty({ children }) { return <p className={styles.empty}>{children}</p>; }
export function Warning({ children }) { return children ? <div className={styles.warning}><Icon name="check_needed" /><p>{children}</p></div> : null; }
export function Counts({ report, locale, compact = false }) {
  const counts = verdictCounts(report);
  const statuses = ["keep", "adjust", ...(counts.hold ? ["hold"] : []), "check_needed"];
  return <div className={compact ? styles.compactCounts : styles.counts}>{statuses.map((status) => <div key={status} data-tone={status}><Icon name={status} /><div><strong>{({ keep: ["유지", "Keep"], adjust: ["조정", "Adjust"], hold: ["보류", "Pause"], check_needed: ["확인 필요", "Check needed"] }[status])[locale === "en" ? 1 : 0]}</strong><p>{list(report?.currentProductVerdicts).length ? `${counts[status]}${locale === "en" ? " slots" : "개 슬롯"}` : (locale === "en" ? "No saved verdict" : "판단 정보 없음")}</p></div></div>)}</div>;
}
export function Evidence({ items }) { return list(items).length ? list(items).map((reason, index) => <p key={index}>{typeof reason === "string" ? reason : reason?.summary || reason?.title || ""}</p>) : null; }
