import Link from "next/link";
import { notFound } from "next/navigation";
import ResultShareCard from "@/components/result/ResultShareCard";
import { getShareCopy, normalizeStoredAnalysisResult } from "@/lib/analysis-results";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function getSharedResult(shareId) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("share_id", shareId)
    .eq("is_public", true)
    .single();

  if (error || !data) {
    return null;
  }

  return normalizeStoredAnalysisResult(data);
}

export default async function SharedResultPage({ params }) {
  const result = await getSharedResult(params?.shareId);

  if (!result) {
    notFound();
  }

  const copy = getShareCopy(result.locale);
  const homePath = result.locale === "en" ? "/en" : "/";

  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-6 sm:px-6">
        <div className="space-y-4">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="ui-kicker">Shared Result</p>
              <h1 className="ui-title mt-2 text-xl sm:text-2xl">{copy.title}</h1>
            </div>
            <Link href={homePath} className="ui-button-secondary px-4 py-2.5 text-xs font-medium">
              {copy.backHome}
            </Link>
          </header>

          <ResultShareCard
            locale={result.locale}
            skinType={result.skinType}
            mainConcerns={result.mainConcerns}
            summary={result.summary}
            topPick={result.topPick}
            categoryPicks={result.categoryPicks}
            routineAm={result.routineAm}
            routinePm={result.routinePm}
          />
        </div>
      </div>
    </main>
  );
}
