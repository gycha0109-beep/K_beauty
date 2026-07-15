"use client";

import { useEffect, useRef, useState } from "react";
import ResultShareCard from "@/components/result/ResultShareCard";
import { getShareCopy } from "@/lib/analysis-results";

function StateMessage({ title, message }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center" role="status">
      <h1 className="ui-title text-xl">{title}</h1>
      <p className="ui-text-secondary mt-3 text-sm">{message}</p>
      <a href="/" className="ui-button-secondary mt-6 inline-flex px-4 py-2.5 text-sm">Back to home</a>
    </div>
  );
}

export default function SharedResultLoader({ shareId }) {
  const requestRef = useRef(null);
  const requestKeyRef = useRef(null);
  const [state, setState] = useState({ status: "loading", result: null });

  useEffect(() => {
    let active = true;
    if (requestKeyRef.current !== shareId) {
      requestKeyRef.current = shareId;
      requestRef.current = fetch(`/api/results/${encodeURIComponent(shareId)}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin"
      }).then(async (response) => ({
        status: response.status,
        data: await response.json().catch(() => null)
      }));
    }

    requestRef.current.then(({ status, data }) => {
      if (!active) return;
      if (status === 200 && data?.success === true && data.result) {
        setState({ status: "success", result: data.result });
      } else if (status === 429) {
        setState({ status: "rate_limited", result: null });
      } else if (status === 503) {
        setState({ status: "unavailable", result: null });
      } else {
        setState({ status: "not_found", result: null });
      }
    }).catch(() => {
      if (active) setState({ status: "unavailable", result: null });
    });

    return () => { active = false; };
  }, [shareId]);

  if (state.status === "loading") return <StateMessage title="Loading result" message="Please wait." />;
  if (state.status === "not_found") return <StateMessage title="Result not found" message="This shared result is unavailable." />;
  if (state.status === "rate_limited") return <StateMessage title="Too many requests" message="Please wait before opening this result again." />;
  if (state.status === "unavailable") return <StateMessage title="Temporarily unavailable" message="Please try again later." />;

  const result = state.result;
  const copy = getShareCopy(result.locale);
  const homePath = result.locale === "en" ? "/en" : "/";
  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-6 sm:px-6">
        <div className="space-y-4">
          <header className="flex items-start justify-between gap-3">
            <div><p className="ui-kicker">Shared Result</p><h1 className="ui-title mt-2 text-xl sm:text-2xl">{copy.title}</h1></div>
            <a href={homePath} className="ui-button-secondary px-4 py-2.5 text-xs font-medium">{copy.backHome}</a>
          </header>
          <ResultShareCard
            locale={result.locale}
            skinType={result.skinType}
            mainConcerns={result.mainConcerns}
            summary={result.summary}
            topPick={result.topPick}
            categoryPicks={result.categoryPicks}
            routineStructure={result.routineStructure}
            routineAm={result.routineAm}
            routinePm={result.routinePm}
          />
        </div>
      </div>
    </main>
  );
}
