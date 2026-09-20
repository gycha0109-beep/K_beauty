import { buildCurrentProductRoutineSlots } from "@/lib/current-products";
import { getCurrentProductVerdictSlotKey } from "@/lib/current-product-verdicts";
import { list } from "@/lib/full-report-presentation";
import { Badge, Disclosure, Empty, Evidence, styles } from "./ReportUI";

export default function ReportCurrentProducts({ report, locale = "ko", mode, evidenceOnly = false }) {
  const slots = buildCurrentProductRoutineSlots(report?.currentProducts, locale);
  const verdicts = new Map(list(report?.currentProductVerdicts).map((item) => [item.slotKey, item]));
  const rows = (mode ? [mode] : ["am", "pm"]).flatMap((time) => Object.values(slots[time]).flat().map((item) => ({ ...item, time, key: getCurrentProductVerdictSlotKey(time, item.slot, item.category) })));
  const en = locale === "en";
  if (!rows.length) return <Empty>{en ? "No current-product selections are saved." : "저장된 현재 사용 제품 정보가 없어요."}</Empty>;
  return <div className={styles.productRows}>{rows.map((item, i) => {
    const verdict = item.status === "not_using" ? null : verdicts.get(item.key);
    const name = item.productName || item.label;
    return <Disclosure key={`${item.key}-${i}`} icon="bottle" title={<><span>{name}<small>{item.time === "am" ? (en ? "Morning" : "아침") : (en ? "Evening" : "저녁")}</small></span><Badge status={verdict?.status} locale={locale}>{item.status === "not_using" ? (en ? "Not using" : "사용 안 함") : undefined}</Badge></>}>
      {evidenceOnly ? <Evidence items={verdict?.reasons}/> : <><p>{verdict?.summary || item.helperText}</p><p>{verdict?.adjustment}</p><Evidence items={verdict?.reasons}/></>}
      {item.status === "not_in_db" && <p>{en ? "Unregistered; functionality has not been inferred." : "미등록 제품의 기능성은 추정하지 않았어요."}</p>}
      {!verdict && item.status !== "not_using" && <p>{en ? "No saved product verdict is available." : "제품별 판단 정보가 없어 확인이 필요해요."}</p>}
    </Disclosure>;
  })}</div>;
}
