import Link from "next/link";

export default function TodayCheckInPrompt() {
  return (
    <section className="ui-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="ui-kicker">Today Check-in</p>
          <h2 className="ui-title mt-2 text-2xl sm:text-3xl">오늘 피부 상태 체크</h2>
          <p className="ui-text-secondary mt-3 text-sm leading-6">
            건조함, 유분감, 붉어짐을 짧게 기록하면 오늘 루틴이 바로 정리됩니다.
          </p>
        </div>
        <Link href="/my/check-in" className="ui-button-primary min-h-11 w-full px-5 text-sm font-semibold sm:w-auto">
          오늘 피부 체크하기
        </Link>
      </div>
    </section>
  );
}
