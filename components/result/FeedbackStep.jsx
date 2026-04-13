import Link from "next/link";

export default function FeedbackStep({
  copy,
  question,
  questionIndex,
  questionTotal,
  yesLabel,
  noLabel,
  onAnswer,
  isComplete,
  retryHref,
  homeHref
}) {
  if (isComplete) {
    return (
      <section className="space-y-4">
        <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 text-center shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
            {copy.feedbackStepKicker}
          </p>
          <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-ink">
            {copy.feedbackThanksTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-black/62">
            {copy.feedbackThanksBody}
          </p>
        </div>

        <div className="grid gap-3">
          <Link
            href={homeHref}
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#1f1811] px-5 text-sm font-semibold text-white transition hover:bg-black"
          >
            {copy.backHome}
          </Link>
          <Link
            href={retryHref}
            className="inline-flex min-h-14 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black/68 transition hover:border-black/20 hover:bg-black/5"
          >
            {copy.tryAgain}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.feedbackStepKicker}
        </p>
        <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-ink">
          {copy.feedbackStepTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-black/62">
          {copy.feedbackSubtitle}
        </p>
      </div>

      <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/38">
          {copy.feedbackQuestionLabel} {questionIndex + 1} / {questionTotal}
        </p>
        <p className="mt-3 text-xl font-semibold leading-8 tracking-tight text-ink">
          {question?.text}
        </p>

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => onAnswer(yesLabel)}
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#1f1811] px-5 text-sm font-semibold text-white transition hover:bg-black"
          >
            {yesLabel}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(noLabel)}
            className="inline-flex min-h-14 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black/68 transition hover:border-black/20 hover:bg-black/5"
          >
            {noLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
