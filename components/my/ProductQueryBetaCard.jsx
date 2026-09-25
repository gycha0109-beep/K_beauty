"use client";

import { useState } from "react";

function getErrorMessage(status, copy) {
  if (status === 400) return copy.errors.invalid;
  if (status === 401) return copy.errors.session;
  if (status === 404) return copy.errors.unavailable;
  if (status === 502 || status === 503) return copy.errors.temporary;
  return copy.errors.generic;
}

export default function ProductQueryBetaCard({ copy }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedQuery = query.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!normalizedQuery || normalizedQuery.length > 500 || submitting) {
      setError(copy.errors.invalid);
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/my/product-query-beta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({ query: normalizedQuery })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError(getErrorMessage(response.status, copy));
        return;
      }

      setResult(payload.result || null);
    } catch {
      setError(copy.errors.temporary);
    } finally {
      setSubmitting(false);
    }
  }

  const products = Array.isArray(result?.results) ? result.results : [];
  const unresolvedTerms = Array.isArray(result?.unresolvedTerms)
    ? result.unresolvedTerms
    : [];

  return (
    <section data-testid="product-query-beta-card" className="rounded-[1.5rem] border border-[#e8c9d3] bg-[linear-gradient(145deg,rgba(255,250,247,0.96),rgba(255,238,244,0.92))] p-5 shadow-[0_18px_45px_rgba(120,65,82,0.08)] dark:border-[#51323f] dark:bg-[linear-gradient(145deg,rgba(47,31,40,0.98),rgba(58,34,45,0.96))] sm:p-6">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <p className="ui-kicker">{copy.kicker}</p>
          <span className="rounded-full border border-[#e8b8c8] bg-white/70 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#9b4f69] dark:border-[#704354] dark:bg-[#38232d] dark:text-[#f2adc3]">
            Beta
          </span>
        </div>
        <h2 className="ui-title mt-2 text-xl sm:text-2xl">{copy.title}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="product-query-beta-input" className="text-sm font-semibold text-[#533c45] dark:text-[#f2dfe5]">
          {copy.label}
        </label>
        <textarea
          id="product-query-beta-input"
          data-testid="product-query-beta-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder={copy.placeholder}
          className="mt-2 w-full resize-none rounded-[1rem] border border-[#e2c8d0] bg-white/90 px-4 py-3 text-sm leading-6 text-[#382a30] outline-none transition placeholder:text-[#a68d96] focus:border-[#df7698] focus:ring-2 focus:ring-[#f6cad8] dark:border-[#5a3a47] dark:bg-[#261920] dark:text-[#f8edf1] dark:placeholder:text-[#a98d98] dark:focus:border-[#ef769c] dark:focus:ring-[#633346]"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="ui-text-faint text-xs">{copy.privacy}</p>
          <button
            type="submit"
            data-testid="product-query-beta-submit"
            disabled={submitting || !query.trim()}
            className="ui-button-primary min-h-11 w-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitting ? copy.submitting : copy.submit}
          </button>
        </div>
      </form>

      {error ? (
        <div role="alert" data-testid="product-query-beta-error" className="mt-4 rounded-[1rem] border border-[#efc6c6] bg-[#fff4f4] px-4 py-3 text-sm text-[#8d3d45] dark:border-[#6a3d43] dark:bg-[#3b2328] dark:text-[#ffc8cf]">
          {error}
        </div>
      ) : null}

      {result ? (
        <div data-testid="product-query-beta-result" className="mt-5 space-y-3">
          {unresolvedTerms.length > 0 ? (
            <div className="rounded-[1rem] border border-[#ead8b7] bg-[#fff9e9] px-4 py-3 text-sm text-[#745a27] dark:border-[#665536] dark:bg-[#332d20] dark:text-[#f2dda8]">
              <p className="font-semibold">{copy.partialTitle}</p>
              <p className="mt-1 leading-6">{copy.partialBody}</p>
            </div>
          ) : null}

          {products.length > 0 ? (
            <>
              <div>
                <p className="ui-kicker">{copy.resultsKicker}</p>
                <h3 className="ui-title mt-1 text-lg">{copy.resultsTitle}</h3>
              </div>
              <div className="grid gap-3">
                {products.map((product) => (
                  <article data-testid="product-query-beta-product" key={product.id || `${product.brand}-${product.name}`} className="rounded-[1.1rem] border border-[#ead2ca] bg-white/80 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26]">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9a6c7a] dark:text-[#cfa9b5]">
                      {product.brand || copy.unknownBrand}
                    </p>
                    <h4 className="mt-1 text-base font-bold text-[#3d2b32] dark:text-[#f8edf1]">
                      {product.name || copy.unknownProduct}
                    </h4>
                    {Array.isArray(product.whyPicked) && product.whyPicked.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 text-sm leading-6 text-[#6f4d58] dark:text-[#e8d5dc]">
                        {product.whyPicked.slice(0, 3).map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    ) : null}
                    {product.cautionNote ? (
                      <p className="mt-3 rounded-lg bg-[#fff4ef] px-3 py-2 text-xs leading-5 text-[#855342] dark:bg-[#3b2825] dark:text-[#efc3b4]">
                        {copy.caution}: {product.cautionNote}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[1rem] border border-dashed border-[#dfc8cf] bg-white/55 px-4 py-4 dark:border-[#543744] dark:bg-[#2a1c23]">
              <p className="text-sm font-semibold text-[#5f434d] dark:text-[#f0dce3]">
                {copy.emptyTitle}
              </p>
              <p className="ui-text-secondary mt-1 text-sm leading-6">{copy.emptyBody}</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
