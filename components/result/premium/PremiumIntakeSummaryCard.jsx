const DECISION_LABELS = {
  ko: {
    current_product_fit: "현재 제품 유지·조정 판단",
    routine_order: "아침·저녁 사용 순서",
    functional_addition: "기능성 추가 가능 여부",
    condition_response: "예민·트러블 때 조정 방법",
    unknown: "선택하지 않음"
  },
  en: {
    current_product_fit: "Keep or adjust current products",
    routine_order: "AM / PM usage order",
    functional_addition: "Whether to add an active",
    condition_response: "How to adjust when skin reacts",
    unknown: "Not selected"
  }
};

const ANSWER_LABELS = {
  ko: {
    yes: "예",
    no: "아니오",
    unknown: "잘 모르겠음"
  },
  en: {
    yes: "Yes",
    no: "No",
    unknown: "Not sure"
  }
};

export default function PremiumIntakeSummaryCard({ intake, locale = "ko" }) {
  if (!intake || typeof intake !== "object") {
    return null;
  }

  const lang = locale === "en" ? "en" : "ko";
  const decision = DECISION_LABELS[lang][intake.decisionFocus] || DECISION_LABELS[lang].unknown;
  const changed = ANSWER_LABELS[lang][intake?.answers?.recentlyChangedProduct] || ANSWER_LABELS[lang].unknown;
  const reaction = ANSWER_LABELS[lang][intake?.answers?.productReaction] || ANSWER_LABELS[lang].unknown;

  return (
    <section className="rounded-[1rem] border border-[#ead8cf] bg-[#fff8f3] p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="ui-kicker">{lang === "en" ? "PREMIUM INTAKE" : "추가 입력 반영"}</p>
      <h3 className="mt-2 text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
        {lang === "en" ? "What you asked this report to decide" : "이번 리포트에서 받고 싶은 판단"}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#7a253f] dark:text-[#ffd7df]">
        {decision}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[0.85rem] border border-[#ead8cf] bg-white/55 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            {lang === "en" ? "Recent product change" : "최근 제품·루틴 변경"}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{changed}</p>
        </div>
        <div className="rounded-[0.85rem] border border-[#ead8cf] bg-white/55 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            {lang === "en" ? "Recent reaction" : "최근 불편 반응"}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{reaction}</p>
        </div>
      </div>
    </section>
  );
}
