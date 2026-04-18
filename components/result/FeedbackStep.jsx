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
        <div className="ui-card p-6 text-center">
          <p className="ui-kicker">{copy.feedbackStepKicker}</p>
          <h2 className="ui-title mt-2 text-[2rem]">{copy.feedbackThanksTitle}</h2>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.feedbackThanksBody}</p>
        </div>

        <div className="grid gap-3">
          <Link
            href={homeHref}
            className="ui-button-primary min-h-14 px-5 text-sm font-semibold"
          >
            {copy.backHome}
          </Link>
          <Link
            href={retryHref}
            className="ui-button-secondary min-h-14 px-5 text-sm font-medium"
          >
            {copy.tryAgain}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="ui-card p-6">
        <p className="ui-kicker">{copy.feedbackStepKicker}</p>
        <h2 className="ui-title mt-2 text-[2rem]">{copy.feedbackStepTitle}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.feedbackSubtitle}</p>
      </div>

      <div className="ui-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {copy.feedbackQuestionLabel} {questionIndex + 1} / {questionTotal}
        </p>
        <p className="mt-3 text-xl font-semibold leading-8 tracking-tight text-zinc-900 dark:text-zinc-100">
          {question?.text}
        </p>

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => onAnswer(yesLabel)}
            className="ui-button-primary min-h-14 px-5 text-sm font-semibold"
          >
            {yesLabel}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(noLabel)}
            className="ui-button-secondary min-h-14 px-5 text-sm font-medium"
          >
            {noLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
