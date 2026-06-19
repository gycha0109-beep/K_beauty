export default function CurrentProductSlotNote({ items = [], compact = false }) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const toneClass = {
    positive: "border-[#e7b49f]/35 bg-[#e87662]/[0.07] text-[#6f342f] dark:border-[#e7b49f]/25 dark:bg-[#e87662]/[0.09] dark:text-[#f2c5b6]",
    neutral: "border-white/10 bg-white/[0.035] text-zinc-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-300",
    warning: "border-[#f0a9a3]/40 bg-[#f07167]/[0.08] text-[#893f3b] dark:border-[#f0a9a3]/28 dark:bg-[#f07167]/10 dark:text-[#f3b8b2]",
    empty: "border-zinc-300/45 bg-zinc-500/[0.07] text-zinc-600 dark:border-zinc-700/75 dark:bg-white/[0.03] dark:text-zinc-300"
  };

  return (
    <div className={`${compact ? "mt-2" : "mt-2.5"} grid gap-2`}>
      {items.map((item) => {
        const productLine = [item.brandName, item.productName].filter(Boolean).join(" - ");

        return (
          <div
            key={`${item.category}-${item.slot}-${item.status}-${productLine || item.helperText}`}
            className={`min-w-0 rounded-[0.72rem] border px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${toneClass[item.severity] || toneClass.neutral}`}
          >
            <p className="text-[10px] font-semibold leading-4 text-zinc-500 dark:text-zinc-400">{item.label}</p>
            {productLine ? (
              <p className="mt-0.5 break-words text-xs font-semibold leading-5">{productLine}</p>
            ) : null}
            {item.helperText ? (
              <p className="mt-0.5 break-words text-[10px] leading-4 opacity-72">{item.helperText}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
