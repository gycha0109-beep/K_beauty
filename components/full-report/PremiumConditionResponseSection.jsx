"use client";
import { useState } from "react";
import { list, saved, conditionItems } from "@/lib/full-report-view";
import { Header, Badge, Disclosure, Notice, Empty, Icon, styles } from "./ReportUI";

// Literal labels for canonical roles/actions; no product or causality inference.
const LABELS = {
  gentle_cleansing: ["순한 세안", "Gentle cleansing"], hydration: ["수분 보완", "Hydration"], barrier_support: ["장벽 보습", "Barrier support"], sun_protection: ["자외선 보호", "Sun protection"], necessary_evening_cleansing: ["필요한 저녁 세안", "Necessary PM cleansing"], optional_actives: ["선택 기능성", "Optional actives"], optional_exfoliation: ["선택 각질 케어", "Optional exfoliation"], suspected_optional_product: ["반응이 의심되는 선택 제품 (특정 제품 미지정)", "Suspected optional product (not identified)"], friction: ["마찰", "Friction"], heat_exposure: ["열 노출", "Heat exposure"], layer_count: ["겹치는 단계 수", "Layer count"], cleansing_frequency: ["세안 횟수", "Cleansing frequency"], cleansing_friction: ["세안 마찰", "Cleansing friction"], drying_finish: ["건조한 마무리", "Drying finish"], heavy_layer_count: ["무거운 레이어", "Heavy layers"], makeup_prep_layers: ["메이크업 전 단계 수", "Makeup prep layers"], same_day_active_stacking: ["같은 날 기능성 중복", "Same-day active stacking"], cleansing_duration: ["세안 시간", "Cleansing duration"], active_frequency: ["기능성 사용 빈도", "Active frequency"], new_product_trials: ["새 제품 시도", "New product trials"], redness_signal_resolved: ["붉음 신호가 가라앉음", "Redness has resolved"], comfortable_for_several_days: ["며칠간 편안한 상태 유지", "Comfortable for several days"], tightness_signal_resolved: ["당김 신호가 가라앉음", "Tightness has resolved"], flaking_signal_resolved: ["각질 신호가 가라앉음", "Flaking has resolved"], reaction_signal_resolved: ["반응 신호가 가라앉음", "Reaction has resolved"], persistent_discomfort: ["불편감 지속", "Persistent discomfort"], daily_life_interference: ["일상생활에 지장", "Interference with daily life"], worsening_reaction: ["반응 악화", "Worsening reaction"], rapid_worsening: ["빠르게 악화됨", "Rapid worsening"]
};
export default function PremiumConditionResponseSection({ conditionPlan = null, responses = [], report = {}, locale = "ko", onNavigate }) {
  const [selected, setSelected] = useState(0);
  const [windowKey, setWindowKey] = useState("morningSteps");
  const en = locale === "en";
  const items = conditionItems(conditionPlan, responses);
  const item = items[selected] || items[0];
  const label = (key) => LABELS[key]?.[en ? 1 : 0] || key;
  const groups = item ? [
    { key: "keep", title: en ? "Maintain" : "유지하기", icon: "check", roles: list(item.maintainRoles) },
    { key: "adjust", title: en ? "Reduce" : "줄이기", icon: "minus", roles: [...list(item.reduceRoles), ...list(item.reduceActions)] },
    { key: "hold", title: en ? "Temporarily pause" : "잠시 보류", icon: "close", roles: list(item.pauseRoles) }
  ] : [];
  const hasRoles = groups.some((group) => group.roles.length);
  const routine = saved(report, "routinePlan");
  const baseline = list(routine?.[windowKey] ?? report?.fullRoutine?.[windowKey]);
  return <section className={styles.page} data-report-section="condition" data-condition-source={Array.isArray(conditionPlan?.responses) ? "canonical" : "legacy_adapter"}>
    <Header number="04" title={en ? "Situational care" : "상황별 대응"} locale={locale} onNavigate={onNavigate}/>
    <p>{en ? "Choose a scenario recorded in your report." : "저장된 상황에 맞는 스킨케어 가이드를 확인하세요."}</p>
    <div className={styles.scenarioSelector} aria-label={en ? "Scenarios" : "상황 선택"}>{items.map((response, i) => <button type="button" key={`${response.conditionKey || response.responseKey}-${i}`} aria-pressed={item === response} onClick={() => setSelected(i)}><Icon name={response.conditionKey === "dryness_tightness" ? "sun" : "info"}/>{response.title}</button>)}</div>
    {item ? <>
      <div className={styles.scenarioHero}><Badge>{({ active: en ? "Reported" : "확인된 신호", watch: en ? "Watch" : "관찰 필요", unknown: en ? "Unknown" : "미확인", inactive: en ? "Not active" : "현재 신호 없음" }[item.triggerState]) || (en ? "Saved guidance" : "저장된 안내")}</Badge><h3>{item.title}</h3><p>{item.summary}</p></div>
      <h3 className={styles.heading}>{en ? "How to respond" : "이렇게 케어해보세요"}</h3>
      {hasRoles ? groups.map((group) => <div key={group.key} className={styles.roleRow} data-tone={group.key}><span className={styles.roleIcon}><Icon name={group.icon}/></span><div><h3>{group.title}</h3><p>{group.roles.map(label).join(" · ") || (en ? "No specified changes" : "지정된 항목 없음")}</p></div></div>) : <Notice>{item.action || (en ? "This legacy report has no role-level comparison." : "이전 리포트에는 역할별 비교 정보가 없어요.")}</Notice>}
      <h3 className={styles.heading}>{en ? "Routine comparison" : "루틴 비교"}</h3>
      {hasRoles ? <><div className={styles.segmented}>{[["morningSteps", "AM"], ["nightSteps", "PM"]].map(([key, title]) => <button key={key} type="button" aria-pressed={windowKey === key} onClick={() => setWindowKey(key)}>{title}</button>)}</div><div className={styles.comparison}><div className={styles.compareColumn}><h4>{en ? "Usual routine" : "평소 루틴"}</h4>{baseline.length ? baseline.map((step, i) => <p key={i}><Icon/>{step.title || step.stepName || step.instruction}</p>) : <Empty>{en ? "No stored steps" : "저장된 단계 없음"}</Empty>}</div><Icon name="arrow"/><div className={styles.compareColumn}><h4>{en ? "Response routine" : "대응 루틴"}</h4>{groups.flatMap((group) => group.roles.map((role) => <p key={`${group.key}-${role}`} data-tone={group.key}><Icon name={group.icon}/>{label(role)} · {group.title}</p>))}</div></div><p className={styles.metadata}>{en ? "Compare the saved routine with policy roles and actions; no product-specific stop decision is inferred." : "저장 루틴과 정책의 역할·행동을 비교해요. 특정 제품의 중단을 추정하지 않아요."}</p></> : <Empty>{en ? "Role-level changes were not stored; no routine diff is inferred." : "역할별 변경이 저장되지 않아 루틴 차이를 추정하지 않아요."}</Empty>}
      {list(item.returnCriteria).length > 0 && <Notice><strong>{en ? "Return when" : "원래 루틴으로 돌아갈 때"}</strong><p>{item.returnCriteria.map(label).join(" · ")}</p></Notice>}
      {list(item.escalationCriteria).length > 0 && <Notice><strong>{en ? "Seek advice if" : "상담을 고려할 때"}</strong><p>{item.escalationCriteria.map(label).join(" · ")}</p></Notice>}
      <Disclosure title={en ? "Scenario evidence" : "상황 판단 근거"}>{list(item.reasons).map((reason, i) => <p key={i}>{reason}</p>)}<p>{item.action}</p><p>{en ? "Confidence" : "확신 수준"} · {item.confidence || (en ? "Unknown" : "미확인")}</p><small>{list(item.evidenceKeys).join(" · ")}</small></Disclosure>
    </> : <Empty>{en ? "No scenarios are stored in this report." : "이 리포트에는 저장된 상황별 대응이 없어요."}</Empty>}
    <Notice>{conditionPlan?.globalNotice}</Notice>
  </section>;
}
