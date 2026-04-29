export default function PremiumReportCard({ copy }) {
  return (
    <section className="ui-card p-5">
      <div className="space-y-3">
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {copy.premiumCardBody}
        </p>
      </div>
    </section>
  );
}
