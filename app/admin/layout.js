import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminNavigation from "@/app/admin/AdminNavigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

function getRoleLabel(role) {
  const labels = {
    admin_viewer: "Viewer",
    admin_operator: "Operator",
    admin_privacy: "Privacy",
    admin_owner: "Owner"
  };

  return labels[role] || "Admin";
}

export default async function AdminLayout({ children }) {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.DASHBOARD_READ);

  if (!access.authenticated || !access.accountUser) {
    redirect("/?auth_required=admin");
  }

  if (!access.allowed) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#16181d] dark:bg-[#0d0f13] dark:text-[#f5f7fa]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-[#dde1e7] bg-white px-5 py-5 dark:border-[#2b3038] dark:bg-[#14171c] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4 lg:block">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#777f8c]">
                Bejewely
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">Admin</h1>
            </div>
            <span className="rounded-full border border-[#d9dde4] bg-[#f7f8fa] px-3 py-1 text-xs font-semibold text-[#4e5663] dark:border-[#343a44] dark:bg-[#1d2128] dark:text-[#c8ced8]">
              {getRoleLabel(access.role)}
            </span>
          </div>

          <AdminNavigation />
        </aside>

        <div className="min-w-0">
          <header className="flex min-h-16 items-center justify-between border-b border-[#dde1e7] bg-white px-5 py-3 dark:border-[#2b3038] dark:bg-[#14171c] sm:px-8">
            <div>
              <p className="text-xs font-semibold text-[#737b87]">Operations console</p>
              <p className="text-sm font-medium">권한 검증이 완료된 관리자 세션</p>
            </div>
            <Link
              href="/"
              className="rounded-full border border-[#d9dde4] px-4 py-2 text-sm font-semibold transition hover:bg-[#f2f4f7] dark:border-[#343a44] dark:hover:bg-[#20242b]"
            >
              서비스로 이동
            </Link>
          </header>

          <main className="px-5 py-7 sm:px-8 sm:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
