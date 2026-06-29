import Link from "next/link";
import { redirect } from "next/navigation";
import DailyCheckInForm from "@/components/my/DailyCheckInForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyCopy } from "@/lib/my/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: getMyCopy("ko").metadata.checkInTitle
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

const DAILY_CHECKIN_COLUMNS = [
  "id",
  "user_id",
  "skin_profile_id",
  "checkin_date",
  "dryness_level",
  "oiliness_level",
  "redness_level",
  "breakout_level",
  "irritation_level",
  "makeup_today",
  "outdoor_today",
  "memo",
  "context",
  "created_at",
  "updated_at"
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

async function getLatestCheckin(supabase, userId) {
  const { data, error } = await supabase
    .from("daily_checkins")
    .select(DAILY_CHECKIN_COLUMNS)
    .eq("user_id", userId)
    .order("checkin_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

function NoProfileState({ copy }) {
  return (
    <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
      <section className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <div className="ui-card w-full p-6 text-center sm:p-8">
          <p className="ui-kicker">{copy.checkInPage.noProfile.kicker}</p>
          <h1 className="ui-title mt-3 text-2xl">{copy.checkInPage.noProfile.title}</h1>
          <p className="ui-text-secondary mt-3 text-sm leading-6">
            {copy.checkInPage.noProfile.body}
          </p>
          <Link href={copy.paths.my} className="ui-button-primary mt-6 min-h-11 px-5 text-sm font-semibold">
            {copy.checkInPage.noProfile.back}
          </Link>
        </div>
      </section>
    </main>
  );
}

export async function CheckInPageContent({ locale = "ko" } = {}) {
  const copy = getMyCopy(locale);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(copy.paths.home);
  }

  try {
    const skinProfile = await getActiveSkinProfile(supabase, user.id);

    if (!skinProfile) {
      return <NoProfileState copy={copy} />;
    }

    const latestCheckin = await getLatestCheckin(supabase, user.id);

    return (
      <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <header className="mb-6">
            <Link href={copy.paths.my} className="ui-button-secondary min-h-10 px-4 text-sm font-semibold">
              {copy.checkInPage.header.back}
            </Link>
            <p className="ui-kicker mt-6">{copy.checkInPage.header.kicker}</p>
            <h1 className="ui-title mt-2 text-3xl sm:text-4xl">{copy.checkInPage.header.title}</h1>
            <p className="ui-text-secondary mt-3 text-sm leading-6">
              {copy.checkInPage.header.body}
            </p>
          </header>
          <DailyCheckInForm skinProfile={skinProfile} initialCheckin={latestCheckin} locale={locale} />
        </div>
      </main>
    );
  } catch (error) {
    console.error("[my/check-in] failed to load page", error);

    return (
      <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
          <div className="ui-card w-full p-6 text-center sm:p-8">
            <p className="ui-kicker">{copy.checkInPage.error.kicker}</p>
            <h1 className="ui-title mt-3 text-2xl">{copy.checkInPage.error.title}</h1>
            <p className="ui-text-secondary mt-3 text-sm leading-6">
              {copy.checkInPage.error.body}
            </p>
            <Link href={copy.paths.my} className="ui-button-primary mt-6 min-h-11 px-5 text-sm font-semibold">
              {copy.checkInPage.error.back}
            </Link>
          </div>
        </section>
      </main>
    );
  }
}

export default async function CheckInPage() {
  return <CheckInPageContent locale="ko" />;
}
