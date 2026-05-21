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
    return null;
  }

  return (
    <section className="ui-card-subtle p-5">
      <p className="ui-kicker">Saved Report</p>
      <h2 className="ui-title mt-2 text-lg">최근 저장 리포트</h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="ui-chip-compact">{report.report_type || "report"}</span>
        {report.report_version ? (
          <span className="ui-chip-compact">{report.report_version}</span>
        ) : null}
      </div>
      <p className="ui-text-primary mt-3 text-sm font-semibold">
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
        먼저 무료 진단을 진행해 주세요.
      </p>
      <Link href="/" className="ui-button-primary mt-6 min-h-11 px-5 text-sm font-semibold">
        무료 진단 시작하기
      </Link>
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
    <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-kicker">Bejewely Revisit</p>
            <h1 className="ui-title mt-2 text-3xl sm:text-4xl">My Skin Dashboard</h1>
          </div>
          <Link href="/api/auth/signout" className="ui-button-secondary min-h-10 px-4 text-sm font-semibold">
            로그아웃
          </Link>
        </header>

        <div className="mt-8">
          {!hasProfile ? (
            <EmptyProfileState />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-5">
                <SkinProfileSummaryCard profile={latestSkinProfile} />
                <LatestSavedReport report={latestSavedReport} />
              </div>
              <div className="space-y-5">
                {needsCheckIn ? (
                  <TodayCheckInPrompt />
                ) : todayCheckin && todayRoutine ? (
                  <TodayRoutineCard checkin={todayCheckin} routine={todayRoutine} />
                ) : todayCheckin ? (
                  <section className="ui-card p-5">
                    <p className="ui-kicker">Today</p>
                    <h2 className="ui-title mt-2 text-xl">오늘 체크인이 저장되었습니다.</h2>
                    <p className="ui-text-secondary mt-3 text-sm leading-6">
                      오늘 루틴 카드는 체크인 루틴 생성 단계에서 표시됩니다.
                    </p>
                  </section>
                ) : (
                  <TodayCheckInPrompt />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
