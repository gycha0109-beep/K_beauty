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
      <div className="ui-card p-6">
        <p className="ui-kicker">{copy.recommendedStepKicker}</p>
        <h2 className="ui-title mt-2 text-[2rem]">{copy.recommendedStepTitle}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.recommendedStepBody}</p>
      </div>

      {products.length ? (
        <div className="space-y-4">
          <div className="overflow-hidden">
            {activeProduct ? renderProduct(activeProduct) : null}
          </div>

          <div className="ui-card-muted flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {activeIndex + 1} / {products.length}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moveTo(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="ui-button-secondary px-3 py-1.5 text-xs font-medium"
              >
                {copy.previous}
              </button>
              <button
                type="button"
                onClick={() => moveTo(activeIndex + 1)}
                disabled={activeIndex === products.length - 1}
                className="ui-button-secondary px-3 py-1.5 text-xs font-medium"
              >
                {copy.next}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="ui-card p-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {copy.recommendedStepEmpty}
        </div>
      )}
    </section>
  );
}
