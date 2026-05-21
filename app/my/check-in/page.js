import Link from "next/link";
import { redirect } from "next/navigation";
import DailyCheckInForm from "@/components/my/DailyCheckInForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daily Check-in"
};

const SKIN_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "skin_type",
  "concerns",
  "sensitivity_level",
  "skin_summary",
  "face_summary",
  "is_active",
  "created_at"
].join(",");

async function getActiveSkinProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("skin_profiles")
    .select(SKIN_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

function NoProfileState() {
  return (
    <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
      <section className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <div className="ui-card w-full p-6 text-center sm:p-8">
          <p className="ui-kicker">Daily Check-in</p>
          <h1 className="ui-title mt-3 text-2xl">아직 저장된 피부 프로필이 없습니다.</h1>
          <p className="ui-text-secondary mt-3 text-sm leading-6">
            오늘 피부 체크는 피부 프로필 저장 후 사용할 수 있습니다.
          </p>
          <Link href="/my" className="ui-button-primary mt-6 min-h-11 px-5 text-sm font-semibold">
            My로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function CheckInPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/");
  }

  try {
    const skinProfile = await getActiveSkinProfile(supabase, user.id);

    if (!skinProfile) {
      return <NoProfileState />;
    }

    return (
      <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <header className="mb-6">
            <Link href="/my" className="ui-button-secondary min-h-10 px-4 text-sm font-semibold">
              My로 돌아가기
            </Link>
            <p className="ui-kicker mt-6">Daily Check-in</p>
            <h1 className="ui-title mt-2 text-3xl sm:text-4xl">오늘 피부 체크</h1>
            <p className="ui-text-secondary mt-3 text-sm leading-6">
              오늘 피부 상태를 저장하면 rule 기반 루틴 카드가 생성됩니다.
            </p>
          </header>
          <DailyCheckInForm skinProfile={skinProfile} />
        </div>
      </main>
    );
  } catch (error) {
    console.error("[my/check-in] failed to load page", error);

    return (
      <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
          <div className="ui-card w-full p-6 text-center sm:p-8">
            <p className="ui-kicker">Daily Check-in</p>
            <h1 className="ui-title mt-3 text-2xl">체크인 화면을 불러오지 못했습니다.</h1>
            <p className="ui-text-secondary mt-3 text-sm leading-6">
              잠시 후 다시 시도해 주세요.
            </p>
            <Link href="/my" className="ui-button-primary mt-6 min-h-11 px-5 text-sm font-semibold">
              My로 돌아가기
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
