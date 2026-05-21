import Link from "next/link";
import SkinProfileSummaryCard from "@/components/my/SkinProfileSummaryCard";
import TodayCheckInPrompt from "@/components/my/TodayCheckInPrompt";
import TodayRoutineCard from "@/components/my/TodayRoutineCard";

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function LatestSavedReport({ report }) {
  if (!report) {
    return (
      <section className="rounded-[1.1rem] border border-[#ead2ca] bg-white/55 p-4 dark:border-[#3a2630] dark:bg-[#2f202a]/70">
        <p className="ui-kicker">Saved Report</p>
        <p className="ui-text-secondary mt-2 text-sm">아직 저장된 리포트가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.1rem] border border-[#ead2ca] bg-white/55 p-4 dark:border-[#3a2630] dark:bg-[#2f202a]/70">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ui-kicker">Saved Report</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="ui-chip-compact">{report.report_type || "report"}</span>
          {report.report_version ? (
            <span className="ui-chip-compact">{report.report_version}</span>
          ) : null}
        </div>
      </div>
      <p className="ui-text-primary mt-3 truncate text-sm font-semibold">
        {report.title || "저장된 피부 리포트"}
      </p>
      {report.created_at ? (
        <p className="ui-text-faint mt-1 text-xs">{formatDate(report.created_at)}</p>
      ) : null}
    </section>
  );
}

function EmptyProfileState() {
  return (
    <section className="ui-card mx-auto w-full max-w-2xl p-6 text-center sm:p-8">
      <p className="ui-kicker">My Skin</p>
      <h1 className="ui-title mt-3 text-2xl sm:text-3xl">
        아직 저장된 피부 프로필이 없습니다.
      </h1>
      <p className="ui-text-secondary mt-3 text-sm leading-6">
        먼저 무료 진단을 진행하면 이곳에서 오늘 체크와 루틴을 이어갈 수 있습니다.
      </p>
      <Link href="/" className="ui-button-primary mt-6 min-h-11 w-full px-5 text-sm font-semibold sm:w-auto">
        무료 진단 시작하기
      </Link>
    </section>
  );
}

function TodayCheckInDone({ checkin }) {
  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ui-kicker">Today Check-in</p>
          <h2 className="ui-title mt-1 text-lg">오늘 피부 상태 체크 완료</h2>
          {checkin?.checkin_date ? (
            <p className="ui-text-faint mt-1 text-xs">{formatDate(checkin.checkin_date)}</p>
          ) : null}
        </div>
        <Link href="/my/check-in" className="ui-button-secondary min-h-10 w-full px-4 text-sm font-semibold sm:w-auto">
          다시 체크하기
        </Link>
      </div>
    </section>
  );
}

function RoutinePendingNotice() {
  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26]">
      <p className="ui-kicker">Today Routine</p>
      <h2 className="ui-title mt-1 text-lg">오늘 체크인은 저장되었습니다.</h2>
      <p className="ui-text-secondary mt-2 text-sm leading-6">
        루틴 카드가 아직 없으면 잠시 후 다시 확인해 주세요.
      </p>
    </section>
  );
}

export default function MyDashboard({ dashboard }) {
  const {
    latestSkinProfile,
    todayCheckin,
    todayRoutine,
    latestSavedReport,
    hasProfile,
    needsCheckIn
  } = dashboard;

  return (
    <main className="ui-page-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-kicker">Bejewely Revisit</p>
            <h1 className="ui-title mt-2 text-3xl sm:text-4xl">My Skin</h1>
            <p className="ui-text-secondary mt-2 text-sm leading-6">
              오늘 상태를 먼저 보고, 필요한 루틴만 빠르게 확인합니다.
            </p>
          </div>
          <Link href="/api/auth/signout" className="ui-button-secondary min-h-10 w-full px-4 text-sm font-semibold sm:w-auto">
            로그아웃
          </Link>
        </header>

        <div className="mt-6 sm:mt-8">
          {!hasProfile ? (
            <EmptyProfileState />
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {needsCheckIn ? (
                <TodayCheckInPrompt />
              ) : (
                <TodayCheckInDone checkin={todayCheckin} />
              )}

              {todayRoutine ? (
                <TodayRoutineCard routine={todayRoutine} />
              ) : todayCheckin ? (
                <RoutinePendingNotice />
              ) : null}

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.52fr)]">
                <SkinProfileSummaryCard profile={latestSkinProfile} />
                <LatestSavedReport report={latestSavedReport} />
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
