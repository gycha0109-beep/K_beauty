export default function TopPickStep({
  copy,
  tabs = [],
  activeTab,
  onTabChange,
  premiumCard = null
}) {
  const selectedTab = tabs.find((tab) => tab.id === activeTab) || tabs[0] || null;

  return (
    <section className="space-y-4">
      <div className="ui-card p-6">
        <p className="ui-kicker">{copy.topPickStepKicker}</p>
        <h2 className="ui-title mt-2 text-[2rem]">{copy.topPickStepTitle}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.topPickStepBody}</p>

        {tabs.length ? (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedTab?.id === tab.id
                    ? "ui-choice-active"
                    : "ui-button-secondary-soft"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {selectedTab?.content}
      {premiumCard}
    </section>
  );
}
