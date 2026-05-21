import { redirect } from "next/navigation";
import MyDashboard from "@/components/my/MyDashboard";
import { getMyDashboardPayload } from "@/lib/my/dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Skin Dashboard"
};

export default async function MyPage() {
  const result = await getMyDashboardPayload();

  if (result.status === 401) {
    redirect("/");
  }

  if (result.status !== 200) {
    return (
      <main className="ui-page-shell min-h-screen px-4 py-8 sm:px-6">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center">
          <div className="ui-card w-full p-6 text-center sm:p-8">
            <p className="ui-kicker">My Skin</p>
            <h1 className="ui-title mt-3 text-2xl">대시보드를 불러오지 못했습니다.</h1>
            <p className="ui-text-secondary mt-3 text-sm leading-6">
              잠시 후 다시 시도해 주세요.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return <MyDashboard dashboard={result.payload} />;
}
