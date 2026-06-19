export default function CurrentProductsSummaryCard({ currentProducts, locale = "ko" }) {
  const selections = Array.isArray(currentProducts?.selections)
    ? currentProducts.selections
    : [];

  if (!selections.length) {
    return null;
  }

  const isEnglish = locale === "en";
  const statusItems = [
    {
      label: isEnglish ? "DB products" : "DB 제품",
      count: selections.filter((selection) => selection.status === "selected").length
    },
    {
      label: isEnglish ? "Not in DB" : "DB 미등록",
      count: selections.filter((selection) => selection.status === "not_in_db").length
    },
    {
      label: isEnglish ? "Not using" : "사용 안 함",
      count: selections.filter((selection) => selection.status === "not_using").length
    }
  ].filter((item) => item.count > 0);

  return (
    <section className="rounded-[1rem] border border-white/10 bg-white/[0.035] p-4">
      <div className="min-w-0">
        <p className="ui-kicker">{isEnglish ? "CURRENT PRODUCT CONTEXT" : "현재 제품 반영"}</p>
        <h3 className="mt-2 text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
          {isEnglish ? "Current products are shown inside routine steps." : "선택한 제품을 루틴 단계에 함께 표시했어요."}
        </h3>
        <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          {isEnglish
            ? "Unregistered products are excluded from detailed fit checks. Slots marked not in use stay visible as empty steps."
            : "DB 미등록 제품은 상세 판단에서 제외됩니다. 사용 안 함으로 표시한 슬롯은 비어 있음으로 안내해요."}
        </p>
      </div>

      {statusItems.length ? (
        <p className="mt-3 text-[11px] font-semibold leading-5 text-[#8a4a5c] dark:text-[#f0c5cf]">
          {statusItems.map((item) => `${item.label} ${item.count}`).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
