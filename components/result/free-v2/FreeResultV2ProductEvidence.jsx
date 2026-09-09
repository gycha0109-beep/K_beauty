import { FreeResultV2Card } from "@/components/result/free-v2/FreeResultV2Primitives";
import { buildFreeResultV2ProductEvidenceItems } from "@/lib/free-result-v2-product-evidence";

function EvidenceDot({ tone }) {
  const className =
    tone === "mixed"
      ? "bg-amber-400/80"
      : tone === "supported"
        ? "bg-[#e6507a]/80"
        : "bg-[#b79aa3]/80";

  return <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${className}`} aria-hidden="true" />;
}

export default function FreeResultV2ProductEvidence({ entries, locale = "ko" }) {
  const isEnglish = locale === "en";
  const items = buildFreeResultV2ProductEvidenceItems(entries, locale);

  if (!items.length) return null;

  return (
    <FreeResultV2Card className="border-[#ead9d6]/90 bg-white/34 dark:border-[#5a3a48] dark:bg-[#2a1b24]/72">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#26101a] dark:text-[#fff8f3]">
              {isEnglish ? "Why we see it this way" : "왜 이렇게 봤어요?"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
              {isEnglish
                ? "Only product signals with traceable evidence are shown here."
                : "확인 가능한 제품 근거가 연결된 항목만 보여드려요."}
            </p>
          </div>
          <span className="shrink-0 text-lg leading-none text-[#a06b7a] transition-transform group-open:rotate-180 dark:text-[#d5a8b5]" aria-hidden="true">
            ⌄
          </span>
        </summary>

        <div className="mt-4 divide-y divide-[#ead9d6]/80 border-t border-[#ead9d6]/80 dark:divide-[#5a3a48] dark:border-[#5a3a48]">
          {items.map((item) => (
            <div key={item.featureKey} className="grid gap-1.5 py-3.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
              <p className="text-xs font-semibold text-[#7a5360] dark:text-[#c8aeb8]">{item.featureLabel}</p>
              <div className="min-w-0">
                <p className="break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item.valueLabel}</p>
                <div className="mt-1.5 flex items-start gap-2">
                  <EvidenceDot tone={item.tone} />
                  <p className="break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{item.evidenceCopy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </details>
    </FreeResultV2Card>
  );
}
