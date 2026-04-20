export default function PremiumReportCard({ copy, locale = "ko" }) {
  const premiumGroups = locale === "en"
    ? [
        {
          label: "Skin Match full report",
          items: [
            "Full morning and night routine",
            "Supporting product picks",
            "What combinations to avoid"
          ]
        },
        {
          label: "Face Lab extended report",
          items: [
            "Hair direction for your face shape",
            "Curated color palette",
            "Styling application tips"
          ]
        }
      ]
    : [
        {
          label: "Skin Match 전체 리포트",
          items: [
            "아침/저녁 전체 루틴",
            "함께 보면 좋은 추천 전체",
            "피해야 할 조합"
          ]
        },
        {
          label: "Face Lab 확장 리포트",
          items: [
            "얼굴형에 맞는 헤어 방향",
            "컬러 팔레트",
            "스타일 활용 팁"
          ]
        }
      ];

  return (
    <section className="ui-card p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="ui-kicker">{copy.premiumCardKicker}</p>
          <h3 className="ui-title text-[1.45rem] leading-tight sm:text-[1.6rem]">{copy.premiumCardTitle}</h3>
          <p className="ui-text-secondary text-sm leading-6">{copy.premiumCardBody}</p>
        </div>

        <div className="grid gap-3">
          {premiumGroups.map((group) => (
            <div key={group.label} className="ui-card-muted rounded-[1.4rem] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {group.label}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span key={`${group.label}-${item}`} className="ui-chip-compact px-3 py-1.5">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ui-button-primary min-h-14 w-full px-5 text-sm font-semibold"
        >
          {copy.premiumCardButton}
        </button>
      </div>
    </section>
  );
}
