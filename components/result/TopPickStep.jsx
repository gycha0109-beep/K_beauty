export default function TopPickStep({
  copy,
  children,
  premiumCard = null,
  afterPremium = null
}) {
  return (
    <section className="space-y-4">
      <div className="ui-card p-6">
        <p className="ui-kicker">{copy.topPickStepKicker}</p>
        <h2 className="ui-title mt-2 text-[2rem]">{copy.topPickStepTitle}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.topPickStepBody}</p>
      </div>

      {children}
      {afterPremium}
      {premiumCard}
    </section>
  );
}
