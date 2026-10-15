"use client";

import { buildOfferPresentation } from "@/lib/commerce/product-offer-presentation-v1.mjs";

/** D8K-3 presentation-only; no fetch, API, browser role or enabled purchase CTA. */
export default function ProductOfferComparison({ comparison = null, locale = "ko", compact = false }) {
  const view = buildOfferPresentation(comparison, locale);
  return (
    <section aria-label={view.title} data-offer-ui-version={view.version}
      className={"min-w-0 rounded-2xl border border-rose-200/70 bg-white/85 text-zinc-900 dark:border-rose-300/15 dark:bg-zinc-900/85 dark:text-zinc-100 " + (compact ? "p-3" : "p-4 sm:p-5")}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight sm:text-base">{view.title}</h3>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{view.message}</span>
      </header>
      {view.groups.length ? (
        <div className="mt-3 space-y-4">
          {view.groups.map((group, index) => (
            <div key={group.key || "group-" + index} className="min-w-0">
              <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">{group.description}</p>
              <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" role="list">
                {group.rows.map((row, i) => (
                  <li key={row.key || "seller-" + i} className="min-w-0 rounded-xl border border-zinc-200/85 bg-rose-50/35 p-3 dark:border-zinc-700/80 dark:bg-white/[0.035]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words text-xs font-semibold">{row.seller}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{row.formattedAmount}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">{row.amountLabel}</p>
                    {row.shippingUnknown ? <p className="mt-1 text-[11px] leading-4 text-amber-700 dark:text-amber-300">{row.shippingMessage}</p> : null}
                    {row.observedAt ? <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{row.observedLabel}: {row.observedAt}</p> : null}
                    <button type="button" disabled aria-disabled="true" className="mt-3 min-h-9 w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-500 opacity-90 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      {row.ctaLabel}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{view.noCheapest}</p>
        </div>
      ) : <p role="status" className="mt-3 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{view.message}</p>}
    </section>
  );
}
