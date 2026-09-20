"use client";
import { useState } from "react";
import { resolvePremiumFunctionalDisplayModel } from "@/lib/premium-functional-display-model";
import { list, savedPlan, finalAction } from "@/lib/full-report-presentation";
import SafeProductImage from "@/components/common/SafeProductImage";
import ReportCurrentProducts from "./ReportCurrentProducts";
import { Header, Hero, CTA, Counts, Heading, Badge, Disclosure, Evidence, Empty, Icon, styles } from "./ReportUI";

function Candidate({ product, locale }) {
  const en = locale === "en";
  const [open, setOpen] = useState(false);
  const prices = [product.price_min, product.price_max].filter((p) => p !== null && p !== undefined && Number.isFinite(Number(p))).map((p) => Number(p).toLocaleString(en ? "en-US" : "ko-KR"));
  return <article className={styles.candidate} data-functional-product>
    <div className={styles.candidateImage}><SafeProductImage product={product} alt={product.name || ""} className={styles.productPhoto} fallback={<><Icon name="bottle"/><small>{en ? "No product image" : "제품 이미지 없음"}</small></>}/></div>
    <div><small>{product.brand}</small><h3>{product.name}</h3><p>{product.reason || product.description}</p><strong>{product.priceLabel || (prices.length ? [...new Set(prices)].join("–") + (en ? " KRW" : "원") : (en ? "Price unavailable" : "가격 정보 확인 필요"))}</strong>
      <button className={styles.primary} aria-expanded={open} onClick={() => setOpen(!open)}>{en ? "Product information" : "제품 정보 보기"} <span aria-hidden="true">→</span></button>
      {open && <div className={styles.productDetail}><p>{product.reason || product.description || (en ? "Only the saved candidate information is available." : "저장된 후보 정보만 표시해요.")}</p><p>{en ? "Viewing does not add this product to your routine." : "제품을 확인해도 현재 루틴에 자동 추가되지 않아요."}</p></div>}
    </div>
  </article>;
}
export default function PremiumFunctionalDecisionSection({ report = {}, decisions = [], locale = "ko", onNavigate }) {
  const en = locale === "en";
  const [expanded, setExpanded] = useState(false);
  const model = resolvePremiumFunctionalDisplayModel({ report, decisions, locale });
  // Keep legacy snapshot text, but do not advertise inferred legacy START as new permission.
  const canonical = savedPlan(report);
  const plan = model.functionalPlan || {};
  const guide = canonical?.routineGuide || {};
  const candidates = list(plan.productCandidates);
  const mode = canonical?.planMode;
  const status = mode === "START" ? "keep" : mode === "HOLD" ? "hold" : "check_needed";
  const modeLabel = en ? ({ START: "Can start", HOLD: "Pause" }[mode] || "Check needed") : ({ START: "시작 가능", HOLD: "추가 보류" }[mode] || "확인 필요");
  return <section className={styles.page} data-report-section="change" data-functional-plan>
    <Header title={en ? "Next change plan" : "다음 변화 플랜"} body={en ? "Review the next step for your skin." : "내 피부에 맞는 다음 단계를 제안해요."} locale={locale} onNavigate={onNavigate}/>
    <Hero label={en ? "Next change proposal" : "다음 변화 제안"} title={finalAction(report, locale)} body={plan.planSummary} actions={<CTA onClick={() => onNavigate("adjustment-guide")}>{en ? "Situational care" : "상황별 대응 보기"}</CTA>}>
      <div className={styles.signalRow}><Badge status={status}>{en ? "Skin guidance" : "피부 기준"} · {modeLabel}</Badge><Badge status="check_needed">{en ? "Replacement" : "제거·교체"} · {en ? "No separate verdict" : "별도 판단 정보 없음"}</Badge></div>
    </Hero>
    <Heading note={en ? "Saved slot verdicts" : "현재 제품의 저장된 슬롯별 판단이에요."}>{en ? "Change summary" : "변화 요약"}</Heading><Counts report={report} locale={locale}/>
    <Heading note={en ? "Review candidates; not an instruction to add" : "추가 지시가 아닌, 검토할 후보예요."}>{en ? "Candidate for the next step" : "이번에 검토할 다음 단계"}</Heading>
    {candidates.length ? <><Candidate product={candidates[0]} locale={locale}/>{candidates.length > 1 && <><button className={styles.secondary} aria-expanded={expanded} aria-controls="change-alternatives" onClick={() => setExpanded(!expanded)}>{expanded ? (en ? "Hide alternatives" : "다른 후보 접기") : (en ? `View ${candidates.length - 1} alternatives` : `다른 후보 ${candidates.length - 1}개 보기`)}</button><div id="change-alternatives" hidden={!expanded}>{candidates.slice(1).map((product, i) => <Candidate key={product.id || i} product={product} locale={locale}/>)}</div></>}</> : <Empty>{en ? "No candidate is saved for this report." : "이 리포트에 저장된 후보 제품이 없어요."}</Empty>}
    <Heading>{en ? "Current products" : "현재 사용 제품은 이렇게"}</Heading><ReportCurrentProducts report={report} locale={locale}/>
    {model.routineAudit?.message && <p className={styles.muted}>{model.routineAudit.message}</p>}
    {list(model.routineAudit?.findings).map((finding, index) => <Disclosure key={finding.productId || index} title={finding.productName || (en ? "Product evidence" : "제품 확인 근거")}><p>{finding.reason}</p><p>{finding.sourceState === "not_in_db" ? (en ? "Unregistered · check needed" : "미등록 · 확인 필요") : finding.relationToPlan === "duplicate_axis" ? (en ? "Overlapping functional axis" : "기능성 축 중복") : ""}</p></Disclosure>)}
    <Heading>{en ? "Usage guide" : "사용 가이드"}</Heading>
    <div className={styles.guideGrid}>{[[en ? "Frequency" : "권장 빈도", guide.frequency, "clock"], [en ? "Order" : "사용 순서", [guide.time, guide.order].filter(Boolean).join(" · "), "bars"], [en ? "Avoid pairing" : "함께 피할 조합", guide.avoid, "shield"]].map(([title, value, icon]) => <article key={title}><Icon name={icon}/><h3>{title}</h3><p>{value || (en ? "No saved guidance; check needed." : "저장된 안내가 없어 확인이 필요해요.")}</p></article>)}</div>
    <Disclosure title={en ? "Supporting goals and budget alternatives" : "보조 목표와 예산 대안"}><h3>{plan.secondarySolution?.title || plan.secondaryConcern}</h3><p>{plan.secondarySolution?.direction}</p>{[...list(plan.secondarySolution?.products), ...list(plan.budgetAlternatives)].map((product, i) => <Candidate key={i} product={product.product || product} locale={locale}/>)}</Disclosure>
    <Disclosure title={en ? "Recheck conditions" : "재검토 조건"} icon="clock"><p>{guide.review || canonical?.reviewCondition || (en ? "No saved recheck conditions." : "재검토 조건이 저장되지 않았어요.")}</p></Disclosure>
    <Disclosure title={en ? "Detailed decision evidence" : "상세 판단 근거"}><p>{plan.whyPriority}</p><p>{model.routineAudit?.actionMessage}</p>{list(decisions).map((decision, i) => <div key={i}><h3>{decision.title}</h3><p>{decision.summary}</p><Evidence items={decision.reasons}/><p>{decision.nextAction}</p></div>)}</Disclosure>
  </section>;
}
