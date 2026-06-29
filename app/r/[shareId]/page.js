import Link from "next/link";
import { notFound } from "next/navigation";
import ResultShareCard from "@/components/result/ResultShareCard";
import {
  getConcernLabels,
  getShareCopy,
  getShareLocale,
  getSkinTypeLabel
} from "@/lib/analysis-results";
import { getAnalysisResultForShare } from "@/lib/analysis-result-access";

const BRAND_TITLE = "Be jewely";
const DEFAULT_OG_IMAGE = "/opengraph-image.png";
const DEFAULT_TWITTER_IMAGE = "/twitter-image.png";

async function getResolvedParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function getSharedResult(shareId) {
  return getAnalysisResultForShare({ shareId });
}

function compactMetadataText(value, maxLength = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function buildSharedResultTitle(locale = "ko") {
  return locale === "en"
    ? `My skin analysis result | ${BRAND_TITLE}`
    : `내 피부 타입 분석 결과 | ${BRAND_TITLE}`;
}

function getFallbackDescription(locale = "ko") {
  return locale === "en"
    ? "A saved K-beauty skin analysis result built from one photo and a short survey."
    : "사진 한 장과 짧은 설문으로 정리한 K-뷰티 피부 분석 결과입니다.";
}

function buildSharedResultDescription(result) {
  const locale = getShareLocale(result?.locale);

  if (!result) {
    return getFallbackDescription(locale);
  }

  const skinType = getSkinTypeLabel(result.skinType, locale);
  const concerns = getConcernLabels(result.mainConcerns, locale)
    .slice(0, 3)
    .join(locale === "en" ? ", " : ", ");
  const topPickName = String(result.topPick?.name || "").trim();
  const summary = compactMetadataText(result.summary, 80);
  const segments = [];

  if (skinType && skinType !== "-") {
    segments.push(locale === "en" ? `Skin type: ${skinType}` : `피부 타입: ${skinType}`);
  }

  if (concerns) {
    segments.push(locale === "en" ? `Concerns: ${concerns}` : `주요 고민: ${concerns}`);
  }

  if (topPickName) {
    segments.push(`Top Pick: ${topPickName}`);
  }

  if (summary) {
    segments.push(summary);
  }

  return compactMetadataText(
    segments.join(" | ") || getFallbackDescription(locale),
    155
  );
}

function buildSharedResultMetadata({ shareId, result }) {
  const locale = getShareLocale(result?.locale);
  const title = buildSharedResultTitle(locale);
  const description = buildSharedResultDescription(result);
  const sharePath = shareId ? `/r/${shareId}` : "/";

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false
    },
    openGraph: {
      title,
      description,
      url: sharePath,
      siteName: BRAND_TITLE,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: BRAND_TITLE
        }
      ],
      locale: locale === "en" ? "en_US" : "ko_KR",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_TWITTER_IMAGE]
    }
  };
}

export async function generateMetadata({ params }) {
  const resolvedParams = await getResolvedParams(params);
  const shareId = resolvedParams?.shareId;
  const result = await getSharedResult(shareId);

  return buildSharedResultMetadata({ shareId, result });
}

export default async function SharedResultPage({ params }) {
  const resolvedParams = await getResolvedParams(params);
  const result = await getSharedResult(resolvedParams?.shareId);

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
            routineStructure={result.routineStructure}
            routineAm={result.routineAm}
            routinePm={result.routinePm}
          />
        </div>
      </div>
    </main>
  );
}
