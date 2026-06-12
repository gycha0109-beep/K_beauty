import Link from "next/link";
import { getMyCopy } from "@/lib/my/i18n";

export default function TodayCheckInPrompt({ copy = getMyCopy("ko") }) {
  return (
    <section className="ui-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="ui-kicker">{copy.checkInPrompt.kicker}</p>
          <h2 className="ui-title mt-2 text-2xl sm:text-3xl">{copy.checkInPrompt.title}</h2>
          <p className="ui-text-secondary mt-3 text-sm leading-6">
            {copy.checkInPrompt.body}
          </p>
        </div>
        <Link href={copy.paths.checkIn} className="ui-button-primary min-h-11 w-full px-5 text-sm font-semibold sm:w-auto">
          {copy.checkInPrompt.cta}
        </Link>
      </div>
    </section>
  );
}
