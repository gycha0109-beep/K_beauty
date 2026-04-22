export default function PremiumReportCard({
  copy,
  locale = "ko",
  premiumReport = null,
  faceLabPaid = null,
  onCtaClick
}) {
  const supportingCount = Array.isArray(premiumReport?.supportingProducts)
    ? premiumReport.supportingProducts.length
    : 0;
  const budgetCount = Array.isArray(premiumReport?.budgetAlternatives)
    ? premiumReport.budgetAlternatives.length
    : 0;
  const hasFaceLabPaid =
    Boolean(faceLabPaid?.hairDirection?.length) ||
    Boolean(faceLabPaid?.avoidStyles?.length) ||
    Boolean(faceLabPaid?.colorPalette?.length) ||
    Boolean(faceLabPaid?.vibeKeywords?.length);

  const premiumGroups = locale === "en"
    ? [
        {
          label: "Skin Match practical build",
          items: [
            "Top Pick reasoning you can actually follow",
            `${Math.max(2, supportingCount || 2)} supporting product directions`,
            "Full morning and night guidance",
            "Avoid combinations to skip"
          ]
        },
        {
          label: "Launch report extras",
          items: [
            budgetCount ? `${budgetCount} budget alternative lanes` : "Budget alternative lanes",
            hasFaceLabPaid ? "Face Lab hair, avoid-style, palette, and vibe guidance" : "Face Lab style guidance",
            "A report structured around real use, not just browsing"
          ]
        }
      ]
    : [
        {
          label: "Skin Match 실사용 구성",
          items: [
            "Top Pick을 왜 이렇게 써야 하는지 정리",
            `${Math.max(2, supportingCount || 2)}개 보조 제품 방향`,
            "아침 · 저녁 전체 사용 가이드",
            "같이 피해야 할 조합 정리"
          ]
        },
        {
          label: "Launch 보고서 확장",
          items: [
            budgetCount ? `${budgetCount}개 예산 대안 방향` : "예산 대안 방향",
            hasFaceLabPaid ? "Face Lab 헤어 방향 · 피할 스타일 · 팔레트 · 분위기 키워드" : "Face Lab 스타일 확장 가이드",
            "구경용이 아니라 실제 사용 기준으로 정리"
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
          onClick={onCtaClick}
          className="ui-button-primary min-h-14 w-full px-5 text-sm font-semibold"
        >
          {copy.premiumCardButton}
        </button>
      </div>
    </section>
  );
}
