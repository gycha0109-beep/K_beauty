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
      <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.tipsStepKicker}
        </p>
        <h2 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-ink sm:text-[1.9rem]">
          {copy.tipsStepTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-black/62">
          {copy.notesSubtitle}
        </p>
      </div>

      <div className="space-y-2.5">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="rounded-[1.55rem] border border-black/5 bg-white/88 p-5 shadow-soft"
          >
            <p className="text-sm leading-6 text-black/74">{item}</p>
          </div>
        ))}

        {insightDescription ? (
          <div className="rounded-[1.55rem] border border-black/5 bg-[linear-gradient(135deg,#f6efe7_0%,#fff9f2_100%)] p-5 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/38">
              {copy.skinNote}
            </p>
            <p className="mt-3 text-sm leading-6 text-black/72">{insightDescription}</p>
          </div>
        ) : null}

        {!items.length && !insightDescription ? (
          <div className="rounded-[1.7rem] border border-black/5 bg-white/88 p-5 text-sm leading-6 text-black/62 shadow-soft">
            {copy.tipsStepEmpty}
          </div>
        ) : null}

        {feedbackQuestions.length ? (
          <div className="rounded-[1.55rem] border border-black/5 bg-white/88 p-5 shadow-soft">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">{copy.quickFeedback}</p>
              <p className="text-xs leading-5 text-black/52">{copy.feedbackSubtitle}</p>
            </div>

            <div className="mt-4 space-y-3">
              {visibleQuestions.map((question, index) => {
                const answer = feedback[question.id];
                const isCurrent = !feedbackComplete && index === currentFeedbackIndex;
                const isAnswered = Boolean(answer);

                return (
                  <div
                    key={question.id}
                    className="rounded-[1.2rem] bg-[#faf6f0] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm leading-6 text-black/74">{question.text}</p>
                      {isAnswered && !isCurrent ? (
                        <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] font-medium text-black/56">
                          {answer}
                        </span>
                      ) : null}
                    </div>

                    {isCurrent ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onAnswer?.(yesLabel)}
                          className="rounded-full bg-[#1f1811] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
                        >
                          {yesLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => onAnswer?.(noLabel)}
                          className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-medium text-black/66 transition hover:border-black/20 hover:bg-black/5"
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
              <p className="mt-4 text-sm font-medium text-[#7d5724]">
                {copy.feedbackThanksTitle}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
