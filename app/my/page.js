import { redirect } from "next/navigation";
import MyDashboard from "@/components/my/MyDashboard";
import { getMyDashboardPayload } from "@/lib/my/dashboard";
import { getMyCopy } from "@/lib/my/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: getMyCopy("ko").metadata.title
};

export async function MyPageContent({ locale = "ko" } = {}) {
  const copy = getMyCopy(locale);
  const result = await getMyDashboardPayload();

  if (result.status === 401) {
    redirect(copy.paths.home);
  }

  if (result.status !== 200) {
    return (
      <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center">
          <div className="ui-card w-full p-6 text-center sm:p-8">
            <p className="ui-kicker">{copy.pageError.kicker}</p>
            <h1 className="ui-title mt-3 text-2xl">{copy.pageError.title}</h1>
            <p className="ui-text-secondary mt-3 text-sm leading-6">
              {copy.pageError.body}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return <MyDashboard dashboard={result.payload} locale={locale} />;
}

export default async function MyPage() {
  return <MyPageContent locale="ko" />;
}
