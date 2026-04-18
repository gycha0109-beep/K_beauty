export default function TipsStep({
  copy,
  cautions,
  insightDescription,
  feedbackQuestions = [],
  currentFeedbackIndex = 0,
  feedback = {},
  feedbackComplete = false,
  yesLabel,
  noLabel,
  onAnswer
}) {
  const items = cautions.filter(Boolean).slice(0, 5);
  const visibleQuestions = feedbackComplete
    ? feedbackQuestions
    : feedbackQuestions.slice(0, Math.min(currentFeedbackIndex + 1, feedbackQuestions.length));

  return (
    <section className="space-y-4">
      <div className="ui-card p-6">
        <p className="ui-kicker">{copy.tipsStepKicker}</p>
        <h2 className="ui-title mt-2 text-[1.75rem] sm:text-[1.9rem]">{copy.tipsStepTitle}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.notesSubtitle}</p>
      </div>

      <div className="space-y-2.5">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="ui-card p-5"
          >
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item}</p>
          </div>
        ))}

        {insightDescription ? (
          <div className="ui-panel-accent p-5 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{copy.skinNote}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{insightDescription}</p>
          </div>
        ) : null}

        {!items.length && !insightDescription ? (
          <div className="ui-card p-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {copy.tipsStepEmpty}
          </div>
        ) : null}

        {feedbackQuestions.length ? (
          <div className="ui-card p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.quickFeedback}</p>
              <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">{copy.feedbackSubtitle}</p>
            </div>

            <div className="mt-4 space-y-3">
              {visibleQuestions.map((question, index) => {
                const answer = feedback[question.id];
                const isCurrent = !feedbackComplete && index === currentFeedbackIndex;
                const isAnswered = Boolean(answer);

                return (
                  <div
                    key={question.id}
                    className="rounded-[1.2rem] bg-zinc-50 px-4 py-3 dark:bg-zinc-800/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{question.text}</p>
                      {isAnswered && !isCurrent ? (
                        <span className="ui-chip-compact">
                          {answer}
                        </span>
                      ) : null}
                    </div>

                    {isCurrent ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onAnswer?.(yesLabel)}
                          className="ui-button-primary px-3.5 py-1.5 text-xs font-semibold"
                        >
                          {yesLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => onAnswer?.(noLabel)}
                          className="ui-button-secondary px-3.5 py-1.5 text-xs font-medium"
                        >
                          {noLabel}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {feedbackComplete ? (
              <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {copy.feedbackThanksTitle}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
