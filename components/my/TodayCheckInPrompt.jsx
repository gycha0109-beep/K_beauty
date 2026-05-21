import Link from "next/link";

export default function TodayCheckInPrompt() {
  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">Today</p>
      <h2 className="ui-title mt-2 text-xl">오늘 피부 상태를 체크하고 루틴을 조정해보세요.</h2>
      <p className="ui-text-secondary mt-3 text-sm leading-6">
        체크인 후 오늘의 AM/PM 루틴 카드가 이곳에 표시됩니다.
      </p>
      <Link href="/my/check-in" className="ui-button-primary mt-5 min-h-11 px-5 text-sm font-semibold">
        오늘 피부 체크하기
      </Link>
    </section>
  );
}
