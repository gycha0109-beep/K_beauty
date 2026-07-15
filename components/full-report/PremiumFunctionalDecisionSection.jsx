"use client";

import { useEffect, useMemo, useState } from "react";
import { resolvePremiumFunctionalDisplayModel } from "@/lib/premium-functional-display-model";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const EMPTY_DEV_SCENARIOS = [];
const CATEGORY_LABELS = {
  cleanser: ["클렌저", "Cleanser"], toner_essence: ["토너/에센스", "Toner / Essence"],
  toner_pad: ["토너 패드", "Toner pad"], treatment: ["세럼/기능성", "Treatment"],
  serum: ["세럼", "Serum"], ampoule: ["앰플", "Ampoule"], essence: ["에센스", "Essence"],
  moisturizer: ["보습제", "Moisturizer"], moisturizer_lotion_emulsion: ["로션/에멀전", "Lotion / Emulsion"],
  moisturizer_gel: ["젤 보습제", "Gel moisturizer"], moisturizer_cream: ["크림", "Cream"],
  moisturizer_balm: ["밤", "Balm"], sunscreen: ["선크림", "Sunscreen"]
};
const RELATION_LABELS = {
  ko: { supports_goal: "이번 방향과 연결", different_goal: "다른 역할의 제품", duplicate_axis: "같은 방향 중복", not_evaluable: "기능성 점검 어려움", empty_slot: "현재 미사용", unknown_usage: "사용 여부 미확인" },
  en: { supports_goal: "Connected to this direction", different_goal: "Different routine role", duplicate_axis: "Same-direction overlap", not_evaluable: "Functional check unavailable", empty_slot: "Not currently used", unknown_usage: "Usage not confirmed" }
};
const COPY = {
  ko: {
    kicker: "FUNCTIONAL PLAN", title: "기능성 플랜", body: "공통 Decision Context에서 확정된 기능성 정책과 현재 제품 점검 결과를 표시합니다.",
    devBanner: "개발용 기능성 플랜 시나리오 — 저장되지 않음", focus: "이번에 집중할 피부 고민", secondary: "보조 고민",
    solution: "주요 고민 솔루션", direction: "기능성 방향", reason: "이번 우선순위 근거", approach: "기본 접근",
    products: "내게 맞는 제품 고르기", primaryTab: "주요 고민 추천", secondaryTab: "보조 고민 솔루션", budgetTab: "예산별 대안",
    reportNotice: "현재 리포트에서 확인 가능한 후보만 표시합니다. 현재 제품이나 저장 리포트에 바로 반영되지 않습니다.",
    noProducts: "현재 조건에 맞는 확인 제품을 준비 중입니다. 지금은 피부 반응을 먼저 확인하세요.",
    routine: "내 루틴에 넣기", audit: "이미 사용 중인 기능성 점검", summary: "이번 기능성 플랜 요약 보기",
    summaryTitle: "이번 기능성 플랜 요약", close: "닫기", previous: "이전", next: "컨디션 대응 보기", product: "제품",
    cta: "루틴에 추가 후보로 보기", ctaNotice: "현재 제품 목록에는 아직 저장되지 않습니다. 다음 루틴 설정에서 추가할 수 있습니다."
  },
  en: {
    kicker: "FUNCTIONAL PLAN", title: "Functional plan", body: "This displays the functional policy fixed by the shared Decision Context and the stored current-product audit.",
    devBanner: "Development functional-plan scenario — not saved", focus: "Focus this time", secondary: "Support concern",
    solution: "Main concern solution", direction: "Functional direction", reason: "Why this comes first", approach: "Base approach",
    products: "Choose a fitting product", primaryTab: "Main concern", secondaryTab: "Support concern", budgetTab: "Budget alternatives",
    reportNotice: "Only candidates available in the current report are shown. This does not update current products or the saved report.",
    noProducts: "Verified options are still being prepared. Review skin response first.",
    routine: "Place it in my routine", audit: "Current active check", summary: "View this functional plan summary",
    summaryTitle: "Functional plan summary", close: "Close", previous: "Previous", next: "Open condition response", product: "Product",
    cta: "View as routine candidate", ctaNotice: "This is not saved to current products yet. You can add it in the next routine setup."
  }
};
const AUDIT_TONE = {
  NO_ROUTINE_DATA: "border-zinc-300/60 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
  UNKNOWN: "border-zinc-300/60 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
  OPTIMIZE: "border-emerald-300/45 text-emerald-700 dark:text-emerald-200",
  CONSOLIDATE: "border-sky-300/45 text-sky-700 dark:text-sky-200",
  MISMATCH: "border-violet-300/45 text-violet-700 dark:text-violet-200"
};

function localeKey(locale) { return locale === "en" ? "en" : "ko"; }
function categoryLabel(category, locale) {
  const labels = CATEGORY_LABELS[String(category || "").trim().toLowerCase()];
  return labels?.[locale === "en" ? 1 : 0] || (locale === "en" ? "Product" : "제품");
}
function productsForTab(plan, tab) {
  const source = tab === "secondary" ? plan.secondarySolution?.products : tab === "budget" ? plan.budgetAlternatives : plan.productCandidates;
  return (Array.isArray(source) ? source : []).filter(Boolean).slice(0, 3);
}
function productName(finding, locale) {
  if (finding?.productName) return finding.productName;
  if (finding?.sourceState === "not_in_db") return locale === "en" ? "Unregistered current product" : "DB에 없는 사용 중 제품";
  return categoryLabel(finding?.category, locale);
}
function findingEvidence(finding, locale) {
  const en = locale === "en";
  if (finding?.relationToPlan === "supports_goal") return en ? "Structured product evidence supports this direction." : "구조화된 제품 근거가 이번 방향과 연결됩니다.";
  if (finding?.relationToPlan === "duplicate_axis") return en ? "More than one product shares this direction; review frequency and pairing." : "같은 방향 제품이 여러 개라 빈도와 조합을 함께 점검하세요.";
  if (finding?.relationToPlan === "different_goal") return en ? "This product has another routine role but is not the core step for this direction." : "다른 루틴 역할은 있지만 이번 방향의 핵심 단계로 보지는 않습니다.";
  if (finding?.sourceState === "not_in_db") return en ? "Functionality was not inferred from a product or brand name." : "제품명이나 브랜드명으로 기능성을 추정하지 않았습니다.";
  return en ? "Available structured data is not enough for a stronger judgment." : "현재 구조화 정보만으로는 더 강한 판단이 어렵습니다.";
}
function priceLabel(product, locale) {
  if (product?.priceLabel) return product.priceLabel;
  const min = Number(product?.price_min);
  const max = Number(product?.price_max);
  if (Number.isFinite(min) || Number.isFinite(max)) return [Number.isFinite(min) ? min.toLocaleString() : "", Number.isFinite(max) ? max.toLocaleString() : ""].filter(Boolean).join("~") + (locale === "en" ? " KRW" : "원");
  return locale === "en" ? "Price pending" : "가격 정보 확인 중";
}

function SolutionCard({ plan, copy }) {
  return <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{copy.solution}</p>
    <h4 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{plan.primaryConcern}</h4>
    <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
      <p><strong className="text-zinc-900 dark:text-zinc-100">{copy.direction}</strong><br />{plan.direction}</p>
      <p><strong className="text-zinc-900 dark:text-zinc-100">{copy.reason}</strong><br />{plan.whyPriority}</p>
      <p><strong className="text-zinc-900 dark:text-zinc-100">{copy.approach}</strong><br />{plan.baseApproach}</p>
    </div>
  </article>;
}

function ProductOptions({ plan, audit, copy, locale, onCta }) {
  const [tab, setTab] = useState("primary");
  const tabs = [["primary", copy.primaryTab], ["secondary", copy.secondaryTab], ["budget", copy.budgetTab]];
  const products = productsForTab(plan, tab);
  return <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">PRODUCT OPTIONS</p>
    <h4 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{copy.products}</h4>
    <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{copy.reportNotice}</p>
    <div className="mt-4 flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/5 p-1">
      {tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${tab === key ? "bg-rose-500 text-white" : "text-zinc-600 dark:text-zinc-300"}`}>{label}</button>)}
    </div>
    <div className="mt-4 grid gap-3">
      {products.length ? products.map((product, index) => <article key={product.id || `${product.name}-${index}`} className="rounded-[0.95rem] border border-white/10 bg-white/5 p-4">
        <div className="flex gap-3"><div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[10px] text-zinc-400">{copy.product}</div>
          <div className="min-w-0"><span className="ui-chip-compact px-2 py-1">{categoryLabel(product.category, locale)}</span><p className="mt-2 text-xs text-zinc-500">{product.brand}</p><h5 className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{product.name}</h5><p className="mt-1 text-sm font-semibold">{priceLabel(product, locale)}</p></div>
        </div>
        {product.reason ? <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{product.reason}</p> : null}
        <button type="button" onClick={onCta} className="ui-button-secondary mt-4 min-h-10 w-full justify-center text-xs font-semibold">{plan.planMode === "HOLD" ? (locale === "en" ? "Review after skin is steady" : "피부 안정 후 검토하기") : audit.status === "CONSOLIDATE" ? (locale === "en" ? "Compare as an alternative" : "대체 후보로 비교하기") : copy.cta}</button>
      </article>) : <p className="rounded-xl border border-white/10 p-3 text-sm text-zinc-700 dark:text-zinc-300">{copy.noProducts}</p>}
    </div>
  </article>;
}

function RoutineGuide({ plan, copy, locale }) {
  const guide = plan.routineGuide || {};
  const hold = plan.planMode === "HOLD";
  const text = locale === "en"
    ? `${hold ? "Do not add a new active for now." : `Use this in the ${guide.time || "selected routine"}.`}\n${guide.order || ""}\n\n${guide.frequency || ""}. Avoid or adjust ${guide.avoid || "overlapping actives"}.\n\n${guide.review || plan.reviewCondition || ""}`
    : `${hold ? "이번 기간에는 새 기능성을 추가하지 마세요." : `${guide.time || "선택한 루틴"}에서 사용하세요.`}\n${guide.order || ""}\n\n${guide.frequency || ""}. 같은 날에는 ${guide.avoid || "기능성 중첩"}을 피하거나 조절하세요.\n\n${guide.review || plan.reviewCondition || ""}`;
  return <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">ROUTINE GUIDE</p><h4 className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">{copy.routine}</h4><p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">{text}</p></article>;
}

function RoutineAudit({ audit, copy, locale }) {
  const labels = RELATION_LABELS[localeKey(locale)];
  return <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
    <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{copy.audit}</p><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${AUDIT_TONE[audit.status] || AUDIT_TONE.UNKNOWN}`}>{audit.status}</span></div>
    <h4 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">{audit.title || copy.audit}</h4><p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{audit.message}</p>
    {Array.isArray(audit.findings) && audit.findings.length ? <div className="mt-3 grid gap-2">{audit.findings.map((finding, index) => <div key={`${finding.sourceState}-${finding.productId || index}`} className="rounded-xl border border-white/10 px-3 py-2"><div className="flex items-center gap-2"><p className="min-w-0 flex-1 break-words text-sm font-semibold">{productName(finding, locale)}</p><span className="rounded-full border border-white/10 px-2 py-1 text-[11px]">{categoryLabel(finding.category, locale)}</span></div><p className="mt-2 text-xs font-semibold text-violet-700 dark:text-violet-200">{labels[finding.relationToPlan] || labels.not_evaluable}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{findingEvidence(finding, locale)}</p></div>)}</div> : null}
    <p className="mt-3 rounded-xl border border-white/10 px-3 py-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{audit.actionMessage}</p>
  </article>;
}

function SummarySheet({ open, onClose, plan, audit, copy, locale }) {
  if (!open) return null;
  const items = locale === "en" ? [["Main concern", plan.primaryConcern], ["Direction", plan.direction], ["Plan pace", plan.planMode], ["Current product audit", audit.status], ["Next review", plan.routineGuide?.review || plan.reviewCondition]] : [["이번 주요 고민", plan.primaryConcern], ["추천 기능성 방향", plan.direction], ["추천 플랜 속도", plan.planMode], ["현재 제품 점검 결과", audit.status], ["다음 재검토 시점", plan.routineGuide?.review || plan.reviewCondition]];
  return <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0 bg-black/35" aria-label={copy.close} onClick={onClose} /><div className="absolute inset-x-0 bottom-0 mx-auto max-h-[78vh] max-w-2xl overflow-y-auto rounded-t-[1.35rem] border border-white/10 bg-[#fffaf6] p-5 dark:bg-[#241720]"><div className="flex justify-between gap-3"><h4 className="text-lg font-semibold">{copy.summaryTitle}</h4><button type="button" onClick={onClose} className="ui-button-secondary min-h-9 px-3 text-xs">{copy.close}</button></div><div className="mt-4 grid gap-2">{items.filter(([, value]) => value).map(([label, value]) => <p key={label} className="grid gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm sm:grid-cols-[128px_minmax(0,1fr)]"><strong>{label}</strong><span>{value}</span></p>)}</div></div></div>;
}

export default function PremiumFunctionalDecisionSection({ decisions = [], report = {}, locale = "ko", enableDevScenarios = false, devScenarios = EMPTY_DEV_SCENARIOS, onNavigate }) {
  const copy = COPY[localeKey(locale)];
  const [devScenarioId, setDevScenarioId] = useState("");
  const [ctaNotice, setCtaNotice] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const canUseDev = Boolean(enableDevScenarios && IS_DEVELOPMENT);
  const activeDevScenario = canUseDev ? devScenarios.find((item) => item.id === devScenarioId) || devScenarios[0] || null : null;
  useEffect(() => { if (!canUseDev) setDevScenarioId(""); else setDevScenarioId((current) => current || devScenarios[0]?.id || ""); }, [canUseDev, devScenarios]);
  const model = useMemo(() => resolvePremiumFunctionalDisplayModel({ report, decisions, locale, devScenario: activeDevScenario }), [activeDevScenario, decisions, locale, report]);
  const plan = model.functionalPlan;
  const audit = model.routineAudit;

  return <section className="space-y-4">
    {canUseDev && devScenarios.length ? <div className="rounded-[1rem] border border-amber-300/50 bg-amber-50/70 p-3 text-amber-900"><p className="text-xs font-semibold">{copy.devBanner}</p><div className="mt-2 flex gap-2 overflow-x-auto">{devScenarios.map((scenario) => <button key={scenario.id} type="button" onClick={() => setDevScenarioId(scenario.id)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${scenario.id === model.id ? "bg-rose-500 text-white" : "bg-white/70"}`}>{scenario.label}</button>)}</div></div> : null}
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{copy.kicker}</p><h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{copy.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{copy.body}</p><div className="mt-4 flex gap-2"><span className="rounded-full border border-violet-300/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-200">{plan.planMode}</span>{plan.allowedIntensity ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold">{plan.allowedIntensity}</span> : null}</div><div className="mt-4 rounded-[1rem] bg-violet-500/10 p-4"><p className="text-xs font-semibold text-violet-700 dark:text-violet-200">{copy.focus}</p><h4 className="mt-2 text-xl font-semibold">{plan.primaryConcern}</h4>{plan.secondaryConcern ? <p className="mt-1 text-sm text-zinc-500">{copy.secondary} · {plan.secondaryConcern}</p> : null}<p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{plan.planSummary}</p></div></article>
    <SolutionCard plan={plan} copy={copy} />
    <ProductOptions plan={plan} audit={audit} copy={copy} locale={locale} onCta={() => setCtaNotice(copy.ctaNotice)} />
    {ctaNotice ? <p className="rounded-xl border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-200">{ctaNotice}</p> : null}
    <RoutineGuide plan={plan} copy={copy} locale={locale} />
    <RoutineAudit audit={audit} copy={copy} locale={locale} />
    <button type="button" onClick={() => setSummaryOpen(true)} className="ui-button-secondary min-h-12 w-full justify-center text-sm font-semibold">{copy.summary}</button>
    <div className="grid grid-cols-2 gap-2"><button type="button" className="ui-button-secondary min-h-11 justify-center text-sm" onClick={() => onNavigate?.("routine")}>{copy.previous}</button><button type="button" className="ui-button-primary min-h-11 justify-center text-sm" onClick={() => onNavigate?.("condition")}>{copy.next}</button></div>
    <SummarySheet open={summaryOpen} onClose={() => setSummaryOpen(false)} plan={plan} audit={audit} copy={copy} locale={locale} />
  </section>;
}
