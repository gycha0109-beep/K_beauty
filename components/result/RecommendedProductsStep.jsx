"use client";

import { useState } from "react";

export default function RecommendedProductsStep({ copy, products, renderProduct }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeProduct = products[activeIndex] || null;
  const moveTo = (nextIndex) => {
    const boundedIndex = Math.max(0, Math.min(products.length - 1, nextIndex));
    setActiveIndex(boundedIndex);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.recommendedStepKicker}
        </p>
        <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-ink">
          {copy.recommendedStepTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-black/62">
          {copy.recommendedStepBody}
        </p>
      </div>

      {products.length ? (
        <div className="space-y-4">
          <div className="overflow-hidden">
            {activeProduct ? renderProduct(activeProduct) : null}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-black/5 bg-white/88 px-4 py-3 shadow-soft">
            <p className="text-xs font-medium text-black/45">
              {activeIndex + 1} / {products.length}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moveTo(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/68 transition hover:border-black/20 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copy.previous}
              </button>
              <button
                type="button"
                onClick={() => moveTo(activeIndex + 1)}
                disabled={activeIndex === products.length - 1}
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/68 transition hover:border-black/20 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copy.next}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.7rem] border border-black/5 bg-white/88 p-5 text-sm leading-6 text-black/62 shadow-soft">
          {copy.recommendedStepEmpty}
        </div>
      )}
    </section>
  );
}
